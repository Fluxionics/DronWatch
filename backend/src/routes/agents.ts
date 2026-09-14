import { Router, Response } from 'express'
import { createHash, randomBytes } from 'crypto'
import { supabase } from '../config/supabase'
import { requireAuth, forbidAgents, AuthenticatedRequest } from '../middleware/auth'
import { assertResourceLimit } from '../services/plans'

const router = Router()
router.use(requireAuth)

async function getAgent(req: AuthenticatedRequest, res: Response, id: string) {
  const { data, error } = await supabase.from('agents').select('*').eq('id', id).eq('user_id', req.user!.id).single()
  if (error || !data) { res.status(404).json({ error: 'Agent not found' }); return null }
  return data
}

router.get('/', forbidAgents, async (req: AuthenticatedRequest, res: Response) => {
  const { data, error } = await supabase.from('agents').select('*').eq('user_id', req.user!.id).order('created_at', { ascending: false })
  if (error) return res.status(500).json({ error: error.message })
  const withStats = await Promise.all((data || []).map(async agent => {
    const { data: stats } = await supabase.from('system_stats').select('*').eq('agent_id', agent.id).order('recorded_at', { ascending: false }).limit(1)
    return { ...agent, last_stats: stats?.[0] || null }
  }))
  res.json(withStats)
})

router.post('/', forbidAgents, async (req: AuthenticatedRequest, res: Response) => {
  const limit = await assertResourceLimit(req.user!.id, 'agents')
  if (!limit.ok) return res.status(402).json({ error: limit.error })
  const name = String(req.body?.name || '').trim().slice(0, 100)
  const platform = String(req.body?.platform || '').slice(0, 100)
  if (!name) return res.status(400).json({ error: 'name required' })
  const token = `ag_${randomBytes(32).toString('hex')}`
  const { data, error } = await supabase.from('agents').insert({ user_id: req.user!.id, name, platform, token_hash: createHash('sha256').update(token).digest('hex') }).select().single()
  if (error) return res.status(500).json({ error: error.message })
  res.status(201).json({ ...data, token })
})

router.get('/:id/script', forbidAgents, async (req: AuthenticatedRequest, res: Response) => {
  const agent = await getAgent(req, res, req.params.id)
  if (!agent) return
  const { data: user } = await supabase.from('users').select('username').eq('id', req.user!.id).single()
  const script = `#!/usr/bin/env node
// DronWatch agent 2.0 for ${agent.name} (${user?.username || 'user'})
// Required env: DW_AGENT_TOKEN=<token shown once on creation>
// Optional env: AGENT_API_URL (default: this server), DW_INTERVAL (seconds, default 30), DW_SERVICES="nginx:80,postgres:5432,redis:6379"
const https = require('https'), http = require('http'), os = require('os'), fs = require('fs'), net = require('net');
const HOST = (process.env.AGENT_API_URL || '${(process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '')}/api').replace(/\\/$/, '');
const AGENT_ID = '${agent.id}';
const AGENT_TOKEN = process.env.DW_AGENT_TOKEN || '';
const INTERVAL = Math.max(10, Number(process.env.DW_INTERVAL || 30)) * 1000;

function cpuUsage() { return new Promise(res => { try { const s = fs.readFileSync('/proc/stat', 'utf8').split('\\n')[0].split(/\\s+/).slice(1).map(Number); const t = s.reduce((a, b) => a + b, 0); setTimeout(() => { const s2 = fs.readFileSync('/proc/stat', 'utf8').split('\\n')[0].split(/\\s+/).slice(1).map(Number); const t2 = s2.reduce((a, b) => a + b, 0); const idle = s2[3] - s[3]; res(Math.round((1 - idle / Math.max(1, t2 - t)) * 1000) / 10); }, 50); } catch { res(0); } }); }
function linuxMetrics() {
  const out = { processes: 0, network_in: 0, network_out: 0 };
  try { out.processes = fs.readdirSync('/proc').filter(x => /^\\d+$/.test(x)).length; } catch {}
  try {
    const net = fs.readFileSync('/proc/net/dev', 'utf8');
    for (const line of net.split('\\n').slice(2)) {
      const m = line.match(/:\\s*(\\d+)\\s+\\d+\\s+\\d+\\s+\\d+\\s+\\d+\\s+\\d+\\s+\\d+\\s+\\d+\\s+(\\d+)/);
      if (m) { out.network_in += parseInt(m[1]); out.network_out += parseInt(m[2]); }
    }
  } catch {}
  return out;
}
function diskUsage() {
  try {
    const info = fs.statfsSync('/');
    const used = (info.blocks - info.bfree) * info.bsize;
    return Math.round((used / (info.blocks * info.bsize)) * 1000) / 10;
  } catch { return 0; }
}
function getTemperature() {
  try {
    for (const p of ['/sys/class/thermal/thermal_zone0/temp','/sys/class/thermal/thermal_zone1/temp']) {
      try { const v = parseInt(fs.readFileSync(p,'utf8').trim()); if (!isNaN(v)) return Math.round(v/100)/10; } catch {}
    }
  } catch {}
  return null;
}
function getDocker() {
  return new Promise(res => {
    const req = http.request({ socketPath: '/var/run/docker.sock', path: '/containers/json?all=1', method: 'GET' }, r => {
      let d=''; r.on('data',c=>d+=c); r.on('end',()=>{
        try { const arr=JSON.parse(d); res(arr.map(c=>({ name:(c.Names&&c.Names[0]||'').replace(/^\\//,''), image:c.Image, state:c.State, status:c.Status })))} catch { res([])}
      });
    });
    req.on('error',()=>res([])); req.setTimeout(1500,()=>{try{req.destroy()}catch{};res([])}); req.end();
  });
}
function probeService(host, port) {
  return new Promise(res=>{
    const s=net.createConnection({host, port, timeout:800},()=>{s.destroy();res(true)});
    s.on('error',()=>res(false)); s.on('timeout',()=>{s.destroy();res(false)});
  });
}
async function getServices() {
  const raw = process.env.DW_SERVICES || 'nginx:80,postgres:5432,redis:6379';
  const list = raw.split(',').map(s=>s.trim()).filter(Boolean).map(p=>{const [name,port]=p.split(':');return {name, port:parseInt(port)||80}});
  const out=[];
  for (const svc of list.slice(0,12)) { const up=await probeService('127.0.0.1', svc.port); out.push({name:svc.name, port:svc.port, status:up?'up':'down'}); }
  return out;
}

async function collect() {
  const mem = os.totalmem();
  const lm = linuxMetrics();
  const [temp, docker, services] = await Promise.all([Promise.resolve(getTemperature()), getDocker(), getServices()]);
  return {
    platform: process.env.DW_PLATFORM || os.type() + ' ' + os.release(),
    cpu: await cpuUsage(),
    mem: Math.round(((mem - os.freemem()) / Math.max(1, mem)) * 1000) / 10,
    disk: diskUsage(),
    load: Array.isArray(os.loadavg) ? (os.loadavg()[0] || 0) : 0,
    processes: lm.processes,
    containers: docker.length,
    network_in: lm.network_in, network_out: lm.network_out,
    uptime: Math.round(os.uptime()),
    temperature: temp,
    services,
    docker
  };
}

function post(data) {
  const body = JSON.stringify(data);
  const u = new URL(HOST + '/agents/' + AGENT_ID + '/heartbeat');
  const mod = u.protocol === 'https:' ? https : http;
  const headers = { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) };
  if (AGENT_TOKEN) headers['X-Agent-Token'] = AGENT_TOKEN;
  const req = mod.request({ hostname: u.hostname, port: u.port || (u.protocol === 'https:' ? 443 : 80), path: u.pathname, method: 'POST', headers }, r => { r.resume(); });
  req.setTimeout(15000, () => req.destroy());
  req.on('error', () => {});
  req.write(body); req.end();
}

function tick() { Promise.resolve(collect()).then(s => post({ stats: s })).catch(() => {}); }
tick();
setInterval(tick, INTERVAL);
console.log('DronWatch agent running on ' + os.hostname() + ' (reporting every ' + INTERVAL / 1000 + 's)');
`
  res.set('Content-Type', 'text/javascript')
  res.send(script)
})

router.post('/:id/heartbeat', async (req: AuthenticatedRequest, res: Response) => {
  if (req.agent && req.agent.id !== req.params.id) return res.status(403).json({ error: 'Agent token does not match this agent' })
  const agent = await getAgent(req, res, req.params.id)
  if (!agent) return
  const s = req.body?.stats || {}
  const num = (v: unknown) => (typeof v === 'number' && isFinite(v) ? v : null)
  const clamp = (v: unknown, max: number) => { const n = num(v); return n === null ? null : Math.min(n, max) }
  const stats = {
    cpu: clamp(s.cpu, 100000), mem: clamp(s.mem, 100000), disk: clamp(s.disk, 100000),
    load: clamp(s.load, 1e9), processes: clamp(s.processes, 1e7), containers: clamp(s.containers, 1e7),
    network_in: clamp(s.network_in, 1e15), network_out: clamp(s.network_out, 1e15),
    uptime: clamp(s.uptime, 1e9), temperature: s.temperature === null || s.temperature === undefined ? null : clamp(s.temperature, 200),
    services: Array.isArray(s.services) ? s.services.slice(0, 20).map((x: any) => ({ name: String(x.name || '').slice(0, 50), port: clamp(x.port, 65535), status: x.status === 'up' ? 'up' : 'down' })) : null,
    docker: Array.isArray(s.docker) ? s.docker.slice(0, 50).map((x: any) => ({ name: String(x.name || '').slice(0, 100), image: String(x.image || '').slice(0, 200), state: String(x.state || '').slice(0, 30), status: String(x.status || '').slice(0, 200) })) : null
  }
  let payload: any = {
    agent_id: agent.id, cpu: stats.cpu, mem: stats.mem, disk: stats.disk,
    load: stats.load, processes: stats.processes, containers: stats.containers,
    network_in: stats.network_in, network_out: stats.network_out,
    uptime: stats.uptime, temperature: stats.temperature, services: stats.services, extra: stats.docker ? { docker: stats.docker } : null
  }
  let { data, error } = await supabase.from('system_stats').insert(payload).select().single()
  if (error && /uptime|temperature|services|extra/i.test(error.message || '')) {
    const fallback = await supabase.from('system_stats').insert({
      agent_id: agent.id, cpu: stats.cpu, mem: stats.mem, disk: stats.disk,
      load: stats.load, processes: stats.processes, containers: stats.containers,
      network_in: stats.network_in, network_out: stats.network_out
    }).select().single()
    data = fallback.data; error = fallback.error as any
  }
  if (error) return res.status(500).json({ error: error.message })
  await supabase.from('agents').update({ last_seen: new Date().toISOString(), platform: String(s.platform || agent.platform || '').slice(0, 100) }).eq('id', agent.id)
  try {
    await supabase.from('heartbeat_runs').insert({
      agent_id: agent.id,
      duration_ms: typeof s.duration_ms === 'number' && isFinite(s.duration_ms) ? Math.max(0, Math.min(s.duration_ms, 86400000)) : null,
      exit_code: s.exit_code === undefined || s.exit_code === null ? null : Math.trunc(Number(s.exit_code))
    })
  } catch {
    // heartbeat_runs table is optional (added by migration); stats insert above is authoritative.
  }
  res.json({ ok: true, recorded_at: (data as any).recorded_at })
})

router.get('/:id/heartbeats', forbidAgents, async (req: AuthenticatedRequest, res: Response) => {
  const agent = await getAgent(req, res, req.params.id)
  if (!agent) return
  try {
    const { data, error } = await supabase.from('heartbeat_runs')
      .select('id, duration_ms, exit_code, created_at')
      .eq('agent_id', agent.id)
      .order('created_at', { ascending: false })
      .limit(50)
    if (error) throw new Error(error.message)
    res.json(data)
  } catch {
    res.json([])
  }
})

router.delete('/:id', forbidAgents, async (req: AuthenticatedRequest, res: Response) => {
  const { error } = await supabase.from('agents').delete().eq('id', req.params.id).eq('user_id', req.user!.id)
  if (error) return res.status(404).json({ error: 'Agent not found' })
  res.status(204).send()
})

export default router
import net from 'net'
import tls from 'tls'
import http from 'http'
import https from 'https'
import dns from 'dns'
import zlib from 'zlib'
import crypto from 'crypto'
import { supabase } from '../config/supabase'
import { Monitor, Check } from '../types'
import { sendAlert, sendSubscriberEmail } from './alertService'
import { evaluateAlertRules } from './alertRules'
import { rolledSeries, bucketedUptime, RETENTION } from './retention'

interface RawResult {
  dnsTime: number | null
  tcpTime: number | null
  tlsTime: number | null
  ttfb: number | null
  totalTime: number
  status: number | null
  headers: Record<string, any>
  body: string
  error: string | null
}

const lastAlertAt: Map<string, number> = new Map()
const lastHashes: Map<string, string> = new Map()

export function checkRegion(): string {
  return process.env.REGION || 'self'
}

function percentile(arr: number[], p: number): number | null {
  if (arr.length === 0) return null
  const s = [...arr].sort((a, b) => a - b)
  const idx = Math.ceil((p / 100) * s.length) - 1
  return s[Math.max(0, idx)]
}

function resolveVars(text: string, vars: Record<string, string>): string {
  if (!text) return text
  return text.replace(/\{\{([a-zA-Z0-9_.-]+)\}\}/g, (_, key) => vars[key] ?? '')
}

function jsonPath(body: any, path: string): any {
  if (!path) return undefined
  const parts = path.split(/\.|\[['"]?/).map(p => p.replace(/['"\]]$/, '')).filter(Boolean)
  let cur = body
  for (const part of parts) {
    if (cur == null) return undefined
    cur = /^\d+$/.test(part) ? cur[Number(part)] : cur[part]
  }
  return cur
}

function deepSubset(sub: any, obj: any): boolean {
  if (sub === null || typeof sub !== 'object') return sub === obj
  if (Array.isArray(sub)) {
    if (!Array.isArray(obj)) return false
    return sub.every((s, i) => deepSubset(s, obj[i]))
  }
  return Object.entries(sub).every(([k, v]) => deepSubset(v, obj?.[k]))
}

function flattenRes(r: any): string {
  if (Array.isArray(r)) return r.map(x => (x && typeof x === 'object' ? Object.values(x).filter(v => v !== undefined).join(' ') : String(x))).filter(Boolean).join(',')
  return r ? String(r) : ''
}

function hashBody(body: string): string {
  return crypto.createHash('sha256').update(body).digest('hex')
}

function stripDynamic(body: string, patterns: string[]): string {
  let out = body
  for (const p of patterns || []) {
    try { out = out.replace(new RegExp(p, 'g'), '') } catch {}
  }
  return out
}

async function getUserVars(userId: string): Promise<Record<string, string>> {
  const [{ data: user }, { data: rows }] = await Promise.all([
    supabase.from('users').select('env_vars').eq('id', userId).single(),
    supabase.from('user_env_vars').select('key, value').eq('user_id', userId)
  ])
  const vars: Record<string, string> = { ...(user?.env_vars || {}) }
  for (const r of rows || []) vars[r.key] = r.value
  return vars
}

function decompress(b: Buffer, enc: string): Buffer {
  try {
    if (enc === 'gzip') return zlib.gunzipSync(b)
    if (enc === 'deflate') return zlib.inflateSync(b)
    if (enc === 'br') return zlib.brotliDecompressSync(b)
  } catch {}
  return b
}

function isPrivateIp(address: string): boolean {
  const ip = address.toLowerCase().trim()
  const v4mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
  const v4 = v4mapped ? v4mapped[1] : ip
  if (v4.match(/^\d+\.\d+\.\d+\.\d+$/)) {
    const o = v4.split('.').map(Number)
    if (o[0] === 10) return true
    if (o[0] === 127) return true
    if (o[0] === 0) return true
    if (o[0] === 169 && o[1] === 254) return true
    if (o[0] === 172 && o[1] >= 16 && o[1] <= 31) return true
    if (o[0] === 192 && o[1] === 168) return true
    if (o[0] === 100 && o[1] >= 64 && o[1] <= 127) return true
    if (o[0] === 192 && o[1] === 0) return true
    if (o[0] === 198 && (o[1] === 18 || o[1] === 19)) return true
    if (o[0] === 203 && o[1] === 0 && o[2] === 113) return true
    if (o[0] >= 224) return true
    return false
  }
  if (ip === '::' || ip === '::1') return true
  if (ip.startsWith('::ffff:')) return true
  if (ip.startsWith('fc') || ip.startsWith('fd')) return true
  if (ip >= 'fe80' && ip < 'fec0') return true
  if (ip.startsWith('2001:db8')) return true
  if (ip.startsWith('ff')) return true
  return false
}

function assertPublicHost(hostname: string): Promise<{ ok: true } | { ok: false; error: string }> {
  return new Promise(resolve => {
    dns.lookup(hostname, { family: 0, all: true }, (err, addrs) => {
      if (err) return resolve({ ok: false, error: `DNS lookup failed: ${err.message}` })
      const list = Array.isArray(addrs) ? addrs.map(a => a.address) : [String(addrs)]
      if (list.length > 0 && list.every(isPrivateIp)) {
        return resolve({ ok: false, error: `Blocked private/loopback address (SSRF guard): ${list.join(', ')}` })
      }
      resolve({ ok: true })
    })
  })
}

function rawRequest(urlStr: string, opts: any): Promise<RawResult> {
  return new Promise(resolve => {
    const t0 = Date.now()
    let u: URL
    try { u = new URL(urlStr) } catch { return resolve({ dnsTime: null, tcpTime: null, tlsTime: null, ttfb: null, totalTime: 0, status: null, headers: {}, body: '', error: 'Invalid URL' }) }
    if (u.protocol !== 'http:' && u.protocol !== 'https:') {
      return resolve({ dnsTime: null, tcpTime: null, tlsTime: null, ttfb: null, totalTime: 0, status: null, headers: {}, body: '', error: 'Only http/https URLs are supported' })
    }
    const isHttps = u.protocol === 'https:'
    const mod = isHttps ? https : http
    const timeout = opts.timeout || 15000
    const allowRedirects = opts.followRedirects !== false
    const maxRedirects = opts.maxRedirects || 3

    const attempt = (href: string, redirectsLeft: number) => {
      let cu: URL
      try { cu = new URL(href) } catch { return resolve({ dnsTime: null, tcpTime: null, tlsTime: null, ttfb: null, totalTime: Date.now() - t0, status: null, headers: {}, body: '', error: 'Invalid URL' }) }
      if (cu.protocol !== 'http:' && cu.protocol !== 'https:') {
        return resolve({ dnsTime: null, tcpTime: null, tlsTime: null, ttfb: null, totalTime: Date.now() - t0, status: null, headers: {}, body: '', error: 'Only http/https URLs are supported' })
      }
      const secure = cu.protocol === 'https:'
      const reqMod = secure ? https : http
      const dnsStart = Date.now()
      dns.lookup(cu.hostname, { family: 0, all: true }, (lErr, addrs) => {
        if (lErr) return resolve({ dnsTime: Date.now() - dnsStart, tcpTime: null, tlsTime: null, ttfb: null, totalTime: Date.now() - t0, status: null, headers: {}, body: '', error: `DNS lookup failed: ${lErr.message}` })
        const list = (Array.isArray(addrs) ? addrs : [addrs]).map(a => String((a as any)?.address ?? a)).filter(Boolean)
        if (list.length === 0) return resolve({ dnsTime: Date.now() - dnsStart, tcpTime: null, tlsTime: null, ttfb: null, totalTime: Date.now() - t0, status: null, headers: {}, body: '', error: 'DNS lookup failed: no addresses returned' })
        const blocked = list.filter(a => isPrivateIp(a))
        if (opts.allowPrivateIps !== true && blocked.length > 0) {
          return resolve({ dnsTime: Date.now() - dnsStart, tcpTime: null, tlsTime: null, ttfb: null, totalTime: Date.now() - t0, status: null, headers: {}, body: '', error: `Blocked private/loopback address (SSRF guard): ${blocked.join(', ')}` })
        }
        const address = list[0]
        const tcpStart = Date.now()
        const req = reqMod.request({
          hostname: address, port: Number(cu.port || (secure ? 443 : 80)), path: cu.pathname + cu.search,
          method: opts.method || 'GET', headers: { ...opts.headers, Host: cu.host }, family: 0, agent: false,
          servername: cu.hostname,
          rejectUnauthorized: opts.allowInvalidCerts === true ? false : true
        } as any, res => {
          const chunks: Buffer[] = []
          const ttfb = Date.now() - t0
          res.on('data', c => chunks.push(c))
          res.on('end', () => {
            let bodyBuf = decompress(Buffer.concat(chunks), (res.headers['content-encoding'] || '').toLowerCase())
            const location = res.headers.location
            if (allowRedirects && res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && location) {
              if (redirectsLeft <= 0) {
                return finish(req, res.statusCode, res.headers, bodyBuf.toString('utf8'), `Too many redirects (max ${maxRedirects})`, ttfb, tcpStart)
              }
              return attempt(new URL(location, href).toString(), redirectsLeft - 1)
            }
            const sizeLimit = opts.maxResponseSize || 50 * 1024 * 1024
            const headersObj = res.headers as any
            const declaredSize = Number(headersObj['content-length'] || 0)
            if (bodyBuf.length > sizeLimit || (declaredSize > sizeLimit && bodyBuf.length >= declaredSize)) {
              return finish(req, res.statusCode ?? null, headersObj, '', `Response exceeded ${sizeLimit} bytes`, ttfb, tcpStart)
            }
            finish(req, res.statusCode ?? null, headersObj, bodyBuf.toString('utf8'), null, ttfb, tcpStart)
          })
        })
        const times: { tcpAt?: number; tlsAt?: number } = {}
        req.on('socket', socket => {
          socket.once('connect', () => { if (times.tcpAt == null) times.tcpAt = Date.now() })
          if (secure) socket.once('secureConnect', () => { times.tlsAt = Date.now() })
        })
        req.on('error', (e: any) => finish(req, null, {}, '', e.code === 'ECONNREFUSED' ? 'Connection refused' : e.code === 'ECONNRESET' ? 'Connection reset' : e.code === 'CERT_HAS_EXPIRED' ? 'TLS certificate expired' : e.code === 'DEPTH_ZERO_SELF_SIGNED_CERT' ? 'TLS self-signed certificate' : e.message, null, tcpStart))
        req.setTimeout(timeout, () => { req.destroy(); finish(req, null, {}, '', `Timed out after ${timeout}ms`, null, tcpStart) })
        const body = opts.body
        if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body))
        req.end()

        function finish(_req: any, status: number | null, headers: Record<string, any>, bodyText: string, error: string | null, ttfb: number | null, tcpStart: number) {
          const tcpTime = times.tcpAt != null ? Math.max(0, times.tcpAt - tcpStart) : null
          const tlsTime = secure && times.tlsAt != null ? Math.max(0, times.tlsAt - (times.tcpAt ?? tcpStart)) : null
          return resolve({
            dnsTime: Date.now() - dnsStart, tcpTime, tlsTime,
            ttfb, totalTime: Date.now() - t0, status, headers, body: error ? bodyText.slice(0, 2000) : bodyText, error
          })
        }
      })
    }
    attempt(urlStr, maxRedirects)
  })
}

function buildHttpOptions(monitor: Monitor, vars: Record<string, string>): { url: string; opts: any } {
  const cfg = monitor.config || {}
  const headers: Record<string, any> = { 'User-Agent': 'DronWatch/1.0 Uptime Monitor', 'Accept-Encoding': 'gzip, deflate, br' }
  for (const [k, v] of Object.entries(cfg.headers || {})) headers[k] = resolveVars(String(v), vars)
  if (cfg.cookies) headers['Cookie'] = (cfg.cookies as any[]).map(c => `${c.name}=${c.value}`).join('; ')
  const auth = cfg.auth || {}
  if (auth.type === 'basic' && auth.username) headers['Authorization'] = 'Basic ' + Buffer.from(`${auth.username}:${auth.password || ''}`).toString('base64')
  if (auth.type === 'bearer' && auth.token) headers['Authorization'] = `Bearer ${resolveVars(auth.token, vars)}`
  if (auth.type === 'api_key' && auth.value) {
    if (auth.location === 'query') cfg.__apiKeyQuery = { name: auth.key_name || 'api_key', value: resolveVars(auth.value, vars) }
    else headers[auth.key_name || 'X-API-Key'] = resolveVars(auth.value, vars)
  }
  let body: any = cfg.body
  if (cfg.is_graphql && cfg.graphql_query) body = JSON.stringify({ query: cfg.graphql_query })
  if (body && typeof body === 'object') body = JSON.stringify(body)
  if (body && typeof body === 'string') body = resolveVars(body, vars)
  if (cfg.content_type && headers['Content-Type'] === undefined && body) headers['Content-Type'] = cfg.content_type
  let url = resolveVars(cfg.url_template || monitor.url, vars)
  if (cfg.__apiKeyQuery) url += (url.includes('?') ? '&' : '?') + `${cfg.__apiKeyQuery.name}=${encodeURIComponent(cfg.__apiKeyQuery.value)}`
  return { url, opts: { method: (cfg.method || 'GET').toUpperCase(), headers, body, timeout: cfg.timeout, followRedirects: cfg.follow_redirects !== false, maxRedirects: cfg.max_redirects || 3, allowInvalidCerts: cfg.allow_invalid_certs, maxResponseSize: cfg.max_response_size, allowPrivateIps: cfg.allow_private_ips === true } }
}

async function checkHttpLogic(monitor: Monitor, vars: Record<string, string>) {
  const cfg = monitor.config || {}
  const { url, opts } = buildHttpOptions(monitor, vars)
  const r = await rawRequest(url, opts)
  const bodyClean = stripDynamic(r.body, cfg.ignore_patterns)
  const hash = hashBody(bodyClean)
  let isUp = !r.error
  let errorMsg = r.error
  if (isUp) {
    const accepted = cfg.accepted_codes && Array.isArray(cfg.accepted_codes) && cfg.accepted_codes.length ? cfg.accepted_codes : (monitor.expected_status ? [monitor.expected_status] : Array.from([200, 201, 202, 203, 204, 205, 206, 300, 301, 302, 303, 307, 308]))
    if (r.status !== null && !accepted.includes(r.status)) { isUp = false; errorMsg = `Status ${r.status} not in accepted codes [${accepted.join(', ')}]` }
  }
  if (isUp && r.status !== null) {
    if (cfg.expect_content_type && r.headers['content-type'] && !String(r.headers['content-type']).toLowerCase().startsWith(cfg.expect_content_type.toLowerCase())) { isUp = false; errorMsg = `Content-Type mismatch: ${r.headers['content-type']}` }
    if (cfg.check_security_headers) {
      const missing = (cfg.security_headers || ['strict-transport-security', 'x-content-type-options', 'content-security-policy']).filter((h: string) => !r.headers[h])
      if (missing.length) { isUp = false; errorMsg = `Missing security headers: ${missing.join(', ')}` }
    }
    if (cfg.check_compression && opts.headers['Accept-Encoding'] && !r.headers['content-encoding']) { isUp = false; errorMsg = 'Compression not enabled (no Content-Encoding)' }
  }
  let parsed: any = null
  if (isUp && r.body) { try { parsed = JSON.parse(r.body) } catch {} }
  if (isUp && cfg.json_compare && parsed) { if (!deepSubset(cfg.json_compare, parsed)) { isUp = false; errorMsg = 'JSON body does not match expected subset' } }
  if (isUp && cfg.jsonpath) {
    const val = jsonPath(parsed, cfg.jsonpath)
    const expect = cfg.jsonpath_expected
    const ok = expect === undefined ? val !== undefined && val !== null : String(val) === String(expect)
    if (!ok) { isUp = false; errorMsg = `JSONPath ${cfg.jsonpath} → ${val} (expected ${expect})` }
  }
  if (isUp && cfg.regex) {
    try {
      const flags = cfg.regex_flags || ''
      const m = bodyClean.match(new RegExp(cfg.regex, flags))
      if (cfg.regex_expect === false ? !!m : !m) { isUp = false; errorMsg = `Regex ${cfg.regex} did ${m ? 'unexpectedly' : 'not'} match` }
    } catch {}
  }
  if (isUp && (monitor.type === 'keyword' || cfg.keyword)) {
    const kw = cfg.keyword || ''
    const mode = cfg.keyword_match || 'contain'
    const hay = cfg.keyword_case_sensitive ? bodyClean : bodyClean.toLowerCase()
    const needle = cfg.keyword_case_sensitive ? kw : kw.toLowerCase()
    const found = cfg.keyword_exact ? hay.trim() === needle.trim() : hay.includes(needle)
    if (mode === 'not_contain' && found) { isUp = false; errorMsg = `Forbidden keyword "${kw}" present` }
    if (mode !== 'not_contain' && !found) { isUp = false; errorMsg = `Keyword "${kw}" not found` }
  }
  if (isUp && cfg.change_detection) {
    const prev = lastHashes.get(monitor.id) ?? cfg.baseline_hash
    if (prev && prev !== hash) { isUp = false; errorMsg = 'Content changed since baseline hash' }
    lastHashes.set(monitor.id, hash)
    if (!cfg.baseline_hash) cfg.baseline_hash = hash
  }
  if (!isUp && r.error && r.status !== null) errorMsg = errorMsg || `HTTP ${r.status}`
  return { isUp, status: r.status, r, error: errorMsg }
}

async function checkPingLogic(monitor: Monitor) {
  const cfg = monitor.config || {}
  const host = cfg.host || (() => { try { return new URL(monitor.url).hostname } catch { return monitor.url } })()
  const samples = cfg.samples || Math.max(monitor.retry_count || 1, 3)
  const times: number[] = []
  let ok = 0
  if (cfg.allow_private_ips !== true) {
    const guard = await assertPublicHost(host)
    if (!guard.ok) return { isUp: false, avg: null, min: null, max: null, loss: 100, error: guard.error }
  }
  for (let i = 0; i < samples; i++) {
    const s = Date.now()
    try { await new Promise<void>((res, rej) => dns.lookup(host, { family: 0 }, e => (e ? rej(e) : res()))) } catch { times.push(5000); if (i === 0) break; continue }
    ok++
    times.push(Date.now() - s)
  }
  const avg = times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : null
  const loss = samples ? Math.round(((samples - ok) / samples) * 100) : 100
  let isUp = ok > 0
  let error: string | null = null
  if (!isUp) error = 'Host unreachable (100% packet loss)'
  else if (cfg.high_latency_ms && avg && avg > cfg.high_latency_ms) { isUp = false; error = `High latency detected: ${avg}ms (threshold ${cfg.high_latency_ms}ms)` }
  return { isUp, avg, min: times.length ? Math.min(...times) : null, max: times.length ? Math.max(...times) : null, loss, error }
}

async function checkTcpLogic(monitor: Monitor) {
  const cfg = monitor.config || {}
  const host = cfg.host || (() => { try { return new URL(monitor.url).hostname } catch { return monitor.url } })()
  const port = cfg.port || 80
  const useTls = cfg.tls === true || cfg.port === 443
  const timeout = cfg.timeout || 5000
  const start = Date.now()
  if (cfg.allow_private_ips !== true) {
    const guard = await assertPublicHost(host)
    if (!guard.ok) return { isUp: false, responseTime: 0, error: guard.error }
  }
  return new Promise<{ isUp: boolean; responseTime: number; error: string | null }>(resolve => {
    const socket = useTls ? tls.connect({ host, port, servername: cfg.servername || host, rejectUnauthorized: false, timeout }) as any : new net.Socket()
    let done = false
    const finish = (isUp: boolean, error: string | null) => {
      if (done) return; done = true
      try { socket.destroy() } catch {}
      resolve({ isUp, responseTime: Date.now() - start, error })
    }
    if (cfg.expect_text) {
      socket.setTimeout(timeout)
      const hay: string[] = []
      socket.on('data', (d: Buffer) => {
        hay.push(d.toString())
        const all = hay.join('')
        if (all.includes(cfg.expect_text)) finish(true, null)
      })
      socket.once('timeout', () => finish(false, `Expected text "${cfg.expect_text}" not received within ${timeout}ms`))
    } else {
      socket.setTimeout(timeout)
      socket.once('connect', () => finish(true, null))
      if (useTls) socket.once('secureConnect', () => finish(true, null))
      socket.once('timeout', () => finish(false, 'TCP connection timed out'))
    }
    socket.once('error', (e: any) => finish(false, e.code === 'ECONNREFUSED' ? `Port ${port} closed` : e.message))
    if (!useTls) (socket as any).connect(port, host)
  })
}

async function checkSslLogic(monitor: Monitor): Promise<{ isUp: boolean; daysLeft: number | null; expiresAt: string | null; issuer: string | null; subject: string | null; altNames: string | null; responseTime: number; error: string | null }> {
  const cfg = monitor.config || {}
  const host = cfg.hostname || (() => { try { return new URL(monitor.url).hostname } catch { return monitor.url } })()
  const port = cfg.port || 443
  const threshold = cfg.days_threshold
  const start = Date.now()
  if (cfg.allow_private_ips !== true) {
    const guard = await assertPublicHost(host)
    if (!guard.ok) return { isUp: false, daysLeft: null, expiresAt: null, issuer: null, subject: null, altNames: null, responseTime: 0, error: guard.error }
  }
  return new Promise(resolve => {
    const socket = tls.connect({ host, port, servername: host, rejectUnauthorized: !cfg.allow_self_signed, timeout: cfg.timeout || 10000 }, () => {
      const cert: any = socket.getPeerCertificate()
      if (cert && Object.keys(cert).length) {
        const expiresAt = new Date(cert.valid_to).toISOString()
        const daysLeft = Math.round((new Date(cert.valid_to).getTime() - Date.now()) / 86400000)
        let isUp = daysLeft > 0
        let error: string | null = null
        if (daysLeft <= 0) { isUp = false; error = `Certificate expired ${Math.abs(daysLeft)} days ago` }
        else if (threshold && daysLeft <= threshold) { isUp = false; error = `Certificate expires in ${daysLeft} days (threshold ${threshold})` }
        else if (daysLeft <= 60) { isUp = true; error = `Certificate expires in ${daysLeft} days - soon` }
        if (isUp || (!threshold && daysLeft > 0)) {
          if (cfg.hostnames) {
            const names = String(cert.subjectaltname || '').toLowerCase()
            const missing = (cfg.hostnames as string[]).filter(h => !names.includes(h.toLowerCase()))
            if (missing.length) { isUp = false; error = `SAN missing hostnames: ${missing.join(', ')}` }
          }
        }
        socket.end()
        resolve({ isUp, daysLeft, expiresAt, issuer: cert.issuer?.O || null, subject: cert.subject?.CN || null, altNames: cert.subjectaltname || null, responseTime: Date.now() - start, error })
      } else {
        socket.end(); resolve({ isUp: false, daysLeft: null, expiresAt: null, issuer: null, subject: null, altNames: null, responseTime: Date.now() - start, error: 'No certificate presented' })
      }
    })
    socket.on('error', (e: any) => resolve({ isUp: false, daysLeft: null, expiresAt: null, issuer: null, subject: null, altNames: null, responseTime: Date.now() - start, error: e.code === 'CERT_HAS_EXPIRED' ? 'TLS certificate expired' : e.code === 'DEPTH_ZERO_SELF_SIGNED_CERT' ? 'TLS self-signed certificate' : `TLS error: ${e.message}` }))
    socket.on('timeout', () => { socket.destroy(); resolve({ isUp: false, daysLeft: null, expiresAt: null, issuer: null, subject: null, altNames: null, responseTime: Date.now() - start, error: 'SSL handshake timed out' }) })
  })
}

async function checkDomainLogic(monitor: Monitor) {
  const cfg = monitor.config || {}
  const domain = cfg.hostname || (() => { try { return new URL(monitor.url).hostname } catch { return monitor.url } })()
  const start = Date.now()
  return new Promise<{ isUp: boolean; responseTime: number; error: string | null; expiresAt: string | null; registrar: string | null; nameservers: string[]; status: string[] }>(resolve => {
    const req = https.get(`https://rdap.org/domain/${domain}`, { timeout: 12000, headers: { Accept: 'application/rdap+json' } }, res => {
      const chunks: Buffer[] = []
      res.on('data', c => chunks.push(c))
      res.on('end', () => {
        try {
          const data = JSON.parse(Buffer.concat(chunks).toString())
          const expiration = (data.events || []).find((e: any) => e.eventAction === 'expiration')?.eventDate
          const expiresAt = expiration ? new Date(expiration).toISOString() : null
          const registrant = (data.entities || []).find((e: any) => (e.roles || []).includes('registrant'))
          const registrar = (data.entities || []).find((e: any) => (e.roles || []).includes('registrar'))
          const registrarName = registrar ? (registrar.vcardArray?.[1]?.find((v: any) => v[0] === 'fn')?.[1] ?? registrar.handle ?? null) : null
          const nameservers = (data.nameservers || []).map((n: any) => n.ldhName).filter(Boolean)
          const statusArr = Array.isArray(data.status) ? data.status : []
          const expired = expiresAt ? new Date(expiresAt).getTime() < Date.now() : false
          let isUp = !expired
          let error: string | null = null
          if (expired) { isUp = false; error = 'Domain has expired' }
          else if (cfg.expected_nameservers && Array.isArray(cfg.expected_nameservers)) {
            const missing = cfg.expected_nameservers.filter(ns => !nameservers.some((n: string) => String(n).toLowerCase() === String(ns).toLowerCase()))
            if (missing.length) { isUp = false; error = `Nameservers missing: ${missing.join(', ')}` }
          }
          resolve({ isUp, responseTime: Date.now() - start, error, expiresAt, registrar: registrarName, nameservers, status: statusArr })
        } catch (e: any) {
          resolve({ isUp: false, responseTime: Date.now() - start, error: `RDAP lookup failed: ${e.message}`, expiresAt: null, registrar: null, nameservers: [], status: [] })
        }
      })
    })
    req.on('timeout', () => { req.destroy(); resolve({ isUp: false, responseTime: Date.now() - start, error: 'RDAP lookup timed out', expiresAt: null, registrar: null, nameservers: [], status: [] }) })
    req.on('error', (e: any) => resolve({ isUp: false, responseTime: Date.now() - start, error: `RDAP error: ${e.message}`, expiresAt: null, registrar: null, nameservers: [], status: [] }))
  })
}

async function checkDnsLogic(monitor: Monitor) {
  const cfg = monitor.config || {}
  const hostname = cfg.hostname || (() => { try { return new URL(monitor.url).hostname } catch { return monitor.url } })()
  const recordType = cfg.record_type || 'A'
  const expectedList = cfg.expected_values && Array.isArray(cfg.expected_values) ? cfg.expected_values : (cfg.expected_value ? [cfg.expected_value] : [])
  const start = Date.now()
  try {
    let result: any
    if (cfg.resolver) {
      const r: any = new dns.Resolver()
      r.setServers([cfg.resolver])
      result = recordType === 'ANY' ? await r.resolveAny(hostname) : await r.resolve(hostname, recordType)
    } else {
      result = recordType === 'ANY' ? await (dns.promises as any).resolveAny(hostname) : await (dns.promises as any).resolve(hostname, recordType)
    }
    const flat = flattenRes(result)
    const missing = expectedList.filter(e => !flat.split(',').some(x => String(x).toLowerCase().includes(String(e).toLowerCase())))
    const isUp = missing.length === 0
    return { isUp, responseTime: Date.now() - start, error: isUp ? null : `Expected ${recordType} record missing: ${missing.join(', ')} (got: ${flat.slice(0, 300)})`, dnsTime: Date.now() - start }
  } catch (e: any) {
    const isUp = expectedList.length === 0
    return { isUp, responseTime: Date.now() - start, error: e.code === 'ENODATA' ? `No ${recordType} record found for ${hostname}` : `${recordType} resolution failed: ${e.message}`, dnsTime: Date.now() - start }
  }
}

async function checkHeartbeatLogic(monitor: Monitor): Promise<{ isUp: boolean; error: string | null }> {
  const cfg = monitor.config || {}
  const grace = cfg.grace_seconds || monitor.check_interval || 300
  const lastPing = cfg.last_ping ? new Date(cfg.last_ping).getTime() : 0
  const elapsed = lastPing ? (Date.now() - lastPing) / 1000 : Infinity
  const now = new Date()
  const hour = now.getHours()
  const inWindow = !cfg.schedule_start || !cfg.schedule_end || hour >= cfg.schedule_start || hour < cfg.schedule_end === false ? true : hour >= (cfg.schedule_start || 0) && hour < (cfg.schedule_end || 24)
  if (!inWindow) return { isUp: true, error: null }
  if (!lastPing) return { isUp: false, error: 'No heartbeat received yet' }
  if (elapsed > grace) {
    const misses = Math.floor(elapsed / grace)
    return { isUp: false, error: `Heartbeat overdue by ${Math.round(elapsed)}s (${misses} missed run${misses > 1 ? 's' : ''})` }
  }
  if (cfg.min_duration && cfg.last_duration !== undefined && cfg.last_duration < cfg.min_duration) return { isUp: false, error: `Run too short: ${cfg.last_duration}ms (min ${cfg.min_duration}ms)` }
  if (cfg.max_duration && cfg.last_duration !== undefined && cfg.last_duration > cfg.max_duration) return { isUp: false, error: `Run too long: ${cfg.last_duration}ms (max ${cfg.max_duration}ms)` }
  return { isUp: true, error: null }
}

async function checkApiSteps(monitor: Monitor, vars: Record<string, string>) {
  const cfg = monitor.config || {}
  const steps = cfg.steps || []
  const localVars: Record<string, string> = { ...vars }
  try {
    for (const step of steps) {
      const url = resolveVars(step.url || monitor.url, localVars)
      const headers: Record<string, any> = { 'User-Agent': 'DronWatch/1.0 Uptime Monitor', ...Object.fromEntries(Object.entries(step.headers || {}).map(([k, v]) => [k, resolveVars(String(v), localVars)])) }
      let body = step.body
      if (body && typeof body === 'object') body = JSON.stringify(body)
      if (body && typeof body === 'string') body = resolveVars(body, localVars)
      if (step.content_type && body && headers['Content-Type'] === undefined) headers['Content-Type'] = step.content_type
      const r = await rawRequest(url, { method: (step.method || 'GET').toUpperCase(), headers, body, timeout: step.timeout || cfg.timeout, followRedirects: true, maxRedirects: 5 })
      if (r.error) return { isUp: false, error: `Step "${step.name}": ${r.error}` }
      if (step.expected_status && r.status !== step.expected_status) return { isUp: false, error: `Step "${step.name}": expected ${step.expected_status}, got ${r.status}` }
      if (step.expect_content && !r.body.includes(step.expect_content)) return { isUp: false, error: `Step "${step.name}": expected content "${step.expect_content}" not found` }
      if (step.extract) {
        try {
          const parsed = JSON.parse(r.body)
          for (const ex of step.extract) { if (ex.var && ex.path) localVars[ex.var] = String(jsonPath(parsed, ex.path)) }
        } catch {}
      }
    }
    return { isUp: true, error: null }
  } catch (e: any) {
    return { isUp: false, error: `Step sequence failed: ${e.message}` }
  }
}

async function isInMaintenanceWindow(monitor: Monitor): Promise<boolean> {
  const now = new Date().toISOString()
  const { data } = await supabase.from('maintenance_windows').select('*').lte('starts_at', now).gte('ends_at', now).limit(50)
  if (!data) return false
  return data.some((w: any) => (w.monitor_ids || []).includes(monitor.id))
}

export async function checkMonitor(monitor: Monitor): Promise<Check> {
  if (monitor.maintenance) return recordCheck(monitor, null, null, 'Maintenance window', true, true)
  if (monitor.parent_monitor_id) {
    const { data: parent } = await supabase.from('monitors').select('last_status').eq('id', monitor.parent_monitor_id).single()
    if (parent && parent.last_status === false) return recordCheck(monitor, null, null, 'Parent dependency down - suppressed', true, true)
  }
  if (await isInMaintenanceWindow(monitor)) return recordCheck(monitor, null, null, 'Maintenance window', true, true)

  const vars = await getUserVars(monitor.user_id)
  const type = monitor.type || 'http'
  let isUp = false
  let statusCode: number | null = null
  let errorMessage: string | null = null
  let dnsTime: number | null = null
  let tcpTime: number | null = null
  let tlsTime: number | null = null
  let ttfb: number | null = null
  let responseTime: number | null = null
  let daysLeft: number | null = null
  const cfg = monitor.config || {}

  if (type === 'tcp') {
    const r = await checkTcpLogic(monitor); isUp = r.isUp; responseTime = r.responseTime; errorMessage = r.error; tcpTime = r.responseTime
  } else if (type === 'ping') {
    const r = await checkPingLogic(monitor); isUp = r.isUp; responseTime = r.avg; errorMessage = r.error; dnsTime = r.avg
  } else if (type === 'dns') {
    const r = await checkDnsLogic(monitor); isUp = r.isUp; responseTime = r.responseTime; errorMessage = r.error; dnsTime = r.dnsTime
  } else if (type === 'heartbeat') {
    const r = await checkHeartbeatLogic(monitor); isUp = r.isUp; errorMessage = r.error
  } else if (type === 'ssl') {
    const r = await checkSslLogic(monitor); isUp = r.isUp; responseTime = r.responseTime; errorMessage = r.error; tlsTime = r.responseTime; daysLeft = r.daysLeft
    if (isUp && cfg.warn_days && r.daysLeft !== null && r.daysLeft <= cfg.warn_days) errorMessage = `Certificate expires in ${r.daysLeft} days`
  } else if (type === 'domain') {
    const r = await checkDomainLogic(monitor); isUp = r.isUp; responseTime = r.responseTime; errorMessage = r.error; dnsTime = r.responseTime
  } else if (type === 'http' || type === 'keyword') {
    if (Array.isArray(cfg.steps) && cfg.steps.length > 0) {
      const r = await checkApiSteps(monitor, vars); isUp = r.isUp; errorMessage = r.error
    } else {
      const r = await checkHttpLogic(monitor, vars); isUp = r.isUp; statusCode = r.status; responseTime = r.r.totalTime; errorMessage = r.error
      dnsTime = r.r.dnsTime; tcpTime = r.r.tcpTime; tlsTime = r.r.tlsTime; ttfb = r.r.ttfb
    }
  }

  const regions = cfg.regions || []
  if (!isUp && regions.length > 1) {
    await new Promise(res => setTimeout(res, 500))
    const conf = regions.length > 1 ? await (type === 'ssl' ? checkSslLogic(monitor) : type === 'domain' ? checkDomainLogic(monitor) : type === 'dns' ? checkDnsLogic(monitor) : type === 'tcp' ? checkTcpLogic(monitor) : type === 'ping' ? checkPingLogic(monitor) : type === 'heartbeat' ? checkHeartbeatLogic(monitor) : checkHttpLogic(monitor, vars)) : null
    if (conf && 'isUp' in conf && (conf as any).isUp === true) { isUp = true; errorMessage = null }
  }

  if (!isUp && monitor.retry_count > 1) {
    for (let i = 1; i < monitor.retry_count; i++) {
      await new Promise(res => setTimeout(res, 1000 * i))
      const retry = type === 'ssl' ? await checkSslLogic(monitor) : type === 'domain' ? await checkDomainLogic(monitor) : type === 'dns' ? await checkDnsLogic(monitor) : type === 'tcp' ? await checkTcpLogic(monitor) : type === 'ping' ? await checkPingLogic(monitor) : type === 'heartbeat' ? await checkHeartbeatLogic(monitor) : Array.isArray(monitor.config?.steps) && monitor.config.steps.length > 0 ? await checkApiSteps(monitor, vars) : await checkHttpLogic(monitor, vars)
      if ((retry as any).isUp === true) { isUp = true; statusCode = (retry as any).status ?? statusCode; responseTime = (retry as any).responseTime ?? (retry as any).r?.totalTime ?? responseTime; errorMessage = null; break }
    }
  }

  const check = await recordCheck(monitor, statusCode, responseTime, errorMessage, isUp, false, { dnsTime, tcpTime, tlsTime, ttfb }, { daysLeft })

  const prev = monitor.last_status
  const now = new Date().toISOString()

  const latencyThreshold = cfg.latency_threshold || 1000
  const nextConsecutiveDown = isUp ? 0 : (monitor.consecutive_down || 0) + 1
  const nextConsecutiveLatency = isUp && responseTime !== null && responseTime !== undefined && responseTime > latencyThreshold ? (monitor.consecutive_latency || 0) + 1 : 0
  await supabase.from('monitors').update({ last_check: now, last_status: isUp, last_latency: responseTime, consecutive_down: nextConsecutiveDown, consecutive_latency: nextConsecutiveLatency }).eq('id', monitor.id)

  const { data: silence } = await supabase.from('silences').select('id').eq('user_id', monitor.user_id)
    .or(`monitor_id.eq.${monitor.id},monitor_id.is.null`).gte('ends_at', now).limit(1).maybeSingle()
  const isSilenced = !!silence

  await evaluateAlertRules(monitor.id, monitor, { isUp, responseTime, intervalSeconds: monitor.check_interval, extra: { daysLeft }, silenced: isSilenced })

  const changed = prev !== null && prev !== isUp
  if (changed && !isSilenced) {
    await handleStatusChange(monitor, isUp, statusCode, errorMessage)
  }
  if (changed || (prev === isUp && !isUp)) {
    await handleIncident(monitor, isUp)
  }
  if (!isUp && prev === false && cfg.repeat_minutes && !isSilenced) {
    const last = lastAlertAt.get(monitor.id) ?? 0
    if (Date.now() - last >= cfg.repeat_minutes * 60000) {
      lastAlertAt.set(monitor.id, Date.now())
      await handleStatusChange(monitor, false, statusCode, errorMessage)
    }
  }
  if (changed && isSilenced) lastAlertAt.set(monitor.id, Date.now())
  return check
}

async function recordCheck(monitor: Monitor, statusCode: number | null, responseTime: number | null, errorMessage: string | null, isUp: boolean, additive: boolean, timing?: { dnsTime?: number | null; tcpTime?: number | null; tlsTime?: number | null; ttfb?: number | null }, extra?: Record<string, any>): Promise<Check> {
  const { data: check, error } = await supabase.from('checks').insert({
    monitor_id: monitor.id, status_code: statusCode, response_time: responseTime,
    dns_time: timing?.dnsTime ?? null, tcp_time: timing?.tcpTime ?? null, tls_time: timing?.tlsTime ?? null, ttfb: timing?.ttfb ?? null,
    is_up: isUp, error_message: errorMessage, region: checkRegion(), extra: extra || null
  }).select().single()
  if (error) throw new Error(`Failed to save check: ${error.message}`)
  return check as Check
}

async function handleIncident(monitor: Monitor, isUp: boolean) {
  const cfg = monitor.config || {}
  if (!isUp) {
    const { data: existing } = await supabase.from('incidents').select('id').eq('monitor_id', monitor.id).in('status', ['open', 'acknowledged', 'resolving', 'reopened']).limit(1).maybeSingle()
    if (!existing) {
      const { data: inc } = await supabase.from('incidents').insert({
        monitor_id: monitor.id, user_id: monitor.user_id, status: 'open', severity: cfg.severity || 'high', title: `${monitor.name} is down`
      }).select().single()
      if (inc) await supabase.from('incident_updates').insert({ incident_id: inc.id, status: 'investigating', message: `Monitor ${monitor.name} went down. Investigating.` })
    }
  } else {
    const { data: open } = await supabase.from('incidents').select('id').eq('monitor_id', monitor.id).in('status', ['open', 'acknowledged', 'resolving', 'reopened']).limit(1).maybeSingle()
    if (open) {
      await supabase.from('incidents').update({ status: 'resolved', resolved_at: new Date().toISOString() }).eq('id', open.id)
      await supabase.from('incident_updates').insert({ incident_id: open.id, status: 'resolved', message: `Monitor ${monitor.name} recovered.` })
    }
  }
}

async function handleStatusChange(monitor: Monitor, isUp: boolean, statusCode: number | null, errorMessage: string | null) {
  const status = isUp ? 'recovered' : 'down'
  const cfg = monitor.config || {}
  await supabase.from('audit_logs').insert({ user_id: monitor.user_id, action: isUp ? 'monitor.recovered' : 'monitor.down', target: monitor.id })
  const detail = `${monitor.name} (${monitor.url}) ${isUp ? 'is back up' : 'is DOWN'}.${statusCode ? ` HTTP ${statusCode}.` : ''}${errorMessage ? ` ${errorMessage}` : ''} Type: ${monitor.type}. Region: ${monitor.region || 'auto'}.`
  const link = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/monitors/${monitor.id}`
  const message = `${detail}\nView: ${link}`
  for (const channel of monitor.notification_channels || []) {
    await sendAlert({ monitorId: monitor.id, type: channel.type as any, recipient: channel.target, message, status })
  }
  await notifyStatusPageSubscribers(monitor, isUp, detail)
}

async function notifyStatusPageSubscribers(monitor: Monitor, isUp: boolean, detail: string) {
  try {
    const { data: pages } = await supabase.from('status_pages').select('id, name, slug, subscriptions_enabled').contains('monitor_ids', [monitor.id]).eq('is_public', true)
    for (const page of pages || []) {
      if (page.subscriptions_enabled === false) continue
      const { data: subs } = await supabase.from('status_page_subscribers').select('id, email, token').eq('status_page_id', page.id).eq('verified', true).limit(5000)
      if (!subs || subs.length === 0) continue
      const pageUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/status/${encodeURIComponent(page.slug)}`
      const statusText = isUp ? 'UP' : 'DOWN'
      const color = isUp ? '#10b981' : '#ef4444'
      const headline = isUp ? `${page.name} is back online` : `${page.name} is currently DOWN`
      for (const row of subs) {
        try {
          await sendSubscriberEmail(row.email, `${page.name} — Service ${statusText}`, `<div style="font-family:sans-serif;max-width:600px;margin:0 auto"><div style="background:${color};padding:20px;border-radius:8px 8px 0 0"><h2 style="color:white;margin:0">${headline}</h2></div><div style="padding:20px;background:#f9fafb;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px"><p style="color:#374151;white-space:pre-wrap">${escapeHtml(detail)}</p><a href="${pageUrl}" style="display:inline-block;background:#3b82f6;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;margin-top:16px">View Status Page</a><p style="color:#9ca3af;font-size:12px;margin-top:24px">You received this because you subscribed to this status page. <a href="${pageUrl}?unsubscribe=1">Unsubscribe</a></p></div></div>`)
        } catch (err) {
          console.error(`Subscriber email failed for ${row.email}`, err)
        }
      }
    }
  } catch (err) {
    console.error('notifyStatusPageSubscribers failed', err)
  }
}

function escapeHtml(s: any): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

export async function getMonitorStats(monitorId: string, days: number) {
  const since = new Date(); since.setDate(since.getDate() - days)
  if (days > RETENTION.checksDays) {
    const rows = await rolledSeries(monitorId, since)
    if (rows.length === 0) {
      const { uptime, total } = await bucketedUptime(monitorId, since)
      return { uptime, avgResponseTime: null, p50: null, p75: null, p90: null, p95: null, p99: null, p99_9: null, min: null, max: null, errorRate: null, totalChecks: total, checks: [] }
    }
    return { ...buildStats(rows), totalChecks: rows.length, checks: rows }
  }
  const { data: checks } = await supabase.from('checks').select('is_up, response_time, dns_time, tcp_time, tls_time, ttfb, status_code, checked_at')
    .eq('monitor_id', monitorId).gte('checked_at', since.toISOString()).order('checked_at', { ascending: true })
  if (!checks || checks.length === 0) return { uptime: null, avgResponseTime: null, p50: null, p75: null, p90: null, p95: null, p99: null, p99_9: null, min: null, max: null, errorRate: null, totalChecks: 0, checks: [] }
  return buildStats(checks)
}

function buildStats(checks: any[]) {
  const ups = checks.filter(c => c.is_up).length
  const uptime = Math.round((ups / checks.length) * 10000) / 100
  const rts = checks.filter(c => c.response_time !== null).map(c => c.response_time!)
  const avg = rts.length ? Math.round(rts.reduce((a, b) => a + b, 0) / rts.length) : null
  const alarms = checks.filter(c => !c.is_up).length
  const ttfbs = checks.filter(c => c.ttfb !== null).map(c => c.ttfb!)
  const dnsTs = checks.filter(c => c.dns_time !== null).map(c => c.dns_time!)
  const tcpTs = checks.filter(c => c.tcp_time !== null).map(c => c.tcp_time!)
  const tlsTs = checks.filter(c => c.tls_time !== null).map(c => c.tls_time!)
  return {
    uptime, avgResponseTime: avg,
    p50: percentile(rts, 50), p75: percentile(rts, 75), p90: percentile(rts, 90), p95: percentile(rts, 95), p99: percentile(rts, 99), p99_9: percentile(rts, 99.9),
    min: rts.length ? Math.min(...rts) : null, max: rts.length ? Math.max(...rts) : null,
    errorRate: checks.length ? Math.round((alarms / checks.length) * 10000) / 100 : null,
    avgDns: dnsTs.length ? Math.round(dnsTs.reduce((a, b) => a + b, 0) / dnsTs.length) : null,
    avgTcp: tcpTs.length ? Math.round(tcpTs.reduce((a, b) => a + b, 0) / tcpTs.length) : null,
    avgTls: tlsTs.length ? Math.round(tlsTs.reduce((a, b) => a + b, 0) / tlsTs.length) : null,
    avgTtfb: ttfbs.length ? Math.round(ttfbs.reduce((a, b) => a + b, 0) / ttfbs.length) : null,
    totalChecks: checks.length, checks
  }
}

export async function getMonitorReport(monitorId: string) {
  const windows = [
    { label: '1h', hours: 1 }, { label: '24h', hours: 24 }, { label: '7d', days: 7 }, { label: '30d', days: 30 }, { label: '90d', days: 90 }, { label: '365d', days: 365 }
  ]
  const checksRetentionMs = RETENTION.checksDays * 86400000
  const uptimeByWindow: Record<string, number | null> = {}
  for (const w of windows) {
    const since = new Date()
    if (w.hours) since.setHours(since.getHours() - w.hours)
    else since.setDate(since.getDate() - (w.days || 0))
    if (Date.now() - since.getTime() <= checksRetentionMs) {
      const { data } = await supabase.from('checks').select('is_up').eq('monitor_id', monitorId).gte('checked_at', since.toISOString())
      uptimeByWindow[w.label] = data && data.length ? Math.round((data.filter(c => c.is_up).length / data.length) * 10000) / 100 : null
    } else {
      uptimeByWindow[w.label] = (await bucketedUptime(monitorId, since)).uptime
    }
  }
  const { data: monitor } = await supabase.from('monitors').select('*').eq('id', monitorId).single()
  const days = 90
  const since = new Date(); since.setDate(since.getDate() - days)
  const today = new Date().toISOString().slice(0, 10)

  let checks: Array<Record<string, any>>
  if (days <= RETENTION.checksDays) {
    const { data } = await supabase.from('checks').select('is_up, response_time, dns_time, tcp_time, tls_time, ttfb, status_code, checked_at').eq('monitor_id', monitorId).gte('checked_at', since.toISOString()).order('checked_at', { ascending: true })
    checks = data || []
  } else {
    checks = await rolledSeries(monitorId, since)
  }
  const stats = buildStats(checks)
  const errorsByCode: Record<string, number> = {}
  for (const c of checks) { if (c.status_code) errorsByCode[String(c.status_code)] = (errorsByCode[String(c.status_code)] || 0) + 1 }

  const { data: incidents } = await supabase.from('incidents').select('*').eq('monitor_id', monitorId).gte('started_at', since.toISOString())
  const incArr = incidents || []
  const durations = incArr.filter(i => i.resolved_at).map(i => (new Date(i.resolved_at).getTime() - new Date(i.started_at).getTime()) / 60000)
  const acknowledged = incArr.filter(i => i.acknowledged_at)
  const mttaArr = acknowledged.map(i => (new Date(i.acknowledged_at).getTime() - new Date(i.started_at).getTime()) / 60000)
  const sla = (monitor as any)?.config?.sla_target || 99.9
  const errorBudget = sla - (stats.uptime ?? 100)

  const dayMap = new Map<string, { up: number; total: number; rts: number[] }>()
  const addDay = (day: string, isUp: boolean, rt: number | null) => {
    const e = dayMap.get(day) ?? { up: 0, total: 0, rts: [] }
    e.total++; if (isUp) e.up++; if (rt !== null && rt !== undefined) e.rts.push(rt)
    dayMap.set(day, e)
  }
  for (const c of checks) {
    const day = new Date(c.checked_at).toISOString().slice(0, 10)
    if (day === today) addDay(day, c.is_up === true, c.response_time)
  }
  const { data: dStats } = await supabase.from('daily_stats').select('bucket, check_count, down_count, avg_response_ms').eq('monitor_id', monitorId).gte('bucket', since.toISOString()).order('bucket', { ascending: true })
  for (const d of dStats || []) {
    const day = new Date(d.bucket).toISOString().slice(0, 10)
    const e = dayMap.get(day) ?? { up: 0, total: 0, rts: [] }
    e.total += d.check_count ?? 0
    e.up += (d.check_count ?? 0) - (d.down_count ?? 0)
    if (d.avg_response_ms !== null && d.avg_response_ms !== undefined) e.rts.push(d.avg_response_ms)
    dayMap.set(day, e)
  }
  const daily = Array.from(dayMap.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([date, e]) => ({
    date, uptime: e.total > 0 ? Math.round((e.up / e.total) * 10000) / 100 : null, avg: e.rts.length ? Math.round(e.rts.reduce((a, b) => a + b, 0) / e.rts.length) : null
  }))

  return {
    windows: uptimeByWindow, stats,
    errorsByCode, incidentCount: incArr.length,
    incidentDurationAvg: durations.length ? Math.round((durations.reduce((a, b) => a + b, 0) / durations.length) * 10) / 10 : null,
    mtta: mttaArr.length ? Math.round((mttaArr.reduce((a, b) => a + b, 0) / mttaArr.length) * 10) / 10 : null,
    mttr: durations.length ? Math.round((durations.reduce((a, b) => a + b, 0) / durations.length) * 10) / 10 : null,
    errorBudget: Math.round(errorBudget * 100) / 100,
    slaTarget: sla, daily
  }
}

export async function getMonitorRegions(monitorId: string) {
  const { data: regions } = await supabase.from('regions').select('code, label').order('code', { ascending: true })
  const since = new Date(Date.now() - 86400000).toISOString()
  const out: Array<{ code: string; label: string; last_status: boolean | null; last_check: string | null; last_latency: number | null; uptime_24h: number | null }> = []
  for (const reg of regions || []) {
    const { data: latest } = await supabase.from('checks').select('is_up, response_time, checked_at').eq('monitor_id', monitorId).eq('region', reg.code).order('checked_at', { ascending: false }).limit(1)
    const [{ count: total }, { count: up }] = await Promise.all([
      supabase.from('checks').select('id', { count: 'exact', head: true }).eq('monitor_id', monitorId).eq('region', reg.code).gte('checked_at', since),
      supabase.from('checks').select('id', { count: 'exact', head: true }).eq('monitor_id', monitorId).eq('region', reg.code).eq('is_up', true).gte('checked_at', since)
    ])
    out.push({
      code: reg.code, label: reg.label,
      last_status: latest?.[0]?.is_up ?? null,
      last_check: latest?.[0]?.checked_at ?? null,
      last_latency: latest?.[0]?.response_time ?? null,
      uptime_24h: total ? Math.round(((up ?? 0) / total) * 10000) / 100 : null
    })
  }
  return out
}

export async function getDowntimeEvents(monitorId: string) {
  const { data: checks } = await supabase.from('checks').select('is_up, checked_at, error_message, status_code')
    .eq('monitor_id', monitorId).order('checked_at', { ascending: true })
  if (!checks) return []
  const events: Array<{ startedAt: string; resolvedAt: string | null; duration: number | null; error: string | null }> = []
  let start: string | null = null; let err: string | null = null
  for (const c of checks) {
    if (!c.is_up && start === null) { start = c.checked_at; err = c.error_message }
    else if (c.is_up && start !== null) {
      events.push({ startedAt: start, resolvedAt: c.checked_at, duration: Math.round((new Date(c.checked_at).getTime() - new Date(start).getTime()) / 1000), error: err })
      start = null; err = null
    }
  }
  if (start !== null) events.push({ startedAt: start, resolvedAt: null, duration: null, error: err })
  return events.reverse()
}
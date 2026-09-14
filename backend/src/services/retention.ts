import { supabase } from '../config/supabase'

const envInt = (key: string, def: number) => {
  const v = Number(process.env[key])
  return Number.isFinite(v) && v >= 0 ? v : def
}

export const RETENTION = {
  checksDays: envInt('CHECK_RETENTION_DAYS', 7),
  hourlyDays: envInt('HOURLY_RETENTION_DAYS', 90),
  dailyDays: envInt('DAILY_RETENTION_DAYS', 730)
}

function floorHour(d: Date): Date {
  const x = new Date(d)
  x.setMinutes(0, 0, 0)
  return x
}

function floorDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

async function deleteChunked(table: string, ids: string[]): Promise<void> {
  const size = 500
  for (let i = 0; i < ids.length; i += size) {
    const chunk = ids.slice(i, i + size)
    if (chunk.length) await supabase.from(table).delete().in('id', chunk)
  }
}

interface BucketGroup {
  bucket: string
  region: string
  checks: number
  down: number
  rtSum: number
  rtCount: number
  last: boolean
}

function addCheckGroup(map: Map<string, BucketGroup>, bucket: Date, region: string, isUp: boolean, responseTime: number | null) {
  const key = `${region}|${bucket.toISOString()}`
  const g: BucketGroup = map.get(key) ?? { bucket: bucket.toISOString(), region, checks: 0, down: 0, rtSum: 0, rtCount: 0, last: isUp }
  g.checks++
  if (!isUp) g.down++
  if (responseTime !== null && responseTime !== undefined) { g.rtSum += responseTime; g.rtCount++ }
  g.last = isUp
  map.set(key, g)
}

function groupAvg(g: BucketGroup): number | null {
  return g.rtCount > 0 ? Math.round(g.rtSum / g.rtCount) : null
}

async function supportsWeighted(target: 'hourly_stats' | 'daily_stats'): Promise<boolean> {
  const { error } = await supabase.from(target).select('response_sum_ms').limit(1)
  return !error
}

async function writeGroups(monitorId: string, target: 'hourly_stats' | 'daily_stats', groups: Map<string, BucketGroup>) {
  const weighted = await supportsWeighted(target)
  for (const g of groups.values()) {
    const base = {
      monitor_id: monitorId,
      region: g.region,
      bucket: g.bucket,
      check_count: g.checks,
      down_count: g.down,
      avg_response_ms: groupAvg(g),
      last_status: g.last
    }
    const payload = weighted ? { ...base, response_sum_ms: g.rtSum, response_count: g.rtCount } : base
    const { error } = await supabase.from(target).upsert(payload, { onConflict: 'monitor_id,region,bucket' })
    if (error) {
      if (weighted && /response_(sum_ms|count)/i.test(error.message || '')) {
        const { error: retryError } = await supabase.from(target).upsert(base, { onConflict: 'monitor_id,region,bucket' })
        if (retryError) throw new Error(retryError.message)
        continue
      }
      throw new Error(error.message)
    }
  }
}

async function rollupHourly(): Promise<void> {
  const cutoff = floorHour(new Date())
  const { data: monitors } = await supabase.from('monitors').select('id')
  for (const m of monitors || []) {
    let offset = 0
    while (true) {
      const { data: rows } = await supabase
        .from('checks')
        .select('id, is_up, response_time, region, checked_at')
        .eq('monitor_id', m.id)
        .lt('checked_at', cutoff.toISOString())
        .order('checked_at', { ascending: true })
        .range(offset, offset + 999)
      if (!rows || rows.length === 0) break
      const groups = new Map<string, BucketGroup>()
      for (const c of rows) addCheckGroup(groups, floorHour(new Date(c.checked_at)), c.region || 'self', c.is_up, c.response_time)
      await writeGroups(m.id, 'hourly_stats', groups)
      await deleteChunked('checks', rows.map(c => c.id))
      offset += rows.length
      if (rows.length < 1000) break
    }
  }
}

async function rollupDaily(): Promise<void> {
  const cutoff = floorDay(new Date())
  const { data: monitors } = await supabase.from('monitors').select('id')
  for (const m of monitors || []) {
    let offset = 0
    while (true) {
      const weighted = await supportsWeighted('hourly_stats')
      const selectCols = weighted
        ? 'id, bucket, region, check_count, down_count, avg_response_ms, response_sum_ms, response_count, last_status'
        : 'id, bucket, region, check_count, down_count, avg_response_ms, last_status'
      const query: any = supabase.from('hourly_stats').select(selectCols)
      const { data: rows, error } = await query
        .eq('monitor_id', m.id)
        .lt('bucket', cutoff.toISOString())
        .order('bucket', { ascending: true })
        .range(offset, offset + 999)
      if (error) throw new Error(error.message)
      if (!rows || rows.length === 0) break
      const groups = new Map<string, BucketGroup>()
      for (const c of rows) {
        const key = `${c.region || 'self'}|${floorDay(new Date(c.bucket)).toISOString()}`
        const g: BucketGroup = groups.get(key) ?? { bucket: floorDay(new Date(c.bucket)).toISOString(), region: c.region || 'self', checks: 0, down: 0, rtSum: 0, rtCount: 0, last: c.last_status === true }
        g.checks += c.check_count ?? 0
        g.down += c.down_count ?? 0
        const sum = weighted && c.response_sum_ms != null ? Number(c.response_sum_ms) : null
        const count = weighted && c.response_count != null ? Number(c.response_count) : null
        if (sum !== null && count !== null) {
          g.rtSum += sum
          g.rtCount += count
        } else if (c.avg_response_ms !== null && c.avg_response_ms !== undefined) {
          g.rtSum += Number(c.avg_response_ms) * (c.check_count ?? 0)
          g.rtCount += c.check_count ?? 0
        }
        g.last = c.last_status === true ? true : g.last
        groups.set(key, g)
      }
      await writeGroups(m.id, 'daily_stats', groups)
      await deleteChunked('hourly_stats', (rows as any[]).map((c: any) => c.id))
      offset += rows.length
      if (rows.length < 1000) break
    }
  }
}

async function prune(): Promise<void> {
  const now = Date.now()
  if (RETENTION.checksDays > 0) {
    await supabase.from('checks').delete().lt('checked_at', new Date(now - RETENTION.checksDays * 86400000).toISOString())
  }
  if (RETENTION.hourlyDays > 0) {
    await supabase.from('hourly_stats').delete().lt('bucket', new Date(now - RETENTION.hourlyDays * 86400000).toISOString())
  }
  if (RETENTION.dailyDays > 0) {
    await supabase.from('daily_stats').delete().lt('bucket', new Date(now - RETENTION.dailyDays * 86400000).toISOString())
  }
}

export async function rollupAndPrune(): Promise<void> {
  await rollupHourly()
  await rollupDaily()
  await prune()
}

export function uptimeFromBuckets(rows: Array<{ check_count: number; down_count: number }>): { uptime: number | null; total: number } {
  let total = 0
  let up = 0
  for (const r of rows) {
    total += r.check_count ?? 0
    up += (r.check_count ?? 0) - (r.down_count ?? 0)
  }
  return { uptime: total > 0 ? Math.round((up / total) * 10000) / 100 : null, total }
}

export async function rolledSeries(monitorId: string, since: Date): Promise<Array<{ is_up: boolean; response_time: number | null; checked_at: string }>> {
  const spansHours = since.getTime() > Date.now() - RETENTION.hourlyDays * 86400000
  const table = spansHours ? 'hourly_stats' : 'daily_stats'
  const { data } = await supabase
    .from(table)
    .select('bucket, check_count, down_count, avg_response_ms, last_status')
    .eq('monitor_id', monitorId)
    .gte('bucket', since.toISOString())
    .order('bucket', { ascending: true })
  return (data || []).map((r: any) => ({
    is_up: r.last_status === true || (r.down_count ?? 0) === 0,
    response_time: r.avg_response_ms,
    checked_at: r.bucket
  }))
}

export async function bucketedUptime(monitorId: string, since: Date): Promise<{ uptime: number | null; total: number }> {
  const spansHours = since.getTime() > Date.now() - RETENTION.hourlyDays * 86400000
  const table = spansHours ? 'hourly_stats' : 'daily_stats'
  const { data } = await supabase
    .from(table)
    .select('check_count, down_count')
    .eq('monitor_id', monitorId)
    .gte('bucket', since.toISOString())
  return uptimeFromBuckets(data || [])
}
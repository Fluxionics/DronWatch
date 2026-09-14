import { supabase } from '../config/supabase'

export interface AnomalyResult {
  isAnomaly: boolean
  baselineAvg: number | null
  baselineStd: number | null
  current: number | null
  deviation: number | null
  reason: string | null
}

function mean(arr: number[]): number { return arr.reduce((a, b) => a + b, 0) / arr.length }
function std(arr: number[], avg: number): number {
  const v = arr.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / arr.length
  return Math.sqrt(v)
}

export async function detectAnomaly(monitorId: string, current: number | null): Promise<AnomalyResult> {
  if (current === null || current === undefined) return { isAnomaly: false, baselineAvg: null, baselineStd: null, current, deviation: null, reason: null }
  const { data: recent } = await supabase.from('checks').select('response_time').eq('monitor_id', monitorId).eq('is_up', true).order('checked_at', { ascending: false }).limit(50)
  const samples = (recent || []).map(r => r.response_time).filter((v: any): v is number => typeof v === 'number' && isFinite(v) && v > 0)
  if (samples.length < 10) return { isAnomaly: false, baselineAvg: null, baselineStd: null, current, deviation: null, reason: 'insufficient baseline' }
  const avg = mean(samples)
  const sd = std(samples, avg)
  if (avg === 0) return { isAnomaly: false, baselineAvg: avg, baselineStd: sd, current, deviation: null, reason: null }
  const deviation = sd > 0 ? (current - avg) / sd : null
  // Anomaly if > 3 sigma or > 2.5x baseline and at least 300ms absolute increase
  const isAnomaly = (deviation !== null && deviation > 3) || (current > avg * 2.5 && current - avg > 300)
  let reason: string | null = null
  if (isAnomaly) {
    if (deviation !== null && deviation > 3) reason = `${current}ms is ${deviation.toFixed(1)}σ above baseline ${Math.round(avg)}ms (σ=${Math.round(sd)}ms)`
    else reason = `${current}ms is ${((current / avg) * 100).toFixed(0)}% of baseline ${Math.round(avg)}ms (+${Math.round(current - avg)}ms)`
  }
  return { isAnomaly, baselineAvg: Math.round(avg), baselineStd: Math.round(sd), current, deviation: deviation !== null ? Math.round(deviation * 10) / 10 : null, reason }
}

export async function markAnomalyIfNeeded(monitorId: string, checkId: string, responseTime: number | null): Promise<AnomalyResult | null> {
  const res = await detectAnomaly(monitorId, responseTime)
  if (res.isAnomaly) {
    try {
      const { data: existing } = await supabase.from('checks').select('extra').eq('id', checkId).single()
      const extra = { ...(existing?.extra || {}), anomaly: true, anomalyReason: res.reason, baselineAvg: res.baselineAvg }
      await supabase.from('checks').update({ extra }).eq('id', checkId)
    } catch {}
  }
  return res
}

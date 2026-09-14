import { supabase } from '../config/supabase'
import { sendAlert } from './alertService'
import { AlertRule, Monitor } from '../types'

interface RuleRow {
  id: string
  name: string
  condition: AlertRule['condition']
  threshold: number
  for_minutes: number
  channels: Array<{ type: string; target: string }>
  consecutive: number
  last_fired_at: string | null
  last_ok_at: string | null
}

export interface RuleOutcome {
  isUp: boolean
  responseTime: number | null
  intervalSeconds: number
  extra?: { daysLeft: number | null }
  silenced: boolean
}

interface RuleResult {
  matched: boolean
  consecutive: number
  detail: string
}

function evaluateRule(rule: RuleRow, outcome: RuleOutcome): RuleResult {
  const intervalMs = (outcome.intervalSeconds || 300) * 1000
  let consecutive = rule.consecutive ?? 0
  let matched = false
  let detail = ''
  switch (rule.condition) {
    case 'down_for': {
      consecutive = outcome.isUp ? 0 : consecutive + 1
      const durationMs = (rule.for_minutes || 0) * 60000
      if (!outcome.isUp && consecutive * intervalMs >= durationMs) {
        matched = true
        detail = `${outcome.intervalSeconds || 300}s interval, down for ${Math.round((consecutive * intervalMs) / 60000)}m (threshold ${rule.for_minutes || 0}m)`
      }
      break
    }
    case 'latency_above': {
      const slow = outcome.isUp && outcome.responseTime !== null && outcome.responseTime !== undefined && outcome.responseTime > rule.threshold
      consecutive = slow ? consecutive + 1 : 0
      const durationMs = (rule.for_minutes || 0) * 60000
      if (slow && consecutive * intervalMs >= durationMs) {
        matched = true
        detail = `Latency ${outcome.responseTime}ms exceeded ${rule.threshold}ms for ${Math.round((consecutive * intervalMs) / 60000)}m (threshold ${rule.for_minutes || 0}m)`
      }
      break
    }
    case 'ssl_expires_within': {
      consecutive = 0
      const days = outcome.extra?.daysLeft ?? null
      if (days !== null && days !== undefined && days <= rule.threshold) {
        matched = true
        detail = `SSL certificate expires in ${days} days (threshold ${rule.threshold} days)`
      }
      break
    }
  }
  return { matched, consecutive, detail }
}

async function fireRule(rule: RuleRow, monitor: Monitor, detail: string) {
  const link = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/monitors/${monitor.id}`
  const message = `Alert rule "${rule.name}": ${detail}\nMonitor: ${monitor.name} (${monitor.url})\nView: ${link}`
  for (const ch of rule.channels || []) {
    try {
      await sendAlert({ monitorId: monitor.id, type: ch.type as any, recipient: ch.target, message, status: 'down' })
    } catch (err) {
      console.error(`alertRules.fireRule: channel ${ch.type} failed`, err)
    }
  }
}

export async function evaluateAlertRules(monitorId: string, monitor: Monitor, outcome: RuleOutcome): Promise<void> {
  const { data: rules } = await supabase
    .from('alert_rules')
    .select('id, name, condition, threshold, for_minutes, channels, consecutive, last_fired_at, last_ok_at')
    .eq('monitor_id', monitorId)
    .eq('enabled', true)
    .limit(50)
  for (const rule of (rules || []) as unknown as RuleRow[]) {
    const { matched, consecutive, detail } = evaluateRule(rule, outcome)
    const updates: Record<string, unknown> = { consecutive }
    const now = new Date().toISOString()
    const lastFired = rule.last_fired_at ? new Date(rule.last_fired_at).getTime() : 0
    const lastOk = rule.last_ok_at ? new Date(rule.last_ok_at).getTime() : 0
    if (matched && !outcome.silenced) {
      if (lastFired <= lastOk) {
        await fireRule(rule, monitor, detail)
        updates.last_fired_at = now
      }
    } else {
      updates.last_ok_at = now
    }
    await supabase.from('alert_rules').update(updates).eq('id', rule.id)
  }
}
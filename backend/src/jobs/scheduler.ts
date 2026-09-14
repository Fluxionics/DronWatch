import cron from 'node-cron'
import { supabase } from '../config/supabase'
import { checkMonitor, getMonitorReport } from '../services/monitorService'
import { sendReportEmail } from '../services/alertService'
import { rollupAndPrune } from '../services/retention'
import { Monitor } from '../types'

async function claimDueMonitor(monitor: Monitor, now: number): Promise<boolean> {
  const intervalMs = Math.max(30, monitor.check_interval || 300) * 1000
  const cutoff = new Date(now - intervalMs).toISOString()
  const { data, error } = await supabase
    .from('monitors')
    .update({ last_check: new Date(now).toISOString() })
    .eq('id', monitor.id)
    .or(`last_check.is.null,last_check.lt.${cutoff}`)
    .select('id')
    .maybeSingle()
  if (error) {
    console.error(`Scheduler: claim failed for ${monitor.id}`, error)
    return false
  }
  return !!data
}

export function startScheduler() {
  cron.schedule('*/30 * * * * *', async () => {
    const now = Date.now()

    const { data: monitors, error } = await supabase
      .from('monitors')
      .select('*')
      .eq('is_active', true)
      .order('priority', { ascending: false })

    if (error || !monitors) {
      console.error('Scheduler: failed to fetch monitors', error)
      return
    }

    const due = (monitors as Monitor[]).sort((a, b) => (b.priority || 0) - (a.priority || 0)).filter(monitor => {
      const intervalMs = Math.max(30, monitor.check_interval || 300) * 1000
      const last = monitor.last_check ? new Date(monitor.last_check).getTime() : 0
      return now - last >= intervalMs
    })

    if (due.length > 0) {
      const sorted = due.sort((a, b) => (b.priority || 0) - (a.priority || 0))
      await Promise.allSettled(
        sorted.map(async monitor => {
          if (!(await claimDueMonitor(monitor, now))) return
          try {
            await checkMonitor(monitor)
          } catch (err) {
            console.error(`Scheduler: check failed for ${monitor.id}`, err)
          }
        })
      )
    }
  })

  cron.schedule('0 * * * *', async () => {
    const { data: schedules } = await supabase.from('report_schedules').select('*').lte('next_at', new Date().toISOString())
    for (const s of schedules || []) {
      try {
        const { data: monitors } = await supabase.from('monitors').select('id, name, url').eq('user_id', s.user_id)
        const parts = []
        for (const m of (monitors || []).slice(0, 50)) {
          const report = await getMonitorReport(m.id)
          parts.push({ name: m.name, url: m.url, report })
        }
        const html = buildReportHtml(parts)
        await sendReportEmail(s.email, `DronWatch ${s.frequency} report`, html)
      } catch (err) {
        console.error('Report email failed', err)
      } finally {
        const next = new Date(); next.setDate(next.getDate() + (s.frequency === 'daily' ? 1 : s.frequency === 'weekly' ? 7 : 30))
        await supabase.from('report_schedules').update({ next_at: next.toISOString() }).eq('id', s.id)
      }
    }
  })

  cron.schedule('* * * * *', async () => {
    const { data: active } = await supabase.from('monitors').select('id, user_id, name, config, notification_channels').eq('is_active', true)
    const patternMonitors = (active || [])
      .filter((m: any) => m.config?.log_alert_pattern)
      .slice(0, 20)
    for (const m of patternMonitors) {
      const pattern = (m as any).config.log_alert_pattern
      const { data: hits } = await supabase.from('logs')
        .select('id')
        .eq('user_id', (m as any).user_id)
        .ilike('message', `%${pattern}%`)
        .gte('ts', new Date(Date.now() - 60000).toISOString())
        .limit(1)
      if (hits && hits.length > 0) {
        const lastAlert = lastAlertCheck.get((m as any).id) ?? 0
        if (Date.now() - lastAlert > 300000) {
          lastAlertCheck.set((m as any).id, Date.now())
          await supabase.from('alerts').insert({ monitor_id: (m as any).id, type: 'webhook', recipient: 'log-pattern', message: `Log pattern "${pattern}" matched for ${(m as any).name}` })
        }
      }
    }
  })

  cron.schedule('*/10 * * * *', async () => {
    try {
      await rollupAndPrune()
    } catch (err) {
      console.error('Retention rollup failed', err)
    }
  })

  console.log('Scheduler started (30s DB-claimed checks, hourly reports, minute log-pattern scan, 10min retention rollups)')
}

const lastAlertCheck: Map<string, number> = new Map()

function buildReportHtml(parts: Array<{ name: string; url: string; report: any }>): string {
  const rows = parts.map(p => {
    const r = p.report
    return `<tr>
      <td style="padding:10px;border:1px solid #e5e7eb"><a href="${p.url}" style="color:#3b82f6;text-decoration:none">${p.name}</a></td>
      <td style="padding:10px;border:1px solid #e5e7eb;text-align:center">${r.windows['30d'] ?? '-'}%</td>
      <td style="padding:10px;border:1px solid #e5e7eb;text-align:center">${r.windows['7d'] ?? '-'}%</td>
      <td style="padding:10px;border:1px solid #e5e7eb;text-align:center">${r.stats.avgResponseTime ?? '-'}ms</td>
      <td style="padding:10px;border:1px solid #e5e7eb;text-align:center">${r.mttr ?? '-'}m</td>
      <td style="padding:10px;border:1px solid #e5e7eb;text-align:center">${r.errorBudget ?? '-'}%</td>
    </tr>`
  }).join('')
  return `<div style="font-family:sans-serif;max-width:900px;margin:0 auto">
    <h1 style="color:#0f172a">DronWatch Report</h1>
    <table style="border-collapse:collapse;width:100%">
      <thead><tr style="background:#0f172a;color:white">
        <th style="padding:10px;border:1px solid #0f172a">Monitor</th>
        <th style="padding:10px;border:1px solid #0f172a">Uptime 30d</th>
        <th style="padding:10px;border:1px solid #0f172a">Uptime 7d</th>
        <th style="padding:10px;border:1px solid #0f172a">Avg</th>
        <th style="padding:10px;border:1px solid #0f172a">MTTR</th>
        <th style="padding:10px;border:1px solid #0f172a">Error budget</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`
}
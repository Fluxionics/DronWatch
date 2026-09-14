import { supabase } from '../config/supabase'
import { sendAlert } from './alertService'

export interface EscalationStep {
  delay_minutes: number
  channels: Array<{ type: string; target: string }>
}

export async function startEscalation(monitor: { id: string; user_id: string; escalation_policy_id?: string | null; name: string; url: string }) {
  if (!monitor.escalation_policy_id) return
  const { data: policy } = await supabase.from('escalation_policies').select('id,steps').eq('id', monitor.escalation_policy_id).eq('user_id', monitor.user_id).single()
  if (!policy || !Array.isArray(policy.steps) || policy.steps.length === 0) return
  const { data: existing } = await supabase.from('escalation_states').select('id,is_active').eq('monitor_id', monitor.id).eq('policy_id', policy.id).eq('is_active', true).maybeSingle()
  if (existing) return // already escalating
  const now = new Date().toISOString()
  await supabase.from('escalation_states').insert({ monitor_id: monitor.id, policy_id: policy.id, user_id: monitor.user_id, started_at: now, current_step: 0, last_notified_at: now, is_active: true })
  // Fire step 0 immediately
  const step0 = policy.steps[0] as EscalationStep
  if (step0 && Array.isArray(step0.channels)) {
    for (const ch of step0.channels) {
      try {
        await sendAlert({ monitorId: monitor.id, type: ch.type as any, recipient: ch.target, message: `[ESCALATION 0] ${monitor.name} (${monitor.url}) is DOWN — escalation "${(policy as any).name || 'policy'}" step 0`, status: 'down' })
      } catch {}
    }
  }
}

export async function stopEscalation(monitorId: string) {
  await supabase.from('escalation_states').update({ is_active: false }).eq('monitor_id', monitorId).eq('is_active', true)
}

export async function processEscalations() {
  const { data: states } = await supabase.from('escalation_states').select('id,monitor_id,policy_id,started_at,current_step').eq('is_active', true).limit(100)
  if (!states || states.length === 0) return
  for (const st of states) {
    const { data: policy } = await supabase.from('escalation_policies').select('steps,name').eq('id', st.policy_id).single()
    if (!policy || !Array.isArray(policy.steps)) {
      await supabase.from('escalation_states').update({ is_active: false }).eq('id', st.id)
      continue
    }
    const { data: monitor } = await supabase.from('monitors').select('id,name,url,last_status').eq('id', st.monitor_id).single()
    if (!monitor || monitor.last_status !== false) {
      // Monitor recovered – stop escalation
      await supabase.from('escalation_states').update({ is_active: false }).eq('id', st.id)
      continue
    }
    const elapsedMin = (Date.now() - new Date(st.started_at).getTime()) / 60000
    const steps = policy.steps as EscalationStep[]
    // Find next step to fire
    let nextIdx = -1
    for (let i = st.current_step + 1; i < steps.length; i++) {
      if (elapsedMin >= (steps[i].delay_minutes || 0)) nextIdx = i
      else break
    }
    if (nextIdx !== -1) {
      const step = steps[nextIdx]
      for (const ch of step.channels || []) {
        try {
          await sendAlert({ monitorId: monitor.id, type: ch.type as any, recipient: ch.target, message: `[ESCALATION ${nextIdx}] ${monitor.name} (${monitor.url}) still DOWN after ${Math.round(elapsedMin)}m — step ${nextIdx}`, status: 'down' })
        } catch {}
      }
      await supabase.from('escalation_states').update({ current_step: nextIdx, last_notified_at: new Date().toISOString() }).eq('id', st.id)
    }
  }
}

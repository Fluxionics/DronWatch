import { supabase } from '../config/supabase'

export const PLAN_NAMES = ['free', 'pro', 'business', 'enterprise'] as const
export type PlanName = (typeof PLAN_NAMES)[number]

export interface PlanLimits {
  monitors: number
  min_interval: number
  status_pages: number
  agents: number
  history_days: number
}

export const PLAN_LIMITS: Record<string, PlanLimits> = {
  free: { monitors: 5, min_interval: 300, status_pages: 1, agents: 1, history_days: 7 },
  pro: { monitors: 50, min_interval: 60, status_pages: 10, agents: 5, history_days: 90 },
  business: { monitors: 250, min_interval: 30, status_pages: 50, agents: 20, history_days: 365 },
  enterprise: { monitors: 100000, min_interval: 30, status_pages: 100000, agents: 100000, history_days: 730 }
}

export function planLimits(plan?: string | null): PlanLimits {
  return PLAN_LIMITS[plan || 'free'] || PLAN_LIMITS.free
}

export function normalizePlan(plan?: string | null): PlanName {
  return PLAN_NAMES.includes(plan as PlanName) ? (plan as PlanName) : 'free'
}

export async function getUserPlan(userId: string): Promise<PlanName> {
  const { data } = await supabase.from('users').select('plan').eq('id', userId).single()
  return normalizePlan(data?.plan)
}

export async function assertResourceLimit(
  userId: string,
  table: 'monitors' | 'status_pages' | 'agents'
): Promise<{ ok: true } | { ok: false; error: string }> {
  const plan = await getUserPlan(userId)
  const limits = planLimits(plan)
  const key = table as keyof PlanLimits
  const max = limits[key] as number
  const { count } = await supabase.from(table).select('id', { count: 'exact', head: true }).eq('user_id', userId)
  const current = count ?? 0
  if (current >= max) {
    return { ok: false, error: `Your ${plan} plan allows ${max} ${table} (you currently have ${current}). Upgrade your plan to add more.` }
  }
  return { ok: true }
}

export function enforceInterval(plan: string | null | undefined, interval: number): number {
  const min = planLimits(plan).min_interval
  return Math.max(min, interval)
}
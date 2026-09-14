export interface User {
  id: string
  username: string
  email: string | null
  free_tier: boolean
  plan?: 'free' | 'pro' | 'business' | 'enterprise'
  created_at: string
}

export type MonitorType = 'http' | 'ping' | 'tcp' | 'keyword' | 'heartbeat' | 'dns' | 'ssl' | 'domain' | 'synthetic'

export type AlertChannelType = 'email' | 'slack' | 'discord' | 'webhook' | 'telegram' | 'teams' | 'google_chat' | 'pushover' | 'gotify' | 'mattermost' | 'matrix' | 'pagerduty' | 'opsgenie' | 'twilio_sms' | 'jira' | 'linear' | 'github_issue' | 'gitlab_issue' | 'webpush'

export interface NotificationChannel {
  type: AlertChannelType
  target: string
}

export interface Monitor {
  id: string
  user_id: string
  url: string
  name: string
  type: MonitorType
  config: Record<string, any>
  expected_status?: number | null
  check_interval: number
  is_active: boolean
  maintenance: boolean
  parent_monitor_id: string | null
  retry_count: number
  last_check: string | null
  last_status: boolean | null
  last_latency: number | null
  escalation_policy_id?: string | null
  notification_channels: NotificationChannel[]
  uptime_90d?: number | null
  uptime_series?: boolean[]
  created_at: string
  updated_at: string
}

export interface Check {
  id: string
  monitor_id: string
  status_code: number | null
  response_time: number | null
  dns_time: number | null
  tcp_time: number | null
  tls_time: number | null
  ttfb: number | null
  is_up: boolean
  error_message: string | null
  region: string | null
  checked_at: string
}

export interface MonitorStats {
  uptime: number | null
  avgResponseTime: number | null
  p50: number | null
  p75: number | null
  p90: number | null
  p95: number | null
  p99: number | null
  p99_9: number | null
  min: number | null
  max: number | null
  errorRate: number | null
  successRate?: number | null
  avgResponseSize?: number | null
  avgDns: number | null
  avgTcp: number | null
  avgTls: number | null
  avgTtfb: number | null
  totalChecks: number
  checks: Check[]
}

export interface MonitorReport {
  windows: Record<string, number | null>
  stats: MonitorStats
  errorsByCode: Record<string, number>
  incidentCount: number
  incidentDurationAvg: number | null
  mtta: number | null
  mttr: number | null
  mtbf?: number | null
  availability?: number | null
  downtimeMs?: Record<string, number | null>
  slaAllowedMs?: Record<string, number | null>
  slaAchieved?: Record<string, number | null>
  errorBudget: number | null
  slaTarget: number
  daily: Array<{ date: string; uptime: number; avg: number | null }>
}

export interface DowntimeEvent {
  startedAt: string
  resolvedAt: string | null
  duration: number | null
  error: string | null
}

export interface Alert {
  id: string
  monitor_id: string
  type: AlertChannelType
  recipient: string
  message: string
  is_sent: boolean
  sent_at: string | null
  monitors?: { name: string; url: string }
}

export interface StatusPage {
  id: string
  user_id: string
  name: string
  slug: string
  description: string | null
  monitor_ids: string[]
  groups: { name: string; monitor_ids: string[] }[]
  is_public: boolean
  password_hash: string | null
  custom_domain: string | null
  background_color: string
  logo_url: string | null
  branding_default: boolean
  subscriptions_enabled: boolean
  subscribers?: Array<{ id: string; email: string; verified: boolean; created_at: string }>
  created_at: string
}

export type IncidentStatus = 'open' | 'acknowledged' | 'resolving' | 'resolved' | 'closed' | 'reopened'
export type IncidentSeverity = 'informational' | 'low' | 'medium' | 'high' | 'critical'

export interface Incident {
  id: string
  monitor_id: string
  status: IncidentStatus
  severity: IncidentSeverity
  title: string
  assignee: string | null
  tags: string[]
  started_at: string
  acknowledged_at: string | null
  resolved_at: string | null
  closed_at: string | null
  monitors?: { name: string; url: string }
  incident_updates?: IncidentUpdate[]
  incident_tasks?: IncidentTask[]
  postmortem?: { root_cause: string | null; timeline: string | null; actions: string | null }
}

export interface IncidentUpdate {
  id: string
  status: string
  message: string
  visibility: 'public' | 'internal'
  created_at: string
}

export interface IncidentTask {
  id: string
  title: string
  done: boolean
}

export interface MaintenanceWindow {
  id: string
  title: string
  monitor_ids: string[]
  starts_at: string
  ends_at: string
}

export interface ApiKey {
  id: string
  label: string
  created_at: string
  last_used_at: string | null
}

export interface UserStats {
  total: number
  up: number
  down: number
  unknown: number
  alerts_this_month: number
}

export type AlertRuleCondition = 'down_for' | 'latency_above' | 'ssl_expires_within' | 'status_code' | 'keyword' | 'response_size_above' | 'error_rate_above'

export interface AlertRule {
  id: string
  monitor_id: string
  user_id: string
  name: string
  condition: AlertRuleCondition
  threshold: number
  for_minutes: number
  channels: NotificationChannel[]
  enabled: boolean
  consecutive?: number
  last_fired_at: string | null
  last_ok_at: string | null
  created_at: string
  monitors?: { id: string; name: string }
}

export interface MonitorRegion {
  code: string
  label: string
  last_status: boolean | null
  last_check: string | null
  last_latency: number | null
  uptime_24h: number | null
}

export interface EscalationPolicy {
  id: string
  name: string
  steps: Array<{ delay_minutes: number; channels: NotificationChannel[] }>
  created_at: string
}

export interface User {
  id: string
  username: string
  email: string | null
  password_hash: string
  free_tier: boolean
  plan: 'free' | 'pro' | 'business' | 'enterprise'
  created_at: string
  updated_at: string
}

export type MonitorType = 'http' | 'ping' | 'tcp' | 'keyword' | 'heartbeat' | 'dns' | 'ssl' | 'domain'

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
  consecutive_down: number
  consecutive_latency: number
  priority: number
  region: string
  notification_channels: NotificationChannel[]
  created_at: string
  updated_at: string
}

export interface NotificationChannel {
  type: 'email' | 'slack' | 'discord' | 'webhook' | 'telegram' | 'teams'
  target: string
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
  extra: Record<string, any> | null
  checked_at: string
}

export type AlertRuleCondition = 'down_for' | 'latency_above' | 'ssl_expires_within'

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
  consecutive: number
  last_fired_at: string | null
  last_ok_at: string | null
  created_at: string
}

export interface Alert {
  id: string
  monitor_id: string
  type: 'email' | 'slack' | 'discord' | 'webhook' | 'telegram' | 'teams'
  recipient: string
  message: string
  is_sent: boolean
  sent_at: string | null
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
  created_at: string
}

export interface ApiKey {
  id: string
  user_id: string
  key_hash: string
  label: string
  created_at: string
  last_used_at: string | null
}

export interface Incident {
  id: string
  monitor_id: string
  user_id: string
  status: 'open' | 'acknowledged' | 'resolved'
  severity: 'minor' | 'major' | 'critical'
  title: string
  started_at: string
  acknowledged_at: string | null
  resolved_at: string | null
  created_at: string
}

export interface MaintenanceWindow {
  id: string
  user_id: string
  title: string
  monitor_ids: string[]
  starts_at: string
  ends_at: string
  created_at: string
}

export interface AuthRequest extends Request {
  user?: { id: string; email?: string }
}

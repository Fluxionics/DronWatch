import { useState } from 'react'
import { NotificationChannel } from '../types'

interface Props {
  value: NotificationChannel[]
  onChange: (channels: NotificationChannel[]) => void
}

const TYPES: NotificationChannel['type'][] = ['email', 'slack', 'discord', 'webhook', 'telegram', 'teams', 'google_chat', 'pushover', 'gotify', 'mattermost', 'matrix', 'pagerduty', 'opsgenie', 'twilio_sms', 'jira', 'linear', 'github_issue', 'gitlab_issue', 'webpush']

const PLACEHOLDERS: Record<NotificationChannel['type'], string> = {
  email: 'alerts@example.com',
  slack: 'https://hooks.slack.com/services/...',
  discord: 'https://discord.com/api/webhooks/...',
  webhook: 'https://your-server.com/webhook',
  telegram: 'BOT_TOKEN|CHAT_ID',
  teams: 'https://outlook.office.com/webhook/...',
  google_chat: 'https://chat.googleapis.com/v1/spaces/...',
  pushover: 'USER_KEY|APP_TOKEN',
  gotify: 'https://gotify.example.com|APP_TOKEN',
  mattermost: 'https://mattermost.example.com/hooks/...',
  matrix: 'https://matrix.example.com/_matrix/...',
  pagerduty: 'ROUTING_KEY',
  opsgenie: 'API_KEY|ALIAS(optional)',
  twilio_sms: '+15551234567',
  jira: 'ATLASSIAN_TOKEN|BASE_URL|PROJECT_KEY',
  linear: 'API_KEY|TEAM_ID|ASSIGNEE_ID(optional)',
  github_issue: 'GITHUB_TOKEN|OWNER/REPO',
  gitlab_issue: 'GITLAB_TOKEN|PROJECT/PATH',
  webpush: 'https://your-push-server/webhook'
}

const LABELS: Record<NotificationChannel['type'], string> = {
  email: 'Email',
  slack: 'Slack',
  discord: 'Discord',
  webhook: 'Custom Webhook',
  telegram: 'Telegram',
  teams: 'Teams',
  google_chat: 'Google Chat',
  pushover: 'Pushover',
  gotify: 'Gotify',
  mattermost: 'Mattermost',
  matrix: 'Matrix',
  pagerduty: 'PagerDuty',
  opsgenie: 'Opsgenie',
  twilio_sms: 'SMS (Twilio)',
  jira: 'Jira',
  linear: 'Linear',
  github_issue: 'GitHub Issue',
  gitlab_issue: 'GitLab Issue',
  webpush: 'Web Push (webhook)'
}

export default function NotificationChannelPicker({ value, onChange }: Props) {
  const [type, setType] = useState<NotificationChannel['type']>('email')
  const [target, setTarget] = useState('')

  const add = () => {
    if (!target.trim()) return
    onChange([...value, { type, target: target.trim() }])
    setTarget('')
  }

  const remove = (i: number) => {
    onChange(value.filter((_, idx) => idx !== i))
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <select
          value={type}
          onChange={e => setType(e.target.value as NotificationChannel['type'])}
          className="input w-auto"
        >
          {TYPES.map(t => (
            <option key={t} value={t}>{LABELS[t]}</option>
          ))}
        </select>
        <input
          type={type === 'email' ? 'email' : type === 'twilio_sms' ? 'tel' : 'text'}
          className="input flex-1"
          placeholder={PLACEHOLDERS[type]}
          value={target}
          onChange={e => setTarget(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), add())}
        />
        <button type="button" onClick={add} className="btn-primary whitespace-nowrap">
          Add
        </button>
      </div>

      {value.length > 0 && (
        <ul className="space-y-1.5">
          {value.map((ch, i) => (
            <li key={i} className="flex items-center gap-2 rounded-lg border border-surface-700 bg-surface-800 px-3 py-2 text-sm">
              <span className="text-surface-400 font-medium capitalize">{ch.type}</span>
              <span className="flex-1 text-surface-200 font-mono text-xs truncate">{ch.target}</span>
              <button
                type="button"
                onClick={() => remove(i)}
                className="text-surface-500 hover:text-red-400 transition-colors"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

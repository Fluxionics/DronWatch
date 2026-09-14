import nodemailer from 'nodemailer'
import axios from 'axios'
import { supabase } from '../config/supabase'

export type AlertType = 'email' | 'slack' | 'discord' | 'webhook' | 'telegram' | 'teams' | 'google_chat' | 'pushover' | 'gotify' | 'mattermost' | 'matrix' | 'pagerduty' | 'opsgenie' | 'twilio_sms' | 'jira' | 'linear' | 'github_issue' | 'gitlab_issue' | 'webpush'

interface AlertPayload {
  monitorId: string
  type: AlertType
  recipient: string
  message: string
  status: 'down' | 'recovered'
}

export async function sendAlert(payload: AlertPayload) {
  const { data: alert } = await supabase.from('alerts').insert({
    monitor_id: payload.monitorId, type: payload.type, recipient: payload.recipient, message: payload.message
  }).select().single()
  try {
    switch (payload.type) {
      case 'email': await sendEmail(payload.recipient, payload.message, payload.status); break
      case 'slack': await sendSlackMessage(payload.recipient, payload.message, payload.status); break
      case 'discord': await sendDiscordMessage(payload.recipient, payload.message, payload.status); break
      case 'webhook': await sendWebhook(payload.recipient, payload); break
      case 'telegram': await sendTelegram(payload.recipient, payload.message, payload.status); break
      case 'teams': await sendTeams(payload.recipient, payload.message, payload.status); break
      case 'google_chat': await postJson(payload.recipient, { text: `${payload.status === 'down' ? 'DOWN' : 'RECOVERED'}: ${payload.message}` }); break
      case 'pushover': await sendPushover(payload.recipient, payload.message, payload.status); break
      case 'gotify': await sendGotify(payload.recipient, payload.message); break
      case 'mattermost': await postJson(payload.recipient, { text: payload.message, username: 'DronWatch' }); break
      case 'matrix': case 'webpush': await postJson(payload.recipient, { text: payload.message }); break
      case 'pagerduty': await sendPagerDuty(payload.recipient, payload.message, payload.status); break
      case 'opsgenie': await sendOpsgenie(payload.recipient, payload.message, payload.status); break
      case 'twilio_sms': await sendTwilioSms(payload.recipient, payload.message); break
      case 'jira': await sendIssue(payload.recipient, payload.message, 'jira'); break
      case 'linear': await sendIssue(payload.recipient, payload.message, 'linear'); break
      case 'github_issue': await sendIssue(payload.recipient, payload.message, 'github'); break
      case 'gitlab_issue': await sendIssue(payload.recipient, payload.message, 'gitlab'); break
    }
    if (alert) await supabase.from('alerts').update({ is_sent: true, sent_at: new Date().toISOString() }).eq('id', alert.id)
  } catch (err) {
    console.error(`Failed to send ${payload.type} alert:`, err)
    await supabase.from('alerts').update({ is_sent: false }).eq('id', alert.id)
    throw err
  }
}

export function getMailer() {
  return nodemailer.createTransport({ service: 'gmail', auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD } })
}

function escapeHtml(s: string): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

export async function sendEmail(to: string, message: string, status: string) {
  const transporter = getMailer()
  const subject = status === 'down' ? 'Monitor Alert: Service is DOWN' : 'Monitor Alert: Service Recovered'
  await transporter.sendMail({
    from: `DronWatch <${process.env.GMAIL_USER}>`, to, subject, text: message,
    html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto"><div style="background:${status === 'down' ? '#ef4444' : '#10b981'};padding:20px;border-radius:8px 8px 0 0"><h2 style="color:white;margin:0">${status === 'down' ? 'Service Down' : 'Service Recovered'}</h2></div><div style="padding:20px;background:#f9fafb;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px"><p style="color:#374151;white-space:pre-wrap">${escapeHtml(message)}</p><a href="${escapeHtml(process.env.FRONTEND_URL || '')}/dashboard" style="display:inline-block;background:#3b82f6;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;margin-top:16px">View Dashboard</a></div></div>`
  })
}

export async function sendSubscriberEmail(to: string, subject: string, html: string) {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) return
  const transporter = getMailer()
  await transporter.sendMail({
    from: `DronWatch Status <${process.env.GMAIL_USER}>`, to, subject, html
  })
}

async function postJson(url: string, data: any) {
  await axios.post(url, data, { timeout: 10000 })
}

async function sendSlackMessage(url: string, message: string, status: string) {
  await postJson(url, { text: message, attachments: [{ color: status === 'down' ? '#ef4444' : '#10b981', text: message, footer: 'DronWatch', ts: Math.floor(Date.now() / 1000) }] })
}
async function sendDiscordMessage(url: string, message: string, status: string) {
  await postJson(url, { embeds: [{ title: status === 'down' ? 'Service Down' : 'Service Recovered', description: message, color: status === 'down' ? 0xef4444 : 0x10b981, timestamp: new Date().toISOString(), footer: { text: 'DronWatch' } }] })
}
async function sendWebhook(url: string, payload: AlertPayload) {
  await postJson(url, { event: `monitor.${payload.status}`, monitor_id: payload.monitorId, message: payload.message, timestamp: new Date().toISOString() })
}
async function sendTelegram(tokenAndChat: string, message: string, status: string) {
  const [botToken, chatId] = tokenAndChat.split('|')
  if (!botToken || !chatId) throw new Error('Telegram format must be BOT_TOKEN|CHAT_ID')
  const text = `${status === 'down' ? 'DOWN' : 'UP'} ${message}`
  await postJson(`https://api.telegram.org/bot${botToken}/sendMessage`, { chat_id: chatId, text })
}
async function sendTeams(url: string, message: string, status: string) {
  await postJson(url, { '@type': 'MessageCard', '@context': 'https://schema.org/extensions', summary: message, themeColor: status === 'down' ? 'EF4444' : '10B981', sections: [{ activityTitle: status === 'down' ? 'Service Down' : 'Service Recovered', text: message }] })
}
async function sendPushover(recipient: string, message: string, status: string) {
  const [user, token] = recipient.split('|')
  if (!user || !token) throw new Error('Pushover format must be USER_KEY|APP_TOKEN')
  await postJson('https://api.pushover.net/1/messages.json', { user, token, message, title: status === 'down' ? 'DronWatch: DOWN' : 'DronWatch: UP', priority: status === 'down' ? 1 : 0 })
}
async function sendGotify(recipient: string, message: string) {
  const [baseUrl, appToken] = recipient.split('|')
  if (!baseUrl || !appToken) throw new Error('Gotify format must be HOST|APP_TOKEN')
  await axios.post(baseUrl.replace(/\/$/, '') + '/message', { title: 'DronWatch', message, priority: 5 }, { headers: { 'X-Gotify-Key': appToken }, timeout: 10000 })
}
async function sendPagerDuty(recipient: string, message: string, status: string) {
  const routingKey = recipient.split('|')[0]
  if (!routingKey) throw new Error('PagerDuty format must be ROUTING_KEY')
  await postJson('https://events.pagerduty.com/v2/enqueue', {
    routing_key: routingKey, event_action: status === 'down' ? 'trigger' : 'resolve',
    dedup_key: `dronwatch-${message.split(' ')[0]}`, payload: {
      summary: message.split('\n')[0], source: 'DronWatch', severity: status === 'down' ? 'critical' : 'info', timestamp: new Date().toISOString()
    }
  })
}
async function sendOpsgenie(recipient: string, message: string, status: string) {
  const [apiKey, alias] = recipient.split('|')
  if (!apiKey) throw new Error('Opsgenie format must be API_KEY')
  const url = status === 'down' ? 'https://api.opsgenie.com/v2/alerts' : `https://api.opsgenie.com/v2/alerts/${alias || encodeURIComponent(message.split('\n')[0])}/close`
  await axios.post(url, status === 'down' ? { message: message.split('\n')[0], description: message, alias: alias || message.split('\n')[0], priority: 'P1' } : { note: 'Recovered' }, { headers: { Authorization: `GenieKey ${apiKey}` }, timeout: 10000 })
}
async function sendTwilioSms(recipient: string, message: string) {
  const sid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  const from = process.env.TWILIO_FROM_NUMBER
  if (!sid || !token || !from) throw new Error('Twilio credentials not configured in env')
  const body = new URLSearchParams({ To: recipient, From: from, Body: message })
  await axios.post(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, body.toString(), { auth: { username: sid, password: token }, timeout: 15000 })
}
async function sendIssue(recipient: string, message: string, kind: string) {
  const [token, target] = recipient.split('|')
  if (!token || !target) throw new Error(`${kind} format must be TOKEN|TARGET`)
  const title = message.split('\n')[0]
  const desc = message.split('\n').slice(1).join('\n')
  if (kind === 'github') {
    const [owner, repo] = target.split('/')
    if (!owner || !repo) throw new Error('github target must be OWNER/REPO')
    await axios.post(`https://api.github.com/repos/${owner}/${repo}/issues`, { title, body: desc }, { headers: { Authorization: `Bearer ${token}`, 'User-Agent': 'DronWatch', 'X-GitHub-Api-Version': '2022-11-28' }, timeout: 15000 })
  } else if (kind === 'gitlab') {
    const [project, ...rest] = target.split('/')
    const pid = encodeURIComponent([project, ...rest].join('/'))
    await axios.post(`https://gitlab.com/api/v4/projects/${pid}/issues`, new URLSearchParams({ title, description: desc }).toString(), { headers: { 'PRIVATE-TOKEN': token }, timeout: 15000 })
  } else if (kind === 'jira') {
    const [baseUrl, project] = target.split('|')
    if (!baseUrl) throw new Error('jira target must be BASE_URL|PROJECT_KEY')
    await axios.post(baseUrl.replace(/\/$/, '') + '/rest/api/2/issue', { fields: { project: { key: project }, summary: title, description: desc, issuetype: { name: 'Bug' } } }, { headers: { Authorization: `Bearer ${token}` }, timeout: 15000 })
  } else if (kind === 'linear') {
    const [teamId, name] = target.split('|')
    await axios.post('https://api.linear.app/graphql', { query: `mutation { issueCreate(input: { teamId: "${teamId}", title: "${title.replace(/"/g, '\\"')}", description: "${desc.replace(/"/g, '\\"')}" ${name ? `, assigneeId: "${name}"` : ''} }) { success } }` }, { headers: { Authorization: token }, timeout: 15000 })
  }
}
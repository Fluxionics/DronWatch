import { Monitor } from '../types'

export interface SyntheticStep {
  action: 'goto' | 'click' | 'fill' | 'waitFor' | 'assert'
  url?: string
  selector?: string
  value?: string
  contains?: string
  timeout?: number
}

export async function runSyntheticCheck(monitor: Monitor): Promise<{ isUp: boolean; responseTime: number; error: string | null; steps: Array<{ step: number; action: string; ok: boolean; error?: string; duration: number }> }> {
  const cfg = monitor.config || {}
  const steps: SyntheticStep[] = Array.isArray(cfg.synthetic_steps) ? cfg.synthetic_steps : []
  if (steps.length === 0) return { isUp: false, responseTime: 0, error: 'No synthetic steps configured', steps: [] }
  const overallStart = Date.now()
  let playwright: any
  try {
    playwright = await import('playwright')
  } catch {
    return { isUp: false, responseTime: Date.now() - overallStart, error: 'Playwright not installed on this host — synthetic checks require `npm i playwright && npx playwright install chromium`', steps: [] }
  }
  const browser = await playwright.chromium.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] })
  const context = await browser.newContext()
  const page = await context.newPage()
  const results: Array<{ step: number; action: string; ok: boolean; error?: string; duration: number }> = []
  let isUp = true
  let error: string | null = null
  const timeout = cfg.synthetic_timeout || 30000
  page.setDefaultTimeout(timeout)
  page.setDefaultNavigationTimeout(timeout)
  try {
    for (let i = 0; i < steps.length; i++) {
      const s = steps[i]
      const stepStart = Date.now()
      try {
        switch (s.action) {
          case 'goto': {
            const url = s.url || monitor.url
            if (!url) throw new Error('goto requires url')
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: s.timeout || timeout })
            break
          }
          case 'click': {
            if (!s.selector) throw new Error('click requires selector')
            await page.click(s.selector, { timeout: s.timeout || timeout })
            break
          }
          case 'fill': {
            if (!s.selector) throw new Error('fill requires selector')
            await page.fill(s.selector, s.value || '', { timeout: s.timeout || timeout })
            break
          }
          case 'waitFor': {
            if (!s.selector) throw new Error('waitFor requires selector')
            await page.waitForSelector(s.selector, { timeout: s.timeout || timeout })
            break
          }
          case 'assert': {
            if (!s.selector) throw new Error('assert requires selector')
            const el = await page.$(s.selector)
            if (!el) throw new Error(`assert: selector "${s.selector}" not found`)
            const text = await el.textContent()
            const needle = s.contains || s.value || ''
            if (needle && !String(text || '').includes(needle)) throw new Error(`assert: "${needle}" not found in "${String(text || '').slice(0, 120)}"`)
            break
          }
          default: throw new Error(`Unknown action: ${(s as any).action}`)
        }
        results.push({ step: i + 1, action: s.action, ok: true, duration: Date.now() - stepStart })
      } catch (e: any) {
        results.push({ step: i + 1, action: s.action, ok: false, error: e.message, duration: Date.now() - stepStart })
        isUp = false
        error = `Step ${i + 1} (${s.action}) failed: ${e.message}`
        break
      }
    }
  } finally {
    try { await page.close() } catch {}
    try { await context.close() } catch {}
    try { await browser.close() } catch {}
  }
  return { isUp, responseTime: Date.now() - overallStart, error, steps: results }
}

import { Link } from 'react-router-dom'

export default function Landing() {
  return (
    <div className="min-h-screen bg-surface-950 text-surface-100">
      <header className="sticky top-0 z-40 backdrop-blur-md bg-surface-950/70 border-b border-surface-800/60">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-brand-500 flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
            </div>
            <span className="font-semibold text-surface-50 tracking-tight">DronWatch</span>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/auth" className="btn-ghost text-sm">Sign in</Link>
            <Link to="/auth?mode=register" className="btn-primary text-sm">Get started free</Link>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_-10%,rgba(59,130,246,0.25),transparent)] pointer-events-none" />

        <div className="relative max-w-4xl mx-auto px-6 py-24 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 text-xs text-emerald-400 mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Everything UptimeRobot charges for — completely free
          </div>
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight text-surface-50 mb-6 leading-tight">
            Know before your
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-400 to-emerald-400"> users do</span>
          </h1>
          <p className="text-lg text-surface-400 mb-10 max-w-2xl mx-auto">
            Monitor URLs and APIs with checks up to every minute. The premium features other tools put
            behind Pro or Enterprise plans — unlimited monitors, custom intervals, dedicated alerts —
            are all free here.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/auth?mode=register" className="btn-primary text-base px-6 py-3">
              Start monitoring for free
            </Link>
            <a href="https://github.com/Fluxionics/DronWatch" target="_blank" rel="noopener noreferrer" className="btn-ghost text-base px-6 py-3">
              View on GitHub
            </a>
          </div>
          <p className="text-xs text-surface-600 mt-4">No credit card. No limits. No expiry.</p>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-6 pb-4">
        <div className="grid md:grid-cols-3 gap-4">
          {features.map(f => (
            <div key={f.title} className="card hover:border-brand-500/40 transition-colors group">
              <div className="w-9 h-9 rounded-lg bg-brand-500/15 flex items-center justify-center mb-4 group-hover:bg-brand-500/25 transition-colors">
                <f.Icon />
              </div>
              <h3 className="font-semibold text-surface-50 mb-2">{f.title}</h3>
              <p className="text-sm text-surface-400">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-6 py-16">
        <h2 className="text-2xl font-bold text-surface-50 mb-2 text-center">
          Better than the paid plans
        </h2>
        <p className="text-surface-400 text-center text-sm mb-10">
          A feature-by-feature look at what premium tools sell — and what you get free here.
        </p>

        <div className="card overflow-hidden p-0">
          <div className="grid grid-cols-2 text-sm border-b border-surface-800">
            <div className="px-5 py-3 text-xs uppercase tracking-wider text-surface-600">Feature</div>
            <div className="grid grid-cols-2">
              <div className="px-4 py-3 text-surface-400 text-center">UptimeRobot</div>
              <div className="px-4 py-3 text-emerald-400 font-medium text-center">DronWatch</div>
            </div>
          </div>
          <div className="divide-y divide-surface-800">
            {comparison.map(row => (
              <div key={row.feature} className="grid grid-cols-2 text-sm">
                <div className="px-5 py-3.5 text-surface-300">{row.feature}</div>
                <div className="grid grid-cols-2 items-center">
                  <div className="px-4 py-3.5 text-surface-600 text-center">
                    {row.theirs === 'free' ? 'Free' : `Paid · ${row.theirs}`}
                  </div>
                  <div className="px-4 py-3.5 text-center">
                    <span className="inline-flex items-center gap-1.5 text-emerald-400">
                      <CheckIcon /> Free
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-6 py-16">
        <h2 className="text-2xl font-bold text-surface-50 mb-10 text-center">
          Everything you need, nothing you don't
        </h2>
        <div className="grid sm:grid-cols-2 gap-3">
          {checklist.map(item => (
            <div key={item} className="flex items-center gap-3 text-sm text-surface-300">
              <CheckIcon className="text-emerald-400 shrink-0" />
              {item}
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-surface-800 py-16 bg-surface-900/30">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 text-xs text-emerald-400 mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Free forever
          </div>
          <h2 className="text-2xl font-bold text-surface-50 mb-3">No plans. No paywalls. No limits.</h2>
          <p className="text-surface-400 mb-8">Create an account with just a username and password.</p>
          <div className="card text-left mb-6">
            <ul className="space-y-3 text-sm text-surface-300">
              {freeTier.map(item => (
                <li key={item} className="flex items-center gap-2.5">
                  <CheckIcon className="text-brand-400 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <Link to="/auth?mode=register" className="btn-primary w-full text-base py-3">
            Create your free account
          </Link>
        </div>
      </section>

      <footer className="border-t border-surface-800 py-8">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-surface-600">
          <span>DronWatch — Free, open-source uptime monitoring</span>
          <div className="flex gap-5">
            <a href="https://github.com/Fluxionics/DronWatch" target="_blank" rel="noopener noreferrer" className="hover:text-surface-400 transition-colors">GitHub</a>
            <span>MIT License</span>
          </div>
        </div>
      </footer>
    </div>
  )
}

function CheckIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={`w-4 h-4 ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function BellIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
}
function ChartIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>
}
function PageIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>
}

const features = [
  { title: 'Instant alerts', desc: 'Get notified within minutes when your service goes down, via email, Slack, Discord, or custom webhooks.', Icon: BellIcon },
  { title: 'Uptime history', desc: 'Track uptime percentage and response times over 7, 30, or 90 days with detailed charts.', Icon: ChartIcon },
  { title: 'Public status pages', desc: 'Share a branded status page with your users so they always know what\'s happening.', Icon: PageIcon }
]

const comparison = [
  { feature: 'Unlimited monitors', theirs: 'Pro plan' },
  { feature: '1-minute check intervals', theirs: 'Pro plan' },
  { feature: 'Unlimited status pages', theirs: 'Pro plan' },
  { feature: '90-day report history', theirs: 'Standard' },
  { feature: 'Slack & Discord alerts', theirs: 'Free' },
  { feature: 'Custom webhooks', theirs: 'Pro plan' },
  { feature: 'Public REST API', theirs: 'Pro plan' },
  { feature: 'Dedicated support & SLA', theirs: 'Enterprise' }
]

const checklist = [
  'HTTP and HTTPS monitoring',
  'Checks up to every minute',
  'Email notifications',
  'Slack and Discord alerts',
  'Custom webhook support',
  'Public status pages',
  'Response time tracking',
  'Downtime event history',
  'Uptime percentage reports',
  'REST API access'
]

const freeTier = [
  'Unlimited monitors',
  'Monitoring intervals as low as 1 minute',
  'Unlimited public status pages',
  '90-day uptime history and response-time charts',
  'Email, Slack, and Discord alerts',
  'Custom webhooks',
  'Full REST API access',
  'Anonymous sign-up — just a username and password',
  'No credit card required, forever'
]
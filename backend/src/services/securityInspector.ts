export interface SecurityAssessment {
  score: string // A+, A, B, C, D, F
  grade: number // 0-100
  checks: Array<{ name: string; pass: boolean; detail: string }>
  summary: string
}

export function assessSecurity(headers: Record<string, any>, tls: { version?: string | null; cipher?: string | null; daysLeft?: number | null; chainLength?: number | null } = {}): SecurityAssessment {
  const h = Object.fromEntries(Object.entries(headers || {}).map(([k, v]) => [k.toLowerCase(), String(v)]))
  const checks: SecurityAssessment['checks'] = []

  const hsts = h['strict-transport-security'] || ''
  const hstsPass = /max-age\s*=\s*(\d+)/i.test(hsts) && Number((hsts.match(/max-age\s*=\s*(\d+)/i) || [])[1] || 0) >= 15552000
  checks.push({ name: 'HSTS', pass: hstsPass, detail: hsts ? hsts.slice(0, 120) : 'missing' })

  const csp = h['content-security-policy'] || h['content-security-policy-report-only'] || ''
  checks.push({ name: 'CSP', pass: !!csp, detail: csp ? csp.slice(0, 120) : 'missing' })

  const xfo = h['x-frame-options'] || ''
  checks.push({ name: 'X-Frame-Options', pass: /deny|sameorigin/i.test(xfo), detail: xfo || 'missing' })

  const xcto = h['x-content-type-options'] || ''
  checks.push({ name: 'X-Content-Type-Options', pass: /nosniff/i.test(xcto), detail: xcto || 'missing' })

  const rp = h['referrer-policy'] || ''
  checks.push({ name: 'Referrer-Policy', pass: !!rp, detail: rp || 'missing' })

  const pp = h['permissions-policy'] || h['feature-policy'] || ''
  checks.push({ name: 'Permissions-Policy', pass: !!pp, detail: pp ? pp.slice(0, 80) : 'missing' })

  const tlsVer = tls.version || ''
  const tlsPass = /TLSv1\.3/i.test(tlsVer) || /TLSv1\.2/i.test(tlsVer)
  checks.push({ name: 'TLS version', pass: tlsPass, detail: tlsVer || 'unknown' })

  const cipher = tls.cipher || ''
  const cipherPass = !!cipher && !/RC4|DES|3DES|NULL|EXPORT|LOW/i.test(cipher)
  checks.push({ name: 'Cipher', pass: cipherPass, detail: cipher || 'unknown' })

  const days = tls.daysLeft ?? null
  const certPass = days === null || days > 30
  checks.push({ name: 'Certificate expiry', pass: certPass, detail: days === null ? 'n/a' : `${days}d left` })

  const chain = tls.chainLength ?? null
  const chainPass = chain === null || chain >= 2
  checks.push({ name: 'Certificate chain', pass: chainPass, detail: chain === null ? 'n/a' : `${chain} certs` })

  const passed = checks.filter(c => c.pass).length
  const grade = Math.round((passed / checks.length) * 100)
  let score = 'F'
  if (grade >= 95) score = 'A+'
  else if (grade >= 85) score = 'A'
  else if (grade >= 70) score = 'B'
  else if (grade >= 55) score = 'C'
  else if (grade >= 40) score = 'D'

  const summary = `${passed}/${checks.length} checks passed — ${score} (${grade}%)`
  return { score, grade, checks, summary }
}

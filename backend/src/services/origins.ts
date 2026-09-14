import { supabase } from '../config/supabase'

let cache = { origins: [] as string[], at: 0 }

export async function getAllowedOrigins(frontendUrl: string): Promise<string[]> {
  if (Date.now() - cache.at > 300000 || cache.origins.length === 0) {
    try {
      const { data } = await supabase
        .from('status_pages')
        .select('custom_domain')
        .not('custom_domain', 'is', null)
      const domains = ((data || []) as Array<{ custom_domain: string | null }>)
        .map(p => String(p.custom_domain || '').trim().toLowerCase())
        .filter(Boolean)
      const set = new Set<string>(domains.flatMap(d => [`https://${d}`, `http://${d}`]))
      cache = { origins: [frontendUrl, ...Array.from(set)], at: Date.now() }
    } catch {
      if (cache.origins.length === 0) cache = { origins: [frontendUrl], at: Date.now() }
    }
  }
  return cache.origins
}
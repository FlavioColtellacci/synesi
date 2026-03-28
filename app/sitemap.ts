import type { MetadataRoute } from 'next'

/** Align with `metadataBase` in app/layout.tsx */
const BASE = 'https://synesi.app'

/**
 * Public indexable routes (marketing, legal, auth entry).
 * `/learn/confirmation-bias-investing` per SEO phase 1 handoff (omit crypto use-case until product scope includes it).
 */
const PUBLIC_PATHS: MetadataRoute.Sitemap = [
  '/',
  '/pricing',
  '/manifesto',
  '/privacy',
  '/terms',
  '/login',
  '/signup',
  '/use-cases/investment-journal',
  '/use-cases/thesis-validation',
  '/learn/confirmation-bias-investing',
].map((path) => ({
  url: `${BASE}${path === '/' ? '' : path}`,
  lastModified: new Date(),
  changeFrequency: path === '/' ? ('weekly' as const) : ('monthly' as const),
  priority: path === '/' ? 1 : 0.8,
}))

export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_PATHS
}

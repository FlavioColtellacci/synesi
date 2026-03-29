import type { Metadata } from 'next'
import { Suspense } from 'react'
import { SITE_ORIGIN } from '@/lib/marketing/site-origin'
import { PricingPageContent, PricingPageFallback } from './pricing-page-client'

const description =
  'Synesi Pro pricing: monthly and annual plans for thesis tracking with Sigma—document conviction, validate against reality, and keep your investment narrative organized.'

export const metadata: Metadata = {
  title: 'Pricing',
  description,
  alternates: {
    canonical: `${SITE_ORIGIN}/pricing`,
  },
  openGraph: {
    type: 'website',
    url: `${SITE_ORIGIN}/pricing`,
    siteName: 'SYNESI',
    title: 'Pricing | SYNESI',
    description,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Pricing | SYNESI',
    description,
  },
}

export default function PricingPage() {
  return (
    <Suspense fallback={<PricingPageFallback />}>
      <PricingPageContent />
    </Suspense>
  )
}

import { Suspense } from 'react'
import type { Metadata } from 'next'
import { PricingPageContent, PricingPageFallback } from './pricing-page-client'

export const metadata: Metadata = {
  title: 'Pricing',
  description:
    'See SYNESI pricing for thesis-driven investors: track your investment journal, run Sigma AI stress-tests, and monitor conviction with Sigma Monitor.',
}

export default function PricingPage() {
  return (
    <Suspense fallback={<PricingPageFallback />}>
      <PricingPageContent />
    </Suspense>
  )
}

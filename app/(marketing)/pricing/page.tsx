import { Suspense } from 'react'
import { PricingPageContent, PricingPageFallback } from './pricing-page-client'

export default function PricingPage() {
  return (
    <Suspense fallback={<PricingPageFallback />}>
      <PricingPageContent />
    </Suspense>
  )
}

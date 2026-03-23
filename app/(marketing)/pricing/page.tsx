'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { trackFunnelEvent } from '@/lib/analytics'
import LandingFooter from '@/components/landing/LandingFooter'
import MarketingPageNav from '@/components/landing/MarketingPageNav'

type Plan = 'monthly' | 'annual'

export default function PricingPage() {
  const [monthlyLoading, setMonthlyLoading] = useState(false)
  const [annualLoading, setAnnualLoading] = useState(false)
  const features = [
    "Unlimited thesis positions",
    "AI thesis analysis",
    "Event-triggered review prompts",
    "Full audit trail",
    "Thesis health dashboard",
  ]

  useEffect(() => {
    trackFunnelEvent("pricing_view")
  }, [])

  async function handleSubscribe(plan: Plan) {
    setMonthlyLoading(plan === 'monthly')
    setAnnualLoading(plan === 'annual')

    try {
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      })

      const data: unknown = await response.json()

      if (
        !response.ok ||
        typeof data !== 'object' ||
        data === null ||
        !('url' in data) ||
        typeof data.url !== 'string'
      ) {
        const message =
          typeof data === 'object' &&
          data !== null &&
          'error' in data &&
          typeof data.error === 'string'
            ? data.error
            : 'Unable to start checkout.'
        throw new Error(message)
      }

      trackFunnelEvent("checkout_start", { plan })
      window.location.href = data.url
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to start checkout.'
      alert(message)
      setMonthlyLoading(false)
      setAnnualLoading(false)
    }
  }

  const isEitherLoading = monthlyLoading || annualLoading

  return (
    <main className="min-h-screen bg-synesi-bg text-synesi-text">
      <MarketingPageNav activeItem="pricing" />

      <div className="px-4 pb-12 pt-40 md:pb-16">
        <div className="mx-auto flex w-full max-w-5xl flex-col items-center">
          <header className="mb-16 text-center">
            <p
              className="mb-4 font-[var(--font-mono)] text-2xl text-white"
              aria-hidden="true"
              style={{
                textShadow:
                  "-1.5px 0 0 rgba(255,50,50,0.7), 1.5px 0 0 rgba(0,210,255,0.7)",
              }}
            >
              Σ
            </p>
            <h1 className="font-[var(--font-mono)] text-3xl tracking-widest md:text-4xl">
              CONVICTION HAS A PRICE.
            </h1>
            <p className="mt-3 font-[var(--font-sans)] text-sm text-synesi-muted">
              One plan. All features. No free tier.
            </p>
          </header>

          <section className="mx-auto grid w-full max-w-2xl grid-cols-1 gap-6 md:grid-cols-2">
            <article className="flex flex-col rounded-xl border border-[#2A2A32] bg-[#141418] p-8">
              <p className="mb-4 font-mono text-xs uppercase tracking-widest text-[#6B6B7B]">
                PRO MONTHLY
              </p>
              <p className="mb-1 font-mono text-4xl font-medium text-[#F0F0F0]">$15</p>
              <p className="mb-8 font-mono text-xs tracking-wide text-[#6B6B7B]">per month</p>

              <div className="mb-10 flex flex-1 flex-col gap-3">
                {features.map((feature) => (
                  <div key={feature} className="flex items-start">
                    <span className="mr-3 font-mono text-xs text-[#00D1B2]">✓</span>
                    <span className="font-sans text-sm text-[#6B6B7B]">{feature}</span>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={() => handleSubscribe('monthly')}
                disabled={isEitherLoading}
                className="mt-auto block w-full rounded-lg border border-[#2A2A32] py-3.5 text-center font-mono text-xs uppercase tracking-widest text-[#F0F0F0] transition-colors hover:border-[#F0F0F0] hover:bg-[#1C1C22] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {monthlyLoading ? 'LOADING...' : 'GET STARTED →'}
              </button>
            </article>

            <article className="relative flex flex-col rounded-xl border border-[#F0F0F0] bg-[#141418] p-8">
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-[#F0F0F0] px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-[#0A0A0C]">
                BEST VALUE
              </span>

              <p className="mb-4 font-mono text-xs uppercase tracking-widest text-[#6B6B7B]">
                PRO ANNUAL
              </p>
              <p className="mb-1 font-mono text-4xl font-medium text-[#F0F0F0]">$99</p>
              <p className="font-mono text-xs tracking-wide text-[#6B6B7B]">
                per year · ~$8.25/month
              </p>
              <p className="mb-8 mt-2 font-mono text-[10px] tracking-widest text-[#00D1B2]">
                SAVE ~45% VS MONTHLY
              </p>

              <div className="mb-10 flex flex-1 flex-col gap-3">
                {features.map((feature) => (
                  <div key={feature} className="flex items-start">
                    <span className="mr-3 font-mono text-xs text-[#00D1B2]">✓</span>
                    <span className="font-sans text-sm text-[#6B6B7B]">{feature}</span>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={() => handleSubscribe('annual')}
                disabled={isEitherLoading}
                className="mt-auto block w-full rounded-lg bg-[#FFFFFF] py-3.5 text-center font-mono text-xs font-medium uppercase tracking-widest text-[#0A0A0C] transition-colors hover:bg-[#E8E8E8] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {annualLoading ? 'LOADING...' : 'GET STARTED →'}
              </button>
            </article>
          </section>

        </div>
      </div>
      <LandingFooter />
    </main>
  )
}

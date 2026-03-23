'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { trackFunnelEvent } from '@/lib/analytics'
import LandingFooter from '@/components/landing/LandingFooter'

type Plan = 'monthly' | 'annual'

export default function PricingPage() {
  const [monthlyLoading, setMonthlyLoading] = useState(false)
  const [annualLoading, setAnnualLoading] = useState(false)

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
      <div className="mx-auto w-full max-w-6xl px-4 pt-4 md:pt-6">
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-2 font-[var(--font-mono)] text-xs tracking-widest text-synesi-text"
          >
            <span
              aria-hidden="true"
              style={{
                textShadow:
                  '-1.5px 0 0 rgba(255,50,50,0.7), 1.5px 0 0 rgba(0,210,255,0.7)',
              }}
            >
              Σ
            </span>
            <span>SYNESI</span>
          </Link>

          <div className="hidden md:flex items-center gap-6">
            <Link
              href="/#features"
              className="font-mono text-xs uppercase tracking-[0.12em] text-[#6B6B7B] transition-colors hover:text-[#F0F0F0]"
            >
              Product
            </Link>
            <Link
              href="/pricing"
              className="font-mono text-xs uppercase tracking-[0.12em] text-[#F0F0F0] transition-colors"
            >
              Pricing
            </Link>
            <Link
              href="/manifesto"
              className="font-mono text-xs uppercase tracking-[0.12em] text-[#6B6B7B] transition-colors hover:text-[#F0F0F0]"
            >
              Manifesto
            </Link>
            <Link
              href="/use-cases/investment-journal"
              className="font-mono text-xs uppercase tracking-[0.12em] text-[#6B6B7B] transition-colors hover:text-[#F0F0F0]"
            >
              Investment Journal
            </Link>
            <Link
              href="/use-cases/thesis-validation"
              className="font-mono text-xs uppercase tracking-[0.12em] text-[#6B6B7B] transition-colors hover:text-[#F0F0F0]"
            >
              AI Thesis Validation
            </Link>
          </div>

          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="inline-flex items-center rounded-lg border border-synesi-border px-3 py-2 font-[var(--font-mono)] text-[10px] uppercase tracking-widest text-synesi-muted transition-colors hover:border-white hover:text-white"
            >
              ← Back to Home
            </Link>
            <Link
              href="/login"
              className="hidden md:inline-flex font-mono text-xs uppercase tracking-[0.12em] text-[#6B6B7B] transition-colors hover:text-[#F0F0F0]"
            >
              LOG IN
            </Link>
            <Link
              href="/signup"
              className="hidden md:inline-flex font-mono text-xs uppercase tracking-[0.12em] text-[#F0F0F0] transition-colors hover:text-white"
            >
              GET STARTED →
            </Link>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-5 overflow-x-auto pb-1 md:hidden">
          <Link
            href="/#features"
            className="whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.12em] text-[#6B6B7B] transition-colors hover:text-[#F0F0F0]"
          >
            Product
          </Link>
          <Link
            href="/pricing"
            className="whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.12em] text-[#F0F0F0] transition-colors"
          >
            Pricing
          </Link>
          <Link
            href="/manifesto"
            className="whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.12em] text-[#6B6B7B] transition-colors hover:text-[#F0F0F0]"
          >
            Manifesto
          </Link>
          <Link
            href="/use-cases/investment-journal"
            className="whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.12em] text-[#6B6B7B] transition-colors hover:text-[#F0F0F0]"
          >
            Investment Journal
          </Link>
          <Link
            href="/use-cases/thesis-validation"
            className="whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.12em] text-[#6B6B7B] transition-colors hover:text-[#F0F0F0]"
          >
            AI Thesis Validation
          </Link>
          <Link
            href="/login"
            className="whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.12em] text-[#6B6B7B] transition-colors hover:text-[#F0F0F0]"
          >
            LOG IN
          </Link>
          <Link
            href="/signup"
            className="whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.12em] text-[#F0F0F0] transition-colors hover:text-white"
          >
            GET STARTED →
          </Link>
        </div>
      </div>

      <div className="px-4 py-12 md:py-16">
        <div className="mx-auto flex w-full max-w-5xl flex-col items-center">
          <header className="mb-16 text-center">
            <p className="mb-4 font-[var(--font-mono)] text-2xl text-white">Σ</p>
            <h1 className="font-[var(--font-mono)] text-3xl tracking-widest md:text-4xl">
              CONVICTION HAS A PRICE.
            </h1>
            <p className="mt-3 font-[var(--font-sans)] text-sm text-synesi-muted">
              One plan. All features. No free tier.
            </p>
          </header>

          <section className="flex w-full max-w-2xl flex-col gap-6 md:flex-row">
            <article className="flex-1 rounded-xl border border-synesi-border bg-synesi-surface p-8">
              <p className="font-[var(--font-mono)] text-xs tracking-widest text-synesi-muted uppercase">
                PRO MONTHLY
              </p>
              <div className="mt-4 flex items-end gap-2">
                <p className="font-[var(--font-mono)] text-5xl text-synesi-text">$15</p>
                <p className="pb-1 font-[var(--font-sans)] text-sm text-synesi-muted">/month</p>
              </div>
              <div className="my-6 border-t border-synesi-border" />
              <ul className="space-y-2 font-[var(--font-sans)] text-sm text-synesi-muted">
                <li>Unlimited thesis positions</li>
                <li>AI thesis analysis</li>
                <li>Event-triggered review prompts</li>
                <li>Full audit trail</li>
              </ul>
              <button
                type="button"
                onClick={() => handleSubscribe('monthly')}
                disabled={isEitherLoading}
                className="mt-8 w-full rounded-lg bg-synesi-accent p-3 font-[var(--font-sans)] text-sm font-medium text-black transition hover:bg-synesi-accent-hover disabled:cursor-not-allowed disabled:opacity-70"
              >
                {monthlyLoading ? 'LOADING...' : 'SUBSCRIBE →'}
              </button>
            </article>

            <article className="flex-1 rounded-xl border-2 border-synesi-accent bg-synesi-surface p-8">
              <span className="mb-4 inline-block rounded-full border border-synesi-border bg-synesi-elevated px-3 py-1 font-[var(--font-mono)] text-xs tracking-widest text-synesi-text">
                BEST VALUE
              </span>
              <p className="font-[var(--font-mono)] text-xs tracking-widest text-synesi-muted uppercase">
                PRO ANNUAL
              </p>
              <div className="mt-4 flex items-end gap-2">
                <p className="font-[var(--font-mono)] text-5xl text-synesi-text">$99</p>
                <p className="pb-1 font-[var(--font-sans)] text-sm text-synesi-muted">/year</p>
              </div>
              <p className="mt-1 font-[var(--font-sans)] text-xs text-synesi-muted">
                ~$8.25/month · save 45%
              </p>
              <div className="my-6 border-t border-synesi-border" />
              <ul className="space-y-2 font-[var(--font-sans)] text-sm text-synesi-muted">
                <li>Unlimited thesis positions</li>
                <li>AI thesis analysis</li>
                <li>Event-triggered review prompts</li>
                <li>Full audit trail</li>
              </ul>
              <button
                type="button"
                onClick={() => handleSubscribe('annual')}
                disabled={isEitherLoading}
                className="mt-8 w-full rounded-lg bg-synesi-accent p-3 font-[var(--font-sans)] text-sm font-medium text-black transition hover:bg-synesi-accent-hover disabled:cursor-not-allowed disabled:opacity-70"
              >
                {annualLoading ? 'LOADING...' : 'SUBSCRIBE →'}
              </button>
            </article>
          </section>

        </div>
      </div>
      <LandingFooter />
    </main>
  )
}

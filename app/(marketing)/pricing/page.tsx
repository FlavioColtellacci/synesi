'use client'

import { useState } from 'react'

type Plan = 'monthly' | 'annual'

export default function PricingPage() {
  const [monthlyLoading, setMonthlyLoading] = useState(false)
  const [annualLoading, setAnnualLoading] = useState(false)

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
    <main className="min-h-screen bg-synesi-bg px-4 py-16 text-synesi-text">
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

        <p className="mt-12 text-center font-[var(--font-sans)] text-xs text-synesi-muted">
          Not financial advice. Built for conviction.
        </p>
      </div>
    </main>
  )
}

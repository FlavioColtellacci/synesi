import Link from "next/link"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Investment Journal for Serious Investors",
  description:
    "SYNESI replaces scattered notes with a structured investment journal. Document your thesis, track assumptions, and review your conviction over time with AI-powered analysis.",
}

export default function InvestmentJournalPage() {
  return (
    <main className="min-h-screen bg-[#0A0A0C] text-[#F0F0F0]">
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-[#2A2A32] bg-[#0A0A0C]/80 px-4 py-4 backdrop-blur-sm md:px-8 md:py-5">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <span className="font-mono text-xl font-bold text-white">Σ</span>
            <span className="font-mono text-sm tracking-[0.2em] text-[#6B6B7B]">
              SYNESI
            </span>
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
              className="font-mono text-xs uppercase tracking-[0.12em] text-[#6B6B7B] transition-colors hover:text-[#F0F0F0]"
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
              className="font-mono text-xs uppercase tracking-[0.12em] text-[#F0F0F0] transition-colors"
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
              className="inline-flex items-center rounded-lg border border-[#2A2A32] px-3 py-2 font-[var(--font-mono)] text-[10px] uppercase tracking-widest text-[#6B6B7B] transition-colors hover:border-white hover:text-white"
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
            className="whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.12em] text-[#6B6B7B] transition-colors hover:text-[#F0F0F0]"
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
            className="whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.12em] text-[#F0F0F0] transition-colors"
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
      </nav>

      <div className="mx-auto max-w-3xl px-6 pb-32 pt-32">
        <p className="mb-6 font-mono text-xs uppercase tracking-[0.3em] text-[#6B6B7B]">
          USE CASE
        </p>
        <h1 className="mb-6 font-mono text-4xl font-medium uppercase tracking-widest md:text-5xl">
          The Investment Journal That Challenges You Back
        </h1>
        <p className="mb-12 font-sans text-lg leading-relaxed text-[#6B6B7B]">
          Most journals record what happened. SYNESI records why you believed what you believed, then
          checks whether it still holds.
        </p>

        <div className="space-y-10 text-[#A0A0A8] leading-relaxed">
          <div>
            <h2 className="mb-3 font-mono text-xl font-medium tracking-wide text-[#F0F0F0]">
              Beyond the spreadsheet
            </h2>
            <p>
              Notebooks, Google Docs, scattered notes, they capture your thinking once, then go
              silent. Six months later, you remember you bought the stock but not why. SYNESI
              replaces that with a structured thesis: ticker, thesis statement, falsifiable
              assumptions, exit criteria, and confidence level, captured in under 60 seconds.
            </p>
          </div>

          <div>
            <h2 className="mb-3 font-mono text-xl font-medium tracking-wide text-[#F0F0F0]">
              Assumptions that get stress-tested
            </h2>
            <p>
              Every thesis rests on assumptions. SYNESI breaks them out explicitly so you can track
              each one. When you run an AI analysis, it pressure-tests those assumptions against
              your own logic, surfacing overconfidence, blind spots, and unstated dependencies.
            </p>
          </div>

          <div>
            <h2 className="mb-3 font-mono text-xl font-medium tracking-wide text-[#F0F0F0]">
              A living audit trail
            </h2>
            <p>
              Every status change, edit, and AI analysis is timestamped and stored. Over months and
              years, you build a personal record of how your thinking evolved, reviewable, honest,
              and structured for learning.
            </p>
          </div>

          <div>
            <h2 className="mb-3 font-mono text-xl font-medium tracking-wide text-[#F0F0F0]">
              Automated review prompts
            </h2>
            <p>
              When a stock in your portfolio moves 5% or more in a single day, SYNESI creates a
              review event and asks: does this change anything? It&apos;s not a price alert, it&apos;s a
              conviction check.
            </p>
          </div>
        </div>

        <div className="mt-16 flex flex-col gap-4 border-t border-[#2A2A32] pt-12 sm:flex-row sm:items-center">
          <Link
            href="/signup"
            className="inline-block rounded-lg bg-[#FFFFFF] px-6 py-3 font-mono text-sm uppercase tracking-widest text-[#0A0A0C] transition-colors hover:bg-[#E8E8E8]"
          >
            START YOUR CONVICTION JOURNAL →
          </Link>
          <span className="font-sans text-sm text-[#6B6B7B]">
            $15/month · No free tier · Cancel anytime
          </span>
        </div>

        <div className="mt-12 flex flex-wrap gap-4">
          <Link
            href="/use-cases/thesis-validation"
            className="font-mono text-xs uppercase tracking-widest text-[#6B6B7B] transition-colors hover:text-[#F0F0F0]"
          >
            Related: AI Thesis Validation →
          </Link>
          <Link
            href="/manifesto"
            className="font-mono text-xs uppercase tracking-widest text-[#6B6B7B] transition-colors hover:text-[#F0F0F0]"
          >
            Read Our Manifesto →
          </Link>
        </div>
      </div>
    </main>
  )
}

import Link from "next/link"
import type { Metadata } from "next"
import MarketingPageNav from "@/components/landing/MarketingPageNav"
import LandingFooter from "@/components/landing/LandingFooter"

export const metadata: Metadata = {
  title: "Investment Journal for Thesis-Driven Investors",
  description:
    "SYNESI replaces scattered notes with a structured investment journal. Document your thesis, track assumptions, and review your conviction over time with AI-powered analysis.",
}

export default function InvestmentJournalPage() {
  return (
    <main className="min-h-screen bg-[#0A0A0C] text-[#F0F0F0]">
      <MarketingPageNav activeItem="investment-journal" />

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
            className="inline-block whitespace-nowrap rounded-lg bg-[#FFFFFF] px-6 py-3 font-mono text-sm uppercase tracking-widest text-[#0A0A0C] transition-colors hover:bg-[#E8E8E8]"
          >
            START YOUR CONVICTION JOURNAL&nbsp;→
          </Link>
          <span className="whitespace-nowrap font-sans text-sm text-[#6B6B7B]">
            7-day free trial—Sigma and all features included. Then $15/month or
            $99/year.
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
      <LandingFooter />
    </main>
  )
}

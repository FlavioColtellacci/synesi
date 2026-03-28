import Link from "next/link"
import type { Metadata } from "next"
import MarketingPageNav from "@/components/landing/MarketingPageNav"
import LandingFooter from "@/components/landing/LandingFooter"

export const metadata: Metadata = {
  title: "AI-Powered Investment Thesis Validation",
  description:
    "SYNESI and Sigma use AI to stress-test your investment thesis against your own reasoning. Surface biases, validate assumptions, and get a monitoring plan, without buy/sell advice.",
}

export default function ThesisValidationPage() {
  return (
    <main className="min-h-screen bg-[#0A0A0C] text-[#F0F0F0]">
      <MarketingPageNav activeItem="thesis-validation" />

      <div className="mx-auto max-w-3xl px-6 pb-32 pt-32">
        <p className="mb-6 font-mono text-xs uppercase tracking-[0.3em] text-[#6B6B7B]">
          USE CASE
        </p>
        <h1 className="mb-6 font-mono text-4xl font-medium uppercase tracking-widest md:text-5xl">
          AI That Challenges Your Thesis, Not Replaces It
        </h1>
        <p className="mb-12 font-sans text-lg leading-relaxed text-[#6B6B7B]">
          Your best investment decisions come from rigorous thinking. Sigma, SYNESI&apos;s AI layer,
          acts as a thinking partner, not an oracle.
        </p>

        <div className="space-y-10 text-[#A0A0A8] leading-relaxed">
          <div>
            <h2 className="mb-3 font-mono text-xl font-medium tracking-wide text-[#F0F0F0]">
              Five-layer thesis analysis
            </h2>
            <p>
              When you trigger an analysis, the AI reviews your thesis across five dimensions:
              clarity check, assumption stress-test, cognitive bias scan, monitoring plan, and
              research questions. Each surfaces specific, actionable insights grounded in your own
              words, not generic market commentary.
            </p>
          </div>

          <div>
            <h2 className="mb-3 font-mono text-xl font-medium tracking-wide text-[#F0F0F0]">
              Bias detection you can act on
            </h2>
            <p>
              Overconfidence, confirmation bias, anchoring, SYNESI scans your thesis language for
              patterns that signal one-sided thinking. It doesn&apos;t just name the bias; it points to
              the specific assumption or phrasing that triggered it.
            </p>
          </div>

          <div>
            <h2 className="mb-3 font-mono text-xl font-medium tracking-wide text-[#F0F0F0]">
              Falsifiability as a feature
            </h2>
            <p>
              Good theses are falsifiable, they state conditions under which the investment case
              breaks. SYNESI structures this explicitly with &ldquo;break conditions&rdquo; per
              assumption, so you always know what to watch for.
            </p>
          </div>

          <div>
            <h2 className="mb-3 font-mono text-xl font-medium tracking-wide text-[#F0F0F0]">
              No buy/sell advice, ever
            </h2>
            <p>
              SYNESI never predicts prices, recommends trades, or tells you what to do. It
              strengthens how you think about positions you already own or are considering, the
              decision is always yours.
            </p>
          </div>
        </div>

        <div className="mt-16 flex flex-col gap-4 border-t border-[#2A2A32] pt-12 sm:flex-row sm:items-center">
          <Link
            href="/signup"
            className="inline-block rounded-lg bg-[#FFFFFF] px-6 py-3 font-mono text-sm uppercase tracking-widest text-[#0A0A0C] transition-colors hover:bg-[#E8E8E8]"
          >
            STRESS-TEST YOUR THESIS →
          </Link>
          <span className="font-sans text-sm text-[#6B6B7B]">
            7-day free trial: Sigma and all features included. Then $15/month or
            $99/year.
          </span>
        </div>

        <div className="mt-12 flex flex-wrap gap-4">
          <Link
            href="/use-cases/investment-journal"
            className="font-mono text-xs uppercase tracking-widest text-[#6B6B7B] transition-colors hover:text-[#F0F0F0]"
          >
            Related: Investment Journal →
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

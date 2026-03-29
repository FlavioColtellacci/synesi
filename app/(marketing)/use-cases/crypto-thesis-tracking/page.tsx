import Link from "next/link"
import type { Metadata } from "next"
import LandingFooter from "@/components/landing/LandingFooter"
import MarketingPageNav from "@/components/landing/MarketingPageNav"

export const metadata: Metadata = {
  title: "Crypto Thesis Tracking Journal for Investors",
  description:
    "Track and refine crypto investment theses with a structured journal. Document assumptions, catalysts, and break conditions, then pressure-test your logic with Sigma.",
}

export default function CryptoThesisTrackingPage() {
  return (
    <main className="min-h-screen bg-[#0A0A0C] text-[#F0F0F0]">
      <MarketingPageNav />

      <div className="mx-auto max-w-3xl px-6 pb-32 pt-32">
        <p className="mb-6 font-mono text-xs uppercase tracking-[0.3em] text-[#6B6B7B]">
          USE CASE
        </p>
        <h1 className="mb-6 font-mono text-4xl font-medium uppercase tracking-widest md:text-5xl">
          Crypto Thesis Tracking That Survives Volatility
        </h1>
        <p className="mb-12 font-sans text-lg leading-relaxed text-[#6B6B7B]">
          Crypto markets move fast, narratives move faster, and your confidence can drift without
          you noticing. SYNESI helps you track your crypto thesis in a way that stays testable:
          what you believe, why you believe it, what could invalidate it, and what signal should
          force a review.
        </p>

        <div className="space-y-10 text-[#A0A0A8] leading-relaxed">
          <section>
            <h2 className="mb-3 font-mono text-xl font-medium tracking-wide text-[#F0F0F0]">
              Why crypto theses decay so quickly
            </h2>
            <p>
              In equities, a thesis often has a familiar cadence: earnings, guidance, valuation
              updates, and business execution. In crypto, the surface area is wider and often less
              structured. You may be tracking protocol revenue, token unlock schedules, liquidity
              migration, governance participation, regulatory headlines, and macro risk all at the
              same time. That is exactly why conviction can become fragile. One week you are focused
              on fundamentals, next week your decision is driven by social momentum without a clear
              bridge between the two. A crypto thesis journal should preserve continuity between
              these moments, so decisions are based on explicit assumptions instead of emotional
              memory.
            </p>
          </section>

          <section>
            <h2 className="mb-3 font-mono text-xl font-medium tracking-wide text-[#F0F0F0]">
              Build one thesis per position, not one narrative for the whole market
            </h2>
            <p>
              A common failure mode is carrying one generalized story across unrelated assets: if
              liquidity is improving, everything should work; if Bitcoin is strong, every alt should
              recover. SYNESI encourages position-level thinking. For each token, you can write a
              focused thesis statement, define the key assumptions, and list the break conditions
              that would make your original argument invalid. This approach makes your process more
              comparable over time. You are no longer grading outcomes against a broad narrative;
              you are evaluating whether each specific idea remained coherent as data changed.
            </p>
          </section>

          <section>
            <h2 className="mb-3 font-mono text-xl font-medium tracking-wide text-[#F0F0F0]">
              Turn assumptions into falsifiable checkpoints
            </h2>
            <p>
              Good crypto theses include assumptions that can be checked: adoption metrics, protocol
              usage, treasury sustainability, fee trends, or governance execution quality. Weak
              theses contain vague language like &ldquo;community is strong&rdquo; or &ldquo;narrative
              will return.&rdquo; In SYNESI, assumptions are explicit fields so they can be
              challenged later. Sigma can then pressure-test the logic and point to where an
              assumption is too broad, not measurable, or internally inconsistent. This does not
              make outcomes certain, but it does make your decision process auditable and harder to
              rationalize after the fact.
            </p>
          </section>

          <section>
            <h2 className="mb-3 font-mono text-xl font-medium tracking-wide text-[#F0F0F0]">
              Review triggers reduce emotional reactions
            </h2>
            <p>
              In high-volatility assets, timing pressure can force rushed decisions. SYNESI adds
              structured review prompts when positions move significantly, helping you ask the right
              question first: did price move because thesis quality changed, or because short-term
              positioning changed? By separating thesis invalidation from temporary noise, you avoid
              the common cycle of panic edits and overconfident re-entries. Sigma Monitor supports
              this workflow with a daily digest that summarizes conviction pressure, open alerts, and
              next checks so you can prioritize your research time instead of scanning everything
              from scratch.
            </p>
          </section>

          <section>
            <h2 className="mb-3 font-mono text-xl font-medium tracking-wide text-[#F0F0F0]">
              Track thesis evolution, not just wins and losses
            </h2>
            <p>
              PnL is important, but it is incomplete feedback. A profitable position can still come
              from weak reasoning; a losing position can still come from a disciplined process. The
              value of a thesis tracker is in preserving your reasoning trail: what changed, when it
              changed, and why you changed it. Months later, this becomes a durable learning asset.
              You can see if you regularly ignored break conditions, if you updated too slowly after
              contradictory evidence, or if you cut good ideas early due to market stress. That
              feedback loop is how conviction quality improves across cycles.
            </p>
          </section>

          <section>
            <h2 className="mb-3 font-mono text-xl font-medium tracking-wide text-[#F0F0F0]">
              A practical workflow for serious crypto investors
            </h2>
            <p>
              Start simple: write one thesis for one position you already hold. Add three to five
              assumptions and one clear break condition for each. Run Sigma analysis to challenge the
              language and detect blind spots, then set a recurring habit to review Sigma Monitor
              daily. As your portfolio grows, repeat the same template so each position stays
              comparable. This process is intentionally boring, and that is a strength. In a market
              built on constant novelty, process consistency is often your real edge.
            </p>
          </section>
        </div>

        <div className="mt-16 flex flex-col gap-4 border-t border-[#2A2A32] pt-12 sm:flex-row sm:items-center">
          <Link
            href="/signup"
            className="inline-block whitespace-nowrap rounded-lg bg-[#FFFFFF] px-6 py-3 font-mono text-sm uppercase tracking-widest text-[#0A0A0C] transition-colors hover:bg-[#E8E8E8]"
          >
            Start Crypto Thesis Tracking →
          </Link>
          <span className="whitespace-nowrap font-sans text-sm text-[#6B6B7B]">
            7-day free trial, then $15/month or $99/year.
          </span>
        </div>

        <div className="mt-12 flex flex-wrap gap-4">
          <Link
            href="/"
            className="font-mono text-xs uppercase tracking-widest text-[#6B6B7B] transition-colors hover:text-[#F0F0F0]"
          >
            Back to Home →
          </Link>
          <Link
            href="/pricing"
            className="font-mono text-xs uppercase tracking-widest text-[#6B6B7B] transition-colors hover:text-[#F0F0F0]"
          >
            View Pricing →
          </Link>
          <Link
            href="/use-cases/thesis-validation"
            className="font-mono text-xs uppercase tracking-widest text-[#6B6B7B] transition-colors hover:text-[#F0F0F0]"
          >
            Related: AI Thesis Validation →
          </Link>
          <Link
            href="/learn/confirmation-bias-investing"
            className="font-mono text-xs uppercase tracking-widest text-[#6B6B7B] transition-colors hover:text-[#F0F0F0]"
          >
            Learn: Confirmation Bias in Investing →
          </Link>
        </div>
      </div>

      <LandingFooter />
    </main>
  )
}

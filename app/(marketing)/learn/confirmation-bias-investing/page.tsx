import Link from "next/link"
import type { Metadata } from "next"
import LandingFooter from "@/components/landing/LandingFooter"
import MarketingPageNav from "@/components/landing/MarketingPageNav"

export const metadata: Metadata = {
  title: "Confirmation Bias in Investing: Practical Guide",
  description:
    "Learn how confirmation bias affects investing decisions and how to reduce it with structured thesis tracking, falsifiable assumptions, and disciplined review routines.",
}

export default function ConfirmationBiasInvestingPage() {
  return (
    <main className="min-h-screen bg-[#0A0A0C] text-[#F0F0F0]">
      <MarketingPageNav />

      <div className="mx-auto max-w-3xl px-6 pb-32 pt-32">
        <p className="mb-6 font-mono text-xs uppercase tracking-[0.3em] text-[#6B6B7B]">
          LEARN
        </p>
        <h1 className="mb-6 font-mono text-4xl font-medium uppercase tracking-widest md:text-5xl">
          Confirmation Bias in Investing (and How to Counter It)
        </h1>
        <p className="mb-12 font-sans text-lg leading-relaxed text-[#6B6B7B]">
          Confirmation bias is one of the most expensive cognitive errors in markets. Once you have
          an opinion, your brain naturally starts collecting support for that opinion and filtering
          out evidence that challenges it. This guide shows how that happens in practice and how to
          build a repeatable process to reduce the damage.
        </p>

        <div className="space-y-10 text-[#A0A0A8] leading-relaxed">
          <section>
            <h2 className="mb-3 font-mono text-xl font-medium tracking-wide text-[#F0F0F0]">
              What confirmation bias looks like during real decisions
            </h2>
            <p>
              Confirmation bias is not just reading bullish posts after buying a stock. It appears in
              subtle ways: weighting positive datapoints more heavily than negative ones, explaining
              away disconfirming news as temporary noise, widening your time horizon only when your
              position is down, or moving break conditions after the fact. In volatile periods, this
              can feel like disciplined conviction when it is actually defensive reasoning. The
              difference between strong conviction and biased conviction is whether your criteria are
              explicit before outcomes happen.
            </p>
          </section>

          <section>
            <h2 className="mb-3 font-mono text-xl font-medium tracking-wide text-[#F0F0F0]">
              Why intelligent investors still fall into it
            </h2>
            <p>
              Intelligence does not protect against confirmation bias. In fact, strong analytical
              ability can make it worse because you become better at constructing persuasive
              justifications for your existing view. Markets also reward narrative coherence, and a
              coherent narrative feels psychologically safe. When identity, public statements, or
              recent gains are tied to your position, your brain experiences contradictory evidence as
              threat, not information. That is why anti-bias systems need structure, not just better
              intentions.
            </p>
          </section>

          <section>
            <h2 className="mb-3 font-mono text-xl font-medium tracking-wide text-[#F0F0F0]">
              The three-part anti-bias framework
            </h2>
            <p>
              A practical anti-bias routine has three components. First, thesis clarity: write what
              must be true for your idea to work. Second, falsifiability: define what would prove
              your thesis wrong, including specific break conditions. Third, scheduled review:
              evaluate your thesis at fixed intervals or trigger events rather than only when your
              emotions spike. This framework does not eliminate mistakes, but it sharply reduces
              post-hoc rationalization and &ldquo;I knew it all along&rdquo; memory edits.
            </p>
          </section>

          <section>
            <h2 className="mb-3 font-mono text-xl font-medium tracking-wide text-[#F0F0F0]">
              Common red flags in thesis language
            </h2>
            <p>
              Watch for words that signal hidden bias: &ldquo;obvious,&rdquo; &ldquo;inevitable,&rdquo;
              &ldquo;everyone knows,&rdquo; or &ldquo;temporary&rdquo; used repeatedly without a
              measurable trigger. Another warning sign is asymmetry in evidence standards: demanding
              strict proof for bearish arguments while accepting weak proof for bullish ones. A final
              red flag is thesis sprawl, where every new data point becomes part of the thesis,
              making the thesis impossible to invalidate. Strong theses are concise, testable, and
              bounded.
            </p>
          </section>

          <section>
            <h2 className="mb-3 font-mono text-xl font-medium tracking-wide text-[#F0F0F0]">
              How to design better break conditions
            </h2>
            <p>
              A break condition is useful only if it is concrete and pre-committed. &ldquo;If sentiment
              weakens&rdquo; is too vague. &ldquo;If net retention drops below X for two quarters&rdquo;
              or &ldquo;if governance fails to pass core upgrade by date Y&rdquo; is far better.
              Useful break conditions are observable, timestamped, and difficult to reinterpret after
              the fact. You can still decide to hold after a break condition is hit, but you should
              explicitly log why the original condition changed. That preserves accountability in your
              process.
            </p>
          </section>

          <section>
            <h2 className="mb-3 font-mono text-xl font-medium tracking-wide text-[#F0F0F0]">
              Using an AI challenger without outsourcing judgment
            </h2>
            <p>
              An AI assistant can help by identifying one-sided assumptions, suggesting disconfirming
              checks, and asking clearer questions than your internal monologue. But AI is a
              challenger, not a decision-maker. The goal is to improve your reasoning quality, not to
              delegate responsibility. In SYNESI, Sigma is designed around this principle: it
              pressure-tests your logic and surfaces blind spots, while your decision remains yours.
              This is especially valuable when markets are fast and your own narrative momentum is
              strongest.
            </p>
          </section>

          <section>
            <h2 className="mb-3 font-mono text-xl font-medium tracking-wide text-[#F0F0F0]">
              Build a bias-resistant routine you can keep
            </h2>
            <p>
              Start with one position and keep the workflow small. Write the thesis in plain
              language. Add assumptions and break conditions. Schedule a regular review. After each
              major move, ask: did my core assumptions improve, worsen, or stay unchanged? Over time
              this creates a decision journal grounded in process rather than memory. You will still
              be wrong sometimes, but your errors will become easier to diagnose and less likely to
              repeat. That is the real edge of a disciplined investor.
            </p>
          </section>
        </div>

        <div className="mt-16 flex flex-col gap-4 border-t border-[#2A2A32] pt-12 sm:flex-row sm:items-center">
          <Link
            href="/signup"
            className="inline-block whitespace-nowrap rounded-lg bg-[#FFFFFF] px-6 py-3 font-mono text-sm uppercase tracking-widest text-[#0A0A0C] transition-colors hover:bg-[#E8E8E8]"
          >
            Build a Better Thesis Process →
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
            href="/use-cases/crypto-thesis-tracking"
            className="font-mono text-xs uppercase tracking-widest text-[#6B6B7B] transition-colors hover:text-[#F0F0F0]"
          >
            Related: Crypto Thesis Tracking →
          </Link>
        </div>
      </div>

      <LandingFooter />
    </main>
  )
}

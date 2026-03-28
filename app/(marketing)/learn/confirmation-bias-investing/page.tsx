import Link from "next/link"
import type { Metadata } from "next"
import MarketingPageNav from "@/components/landing/MarketingPageNav"
import LandingFooter from "@/components/landing/LandingFooter"

export const metadata: Metadata = {
  title: "Confirmation Bias in Investing: What It Is and How to Counter It",
  description:
    "Confirmation bias leads investors to favor information that supports an existing belief. Learn how it skews research, why written theses help, and how structured journaling and AI stress-tests improve decision quality.",
}

export default function ConfirmationBiasInvestingPage() {
  return (
    <main className="min-h-screen bg-[#0A0A0C] text-[#F0F0F0]">
      <MarketingPageNav activeItem="confirmation-bias" />

      <div className="mx-auto max-w-3xl px-6 pb-32 pt-32">
        <p className="mb-6 font-mono text-xs uppercase tracking-[0.3em] text-[#6B6B7B]">
          LEARN
        </p>
        <h1 className="mb-6 font-mono text-4xl font-medium uppercase tracking-widest md:text-5xl">
          Confirmation Bias in Investing
        </h1>
        <p className="mb-12 font-sans text-lg leading-relaxed text-[#6B6B7B]">
          The market rewards people who update their beliefs when evidence changes. Confirmation
          bias does the opposite: it quietly filters reality until your portfolio matches your
          story. Understanding the pattern is the first step to countering it.
        </p>

        <div className="space-y-10 text-[#A0A0A8] leading-relaxed">
          <div>
            <h2 className="mb-3 font-mono text-xl font-medium tracking-wide text-[#F0F0F0]">
              What confirmation bias looks like for investors
            </h2>
            <p>
              Confirmation bias is the tendency to notice, remember, and overweight information that
              agrees with what you already believe, while downplaying or ignoring contradicting
              signals. In investing, it rarely announces itself as a mistake. It shows up as a
              reading list that leans one way, a Twitter feed that applauds your existing position,
              or a &ldquo;due diligence&rdquo; process that somehow never produces a compelling bear
              case. Over time, the effect compounds: you feel more certain even as your information
              diet becomes narrower. That is dangerous in markets where the expensive surprises
              usually come from the scenarios you did not seriously consider.
            </p>
          </div>

          <div>
            <h2 className="mb-3 font-mono text-xl font-medium tracking-wide text-[#F0F0F0]">
              Why thesis-driven work is a practical antidote
            </h2>
            <p>
              Writing forces specificity. When you move from a vague bull narrative to a real
              thesis, you have to name assumptions, time horizons, and what would prove you wrong.
              That structure makes disconfirming evidence easier to spot, because you know what you
              are testing. A dedicated{" "}
              <Link
                href="/use-cases/investment-journal"
                className="text-[#F0F0F0] underline decoration-[#2A2A32] underline-offset-4 transition-colors hover:decoration-[#6B6B7B]"
              >
                investment journal
              </Link>{" "}
              turns one-off opinions into a record you can revisit when prices move and emotions
              spike. The goal is not perfect foresight; it is an honest audit trail of what you
              believed and why, so hindsight does not rewrite history.
            </p>
          </div>

          <div>
            <h2 className="mb-3 font-mono text-xl font-medium tracking-wide text-[#F0F0F0]">
              Stress-testing language, not cheering you on
            </h2>
            <p>
              Even disciplined note-takers can slide into self-reinforcing phrasing: loaded
              adjectives, assumptions framed as facts, or risks mentioned once and never revisited.
              That is where an external challenge helps.{" "}
              <Link
                href="/use-cases/thesis-validation"
                className="text-[#F0F0F0] underline decoration-[#2A2A32] underline-offset-4 transition-colors hover:decoration-[#6B6B7B]"
              >
                AI thesis validation
              </Link>{" "}
              in SYNESI is designed to pressure-test your written thesis and assumptions against
              your own words: surfacing one-sided reasoning, unstated dependencies, and cognitive
              patterns like overconfidence. It is not buy or sell advice and not a prediction
              engine. It is a mirror for your process, so you can correct course before capital
              does.
            </p>
          </div>

          <div>
            <h2 className="mb-3 font-mono text-xl font-medium tracking-wide text-[#F0F0F0]">
              Habits that reduce bias without pretending it disappears
            </h2>
            <p>
              You cannot eliminate bias, but you can change the workflow around it. Before you add
              to a position, write the bear case as if you were pitching it to a skeptical partner.
              Track break conditions for each major assumption and review them on a schedule, not
              only after a rally. Seek one high-quality contrary view for every new source that
              agrees with you. Small friction in the process beats heroic willpower. Over months,
              these habits make it harder for confirmation bias to operate invisibly.
            </p>
            <p className="mt-4">
              Volatility is another trigger: sharp moves create urgency, and urgency rewards the
              story you already know. A pre-committed review checklist (what data would change my
              mind, what did I get wrong last time, what is the simplest scenario where I lose money
              here) slows that loop just enough for better questions to surface. The point is not
              pessimism; it is proportion. Decisions improve when disconfirming paths get the same
              ink as confirming ones.
            </p>
          </div>

          <div>
            <h2 className="mb-3 font-mono text-xl font-medium tracking-wide text-[#F0F0F0]">
              How SYNESI fits in
            </h2>
            <p>
              <Link
                href="/"
                className="text-[#F0F0F0] underline decoration-[#2A2A32] underline-offset-4 transition-colors hover:decoration-[#6B6B7B]"
              >
                SYNESI
              </Link>{" "}
              is a web app for thesis-driven investors: capture conviction in a structured format,
              log changes over time, and use Sigma for analysis that challenges your reasoning rather
              than replacing it. If you are comparing options, see{" "}
              <Link
                href="/pricing"
                className="text-[#F0F0F0] underline decoration-[#2A2A32] underline-offset-4 transition-colors hover:decoration-[#6B6B7B]"
              >
                pricing
              </Link>{" "}
              for the current trial and plans. None of this is financial advice; it is tooling for
              clearer thinking and a more durable learning loop.
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
            7-day free trial: Sigma and all features included. Then $15/month or $99/year.
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
            href="/use-cases/investment-journal"
            className="font-mono text-xs uppercase tracking-widest text-[#6B6B7B] transition-colors hover:text-[#F0F0F0]"
          >
            Related: Investment Journal →
          </Link>
        </div>
      </div>
      <LandingFooter />
    </main>
  )
}

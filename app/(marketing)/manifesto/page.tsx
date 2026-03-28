import Link from 'next/link'
import LandingFooter from '@/components/landing/LandingFooter'
import MarketingPageNav from '@/components/landing/MarketingPageNav'

export const metadata = {
  title: 'Manifesto | SYNESI',
  description:
    'Why SYNESI exists. A statement on conviction, narrative, and what it means to keep your investment story honest over time.',
}

export default function ManifestoPage() {
  return (
    <main className="min-h-screen bg-[#0A0A0C] text-[#F0F0F0]">
      <MarketingPageNav activeItem="manifesto" />

      {/* Page content */}
      <div className="mx-auto max-w-3xl px-6 pb-48 pt-32">
        {/* Header */}
        <div className="mb-20">
          <p className="font-mono text-xs tracking-[0.3em] text-[#6B6B7B] mb-6">
            SYNESI / MANIFESTO
          </p>
          <h1 className="font-mono text-5xl md:text-6xl font-medium tracking-widest uppercase text-white leading-tight">
            Why this
            <br />
            exists.
          </h1>
        </div>

        {/* Body */}
        <div className="space-y-12 text-[#A0A0A8] leading-relaxed text-base md:text-lg">
          <div className="space-y-4">
            <p className="text-[#F0F0F0] text-xl md:text-2xl font-light leading-relaxed">
              You bought the stock for a reason.
            </p>
            <p className="text-[#F0F0F0] text-xl md:text-2xl font-light leading-relaxed">
              Six months later, you don&apos;t remember what it was.
            </p>
          </div>

          <div className="w-12 h-px bg-[#2A2A32]" />

          <div className="space-y-4">
            <p>
              Your thesis lives in a notebook. A Google Doc. A screenshot. A
              conversation you can&apos;t find. Scattered across tools, half-finished,
              never revisited.
            </p>
            <p>
              This isn&apos;t just disorganised. It&apos;s dangerous. When the price
              drops, you have nothing to check your panic against. When the
              fundamentals quietly shift, you have no process to notice. You hold
              because you remember buying, not because you remember why.
            </p>
          </div>

          <div className="space-y-4">
            <p>
              The question that should drive every position you own isn&apos;t
              &ldquo;Is this stock up or down?&rdquo; It&apos;s &ldquo;Is my thesis still
              intact?&rdquo;
            </p>
            <p>
              Most investors never ask it. Not because they don&apos;t care. Because
              they have nowhere to ask it.
            </p>
          </div>

          <div className="w-12 h-px bg-[#2A2A32]" />

          <div className="space-y-4">
            <p className="font-mono text-xs tracking-[0.25em] text-[#6B6B7B] uppercase">
              The conviction principle
            </p>
            <p>
              Conviction is not a feeling. It is a thesis, a structured,
              falsifiable argument about why a business will be worth more than the
              market thinks, over a time horizon you&apos;ve defined.
            </p>
            <p>
              Real investors don&apos;t react to price. They monitor their
              assumptions.
            </p>
          </div>

          <div className="w-12 h-px bg-[#2A2A32]" />

          <div className="space-y-4">
            <p className="font-mono text-xs tracking-[0.25em] text-[#6B6B7B] uppercase">
              What SYNESI is
            </p>
            <p>
              SYNESI captures your conviction at the moment you take a position &mdash;
              the thesis, the assumptions behind it, the conditions under which
              you&apos;d exit. Then it keeps that narrative alive, tracking how your
              story evolves as reality unfolds.
            </p>
            <p>
              When a significant event touches one of your assumptions, you are
              prompted to revisit your reasoning, not your P&amp;L.
            </p>
            <p>
              Sigma—SYNESI&apos;s in-app assistant and Sigma Monitor digest—helps
              you navigate the product and see a scheduled, structured read on
              conviction and alerts. It does not replace your judgment or give
              trade recommendations.
            </p>
          </div>

          <div className="space-y-4">
            <p className="font-mono text-xs tracking-[0.25em] text-[#6B6B7B] uppercase">
              What SYNESI is not
            </p>
            <p>
              It doesn&apos;t track portfolio returns. It doesn&apos;t give price
              targets. It doesn&apos;t tell you what to buy or when to sell. It
              doesn&apos;t aggregate financial news.
            </p>
            <p>
              It keeps your answer to one question: why do you own this? And it
              shows you when that answer has been tested, challenged, or quietly
              outgrown.
            </p>
          </div>

          <div className="w-12 h-px bg-[#2A2A32]" />

          <div className="space-y-4">
            <p className="font-mono text-xs tracking-[0.25em] text-[#6B6B7B] uppercase">
              Who it is for
            </p>
            <p>
              For investors and traders who hold positions based on a clear
              thesis, and want to review that thesis with discipline over time.
            </p>
            <p className="text-[#6B6B7B]">
              Not for hype-driven decisions. Not for blind copying. For people
              who can explain their reasoning and are willing to challenge it.
            </p>
          </div>

          <div className="w-12 h-px bg-[#2A2A32]" />

          <div className="space-y-4">
            <p className="font-mono text-xs tracking-[0.25em] text-[#6B6B7B] uppercase">
              The name
            </p>
            <p>
              SYNESI. From σύνεσις, the Greek for understanding, insight, the
              junction of thoughts. The moment disparate observations converge into
              a complete picture.
            </p>
            <p>
              That moment is what we are building toward. Every thesis documented.
              Every assumption monitored. Every position understood.
            </p>
          </div>

          <div className="w-12 h-px bg-[#2A2A32]" />

          {/* Closing statement */}
          <div className="pt-4">
            <p className="font-mono text-2xl md:text-3xl text-white tracking-wider uppercase">
              Your conviction, tracked.
            </p>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-20 pt-12 border-t border-[#2A2A32] flex flex-col sm:flex-row items-start sm:items-center gap-6">
          <Link
            href="/signup"
            className="font-mono text-sm bg-white text-[#0A0A0C] px-6 py-3 rounded-lg hover:bg-[#E8E8E8] transition-colors"
          >
            GET STARTED →
          </Link>
          <span className="text-sm text-[#6B6B7B]">
            7-day free trial—full app including Sigma. Then $15/month or
            $99/year.
          </span>
        </div>

      </div>
      <LandingFooter />
    </main>
  )
}

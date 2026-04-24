import type { CSSProperties } from 'react'

export default function FeaturesSection() {
  const glitchTextShadow: CSSProperties['textShadow'] =
    '-1.5px 0 0 rgba(255,50,50,0.7), 1.5px 0 0 rgba(0,210,255,0.7)'

  const glitchAnimatedStyle: CSSProperties = {
    textShadow: glitchTextShadow,
    animation: 'synesi-navbar-glitch 3s infinite',
    willChange: 'transform',
  }

  return (
    <section id="features" className="px-6 py-32 md:px-10">
      <div className="mx-auto max-w-6xl">
        <p className="mb-16 text-center font-mono text-xs uppercase tracking-widest text-[#6B6B7B]">
          WHAT SYNESI DOES
        </p>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <article className="rounded-xl border border-[#2A2A32] bg-[#141418] p-8 shadow-[0_25px_60px_rgba(0,0,0,0.4)]">
            <p
              className="mb-6 inline-block font-mono text-[2rem] leading-none text-[#F0F0F0]"
              style={glitchAnimatedStyle}
            >
              ◆
            </p>
            <h3 className="mb-3 font-mono text-base font-medium tracking-wide text-[#F0F0F0]">
              Capture your conviction
            </h3>
            <p className="font-sans text-sm leading-relaxed text-[#6B6B7B]">
              Log the thesis behind every position in under 60 seconds. Ticker,
              assumptions, exit criteria, confidence. Structured for when it
              matters most.
            </p>
          </article>

          <article className="rounded-xl border border-[#2A2A32] bg-[#141418] p-8 shadow-[0_25px_60px_rgba(0,0,0,0.4)]">
            <p
              className="mb-6 inline-block font-mono text-[2rem] leading-none text-[#F0F0F0]"
              style={glitchAnimatedStyle}
            >
              ⚡
            </p>
            <h3 className="mb-3 font-mono text-base font-medium tracking-wide text-[#F0F0F0]">
              Get challenged, not just notified
            </h3>
            <p className="font-sans text-sm leading-relaxed text-[#6B6B7B]">
              Sigma surfaces conflicts between what you believed and what&apos;s
              actually happening. When your stock moves 5%+, SYNESI asks:
              does this change anything?
            </p>
          </article>

          <article className="rounded-xl border border-[#2A2A32] bg-[#141418] p-8 shadow-[0_25px_60px_rgba(0,0,0,0.4)]">
            <p
              className="mb-6 inline-block font-mono text-[2rem] leading-none text-[#F0F0F0]"
              style={glitchAnimatedStyle}
            >
              ↗
            </p>
            <h3 className="mb-3 font-mono text-base font-medium tracking-wide text-[#F0F0F0]">
              Watch your thinking evolve
            </h3>
            <p className="font-sans text-sm leading-relaxed text-[#6B6B7B]">
              Every update, status change, and AI analysis is logged. A full
              audit trail of your conviction per holding, months and years of
              your own thinking, reviewable.
            </p>
          </article>

          <article className="rounded-xl border border-[#2A2A32] bg-[#141418] p-8 shadow-[0_25px_60px_rgba(0,0,0,0.4)]">
            <p
              className="mb-6 inline-block font-mono text-[2rem] leading-none text-[#F0F0F0]"
              style={glitchAnimatedStyle}
            >
              Σ
            </p>
            <h3 className="mb-3 font-mono text-base font-medium tracking-wide text-[#F0F0F0]">
              Sigma: assistant &amp; monitor
            </h3>
            <p className="font-sans text-sm leading-relaxed text-[#6B6B7B]">
              Sigma is SYNESI&apos;s AI layer. Ask the in-app assistant for
              guidance on convictions, alerts, and workflows, grounded in your
              SYNESI context when available. Sigma Monitor runs a daily digest
              of your convictions and alert pressure, with on-demand refresh,
              headline, risk read, and suggested next steps. Sigma does not
              give buy, sell, or hold advice.
            </p>
          </article>
        </div>
      </div>
    </section>
  )
}

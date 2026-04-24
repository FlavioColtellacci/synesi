"use client"

import Link from "next/link"
import { useEffect } from "react"
import { trackFunnelEvent } from "@/lib/analytics"

export default function HeroSection() {
  useEffect(() => {
    trackFunnelEvent("landing_view")
  }, [])

  return (
    <>
      <style>{`
        @keyframes column-glow-pulse {
          0%, 100% { opacity: 0.45; }
          50% { opacity: 0.75; }
        }
        @keyframes dot-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        .column-glow {
          animation: column-glow-pulse 6s ease-in-out infinite;
        }
        .dot-pulse {
          animation: dot-pulse 3s ease-in-out infinite;
        }
      `}</style>

      <section
        id="hero"
        className="relative min-h-screen overflow-hidden pt-36 pb-20 md:pt-32 md:pb-28"
      >
        <div className="relative mx-auto flex min-h-[calc(100vh-5rem)] max-w-6xl flex-col justify-center px-6 md:min-h-[calc(100vh-8rem)] md:px-10">
          <div className="grid grid-cols-1 items-center gap-12 md:grid-cols-2 md:gap-8">
            {/* Left column, Copy and CTA */}
            <div>
              <h1 className="font-mono text-5xl font-medium uppercase leading-none tracking-widest text-[#F0F0F0] md:text-7xl">
                YOUR CONVICTION
                <br />
                TRACKED.
              </h1>

              <p className="mt-6 max-w-sm font-sans text-base leading-relaxed text-[#6B6B7B] md:text-lg">
                Where your investment story lives, grows, and gets
                tested against reality.
              </p>
              <div className="mt-8 flex flex-col gap-8 md:mt-10 md:gap-10">
                <p className="max-w-sm font-sans text-sm leading-relaxed text-[#6B6B7B] md:text-base">
                  Powered by Sigma, your in-app assistant and daily Sigma Monitor
                  digest. Not investment advice.
                </p>

                <Link
                  href="/signup"
                  className="inline-block w-fit rounded-xl bg-[#FFFFFF] px-8 py-4 font-mono text-xs font-medium uppercase tracking-widest text-[#0A0A0C] transition-colors hover:bg-[#E8E8E8] md:text-sm"
                >
                  START YOUR CONVICTION JOURNAL →
                </Link>

                <p className="font-mono text-xs tracking-widest text-[#6B6B7B] md:max-w-md">
                  7-day free trial with the full app, including Sigma. Then $15/month or
                  $99/year.
                </p>
              </div>
            </div>

            {/* Right column, Signature Sigma Visual */}
            <div className="relative flex h-[480px] items-center justify-center md:h-[560px]">
              {/* Ambient glow */}
              <div
                className="column-glow absolute bottom-[88px] left-1/2 h-10 w-44 -translate-x-1/2 rounded-full"
                style={{
                  background:
                    "radial-gradient(ellipse, rgba(150,160,185,0.18) 0%, transparent 72%)",
                }}
              />

              {/* Sigma assembly */}
              <div
                className="relative select-none"
                aria-hidden="true"
                style={{ animation: "synesi-navbar-glitch 3s infinite", willChange: "transform" }}
              >
                <div className="relative flex h-[360px] w-[300px] items-center justify-center md:h-[430px] md:w-[360px]">
                  <span
                    className="absolute text-[248px] font-bold leading-none text-[rgba(255,50,50,0.7)] md:text-[306px]"
                    style={{
                      fontFamily: "var(--font-mono)",
                      transform: "translateX(-2px) scaleY(0.86)",
                    }}
                  >
                    Σ
                  </span>
                  <span
                    className="absolute text-[248px] font-bold leading-none text-[rgba(0,210,255,0.72)] md:text-[306px]"
                    style={{
                      fontFamily: "var(--font-mono)",
                      transform: "translateX(2px) scaleY(0.86)",
                    }}
                  >
                    Σ
                  </span>
                  <span
                    className="absolute text-[248px] font-bold leading-none text-white md:text-[306px]"
                    style={{
                      fontFamily: "var(--font-mono)",
                      transform: "scaleY(0.86)",
                      textShadow: "0 0 8px rgba(255,255,255,0.05)",
                    }}
                  >
                    Σ
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Floating Thesis Card */}
          <div className="relative mt-24 flex justify-center md:mt-32">
            <div className="w-full max-w-lg rounded-xl border border-[#2A2A32] bg-[#141418] p-5 shadow-[0_25px_60px_rgba(0,0,0,0.7)] md:p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-mono text-lg font-medium text-[#F0F0F0]">
                    NVDA
                  </p>
                  <p className="font-sans text-xs text-[#6B6B7B]">
                    NVIDIA Corporation
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="dot-pulse inline-block h-2 w-2 rounded-full bg-[#00D1B2]" />
                  <span className="font-mono text-xs text-[#00D1B2]">
                    INTACT
                  </span>
                </div>
              </div>

              <p className="mt-3 line-clamp-2 font-sans text-sm italic leading-relaxed text-[#6B6B7B]">
                NVIDIA&apos;s dominance in AI accelerator hardware is
                structural, not cyclical. Blackwell adoption across hyperscalers
                validates the thesis...
              </p>

              <div className="mt-4 flex items-center justify-between">
                <span className="font-mono text-[10px] tracking-widest text-[#2A2A32]">
                  GROWTH · MOAT · MANAGEMENT
                </span>
                <span className="font-mono text-[10px] text-[#6B6B7B]">
                  3 assumptions intact
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}

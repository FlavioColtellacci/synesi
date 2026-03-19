"use client"

import Link from "next/link"
import { useEffect, useRef } from "react"
import { SmokeBackground } from "@/components/ui/spooky-smoke-animation"

export default function HeroSection() {
  const columnRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const columnEl = columnRef.current
    if (!columnEl) return

    const triggerGlitch = () => {
      columnEl.style.cssText = `
        filter: drop-shadow(-2px 0 0 rgba(255,50,50,0.8)) drop-shadow(2px 0 0 rgba(0,210,255,0.8));
        transform: translateX(2px);
      `
      setTimeout(() => {
        columnEl.style.cssText = ""
      }, 80)
      setTimeout(() => {
        columnEl.style.cssText = `
          filter: drop-shadow(-1px 0 0 rgba(255,50,50,0.5)) drop-shadow(1px 0 0 rgba(0,210,255,0.5));
          transform: translateX(-1px);
        `
        setTimeout(() => {
          columnEl.style.cssText = ""
        }, 60)
      }, 120)
    }

    const randomInterval = () => Math.random() * 3000 + 5000

    let timeout: ReturnType<typeof setTimeout>
    const scheduleGlitch = () => {
      timeout = setTimeout(() => {
        triggerGlitch()
        scheduleGlitch()
      }, randomInterval())
    }
    scheduleGlitch()

    return () => clearTimeout(timeout)
  }, [])

  return (
    <>
      <style>{`
        @keyframes column-float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-12px); }
        }
        @keyframes column-glow-pulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
        @keyframes dot-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        .column-float {
          animation: column-float 6s ease-in-out infinite;
        }
        .column-glow {
          animation: column-glow-pulse 6s ease-in-out infinite;
        }
        .dot-pulse {
          animation: dot-pulse 3s ease-in-out infinite;
        }
      `}</style>

      <section id="hero" className="relative min-h-screen overflow-hidden pt-16">
        <div className="pointer-events-none absolute inset-0 opacity-[0.12]">
          <SmokeBackground smokeColor="#C8C8C8" />
        </div>
        <div className="relative mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl flex-col justify-center px-6 md:px-10">
          <div className="grid grid-cols-1 items-center gap-12 md:grid-cols-2 md:gap-8">
            {/* Left column — Copy and CTA */}
            <div>
              <h1 className="font-mono text-5xl font-medium uppercase leading-none tracking-widest text-[#F0F0F0] md:text-7xl">
                YOUR CONVICTION
                <br />
                TRACKED.
              </h1>

              <p className="mt-6 max-w-sm font-sans text-base leading-relaxed text-[#6B6B7B] md:text-lg">
                The app that answers &ldquo;why you own a stock&rdquo; — and
                tells you when the answer has changed.
              </p>

              <Link
                href="/signup"
                className="mt-10 inline-block rounded-xl bg-[#FFFFFF] px-8 py-4 font-mono text-xs font-medium uppercase tracking-widest text-[#0A0A0C] transition-colors hover:bg-[#E8E8E8] md:text-sm"
              >
                START YOUR CONVICTION JOURNAL →
              </Link>

              <p className="mt-6 font-mono text-xs tracking-widest text-[#6B6B7B]">
                $15/month · No free tier · Built for serious investors
              </p>
            </div>

            {/* Right column — Broken Column Visual */}
            <div className="relative flex h-[480px] items-center justify-center md:h-[560px]">
              {/* Ambient glow */}
              <div
                className="column-glow absolute bottom-[60px] left-1/2 h-6 w-32 -translate-x-1/2 rounded-full"
                style={{
                  background:
                    "radial-gradient(ellipse, rgba(0,209,178,0.25) 0%, transparent 70%)",
                }}
              />

              {/* Column assembly */}
              <div ref={columnRef} className="column-float relative">
                {/* Capital (top fragment) */}
                <div
                  className="mx-auto h-6 w-36 rounded-sm bg-gradient-to-b from-[#3A3A42] to-[#2A2A32]"
                  style={{
                    transform: "perspective(200px) rotateX(10deg)",
                  }}
                />

                {/* Shaft (main body) */}
                <div
                  className="relative mx-auto h-64 w-16"
                  style={{
                    background:
                      "linear-gradient(to right, #1C1C22 0%, #3A3A42 30%, #4A4A52 50%, #3A3A42 70%, #1C1C22 100%)",
                  }}
                >
                  {/* Crack lines */}
                  <div
                    className="absolute left-[12px] top-[40px] h-[80px] w-[1px] bg-[#0A0A0C]"
                    style={{ transform: "rotate(3deg)" }}
                  />
                  <div
                    className="absolute right-[10px] top-[120px] h-[60px] w-[1px] bg-[#0A0A0C]"
                    style={{ transform: "rotate(-2deg)" }}
                  />
                </div>

                {/* Base fragment (broken bottom) */}
                <div
                  className="mx-auto mt-2 h-5 w-24"
                  style={{
                    background:
                      "linear-gradient(to right, #1C1C22 0%, #3A3A42 30%, #4A4A52 50%, #3A3A42 70%, #1C1C22 100%)",
                    transform: "translateX(8px)",
                  }}
                />

                {/* Debris pieces */}
                <div className="absolute bottom-[-16px] left-[calc(50%-36px)] h-1 w-3 rotate-12 bg-[#2A2A32]" />
                <div className="absolute bottom-[-12px] right-[calc(50%-32px)] h-2 w-2 -rotate-6 bg-[#2A2A32]" />
                <div className="absolute bottom-[-20px] left-[calc(50%+12px)] h-1 w-2 rotate-[20deg] bg-[#2A2A32]" />
              </div>
            </div>
          </div>

          {/* Floating Thesis Card */}
          <div className="relative mt-16 flex justify-center md:mt-24">
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

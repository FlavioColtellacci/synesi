"use client"

import Link from "next/link"

export default function MarketingNav() {
  return (
    <nav className="fixed left-0 right-0 top-0 z-50 border-b border-[#2A2A32] bg-[#0A0A0C]/90 backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl flex-col px-4 py-3 md:h-16 md:flex-row md:items-center md:justify-between md:px-10 md:py-0">
        <div className="flex items-center justify-between">
        <Link href="/" className="font-mono text-base font-medium text-[#F0F0F0]">
          <span
            aria-hidden="true"
            style={{
              textShadow:
                "-1.5px 0 0 rgba(255,50,50,0.7), 1.5px 0 0 rgba(0,210,255,0.7)",
            }}
          >
            Σ
          </span>{" "}
          <span>SYNESI</span>
        </Link>

        <Link
          href="/signup"
          className="rounded-lg bg-[#FFFFFF] px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-[#0A0A0C] transition-colors hover:bg-[#E8E8E8] md:hidden"
        >
          GET STARTED →
        </Link>
        </div>

        <div className="no-scrollbar mt-4 flex items-center gap-5 overflow-x-auto pb-2 md:hidden">
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
            className="whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.12em] text-[#6B6B7B] transition-colors hover:text-[#F0F0F0]"
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
        </div>

        <div className="hidden items-center gap-8 md:flex">
          <Link
            href="/#features"
            className="font-mono text-xs uppercase tracking-widest text-[#6B6B7B] transition-colors hover:text-[#F0F0F0]"
          >
            Product
          </Link>
          <Link
            href="/pricing"
            className="font-mono text-xs uppercase tracking-widest text-[#6B6B7B] transition-colors hover:text-[#F0F0F0]"
          >
            Pricing
          </Link>
          <Link
            href="/manifesto"
            className="font-mono text-xs uppercase tracking-widest text-[#6B6B7B] transition-colors hover:text-[#F0F0F0]"
          >
            Manifesto
          </Link>
          <Link
            href="/use-cases/investment-journal"
            className="font-mono text-xs uppercase tracking-widest text-[#6B6B7B] transition-colors hover:text-[#F0F0F0]"
          >
            Investment Journal
          </Link>
          <Link
            href="/use-cases/thesis-validation"
            className="font-mono text-xs uppercase tracking-widest text-[#6B6B7B] transition-colors hover:text-[#F0F0F0]"
          >
            AI Thesis Validation
          </Link>
        </div>

        <div className="hidden items-center gap-4 md:flex">
          <Link
            href="/login"
            className="font-mono text-xs uppercase tracking-widest text-[#6B6B7B] transition-colors hover:text-[#F0F0F0]"
          >
            LOG IN
          </Link>
          <Link
            href="/signup"
            className="rounded-lg bg-[#FFFFFF] px-5 py-2.5 font-mono text-xs uppercase tracking-widest text-[#0A0A0C] transition-colors hover:bg-[#E8E8E8]"
          >
            GET STARTED →
          </Link>
        </div>
      </div>
    </nav>
  )
}

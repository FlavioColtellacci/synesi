import Link from "next/link"

export default function LandingFooter() {
  return (
    <footer className="border-t border-[#2A2A32] px-6 py-16 md:px-10">
      <div className="mx-auto flex w-full max-w-[1400px] flex-col items-center justify-between gap-6 md:flex-row md:flex-nowrap md:items-center md:gap-4 lg:gap-6">
        <div className="inline-flex items-center gap-1 whitespace-nowrap font-mono text-sm font-medium text-[#F0F0F0] md:shrink-0">
          <span
            aria-hidden="true"
            style={{
              textShadow:
                "-1.5px 0 0 rgba(255,50,50,0.7), 1.5px 0 0 rgba(0,210,255,0.7)",
            }}
          >
            Σ
          </span>
          <span>SYNESI</span>
        </div>

        <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 md:min-w-0 md:flex-1 md:flex-nowrap md:items-center md:justify-center md:gap-x-4 md:gap-y-0 lg:gap-x-5">
          <Link
            href="/#features"
            className="whitespace-nowrap font-mono text-xs uppercase tracking-[0.12em] text-[#6B6B7B] transition-colors hover:text-[#F0F0F0] lg:tracking-[0.16em]"
          >
            Product
          </Link>
          <Link
            href="/#pricing"
            className="whitespace-nowrap font-mono text-xs uppercase tracking-[0.12em] text-[#6B6B7B] transition-colors hover:text-[#F0F0F0] lg:tracking-[0.16em]"
          >
            Pricing
          </Link>
          <Link
            href="/manifesto"
            className="whitespace-nowrap font-mono text-xs uppercase tracking-[0.12em] text-[#6B6B7B] transition-colors hover:text-[#F0F0F0] lg:tracking-[0.16em]"
          >
            Manifesto
          </Link>
          <Link
            href="/use-cases/investment-journal"
            className="whitespace-nowrap font-mono text-xs uppercase tracking-[0.12em] text-[#6B6B7B] transition-colors hover:text-[#F0F0F0] lg:tracking-[0.16em]"
          >
            Investment Journal
          </Link>
          <Link
            href="/use-cases/thesis-validation"
            className="whitespace-nowrap font-mono text-xs uppercase tracking-[0.12em] text-[#6B6B7B] transition-colors hover:text-[#F0F0F0] lg:tracking-[0.16em]"
          >
            AI Thesis Validation
          </Link>
          <Link
            href="/privacy"
            className="whitespace-nowrap font-mono text-xs uppercase tracking-[0.12em] text-[#6B6B7B] transition-colors hover:text-[#F0F0F0] lg:tracking-[0.16em]"
          >
            Privacy
          </Link>
          <Link
            href="/terms"
            className="whitespace-nowrap font-mono text-xs uppercase tracking-[0.12em] text-[#6B6B7B] transition-colors hover:text-[#F0F0F0] lg:tracking-[0.16em]"
          >
            Terms
          </Link>
        </div>

        <div className="text-right font-sans text-[11px] leading-relaxed text-[#6B6B7B] md:shrink-0 lg:text-xs">
          <p className="whitespace-nowrap">Not financial advice. Built for conviction.</p>
          <p>© 2026 SYNESI</p>
        </div>
      </div>
    </footer>
  )
}

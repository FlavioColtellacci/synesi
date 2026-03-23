import Link from "next/link"

export default function LandingFooter() {
  return (
    <footer className="border-t border-[#2A2A32] px-6 py-16 md:px-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 md:flex-row">
        <div className="font-mono text-sm font-medium text-[#F0F0F0]">
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
        </div>

        <div className="flex flex-wrap justify-center gap-x-6 gap-y-2">
          <Link
            href="/#features"
            className="font-mono text-xs uppercase tracking-widest text-[#6B6B7B] transition-colors hover:text-[#F0F0F0]"
          >
            Product
          </Link>
          <Link
            href="/#pricing"
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
          <Link
            href="/privacy"
            className="font-mono text-xs uppercase tracking-widest text-[#6B6B7B] transition-colors hover:text-[#F0F0F0]"
          >
            Privacy
          </Link>
          <Link
            href="/terms"
            className="font-mono text-xs uppercase tracking-widest text-[#6B6B7B] transition-colors hover:text-[#F0F0F0]"
          >
            Terms
          </Link>
        </div>

        <div className="text-right font-sans text-xs leading-relaxed text-[#6B6B7B]">
          <p>Not financial advice. Built for conviction.</p>
          <p>© 2026 SYNESI</p>
        </div>
      </div>
    </footer>
  )
}

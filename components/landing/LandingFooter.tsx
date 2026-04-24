import Link from "next/link"

const footerLinkClass =
  "inline-block whitespace-nowrap font-mono text-xs uppercase tracking-[0.12em] text-[#6B6B7B] transition-colors hover:text-[#F0F0F0] lg:tracking-[0.16em]"

const footerCategoryClass =
  "font-mono text-xs font-bold uppercase tracking-[0.12em] text-[#6B6B7B] lg:tracking-[0.16em]"

export default function LandingFooter() {
  return (
    <footer className="border-t border-[#2A2A32] px-6 py-16 md:px-10">
      <div className="mx-auto flex w-full max-w-[1400px] flex-col items-center gap-10 md:flex-row md:items-start md:justify-between md:gap-8 lg:gap-10">
        <Link
          href="/"
          className="shrink-0 whitespace-nowrap font-mono text-base font-medium text-[#F0F0F0]"
        >
          <span aria-hidden="true" className="synesi-sigma-mark">
            Σ
          </span>{" "}
          <span>SYNESI</span>
        </Link>

        <nav
          className="grid w-full max-w-xl grid-cols-2 gap-x-8 gap-y-10 sm:max-w-2xl md:max-w-none md:flex md:flex-1 md:flex-wrap md:justify-center md:gap-x-10 md:gap-y-8 lg:gap-x-14"
          aria-label="Footer"
        >
          <div className="flex flex-col gap-2">
            <p className={footerCategoryClass}>Product</p>
            <ul className="flex flex-col gap-2">
              <li>
                <Link href="/#features" className={footerLinkClass}>
                  Features
                </Link>
              </li>
              <li>
                <Link href="/pricing" className={footerLinkClass}>
                  Pricing
                </Link>
              </li>
              <li>
                <Link href="/manifesto" className={footerLinkClass}>
                  Manifesto
                </Link>
              </li>
            </ul>
          </div>

          <div className="flex flex-col gap-2">
            <p className={footerCategoryClass}>Use cases</p>
            <ul className="flex flex-col gap-2">
              <li>
                <Link href="/use-cases/investment-journal" className={footerLinkClass}>
                  Investment Journal
                </Link>
              </li>
              <li>
                <Link href="/use-cases/thesis-validation" className={footerLinkClass}>
                  AI Thesis Validation
                </Link>
              </li>
              <li>
                <Link href="/use-cases/crypto-thesis-tracking" className={footerLinkClass}>
                  Crypto Thesis Tracking
                </Link>
              </li>
            </ul>
          </div>

          <div className="flex flex-col gap-2">
            <p className={footerCategoryClass}>Learn</p>
            <ul className="flex flex-col gap-2">
              <li>
                <Link href="/learn/confirmation-bias-investing" className={footerLinkClass}>
                  Confirmation bias
                </Link>
              </li>
            </ul>
          </div>

          <div className="flex flex-col gap-2">
            <p className={footerCategoryClass}>Legal</p>
            <ul className="flex flex-col gap-2">
              <li>
                <Link href="/privacy" className={footerLinkClass}>
                  Privacy
                </Link>
              </li>
              <li>
                <Link href="/terms" className={footerLinkClass}>
                  Terms
                </Link>
              </li>
            </ul>
          </div>
        </nav>

        <div className="shrink-0 text-center font-sans text-[11px] leading-tight text-[#6B6B7B] md:text-right lg:text-xs">
          <p className="whitespace-nowrap">Not financial advice. Built for conviction.</p>
          <p className="mt-1">© 2026 SYNESI</p>
        </div>
      </div>
    </footer>
  )
}

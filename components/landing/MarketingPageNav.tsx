"use client"

import Link from "next/link"

type NavItem = {
  key: "product" | "pricing" | "manifesto" | "investment-journal" | "thesis-validation"
  label: string
  href: string
}

const navItems: NavItem[] = [
  { key: "product", label: "Product", href: "/#features" },
  { key: "pricing", label: "Pricing", href: "/pricing" },
  { key: "manifesto", label: "Manifesto", href: "/manifesto" },
  {
    key: "investment-journal",
    label: "Investment Journal",
    href: "/use-cases/investment-journal",
  },
  {
    key: "thesis-validation",
    label: "AI Thesis Validation",
    href: "/use-cases/thesis-validation",
  },
]

type MarketingPageNavProps = {
  activeItem: NavItem["key"]
}

export default function MarketingPageNav({ activeItem }: MarketingPageNavProps) {
  const getNavItemClassName = (itemKey: NavItem["key"], mobile = false) =>
    [
      "font-mono",
      mobile ? "text-[10px] whitespace-nowrap" : "text-xs",
      "uppercase",
      "tracking-[0.12em]",
      itemKey === activeItem
        ? "text-[#F0F0F0]"
        : "text-[#6B6B7B] hover:text-[#F0F0F0]",
      "transition-colors",
    ].join(" ")

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-[#2A2A32] bg-[#0A0A0C]/80 px-4 py-4 backdrop-blur-sm md:px-8 md:py-5">
      <div className="flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <span className="font-mono text-xl font-bold text-white">Σ</span>
          <span className="font-mono text-sm tracking-[0.2em] text-[#6B6B7B]">SYNESI</span>
        </Link>

        <div className="hidden md:flex items-center gap-6">
          {navItems.map((item) => (
            <Link key={item.key} href={item.href} className={getNavItemClassName(item.key)}>
              {item.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="inline-flex items-center rounded-lg border border-[#2A2A32] px-3 py-2 font-[var(--font-mono)] text-[10px] uppercase tracking-widest text-[#6B6B7B] transition-colors hover:border-white hover:text-white"
          >
            ← Back to Home
          </Link>
          <Link
            href="/login"
            className="hidden md:inline-flex font-mono text-xs uppercase tracking-[0.12em] text-[#6B6B7B] transition-colors hover:text-[#F0F0F0]"
          >
            LOG IN
          </Link>
          <Link
            href="/signup"
            className="hidden md:inline-flex font-mono text-xs uppercase tracking-[0.12em] text-[#F0F0F0] transition-colors hover:text-white"
          >
            GET STARTED →
          </Link>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-5 overflow-x-auto pb-1 md:hidden">
        {navItems.map((item) => (
          <Link key={item.key} href={item.href} className={getNavItemClassName(item.key, true)}>
            {item.label}
          </Link>
        ))}
        <Link
          href="/login"
          className="whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.12em] text-[#6B6B7B] transition-colors hover:text-[#F0F0F0]"
        >
          LOG IN
        </Link>
        <Link
          href="/signup"
          className="whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.12em] text-[#F0F0F0] transition-colors hover:text-white"
        >
          GET STARTED →
        </Link>
      </div>
    </nav>
  )
}

"use client"

import Link from "next/link"

type NavItem = {
  key: "product" | "pricing" | "manifesto" | "investment-journal" | "thesis-validation"
  label: string
  href: string
}

const navItems: NavItem[] = [
  { key: "product", label: "Features", href: "/#features" },
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
  activeItem?: NavItem["key"]
}

export default function MarketingPageNav({ activeItem }: MarketingPageNavProps) {
  const getNavItemClassName = (itemKey: NavItem["key"], mobile = false) =>
    [
      "font-mono",
      mobile ? "text-[10px] whitespace-nowrap" : "text-xs",
      "uppercase",
      mobile ? "tracking-[0.12em]" : "tracking-widest",
      itemKey === activeItem
        ? "text-[#F0F0F0]"
        : "text-[#6B6B7B] hover:text-[#F0F0F0]",
      "transition-colors",
    ].join(" ")

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

        <div className="hidden items-center gap-8 md:flex">
          {navItems.map((item) => (
            <Link key={item.key} href={item.href} className={getNavItemClassName(item.key)}>
              {item.label}
            </Link>
          ))}
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

      <div className="no-scrollbar mt-4 flex items-center gap-5 overflow-x-auto pb-2 md:hidden">
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
      </div>
    </nav>
  )
}

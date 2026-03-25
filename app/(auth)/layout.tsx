import type { ReactNode } from 'react'
import Link from 'next/link'

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-synesi-bg">
      <nav className="border-b border-[#2A2A32] bg-[#0A0A0C]/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 md:h-16 md:px-10 md:py-0">
          <Link
            href="/"
            className="inline-flex items-center font-mono text-base font-medium text-[#F0F0F0]"
          >
            <span
              aria-hidden="true"
              style={{
                textShadow:
                  '-1.5px 0 0 rgba(255,50,50,0.7), 1.5px 0 0 rgba(0,210,255,0.7)',
              }}
            >
              Σ
            </span>
            {" "}
            <span>SYNESI</span>
          </Link>
          <Link
            href="/"
            className="inline-flex items-center rounded-lg border border-synesi-border px-4 py-2 font-[var(--font-mono)] text-[10px] uppercase tracking-widest text-synesi-muted transition-colors hover:border-white hover:text-white md:px-5 md:py-2.5 md:text-xs"
          >
            ← Back to Home
          </Link>
        </div>
      </nav>
      <div className="flex min-h-[calc(100vh-64px)] items-center justify-center px-4 pb-8 pt-4">
        {children}
      </div>
    </main>
  )
}

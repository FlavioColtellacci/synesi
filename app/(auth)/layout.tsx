import type { ReactNode } from 'react'
import Link from 'next/link'

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-synesi-bg">
      <div className="mx-auto w-full max-w-6xl px-4 pt-6">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-2 font-[var(--font-mono)] text-xs tracking-widest text-synesi-text"
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
            <span>SYNESI</span>
          </Link>
          <Link
            href="/"
            className="inline-flex items-center rounded-lg border border-synesi-border px-3 py-2 font-[var(--font-mono)] text-[10px] uppercase tracking-widest text-synesi-muted transition-colors hover:border-white hover:text-white"
          >
            ← Back to Home
          </Link>
        </div>
      </div>
      <div className="flex min-h-[calc(100vh-64px)] items-center justify-center px-4 pb-8 pt-4">
        {children}
      </div>
    </main>
  )
}

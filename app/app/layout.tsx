import type { ReactNode } from 'react'
import Link from 'next/link'
import NavLinks from '@/components/layout/NavLinks'
import SignOutButton from '@/components/layout/SignOutButton'

type AppLayoutProps = {
  children: ReactNode
}

export default function AppLayout({ children }: AppLayoutProps) {
  return (
    <>
      <nav className="fixed inset-x-0 top-0 z-50 h-14 border-b border-[#2A2A32] bg-[#141418] px-6 md:h-16 md:px-10">
        <div className="mx-auto flex h-full w-full items-center justify-between">
          <Link
            href="/app/dashboard"
            className="font-mono text-base font-medium text-[#F0F0F0]"
          >
            <span
              aria-hidden="true"
              style={{
                textShadow:
                  '-1.5px 0 0 rgba(255,50,50,0.7), 1.5px 0 0 rgba(0,210,255,0.7)',
              }}
            >
              Σ
            </span>{' '}
            <span>SYNESI</span>
          </Link>

          <div className="flex items-center gap-6">
            <div className="hidden md:block">
              <NavLinks />
            </div>
            <SignOutButton className="md:hidden" />
            <SignOutButton className="hidden md:inline-flex" />
          </div>
        </div>
      </nav>

      <main className="min-h-screen bg-[#0A0A0C] pt-14 md:pt-16">{children}</main>
    </>
  )
}

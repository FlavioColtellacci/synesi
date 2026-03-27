import type { ReactNode } from 'react'
import Link from 'next/link'
import NavLinks from '@/components/layout/NavLinks'
import SignOutButton from '@/components/layout/SignOutButton'
import ChatWidget from '@/components/chat/ChatWidget'
import { createClient } from '@/lib/supabase/server'

type AppLayoutProps = {
  children: ReactNode
}

export default async function AppLayout({ children }: AppLayoutProps) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: profile } = user
    ? await supabase
        .from('profiles')
        .select('subscription_status, trial_ends_at')
        .eq('id', user.id)
        .maybeSingle()
    : { data: null }

  const hasActiveSubscription = profile?.subscription_status === 'active'
  const isTrialUser = Boolean(profile?.trial_ends_at)
  const trialMessage = 'Your trial is active.'

  return (
    <>
      <nav className="fixed inset-x-0 top-0 z-50 border-b border-[#2A2A32] bg-[#141418] px-4 py-3 md:h-16 md:px-10 md:py-0">
        <div className="mx-auto flex w-full flex-col gap-2 md:h-full md:flex-row md:items-center md:justify-between md:gap-0">
          <div className="flex items-center justify-between">
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
            <SignOutButton className="md:hidden" />
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0 overflow-x-auto">
              <NavLinks />
            </div>
            <SignOutButton className="hidden md:inline-flex" />
          </div>
        </div>
      </nav>

      <main className="min-h-screen bg-[#0A0A0C] pt-24 md:pt-16">
        {!hasActiveSubscription && isTrialUser ? (
          <div className="border-b border-[#2A2A32] bg-[#1A1A20] px-4 py-3 md:px-10">
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <p className="font-sans text-sm text-[#F0F0F0]">
                <span className="font-mono text-[#FFB800]">TRIAL</span> · {trialMessage}
              </p>
              <Link
                href="/pricing"
                className="inline-flex min-h-[36px] items-center justify-center rounded-lg border border-[#F0F0F0]/30 px-4 py-1.5 font-mono text-xs tracking-widest text-[#F0F0F0] transition-colors hover:border-[#F0F0F0] hover:bg-[#1F1F26]"
              >
                CHOOSE PLAN →
              </Link>
            </div>
          </div>
        ) : null}
        {children}
      </main>
      <ChatWidget />
    </>
  )
}

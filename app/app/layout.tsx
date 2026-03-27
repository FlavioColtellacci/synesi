import type { ReactNode } from 'react'
import Link from 'next/link'
import NavLinks from '@/components/layout/NavLinks'
import SignOutButton from '@/components/layout/SignOutButton'
import ChatWidget from '@/components/chat/ChatWidget'
import TrialStatusBanner from '@/components/billing/TrialStatusBanner'
import { createClient } from '@/lib/supabase/server'
import { getTrialState } from '@/lib/billing/trial-state'

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
  const trialState = getTrialState(profile?.trial_ends_at)
  const isTrialUser = trialState.status !== 'none'

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
        {!hasActiveSubscription && isTrialUser ? <TrialStatusBanner trialState={trialState} /> : null}
        {children}
      </main>
      <ChatWidget />
    </>
  )
}

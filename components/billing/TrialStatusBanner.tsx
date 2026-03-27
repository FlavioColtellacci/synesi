'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import type { TrialState } from '@/lib/billing/trial-state'
import { trackFunnelEvent } from '@/lib/analytics'

type TrialStatusBannerProps = {
  trialState: TrialState
}

export default function TrialStatusBanner({ trialState }: TrialStatusBannerProps) {
  const trialMessage =
    trialState.status === 'expired'
      ? `Trial ended on ${trialState.endsAtLabel}. Choose a plan to restore access.`
      : `Trial active - ${trialState.daysRemaining} ${
          trialState.daysRemaining === 1 ? 'day' : 'days'
        } left (ends ${trialState.endsAtLabel}). Choose a plan before trial ends.`

  useEffect(() => {
    trackFunnelEvent('trial_message_view', {
      source: 'app_trial_banner',
      status: trialState.status,
      days_remaining:
        trialState.daysRemaining === null ? 'n/a' : String(trialState.daysRemaining),
    })
  }, [trialState.daysRemaining, trialState.status])

  const handleUpgradeClick = () => {
    trackFunnelEvent('trial_upgrade_click', {
      source: 'app_trial_banner',
      status: trialState.status,
    })
  }

  return (
    <div className="border-b border-[#2A2A32] bg-[#1A1A20] px-4 py-3 md:px-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <p className="font-sans text-sm text-[#F0F0F0]">
          <span
            className={`font-mono ${trialState.status === 'expiresSoon' ? 'text-[#FF6B6B]' : 'text-[#FFB800]'}`}
          >
            TRIAL
          </span>{' '}
          · {trialMessage}
        </p>
        <Link
          href="/pricing"
          onClick={handleUpgradeClick}
          className="inline-flex min-h-[36px] items-center justify-center rounded-lg border border-[#F0F0F0]/30 px-4 py-1.5 font-mono text-xs tracking-widest text-[#F0F0F0] transition-colors hover:border-[#F0F0F0] hover:bg-[#1F1F26]"
        >
          CHOOSE PLAN →
        </Link>
      </div>
    </div>
  )
}

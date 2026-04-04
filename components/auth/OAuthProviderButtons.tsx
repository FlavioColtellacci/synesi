'use client'

import { useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export type OAuthProviderId = 'google'

export type OAuthProviderButtonsProps = {
  disabled?: boolean
  onBusyChange?: (busy: boolean) => void
  onError?: (message: string) => void
  /** Fires when the user chooses a provider (before redirect). Use for analytics on signup. */
  onOAuthAttempt?: () => void
}

export function OAuthProviderButtons({
  disabled = false,
  onBusyChange,
  onError,
  onOAuthAttempt,
}: OAuthProviderButtonsProps) {
  const supabase = useMemo(() => createClient(), [])
  const [activeProvider, setActiveProvider] = useState<OAuthProviderId | null>(
    null
  )

  const oauthBusy = activeProvider !== null
  const buttonsDisabled = disabled || oauthBusy

  async function signInWithProvider(provider: OAuthProviderId) {
    onOAuthAttempt?.()
    onError?.('')
    setActiveProvider(provider)
    onBusyChange?.(true)

    const redirectTo = `${window.location.origin}/auth/callback`
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo },
    })

    if (error) {
      onError?.(error.message)
      setActiveProvider(null)
      onBusyChange?.(false)
      return
    }

    if (data.url) {
      window.location.assign(data.url)
      return
    }

    onError?.('Could not start sign-in. Please try again.')
    setActiveProvider(null)
    onBusyChange?.(false)
  }

  const secondaryButtonClass =
    'w-full rounded-lg border border-synesi-border bg-synesi-bg p-3 font-[var(--font-sans)] text-sm font-medium text-synesi-text transition hover:border-synesi-muted disabled:cursor-not-allowed disabled:opacity-70'

  return (
    <div>
      <div className="space-y-3">
        <button
          type="button"
          disabled={buttonsDisabled}
          onClick={() => void signInWithProvider('google')}
          className={secondaryButtonClass}
        >
          {activeProvider === 'google'
            ? 'REDIRECTING...'
            : 'Continue with Google'}
        </button>
      </div>
      <div className="my-6 flex items-center gap-3">
        <div className="h-px flex-1 bg-synesi-border" aria-hidden />
        <span className="shrink-0 font-[var(--font-sans)] text-xs text-synesi-muted">
          or continue with email
        </span>
        <div className="h-px flex-1 bg-synesi-border" aria-hidden />
      </div>
    </div>
  )
}

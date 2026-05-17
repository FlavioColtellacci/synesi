'use client'

import { useState } from 'react'
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth'
import { isFirebaseBackend } from '@/lib/data/backend'
import { getFirebaseClientAuth } from '@/lib/firebase/client'
import { createClient } from '@/lib/supabase/client'

/** Official multicolor Google mark (brand-compliant for “Sign in with Google” style actions). */
function GoogleGMark({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  )
}

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

    try {
      if (isFirebaseBackend()) {
        if (provider !== 'google') {
          throw new Error('Only Google OAuth is currently supported.')
        }

        const credential = await signInWithPopup(getFirebaseClientAuth(), new GoogleAuthProvider())
        const idToken = await credential.user.getIdToken()
        const response = await fetch('/api/auth/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken }),
        })

        if (!response.ok) {
          throw new Error('Could not start Firebase session.')
        }

        window.location.assign('/app/dashboard')
        return
      }

      const redirectTo = `${window.location.origin}/auth/callback`
      const { data, error } = await createClient().auth.signInWithOAuth({
        provider,
        options: { redirectTo },
      })

      if (error) {
        throw new Error(error.message)
      }

      if (data.url) {
        window.location.assign(data.url)
        return
      }

      throw new Error('Could not start sign-in. Please try again.')
    } catch (error) {
      onError?.(error instanceof Error ? error.message : 'Could not complete sign-in.')
      setActiveProvider(null)
      onBusyChange?.(false)
    }
  }

  const secondaryButtonClass =
    'inline-flex w-full items-center justify-center gap-3 rounded-lg border border-synesi-border bg-synesi-bg px-3 py-3 font-[var(--font-sans)] text-sm font-medium text-synesi-text transition hover:border-synesi-muted disabled:cursor-not-allowed disabled:opacity-70'

  return (
    <div>
      <div className="space-y-3">
        <button
          type="button"
          disabled={buttonsDisabled}
          onClick={() => void signInWithProvider('google')}
          className={secondaryButtonClass}
        >
          <GoogleGMark className="h-5 w-5 shrink-0" />
          <span>
            {activeProvider === 'google'
              ? 'REDIRECTING...'
              : 'Continue with Google'}
          </span>
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

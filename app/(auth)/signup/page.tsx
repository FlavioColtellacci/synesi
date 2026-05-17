'use client'

import Link from 'next/link'
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth'
import { OAuthProviderButtons } from '@/components/auth/OAuthProviderButtons'
import { isFirebaseBackend } from '@/lib/data/backend'
import { getFirebaseClientAuth } from '@/lib/firebase/client'
import { createClient } from '@/lib/supabase/client'
import { trackFunnelEvent } from '@/lib/analytics'

export default function SignupPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const firebaseAuth = useMemo(() => getFirebaseClientAuth(), [])

  useEffect(() => {
    trackFunnelEvent("signup_start")
  }, [])

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [oauthBusy, setOauthBusy] = useState(false)

  const formDisabled = isLoading || oauthBusy

  const trackOAuthSignupStart = useCallback(() => {
    trackFunnelEvent('oauth_signup_start')
  }, [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSuccess(false)
    setIsLoading(true)

    try {
      if (isFirebaseBackend()) {
        const normalizedEmail = email.trim().toLowerCase()
        const userCredential = await createUserWithEmailAndPassword(
          firebaseAuth,
          normalizedEmail,
          password
        )
        if (fullName.trim()) {
          await updateProfile(userCredential.user, { displayName: fullName.trim() })
        }
        const idToken = await userCredential.user.getIdToken()
        const response = await fetch('/api/auth/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken }),
        })
        if (!response.ok) {
          throw new Error('Could not create a secure session. Please try again.')
        }
        router.push('/app/dashboard')
      } else {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
            },
          },
        })
        if (signUpError) {
          throw signUpError
        }
      }

      setSuccess(true)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not create account.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <section className="w-full max-w-md rounded-xl border border-synesi-border bg-synesi-surface p-8 shadow-[0_14px_36px_rgba(0,0,0,0.35)]">
      <p className="mb-2 text-center font-[var(--font-mono)] text-3xl text-white">
        <span aria-hidden="true" className="synesi-sigma-mark">
          Σ
        </span>
      </p>
      <h1 className="text-center font-[var(--font-mono)] text-xl tracking-widest text-synesi-text">
        CREATE ACCOUNT
      </h1>
      <p className="mb-6 text-center font-[var(--font-sans)] text-sm text-synesi-muted">
        Start tracking your conviction.
      </p>

      <OAuthProviderButtons
        disabled={isLoading}
        onBusyChange={setOauthBusy}
        onError={setError}
        onOAuthAttempt={trackOAuthSignupStart}
      />

      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          id="full-name"
          type="text"
          autoComplete="name"
          required
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          placeholder="Full name"
          disabled={formDisabled}
          className="w-full rounded-lg border border-synesi-border bg-synesi-bg p-3 font-[var(--font-sans)] text-sm text-synesi-text placeholder:text-synesi-muted outline-none focus:outline-2 focus:outline-white disabled:cursor-not-allowed disabled:opacity-70"
        />

        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="Email"
          disabled={formDisabled}
          className="w-full rounded-lg border border-synesi-border bg-synesi-bg p-3 font-[var(--font-sans)] text-sm text-synesi-text placeholder:text-synesi-muted outline-none focus:outline-2 focus:outline-white disabled:cursor-not-allowed disabled:opacity-70"
        />

        <input
          id="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Password"
          disabled={formDisabled}
          className="w-full rounded-lg border border-synesi-border bg-synesi-bg p-3 font-[var(--font-sans)] text-sm text-synesi-text placeholder:text-synesi-muted outline-none focus:outline-2 focus:outline-white disabled:cursor-not-allowed disabled:opacity-70"
        />

        <button
          type="submit"
          disabled={formDisabled}
          className="w-full rounded-lg bg-synesi-accent p-3 font-[var(--font-sans)] text-sm font-medium text-black transition hover:bg-synesi-accent-hover disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isLoading ? 'CREATING ACCOUNT...' : 'GET STARTED →'}
        </button>
        <p className="text-center font-[var(--font-sans)] text-xs text-synesi-muted">
          No card required to start. Your 7-day trial begins after signup.
        </p>
      </form>

      {error ? <p className="mt-4 text-sm text-red-400">{error}</p> : null}
      {success ? (
        <p className="mt-4 text-sm text-synesi-intact">
          {isFirebaseBackend() ? 'Account created. Redirecting you to your dashboard...' : 'Check your email to confirm your account.'}
        </p>
      ) : null}

      <p className="mt-4 text-center font-[var(--font-sans)] text-sm text-synesi-muted">
        Already have an account?{' '}
        <Link href="/login" className="text-white">
          Sign in →
        </Link>
      </p>
    </section>
  )
}

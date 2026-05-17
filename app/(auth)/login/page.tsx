'use client'

import Link from 'next/link'
import { Suspense, FormEvent, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { signInWithEmailAndPassword, signOut } from 'firebase/auth'
import type { FirebaseError } from 'firebase/app'
import { OAuthProviderButtons } from '@/components/auth/OAuthProviderButtons'
import { isFirebaseBackend } from '@/lib/data/backend'
import { getFirebaseClientAuth } from '@/lib/firebase/client'
import { createClient } from '@/lib/supabase/client'

function LoginFormFallback() {
  return (
    <section
      className="w-full max-w-md rounded-xl border border-synesi-border bg-synesi-surface p-8 shadow-[0_14px_36px_rgba(0,0,0,0.35)]"
      aria-busy="true"
    >
      <p className="text-center font-[var(--font-sans)] text-sm text-synesi-muted">
        Loading…
      </p>
    </section>
  )
}

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [oauthBusy, setOauthBusy] = useState(false)

  const formDisabled = isLoading || oauthBusy
  const callbackAuthError = searchParams.get('auth_error')
  const displayError = error || callbackAuthError || ''

  function clearAuthErrorQuery() {
    if (searchParams.get('auth_error')) {
      router.replace('/login', { scroll: false })
    }
  }

  function handleOAuthError(message: string) {
    clearAuthErrorQuery()
    setError(message)
  }

  function mapSignInError(error: unknown) {
    if (!isFirebaseBackend()) {
      const message = error instanceof Error ? error.message : 'Could not sign in.'
      if (message === 'Invalid login credentials') {
        return 'Invalid login credentials. Check email/password, confirm your email if newly signed up, or reset your password.'
      }
      return message
    }

    const firebaseCode = (error as FirebaseError | undefined)?.code
    if (
      firebaseCode === 'auth/invalid-credential' ||
      firebaseCode === 'auth/wrong-password' ||
      firebaseCode === 'auth/user-not-found' ||
      firebaseCode === 'auth/invalid-email'
    ) {
      return 'Invalid email or password. If your account was created before the Firebase migration, create a new account or use Google sign-in.'
    }

    if (firebaseCode === 'auth/too-many-requests') {
      return 'Too many sign-in attempts. Please wait a minute and try again.'
    }

    return error instanceof Error ? error.message : 'Could not sign in.'
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    clearAuthErrorQuery()
    setIsLoading(true)

    const normalizedEmail = email.trim().toLowerCase()
    if (!normalizedEmail) {
      setError('Please enter your email.')
      setIsLoading(false)
      return
    }

    try {
      if (isFirebaseBackend()) {
        const firebaseAuth = getFirebaseClientAuth()
        await signOut(firebaseAuth).catch(() => undefined)
        const credential = await signInWithEmailAndPassword(firebaseAuth, normalizedEmail, password)
        const idToken = await credential.user.getIdToken()
        const response = await fetch('/api/auth/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken }),
        })
        if (!response.ok) {
          throw new Error('Could not create a secure session. Please try again.')
        }
      } else {
        const supabase = createClient()
        await supabase.auth.signOut()
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        })
        if (signInError) {
          throw signInError
        }
      }

      router.push('/app/dashboard')
    } catch (error) {
      setError(mapSignInError(error))
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
        SIGN IN
      </h1>
      <p className="mb-6 text-center font-[var(--font-sans)] text-sm text-synesi-muted">
        Welcome back.
      </p>

      <OAuthProviderButtons
        disabled={isLoading}
        onBusyChange={setOauthBusy}
        onError={handleOAuthError}
      />

      <form onSubmit={handleSubmit} className="space-y-4">
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
          autoComplete="current-password"
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
          {isLoading ? 'SIGNING IN...' : 'SIGN IN'}
        </button>
        <p className="text-center font-[var(--font-sans)] text-xs text-synesi-muted">
          New here? Start your 7-day free trial after signup.
        </p>
      </form>

      {displayError ? (
        <p className="mt-4 text-sm text-red-400">{displayError}</p>
      ) : null}

      <p className="mt-4 text-center font-[var(--font-sans)] text-sm text-synesi-muted">
        Don&apos;t have an account?{' '}
        <Link href="/signup" className="text-white">
          Sign up →
        </Link>
      </p>
    </section>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFormFallback />}>
      <LoginForm />
    </Suspense>
  )
}

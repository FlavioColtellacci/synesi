'use client'

import Link from 'next/link'
import { Suspense, FormEvent, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { OAuthProviderButtons } from '@/components/auth/OAuthProviderButtons'
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
  const supabase = useMemo(() => createClient(), [])
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

    // Clear potentially stale local auth state before attempting a fresh sign-in.
    await supabase.auth.signOut()

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    })

    if (signInError) {
      if (signInError.message === 'Invalid login credentials') {
        setError(
          'Invalid login credentials. Check email/password, confirm your email if newly signed up, or reset your password.'
        )
      } else {
        setError(signInError.message)
      }
      setIsLoading(false)
      return
    }

    router.push('/app/dashboard')
  }

  return (
    <section className="w-full max-w-md rounded-xl border border-synesi-border bg-synesi-surface p-8 shadow-[0_14px_36px_rgba(0,0,0,0.35)]">
      <p
        className="mb-2 text-center font-[var(--font-mono)] text-3xl text-white"
        style={{
          textShadow:
            '-1.5px 0 0 rgba(255,50,50,0.7), 1.5px 0 0 rgba(0,210,255,0.7)',
          animation: 'synesi-icon-glitch 2.5s infinite steps(2, end)',
          willChange: 'transform',
        }}
      >
        Σ
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

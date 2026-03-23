'use client'

import Link from 'next/link'
import { FormEvent, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { trackFunnelEvent } from '@/lib/analytics'

export default function SignupPage() {
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    trackFunnelEvent("signup_start")
  }, [])

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSuccess(false)
    setIsLoading(true)

    const canonicalAppUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '')
    const fallbackOriginUrl = window.location.origin.replace(/\/$/, '')

    const baseOptions = {
      data: {
        full_name: fullName,
      },
    }

    let { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        ...baseOptions,
        emailRedirectTo: `${(canonicalAppUrl ?? fallbackOriginUrl)}/auth/callback`,
      },
    })

    // If the configured canonical redirect URL is not allowlisted in Supabase,
    // retry with the current host to avoid blocking signup confirmations.
    if (
      signUpError &&
      canonicalAppUrl &&
      canonicalAppUrl !== fallbackOriginUrl &&
      /redirect|allow.?list|not allowed|invalid/i.test(signUpError.message)
    ) {
      const retry = await supabase.auth.signUp({
        email,
        password,
        options: {
          ...baseOptions,
          emailRedirectTo: `${fallbackOriginUrl}/auth/callback`,
        },
      })
      signUpError = retry.error
    }

    if (signUpError) {
      setError(signUpError.message)
      setIsLoading(false)
      return
    }

    setSuccess(true)
    setIsLoading(false)
  }

  return (
    <section className="w-full max-w-md rounded-xl border border-synesi-border bg-synesi-surface p-8 shadow-[0_14px_36px_rgba(0,0,0,0.35)]">
      <p className="mb-2 text-center font-[var(--font-mono)] text-3xl text-white">Σ</p>
      <h1 className="text-center font-[var(--font-mono)] text-xl tracking-widest text-synesi-text">
        CREATE ACCOUNT
      </h1>
      <p className="mb-8 text-center font-[var(--font-sans)] text-sm text-synesi-muted">
        Start tracking your conviction.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          id="full-name"
          type="text"
          autoComplete="name"
          required
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          placeholder="Full name"
          className="w-full rounded-lg border border-synesi-border bg-synesi-bg p-3 font-[var(--font-sans)] text-sm text-synesi-text placeholder:text-synesi-muted outline-none focus:outline-2 focus:outline-white"
        />

        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="Email"
          className="w-full rounded-lg border border-synesi-border bg-synesi-bg p-3 font-[var(--font-sans)] text-sm text-synesi-text placeholder:text-synesi-muted outline-none focus:outline-2 focus:outline-white"
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
          className="w-full rounded-lg border border-synesi-border bg-synesi-bg p-3 font-[var(--font-sans)] text-sm text-synesi-text placeholder:text-synesi-muted outline-none focus:outline-2 focus:outline-white"
        />

        <button
          type="submit"
          disabled={isLoading}
          className="w-full rounded-lg bg-synesi-accent p-3 font-[var(--font-sans)] text-sm font-medium text-black transition hover:bg-synesi-accent-hover disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isLoading ? 'CREATING ACCOUNT...' : 'GET STARTED →'}
        </button>
      </form>

      {error ? <p className="mt-4 text-sm text-red-400">{error}</p> : null}
      {success ? (
        <p className="mt-4 text-sm text-synesi-intact">Check your email to confirm your account.</p>
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

'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FormEvent, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
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
      <p className="mb-2 text-center font-[var(--font-mono)] text-3xl text-white">Σ</p>
      <h1 className="text-center font-[var(--font-mono)] text-xl tracking-widest text-synesi-text">
        SIGN IN
      </h1>
      <p className="mb-8 text-center font-[var(--font-sans)] text-sm text-synesi-muted">
        Welcome back.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
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
          autoComplete="current-password"
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
          {isLoading ? 'SIGNING IN...' : 'SIGN IN'}
        </button>
      </form>

      {error ? <p className="mt-4 text-sm text-red-400">{error}</p> : null}

      <p className="mt-4 text-center font-[var(--font-sans)] text-sm text-synesi-muted">
        Don&apos;t have an account?{' '}
        <Link href="/signup" className="text-white">
          Sign up →
        </Link>
      </p>
    </section>
  )
}

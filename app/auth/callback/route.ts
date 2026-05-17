import { NextResponse } from 'next/server'
import { isFirebaseBackend } from '@/lib/data/backend'
import { getFirebaseSessionWithProfile } from '@/lib/firebase/session'
import { createAdminClient } from '@/lib/supabase/server'
import { sendTrialStartedEmail } from '@/lib/email/trial'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/types/database'
import { supabaseCookieOptions } from '@/lib/supabase/cookie-options'

function redirectOAuthFailureToLogin(request: Request, requestUrl: URL) {
  const oauthError = requestUrl.searchParams.get('error')
  const rawDesc = requestUrl.searchParams.get('error_description')
  const login = new URL('/login', request.url)

  let message =
    'Sign-in could not be completed. Try again or use email and password.'

  if (oauthError === 'access_denied') {
    message = 'Sign-in was cancelled.'
  } else if (rawDesc) {
    try {
      const text = decodeURIComponent(rawDesc.replace(/\+/g, ' ')).trim()
      if (
        text.length > 0 &&
        text.length <= 180 &&
        !/[<>]/.test(text) &&
        !/[\u0000-\u001f]/.test(text)
      ) {
        message = text.slice(0, 120)
      }
    } catch {
      // keep default message
    }
  }

  login.searchParams.set('auth_error', message)
  return NextResponse.redirect(login)
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  if (isFirebaseBackend()) {
    const oauthError = requestUrl.searchParams.get('error')
    if (oauthError) {
      return redirectOAuthFailureToLogin(request, requestUrl)
    }

    const { token } = await getFirebaseSessionWithProfile()
    if (!token) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    return NextResponse.redirect(new URL('/app/dashboard', request.url))
  }

  const code = requestUrl.searchParams.get('code')
  const oauthError = requestUrl.searchParams.get('error')

  if (!code) {
    if (oauthError) {
      return redirectOAuthFailureToLogin(request, requestUrl)
    }
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: supabaseCookieOptions,
      cookies: {
        async getAll() {
          const cookieStore = await cookies()
          return cookieStore.getAll()
        },
        async setAll(cookiesToSet) {
          const cookieStore = await cookies()
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        },
      },
    }
  )

  try {
    await supabase.auth.exchangeCodeForSession(code)
  } catch {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('subscription_status, trial_started_at, trial_ends_at')
    .eq('id', user.id)
    .maybeSingle()

  const hasActiveSubscription = profile?.subscription_status === 'active'
  const hasTrialWindow = Boolean(profile?.trial_started_at && profile?.trial_ends_at)

  if (!hasActiveSubscription && !hasTrialWindow && user.email) {
    const trialStartedAt = new Date()
    const trialEndsAt = new Date(trialStartedAt.getTime() + 7 * 24 * 60 * 60 * 1000)

    await admin.from('profiles').upsert(
      {
        id: user.id,
        email: user.email,
        full_name:
          typeof user.user_metadata?.full_name === 'string' ? user.user_metadata.full_name : null,
        trial_started_at: trialStartedAt.toISOString(),
        trial_ends_at: trialEndsAt.toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    )

    try {
      await sendTrialStartedEmail({
        to: user.email,
        fullName: typeof user.user_metadata?.full_name === 'string' ? user.user_metadata.full_name : null,
        trialEndsAtIso: trialEndsAt.toISOString(),
      })
    } catch (error) {
      console.error(
        '[AuthCallback] Trial email send failed:',
        error instanceof Error ? error.message : String(error)
      )
    }
  }

  return NextResponse.redirect(new URL('/app/dashboard', request.url))
}

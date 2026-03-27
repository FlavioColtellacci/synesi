import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import type { Database } from '@/types/database'
import { supabaseCookieOptions } from '@/lib/supabase/cookie-options'
import { createAdminClient } from '@/lib/supabase/server'
import { sendTrialStartedEmail } from '@/lib/email/trial'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')

  if (!code) {
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

import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { Database } from '@/types/database'
import { supabaseCookieOptions } from '@/lib/supabase/cookie-options'

export async function proxy(request: NextRequest) {
  if (
    request.nextUrl.pathname === '/api/stripe/webhook' ||
    request.nextUrl.pathname.startsWith('/api/cron/') ||
    request.nextUrl.pathname === '/api/financial/refresh'
  ) {
    return NextResponse.next()
  }

  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: supabaseCookieOptions,
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // Keep request and response cookies in sync so Supabase can
          // refresh and persist auth across navigations/browser restarts.
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value)
          })

          supabaseResponse = NextResponse.next({
            request,
          })

          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    supabaseResponse = NextResponse.redirect(new URL('/login', request.url))
    return supabaseResponse
  }

  if (request.nextUrl.pathname === '/app' || request.nextUrl.pathname.startsWith('/app/')) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('subscription_status, trial_ends_at')
      .eq('id', user.id)
      .single()

    const hasActiveSubscription = profile?.subscription_status === 'active'
    const hasActiveTrial =
      typeof profile?.trial_ends_at === 'string' && new Date(profile.trial_ends_at).getTime() > Date.now()

    if (!hasActiveSubscription && !hasActiveTrial) {
      supabaseResponse = NextResponse.redirect(new URL('/pricing', request.url))
      return supabaseResponse
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/app/:path*', '/api/:path((?!stripe/webhook|cron/|financial/refresh).*)'],
}

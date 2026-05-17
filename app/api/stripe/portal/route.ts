import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createClient } from '@/lib/supabase/server'
import { isFirebaseBackend } from '@/lib/data/backend'
import { verifyFirebaseSessionCookie } from '@/lib/firebase/session'
import { createRepositories } from '@/lib/data/repositories'

export async function POST() {
  try {
    let userId: string | null = null
    let supabase = null as Awaited<ReturnType<typeof createClient>> | null

    if (isFirebaseBackend()) {
      const token = await verifyFirebaseSessionCookie()
      if (!token) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      userId = token.uid
    } else {
      supabase = await createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      userId = user.id
    }

    const repositories = createRepositories({ supabase: supabase ?? undefined })
    const profile = await repositories.profiles.getById(userId)

    if (!profile?.stripe_customer_id) {
      return NextResponse.json({ error: 'No billing account found' }, { status: 400 })
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/app/account`,
    })

    return NextResponse.json({ url: session.url })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

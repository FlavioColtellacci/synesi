import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { isFirebaseBackend } from '@/lib/data/backend'
import { verifyFirebaseSessionCookie } from '@/lib/firebase/session'
import {
  createFirebaseProfileRepository,
  createSupabaseProfileRepository,
  type ProfileRepository,
} from '@/lib/data/repositories/profiles'
import { getFirebaseAdminFirestore } from '@/lib/firebase/admin'

type CheckoutPlan = 'monthly' | 'annual'

function isCheckoutPlan(value: unknown): value is CheckoutPlan {
  return value === 'monthly' || value === 'annual'
}

export async function POST(request: Request) {
  try {
    const firebaseBackend = isFirebaseBackend()
    const profileRepository: ProfileRepository = firebaseBackend
      ? createFirebaseProfileRepository(getFirebaseAdminFirestore())
      : createSupabaseProfileRepository(createAdminClient())
    let userId: string | null = null
    let userEmail: string | null = null

    if (firebaseBackend) {
      const token = await verifyFirebaseSessionCookie()
      if (!token) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      userId = token.uid
      userEmail = token.email ?? null
    } else {
      const supabase = await createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      userId = user.id
      userEmail = user.email ?? null
    }

    const body: unknown = await request.json()
    const plan = typeof body === 'object' && body !== null && 'plan' in body ? body.plan : undefined

    if (!isCheckoutPlan(plan)) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
    }

    const priceId =
      plan === 'monthly' ? process.env.STRIPE_MONTHLY_PRICE_ID : process.env.STRIPE_ANNUAL_PRICE_ID

    if (!priceId) {
      return NextResponse.json({ error: 'Stripe price is not configured' }, { status: 500 })
    }

    const profile = await profileRepository.getById(userId)
    const email = profile?.email || userEmail
    if (!email) {
      throw new Error('Profile email not found')
    }
    let customerId = profile?.stripe_customer_id ?? null

    if (!customerId) {
      const customer = await stripe.customers.create({
        email,
      })

      customerId = customer.id

      await profileRepository.upsert({
        id: userId,
        email,
        stripe_customer_id: customerId,
        updated_at: new Date().toISOString(),
      })
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/app/dashboard`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/pricing`,
      allow_promotion_codes: true,
    })

    return NextResponse.json({ url: session.url })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

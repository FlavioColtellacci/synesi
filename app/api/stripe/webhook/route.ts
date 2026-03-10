import Stripe from 'stripe'
import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

type SubscriptionPlan = 'monthly' | 'annual'
type ProfileSubscriptionStatus = 'active' | 'inactive' | 'cancelled'

function getPlanFromPriceId(priceId: string): SubscriptionPlan {
  if (priceId === process.env.STRIPE_ANNUAL_PRICE_ID) {
    return 'annual'
  }

  return 'monthly'
}

function getCustomerId(
  customer: string | Stripe.Customer | Stripe.DeletedCustomer | null
): string | null {
  if (!customer) {
    return null
  }

  return typeof customer === 'string' ? customer : customer.id
}

function getSubscriptionId(
  subscription: string | Stripe.Subscription | null
): string | null {
  if (!subscription) {
    return null
  }

  return typeof subscription === 'string' ? subscription : subscription.id
}

export async function POST(request: Request) {
  const rawBody = await request.text()
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      try {
        const checkoutEvent = event as Stripe.CheckoutSessionCompletedEvent
        const session = checkoutEvent.data.object
        const customerId = getCustomerId(session.customer)
        const subscriptionId = getSubscriptionId(session.subscription)

        if (!customerId || !subscriptionId) {
          break
        }

        const subscription = await stripe.subscriptions.retrieve(subscriptionId)
        const priceId = subscription.items.data[0]?.price.id

        if (!priceId) {
          break
        }

        const plan = getPlanFromPriceId(priceId)
        const itemPeriodEnd = subscription.items.data[0]?.current_period_end
        const periodEnd = itemPeriodEnd
          ? new Date(itemPeriodEnd * 1000).toISOString()
          : new Date().toISOString()
        const admin = createAdminClient()

        await admin
          .from('profiles')
          .update({
            subscription_status: 'active',
            subscription_plan: plan,
            subscription_period_end: periodEnd,
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_customer_id', customerId)
      } catch (error) {
        console.error('Webhook checkout.session.completed handling failed:', error)
      }
      break
    }

    case 'customer.subscription.updated': {
      try {
        const subscriptionEvent = event as Stripe.CustomerSubscriptionUpdatedEvent
        const subscription = subscriptionEvent.data.object
        const customerId = getCustomerId(subscription.customer)
        const priceId = subscription.items.data[0]?.price.id

        if (!customerId || !priceId) {
          break
        }

        const plan = getPlanFromPriceId(priceId)
        const itemPeriodEnd = subscription.items.data[0]?.current_period_end
        const periodEnd = itemPeriodEnd
          ? new Date(itemPeriodEnd * 1000).toISOString()
          : new Date().toISOString()
        const status: ProfileSubscriptionStatus =
          subscription.status === 'active'
            ? 'active'
            : subscription.status === 'canceled'
              ? 'cancelled'
              : 'inactive'
        const admin = createAdminClient()

        await admin
          .from('profiles')
          .update({
            subscription_status: status,
            subscription_plan: plan,
            subscription_period_end: periodEnd,
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_customer_id', customerId)
      } catch (error) {
        console.error('Webhook customer.subscription.updated handling failed:', error)
      }
      break
    }

    case 'customer.subscription.deleted': {
      try {
        const subscriptionEvent = event as Stripe.CustomerSubscriptionDeletedEvent
        const subscription = subscriptionEvent.data.object
        const customerId = getCustomerId(subscription.customer)

        if (!customerId) {
          break
        }

        const admin = createAdminClient()

        await admin
          .from('profiles')
          .update({
            subscription_status: 'cancelled',
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_customer_id', customerId)
      } catch (error) {
        console.error('Webhook customer.subscription.deleted handling failed:', error)
      }
      break
    }

    default:
      break
  }

  return NextResponse.json({ received: true })
}

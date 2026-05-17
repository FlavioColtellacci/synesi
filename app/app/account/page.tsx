import Link from 'next/link'
import { redirect } from 'next/navigation'
import { isFirebaseBackend } from '@/lib/data/backend'
import { getFirebaseAdminFirestore } from '@/lib/firebase/admin'
import { getFirebaseSessionWithProfile } from '@/lib/firebase/session'
import { createClient } from '@/lib/supabase/server'
import { getTrialState } from '@/lib/billing/trial-state'
import { ManageSubscriptionButton } from './manage-subscription-button'
import { PushNotificationsSection } from './push-notifications-section'

type AccountProfile = {
  email?: string | null
  subscription_status?: string | null
  subscription_plan?: string | null
  subscription_period_end?: string | null
  trial_ends_at?: string | null
}

function formatRenewalDate(date: string | null) {
  if (!date) {
    return 'N/A'
  }

  return new Date(date).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function formatPlan(plan: string | null) {
  if (plan === 'monthly') {
    return 'Pro Monthly'
  }

  if (plan === 'annual') {
    return 'Pro Annual'
  }

  return 'N/A'
}

function getAccountStatusLabel(statusActive: boolean, trialState: ReturnType<typeof getTrialState>) {
  if (statusActive) {
    return 'Active'
  }

  if (trialState.status === 'active' || trialState.status === 'expiresSoon') {
    return `Trial - ${trialState.daysRemaining} ${trialState.daysRemaining === 1 ? 'day' : 'days'} left`
  }

  if (trialState.status === 'expired') {
    return 'Trial expired'
  }

  return 'Inactive'
}

export default async function AccountPage() {
  let userEmail: string | null = null
  let profile: AccountProfile | null = null

  if (isFirebaseBackend()) {
    const { token } = await getFirebaseSessionWithProfile()
    if (!token) {
      redirect('/login')
    }

    userEmail = token.email ?? null
    const snapshot = await getFirebaseAdminFirestore().collection('profiles').doc(token.uid).get()
    profile = snapshot.exists ? (snapshot.data() as AccountProfile) : null
  } else {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    userEmail = user?.email ?? null
    const { data } = user
      ? await supabase
          .from('profiles')
          .select('email, subscription_status, subscription_plan, subscription_period_end, trial_ends_at')
          .eq('id', user.id)
          .single()
      : { data: null }

    profile = data
  }

  const email = profile?.email ?? userEmail ?? 'N/A'
  const plan = formatPlan(profile?.subscription_plan ?? null)
  const statusActive = profile?.subscription_status === 'active'
  const renews = formatRenewalDate(profile?.subscription_period_end ?? null)
  const trialState = getTrialState(profile?.trial_ends_at ?? null)
  const accountStatus = getAccountStatusLabel(statusActive, trialState)
  const trialDaysRemaining = trialState.daysRemaining === null ? 'N/A' : String(trialState.daysRemaining)
  const statusColorClass =
    statusActive || trialState.status === 'active'
      ? 'text-[#00D1B2]'
      : trialState.status === 'expiresSoon'
        ? 'text-[#FFB800]'
        : trialState.status === 'expired'
          ? 'text-[#FF6B6B]'
          : 'text-[#6B6B7B]'

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl bg-[#0A0A0C] px-4 py-10 md:px-10">
      <div className="mb-6">
        <Link
          href="/app/dashboard"
          className="text-sm font-mono text-[#6B6B7B] transition-colors hover:text-[#F0F0F0]"
        >
          ← CONVICTIONS
        </Link>
      </div>

      <section className="w-full rounded-xl border border-[#2A2A32] bg-[#141418] p-4 md:p-6">

        <h1 className="font-mono text-2xl uppercase tracking-wide text-[#F0F0F0]">ACCOUNT</h1>

        <div className="mt-8 space-y-5">
          <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between md:gap-6">
            <p className="font-sans text-xs uppercase tracking-[0.16em] text-[#6B6B7B]">Email</p>
            <p className="font-sans text-sm text-[#F0F0F0]">{email}</p>
          </div>

          <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between md:gap-6">
            <p className="font-sans text-xs uppercase tracking-[0.16em] text-[#6B6B7B]">Plan</p>
            <p className="font-sans text-sm text-[#F0F0F0]">{plan}</p>
          </div>

          <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between md:gap-6">
            <p className="font-sans text-xs uppercase tracking-[0.16em] text-[#6B6B7B]">Status</p>
            <p className={`font-sans text-sm ${statusColorClass}`}>{accountStatus}</p>
          </div>

          <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between md:gap-6">
            <p className="font-sans text-xs uppercase tracking-[0.16em] text-[#6B6B7B]">Renews</p>
            <p className="font-sans text-sm text-[#F0F0F0]">{renews}</p>
          </div>

          <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between md:gap-6">
            <p className="font-sans text-xs uppercase tracking-[0.16em] text-[#6B6B7B]">Trial ends</p>
            <p className="font-sans text-sm text-[#F0F0F0]">{trialState.endsAtLabel}</p>
          </div>

          <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between md:gap-6">
            <p className="font-sans text-xs uppercase tracking-[0.16em] text-[#6B6B7B]">Trial days left</p>
            <p className="font-sans text-sm text-[#F0F0F0]">{trialDaysRemaining}</p>
          </div>
        </div>

        <div className="mt-10 w-full [&>button]:min-h-[44px] [&>button]:w-full md:[&>button]:w-auto">
          <ManageSubscriptionButton />
        </div>

        <div className="mt-10">
          <PushNotificationsSection />
        </div>

      </section>
    </main>
  )
}

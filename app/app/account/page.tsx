import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { ManageSubscriptionButton } from './manage-subscription-button'

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

export default async function AccountPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: profile } = user
    ? await supabase
        .from('profiles')
        .select('email, subscription_status, subscription_plan, subscription_period_end')
        .eq('id', user.id)
        .single()
    : { data: null }

  const email = profile?.email ?? user?.email ?? 'N/A'
  const plan = formatPlan(profile?.subscription_plan ?? null)
  const statusActive = profile?.subscription_status === 'active'
  const renews = formatRenewalDate(profile?.subscription_period_end ?? null)

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0A0A0C] px-4 py-12 md:px-10">
      <section className="w-full max-w-lg rounded-xl border border-[#2A2A32] bg-[#141418] p-4 md:p-6">
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
            <p className={`font-sans text-sm ${statusActive ? 'text-[#00D1B2]' : 'text-[#6B6B7B]'}`}>
              {statusActive ? 'Active' : 'Inactive'}
            </p>
          </div>

          <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between md:gap-6">
            <p className="font-sans text-xs uppercase tracking-[0.16em] text-[#6B6B7B]">Renews</p>
            <p className="font-sans text-sm text-[#F0F0F0]">{renews}</p>
          </div>
        </div>

        <div className="mt-10 w-full [&>button]:min-h-[44px] [&>button]:w-full md:[&>button]:w-auto">
          <ManageSubscriptionButton />
        </div>

        <div className="mt-6">
          <Link href="/app/dashboard" className="font-sans text-sm text-[#6B6B7B] transition-colors hover:text-[#F0F0F0]">
            ← Back to dashboard
          </Link>
        </div>
      </section>
    </main>
  )
}

import Link from "next/link"
import { PRO_PLAN_FEATURE_BULLETS } from "@/lib/marketing/pricing-features"

export default function PricingSection() {
  const features = PRO_PLAN_FEATURE_BULLETS

  return (
    <section id="pricing" className="px-6 py-32 md:px-10">
      <div className="mx-auto max-w-6xl">
        <p className="mb-4 text-center font-mono text-xs uppercase tracking-widest text-[#6B6B7B]">
          SIMPLE PRICING
        </p>
        <h2 className="mb-4 text-center font-mono text-2xl font-medium tracking-wide text-[#F0F0F0] md:text-3xl">
          One plan. All features. Start with a 7-day free trial.
        </h2>
        <p className="mb-16 text-center font-sans text-sm text-[#6B6B7B]">
          Includes Sigma assistant + Sigma Monitor in every plan. SYNESI is built for serious
          investors who want an accountable process.
        </p>

        <div className="mx-auto grid max-w-2xl grid-cols-1 gap-6 md:grid-cols-2">
          <article className="flex flex-col rounded-xl border border-[#2A2A32] bg-[#141418] p-8">
            <p className="mb-4 font-mono text-xs uppercase tracking-widest text-[#6B6B7B]">
              PRO MONTHLY
            </p>
            <p className="mb-1 font-mono text-4xl font-medium text-[#F0F0F0]">$15</p>
            <p className="mb-8 font-mono text-xs tracking-wide text-[#6B6B7B]">per month</p>

            <div className="mb-10 flex flex-1 flex-col gap-3">
              {features.map((feature) => (
                <div key={feature} className="flex items-start">
                  <span className="mr-3 font-mono text-xs text-[#00D1B2]">✓</span>
                  <span className="font-sans text-sm text-[#6B6B7B]">{feature}</span>
                </div>
              ))}
            </div>

            <Link
              href="/signup"
              className="mt-auto block w-full rounded-lg border border-[#2A2A32] py-3.5 text-center font-mono text-xs uppercase tracking-widest text-[#F0F0F0] transition-colors hover:border-[#F0F0F0] hover:bg-[#1C1C22]"
            >
              GET STARTED →
            </Link>
          </article>

          <article className="relative flex flex-col rounded-xl border border-[#F0F0F0] bg-[#141418] p-8">
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-[#F0F0F0] px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-[#0A0A0C]">
              BEST VALUE
            </span>

            <p className="mb-4 font-mono text-xs uppercase tracking-widest text-[#6B6B7B]">
              PRO ANNUAL
            </p>
            <p className="mb-1 font-mono text-4xl font-medium text-[#F0F0F0]">$99</p>
            <p className="font-mono text-xs tracking-wide text-[#6B6B7B]">per year · ~$8.25/month</p>
            <p className="mb-8 mt-2 font-mono text-[10px] tracking-widest text-[#00D1B2]">
              SAVE ~45% VS MONTHLY
            </p>

            <div className="mb-10 flex flex-1 flex-col gap-3">
              {features.map((feature) => (
                <div key={feature} className="flex items-start">
                  <span className="mr-3 font-mono text-xs text-[#00D1B2]">✓</span>
                  <span className="font-sans text-sm text-[#6B6B7B]">{feature}</span>
                </div>
              ))}
            </div>

            <Link
              href="/signup"
              className="mt-auto block w-full rounded-lg bg-[#FFFFFF] py-3.5 text-center font-mono text-xs font-medium uppercase tracking-widest text-[#0A0A0C] transition-colors hover:bg-[#E8E8E8]"
            >
              GET STARTED →
            </Link>
          </article>
        </div>

        <p className="mt-10 text-center font-sans text-xs text-[#6B6B7B]">
          SYNESI is not a financial advisor and does not provide investment advice.
        </p>
      </div>
    </section>
  )
}

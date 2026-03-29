import Link from "next/link"

const TRIAL_COPY =
  "7-day free trial: Sigma and all features included. Then $15/month or $99/year."

type UseCasePageCtaProps = {
  ctaLabel: string
  relatedHref: string
  relatedLabel: string
}

export default function UseCasePageCta({
  ctaLabel,
  relatedHref,
  relatedLabel,
}: UseCasePageCtaProps) {
  return (
    <div className="mt-16 border-t border-[#2A2A32] pt-12">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
        <Link
          href="/signup"
          className="inline-flex w-fit shrink-0 items-center justify-center whitespace-nowrap rounded-lg bg-[#FFFFFF] px-6 py-3 font-mono text-xs uppercase tracking-widest text-[#0A0A0C] transition-colors hover:bg-[#E8E8E8] sm:text-sm"
        >
          {ctaLabel}
        </Link>
        <p className="min-w-0 font-mono text-xs leading-relaxed text-[#6B6B7B] sm:text-sm">
          {TRIAL_COPY}
        </p>
      </div>
      <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-x-10 sm:gap-y-2">
        <Link
          href={relatedHref}
          className="w-fit font-mono text-xs uppercase tracking-widest text-[#6B6B7B] transition-colors hover:text-[#F0F0F0]"
        >
          {relatedLabel}
        </Link>
        <Link
          href="/manifesto"
          className="w-fit font-mono text-xs uppercase tracking-widest text-[#6B6B7B] transition-colors hover:text-[#F0F0F0]"
        >
          Read Our Manifesto →
        </Link>
      </div>
    </div>
  )
}

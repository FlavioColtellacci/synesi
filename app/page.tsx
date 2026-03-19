import { redirect } from "next/navigation"
import FeaturesSection from "@/components/landing/FeaturesSection"
import HeroSection from "@/components/landing/HeroSection"
import LandingFooter from "@/components/landing/LandingFooter"
import MarketingNav from "@/components/landing/MarketingNav"
import PricingSection from "@/components/landing/PricingSection"
import ProblemSection from "@/components/landing/ProblemSection"

type HomePageProps = {
  searchParams: Promise<{ code?: string }>
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = await searchParams
  if (params.code) {
    redirect(`/auth/callback?code=${params.code}`)
  }

  return (
    <div className="min-h-screen bg-[#0A0A0C]">
      <MarketingNav />
      <HeroSection />
      <ProblemSection />
      <FeaturesSection />
      <PricingSection />
      <LandingFooter />
    </div>
  )
}

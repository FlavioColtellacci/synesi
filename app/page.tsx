import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import FAQSection from "@/components/landing/FAQSection"
import FeaturesSection from "@/components/landing/FeaturesSection"
import HeroSection from "@/components/landing/HeroSection"
import HomeJsonLd from "@/components/landing/HomeJsonLd"
import LandingFooter from "@/components/landing/LandingFooter"
import MarketingNav from "@/components/landing/MarketingNav"
import PersonasSection from "@/components/landing/PersonasSection"
import PricingSection from "@/components/landing/PricingSection"
import ProblemSection from "@/components/landing/ProblemSection"
import ProductProofSection from "@/components/landing/ProductProofSection"
import SigmaDemoSection from "@/components/landing/SigmaDemoSection"
import TestimonialsSection from "@/components/landing/TestimonialsSection"
import { SmokeBackground } from "@/components/ui/spooky-smoke-animation"

type HomePageProps = {
  searchParams: Promise<{ code?: string }>
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = await searchParams
  if (params.code) {
    redirect(`/auth/callback?code=${params.code}`)
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    redirect('/app/dashboard')
  }

  return (
    <div className="relative isolate min-h-screen bg-[#0A0A0C]">
      <HomeJsonLd />
      <div className="pointer-events-none fixed inset-0 -z-10 opacity-[0.12]">
        <SmokeBackground smokeColor="#C8C8C8" />
      </div>
      <MarketingNav />
      <HeroSection />
      <SigmaDemoSection />
      <ProblemSection />
      <FeaturesSection />
      <ProductProofSection />
      <PersonasSection />
      <PricingSection />
      <TestimonialsSection />
      <FAQSection />
      <LandingFooter />
    </div>
  )
}

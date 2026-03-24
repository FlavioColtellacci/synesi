import MarketingPageNav from "@/components/landing/MarketingPageNav"
import LandingFooter from "@/components/landing/LandingFooter"

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#0A0A0C] px-6 pb-24 pt-40 md:px-10">
      <MarketingPageNav activeItem="product" />
      <div className="max-w-2xl mx-auto">
        <p className="font-mono text-xs tracking-widest uppercase text-[#6B6B7B] mb-4">Legal</p>
        <h1 className="font-mono text-2xl md:text-3xl font-medium text-[#F0F0F0] mb-2 tracking-wide">Privacy Policy</h1>
        <p className="font-sans text-xs text-[#6B6B7B] mb-12">Last updated: March 2026</p>

        <div className="space-y-10 font-sans text-sm text-[#6B6B7B] leading-relaxed">

          <section>
            <h2 className="font-mono text-xs tracking-widest uppercase text-[#F0F0F0] mb-4">1. Who We Are</h2>
            <p>SYNESI ("we", "us", "our") is an investment thesis tracking tool operated as a sole-trader business. We are not a financial advisor, broker, or investment firm. Our service is designed to help investors organise and review their own thinking, not to provide investment recommendations.</p>
            <p className="mt-3">Contact: support@synesi.app</p>
          </section>

          <section>
            <h2 className="font-mono text-xs tracking-widest uppercase text-[#F0F0F0] mb-4">2. What Data We Collect</h2>
            <p>We collect only what is necessary to provide the service:</p>
            <ul className="mt-3 space-y-2 list-none">
              <li className="flex gap-3"><span className="text-[#F0F0F0] font-mono">,</span><span><strong className="text-[#F0F0F0]">Account data:</strong> Your email address and encrypted password, collected at signup.</span></li>
              <li className="flex gap-3"><span className="text-[#F0F0F0] font-mono">,</span><span><strong className="text-[#F0F0F0]">Thesis data:</strong> Investment theses, assumptions, status updates, and notes you enter into the app. This data belongs to you.</span></li>
              <li className="flex gap-3"><span className="text-[#F0F0F0] font-mono">,</span><span><strong className="text-[#F0F0F0]">Payment data:</strong> Billing is handled entirely by Stripe. We never store your card number or payment details.</span></li>
              <li className="flex gap-3"><span className="text-[#F0F0F0] font-mono">,</span><span><strong className="text-[#F0F0F0]">Usage data:</strong> Basic analytics (page views, session counts) via Vercel Analytics. No personal identifiers attached.</span></li>
            </ul>
          </section>

          <section>
            <h2 className="font-mono text-xs tracking-widest uppercase text-[#F0F0F0] mb-4">3. How We Use Your Data</h2>
            <ul className="mt-3 space-y-2 list-none">
              <li className="flex gap-3"><span className="text-[#F0F0F0] font-mono">,</span><span>To provide and maintain the service</span></li>
              <li className="flex gap-3"><span className="text-[#F0F0F0] font-mono">,</span><span>To process your subscription via Stripe</span></li>
              <li className="flex gap-3"><span className="text-[#F0F0F0] font-mono">,</span><span>To run AI analysis on your thesis data using the Anthropic API (your data is sent to Anthropic's API solely to generate the analysis, it is not used to train their models under our current agreement)</span></li>
              <li className="flex gap-3"><span className="text-[#F0F0F0] font-mono">,</span><span>To send transactional emails (email confirmation, subscription receipts), no marketing emails without your explicit consent</span></li>
            </ul>
          </section>

          <section>
            <h2 className="font-mono text-xs tracking-widest uppercase text-[#F0F0F0] mb-4">4. Data Storage & Security</h2>
            <p>Your data is stored in Supabase (Postgres), hosted on AWS infrastructure in the EU. All data is encrypted at rest and in transit. Row-level security policies ensure you can only access your own data. We do not sell your data to any third party.</p>
          </section>

          <section>
            <h2 className="font-mono text-xs tracking-widest uppercase text-[#F0F0F0] mb-4">5. Third-Party Services</h2>
            <ul className="mt-3 space-y-2 list-none">
              <li className="flex gap-3"><span className="text-[#F0F0F0] font-mono">,</span><span>We use a small number of trusted third-party providers to support core product functionality, including infrastructure, billing, analytics, and data processing.</span></li>
            </ul>
          </section>

          <section>
            <h2 className="font-mono text-xs tracking-widest uppercase text-[#F0F0F0] mb-4">6. Your Rights</h2>
            <p>You can request deletion of your account and all associated data at any time by emailing support@synesi.app. We will delete your data within 30 days. You can export your thesis data at any time from within the app (coming in v1.5).</p>
          </section>

          <section>
            <h2 className="font-mono text-xs tracking-widest uppercase text-[#F0F0F0] mb-4">7. Changes to This Policy</h2>
            <p>We may update this policy as the product evolves. Significant changes will be communicated by email. Continued use of the service after changes constitutes acceptance.</p>
          </section>

        </div>
      </div>
      <LandingFooter />
    </div>
  )
}

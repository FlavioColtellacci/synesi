import MarketingPageNav from "@/components/landing/MarketingPageNav"
import LandingFooter from "@/components/landing/LandingFooter"

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#0A0A0C] px-6 pb-24 pt-40 md:px-10">
      <MarketingPageNav />
      <div className="max-w-2xl mx-auto mb-20 md:mb-24">
        <p className="font-mono text-xs tracking-widest uppercase text-[#6B6B7B] mb-4">Legal</p>
        <h1 className="font-mono text-2xl md:text-3xl font-medium text-[#F0F0F0] mb-2 tracking-wide">Terms of Service</h1>
        <p className="font-sans text-xs text-[#6B6B7B] mb-12">Last updated: March 2026</p>

        <div className="space-y-10 font-sans text-sm text-[#6B6B7B] leading-relaxed">

          <section>
            <h2 className="font-mono text-xs tracking-widest uppercase text-[#F0F0F0] mb-4">1. The Service</h2>
            <p>SYNESI is an investment thesis documentation and tracking tool. By using SYNESI, you agree to these terms. If you do not agree, do not use the service.</p>
          </section>

          <section>
            <h2 className="font-mono text-xs tracking-widest uppercase text-[#F0F0F0] mb-4">2. Not Financial Advice</h2>
            <p className="text-[#F0F0F0]">SYNESI is not a financial advisor, broker, dealer, or investment adviser. Nothing on this platform constitutes financial, investment, legal, or tax advice.</p>
            <p className="mt-3">AI-generated analysis within SYNESI is a thinking tool designed to help you stress-test your own reasoning. It is not a recommendation to buy, sell, or hold any security. All investment decisions are yours alone. SYNESI accepts no liability for any investment losses.</p>
          </section>

          <section>
            <h2 className="font-mono text-xs tracking-widest uppercase text-[#F0F0F0] mb-4">3. Eligibility</h2>
            <p>You must be 18 or older to use SYNESI. By creating an account, you confirm you are legally permitted to use financial tools in your jurisdiction.</p>
          </section>

          <section>
            <h2 className="font-mono text-xs tracking-widest uppercase text-[#F0F0F0] mb-4">4. Subscriptions & Billing</h2>
            <ul className="mt-3 space-y-2 list-none">
              <li className="flex gap-3"><span className="text-[#F0F0F0] font-mono">,</span><span>Subscriptions are billed monthly or annually via Stripe.</span></li>
              <li className="flex gap-3"><span className="text-[#F0F0F0] font-mono">,</span><span>You may cancel at any time via your Account page. Access continues until the end of the current billing period. No refunds for partial periods.</span></li>
              <li className="flex gap-3"><span className="text-[#F0F0F0] font-mono">,</span><span>We reserve the right to change pricing with 30 days' notice to existing subscribers.</span></li>
            </ul>
          </section>

          <section>
            <h2 className="font-mono text-xs tracking-widest uppercase text-[#F0F0F0] mb-4">5. Acceptable Use</h2>
            <p>You agree not to: reverse-engineer the service, attempt to access other users' data, use the service for any unlawful purpose, or resell or redistribute access.</p>
          </section>

          <section>
            <h2 className="font-mono text-xs tracking-widest uppercase text-[#F0F0F0] mb-4">6. Your Data</h2>
            <p>You own your thesis data. We store it to provide the service. We do not claim any rights over your investment content. See our Privacy Policy for full details on data handling.</p>
          </section>

          <section>
            <h2 className="font-mono text-xs tracking-widest uppercase text-[#F0F0F0] mb-4">7. Availability</h2>
            <p>We aim for high availability but do not guarantee uninterrupted service. We are not liable for data loss, outages, or service interruptions. We recommend exporting important thesis data periodically.</p>
          </section>

          <section>
            <h2 className="font-mono text-xs tracking-widest uppercase text-[#F0F0F0] mb-4">8. Termination</h2>
            <p>We reserve the right to suspend or terminate accounts that violate these terms. You may delete your account at any time by contacting support@synesi.app.</p>
          </section>

          <section>
            <h2 className="font-mono text-xs tracking-widest uppercase text-[#F0F0F0] mb-4">9. Governing Law</h2>
            <p>These terms are governed by the laws of Switzerland. Any disputes will be resolved in the courts of Switzerland.</p>
          </section>

        </div>
      </div>
      <LandingFooter />
    </div>
  )
}

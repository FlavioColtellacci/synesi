export default function ProductProofSection() {
  return (
    <section id="proof" className="px-6 py-32 md:px-10">
      <div className="mx-auto max-w-6xl">
        <p className="mb-4 text-center font-mono text-xs uppercase tracking-widest text-[#6B6B7B]">
          LIVE NOW — NO WAITLIST
        </p>
        <h2 className="mb-16 text-center font-mono text-2xl font-medium tracking-wide text-[#F0F0F0] md:text-3xl">
          See the engine behind your conviction
        </h2>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* Dashboard card */}
          <div className="rounded-xl border border-[#2A2A32] bg-[#141418] p-6">
            <p className="mb-4 font-mono text-xs uppercase tracking-widest text-[#6B6B7B]">
              THESIS DASHBOARD
            </p>
            <div className="space-y-3">
              {[
                { ticker: "NVDA", status: "INTACT", color: "#00D1B2", assumptions: 3 },
                { ticker: "AAPL", status: "AT RISK", color: "#FFB800", assumptions: 4 },
                { ticker: "AMZN", status: "INTACT", color: "#00D1B2", assumptions: 2 },
              ].map((item) => (
                <div
                  key={item.ticker}
                  className="flex items-center justify-between rounded-lg border border-[#2A2A32] bg-[#0A0A0C] px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm font-medium text-[#F0F0F0]">
                      {item.ticker}
                    </span>
                    <span
                      className="font-mono text-[10px] tracking-widest"
                      style={{ color: item.color }}
                    >
                      {item.status}
                    </span>
                  </div>
                  <span className="font-mono text-[10px] text-[#6B6B7B]">
                    {item.assumptions} assumptions
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* AI analysis card */}
          <div className="rounded-xl border border-[#2A2A32] bg-[#141418] p-6">
            <p className="mb-4 font-mono text-xs uppercase tracking-widest text-[#6B6B7B]">
              AI THESIS CHALLENGE
            </p>
            <div className="space-y-4">
              <div className="rounded-lg border border-[#2A2A32] bg-[#0A0A0C] p-4">
                <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-[#8B5CF6]">
                  BIAS SCAN
                </p>
                <p className="font-sans text-sm leading-relaxed text-[#6B6B7B]">
                  &ldquo;Your thesis leans heavily on management execution but
                  doesn&apos;t account for the competitive response from AMD and
                  custom silicon efforts at major hyperscalers.&rdquo;
                </p>
              </div>
              <div className="rounded-lg border border-[#2A2A32] bg-[#0A0A0C] p-4">
                <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-[#FFB800]">
                  STRESS TEST
                </p>
                <p className="font-sans text-sm leading-relaxed text-[#6B6B7B]">
                  &ldquo;If hyperscaler capex declines 15%+ for two consecutive
                  quarters, your core growth assumption breaks.&rdquo;
                </p>
              </div>
              <div className="rounded-lg border border-[#2A2A32] bg-[#0A0A0C] p-4">
                <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-[#00D1B2]">
                  MONITORING PLAN
                </p>
                <p className="font-sans text-sm leading-relaxed text-[#6B6B7B]">
                  &ldquo;Track quarterly data center revenue growth and gross
                  margin trends. Review thesis after each earnings call.&rdquo;
                </p>
              </div>
            </div>
          </div>
        </div>

        <p className="mt-8 text-center font-sans text-xs text-[#6B6B7B]">
          Start tracking today — your first thesis takes under 60 seconds.
        </p>
      </div>
    </section>
  )
}

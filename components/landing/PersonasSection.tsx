const personas = [
  {
    title: "The Conviction Investor",
    description:
      "You hold 5–20 positions and know exactly why you own each one. You want a system that keeps those reasons sharp as time passes.",
    keywords: "Thesis-driven investor · Conviction tracking · Position discipline",
  },
  {
    title: "The Analyst",
    description:
      "You cover multiple companies and need structured thesis documentation with falsifiable assumptions and audit trails.",
    keywords: "Research analyst · Due diligence · Thesis management",
  },
  {
    title: "The Self-Aware Trader",
    description:
      "You know cognitive bias is your biggest risk. You want a tool that challenges your thinking before the market does.",
    keywords: "Behavioral finance · Investment journal · Decision review",
  },
]

export default function PersonasSection() {
  return (
    <section id="who" className="px-6 py-32 md:px-10">
      <div className="mx-auto max-w-6xl">
        <h2 className="mb-4 text-center font-mono text-2xl font-medium tracking-wide text-[#F0F0F0] md:text-3xl">
          Who is SYNESI for?
        </h2>
        <p className="mb-16 text-center font-sans text-sm text-[#6B6B7B]">
          Built for thesis-driven investors who document their reasoning and review it as markets evolve.
        </p>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {personas.map((persona) => (
            <article
              key={persona.title}
              className="rounded-xl border border-[#2A2A32] bg-[#141418] p-8 transition-colors hover:border-[#3A3A42]"
            >
              <h3 className="mb-3 font-mono text-base font-medium tracking-wide text-[#F0F0F0]">
                {persona.title}
              </h3>
              <p className="mb-4 font-sans text-sm leading-relaxed text-[#6B6B7B]">
                {persona.description}
              </p>
              <p className="font-mono text-[10px] tracking-widest text-[#2A2A32]">
                {persona.keywords}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

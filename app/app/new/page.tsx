"use client"

import { useMemo, useState } from "react"

const STEPS = [
  { number: 1, label: "POSITION" },
  { number: 2, label: "ASSUMPTIONS" },
  { number: 3, label: "CONVICTION" },
] as const

export default function NewThesisPage() {
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1)
  const [ticker, setTicker] = useState("")
  const [company, setCompany] = useState("")
  const [thesisStatement, setThesisStatement] = useState("")

  const isStepOneValid = useMemo(() => {
    return (
      ticker.trim().length > 0 &&
      company.trim().length > 0 &&
      thesisStatement.trim().length > 0
    )
  }, [ticker, company, thesisStatement])

  const renderStepContent = () => {
    if (currentStep === 2) {
      return <div>Step 2 coming soon</div>
    }

    if (currentStep === 3) {
      return <div>Step 3 coming soon</div>
    }

    return (
      <>
        <div className="flex flex-col gap-6">
          <div>
            <label
              htmlFor="ticker"
              className="mb-2 block font-[var(--font-sans)] text-xs tracking-widest text-[#6B6B7B]"
            >
              TICKER
            </label>
            <input
              id="ticker"
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase())}
              placeholder="AAPL"
              required
              className="w-40 rounded-lg border border-[#2A2A32] bg-[#1C1C22] px-4 py-3 font-[var(--font-mono)] tracking-widest text-[#F0F0F0] uppercase placeholder:text-[#6B6B7B] transition-colors focus:border-[#F0F0F0] focus:outline-none"
            />
          </div>

          <div>
            <label
              htmlFor="company"
              className="mb-2 block font-[var(--font-sans)] text-xs tracking-widest text-[#6B6B7B]"
            >
              COMPANY
            </label>
            <input
              id="company"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="Apple Inc."
              required
              className="w-full rounded-lg border border-[#2A2A32] bg-[#1C1C22] px-4 py-3 font-[var(--font-sans)] text-[#F0F0F0] placeholder:text-[#6B6B7B] transition-colors focus:border-[#F0F0F0] focus:outline-none"
            />
          </div>

          <div>
            <label
              htmlFor="thesis-statement"
              className="mb-2 block font-[var(--font-sans)] text-xs tracking-widest text-[#6B6B7B]"
            >
              WHY I OWN THIS
            </label>
            <textarea
              id="thesis-statement"
              value={thesisStatement}
              onChange={(e) => setThesisStatement(e.target.value)}
              placeholder="In 1–3 sentences: what is the core reason you own this stock?"
              required
              rows={5}
              maxLength={500}
              className="w-full resize-none rounded-lg border border-[#2A2A32] bg-[#1C1C22] px-4 py-3 font-[var(--font-mono)] text-[#F0F0F0] placeholder:text-[#6B6B7B] transition-colors focus:border-[#F0F0F0] focus:outline-none"
            />
            <p className="mt-2 text-right font-[var(--font-sans)] text-xs text-[#6B6B7B]">
              {thesisStatement.length}/500
            </p>
          </div>
        </div>

        <div className="mt-8 flex justify-end">
          <button
            type="button"
            onClick={() => setCurrentStep(2)}
            disabled={!isStepOneValid}
            className="rounded-full bg-[#F0F0F0] px-6 py-2.5 font-[var(--font-mono)] text-sm font-medium tracking-widest text-[#0A0A0C] transition-colors hover:bg-[#E8E8E8] disabled:cursor-not-allowed disabled:opacity-30"
          >
            CONTINUE →
          </button>
        </div>
      </>
    )
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#0A0A0C]">
      <section className="my-12 w-full max-w-2xl rounded-xl border border-[#2A2A32] bg-[#141418] p-8">
        <h1 className="mb-8 font-[var(--font-mono)] text-xl font-medium tracking-widest text-[#F0F0F0]">
          NEW THESIS
        </h1>

        <div className="mb-10">
          <div className="flex items-center">
            {STEPS.map((step, index) => {
              const isActive = currentStep === step.number

              return (
                <div
                  key={step.number}
                  className={index === STEPS.length - 1 ? "shrink-0" : "flex flex-1 items-center"}
                >
                  <div className="flex flex-col items-center gap-2">
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-[var(--font-mono)] ${
                        isActive
                          ? "bg-[#F0F0F0] text-[#0A0A0C]"
                          : "border border-[#2A2A32] bg-[#141418] text-[#6B6B7B]"
                      }`}
                    >
                      {step.number}
                    </div>
                    <span className="font-[var(--font-sans)] text-xs text-[#6B6B7B]">
                      {step.label}
                    </span>
                  </div>

                  {index < STEPS.length - 1 ? (
                    <div className="mx-3 h-px flex-1 bg-[#2A2A32]" />
                  ) : null}
                </div>
              )
            })}
          </div>
        </div>

        {renderStepContent()}
      </section>
    </main>
  )
}

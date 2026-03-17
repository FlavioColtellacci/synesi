"use client"

import { useMemo, useState } from "react"

const STEPS = [
  { number: 1, label: "POSITION" },
  { number: 2, label: "ASSUMPTIONS" },
  { number: 3, label: "CONVICTION" },
] as const

type AssumptionCategory = "growth" | "economics" | "moat" | "management"

type AssumptionFields = {
  statement: string
  evidence: string
  kpiLabel: string
  kpiThreshold: string
  breakCondition: string
}

type AssumptionsState = Record<AssumptionCategory, AssumptionFields>

const STEP_TWO_CATEGORIES: Array<{
  key: AssumptionCategory
  name: string
  statementPlaceholder: string
}> = [
  {
    key: "growth",
    name: "Growth",
    statementPlaceholder:
      "Revenue grows at least 10% annually for the next 3 years",
  },
  {
    key: "economics",
    name: "Economics",
    statementPlaceholder:
      "Operating margin expands by at least 200 bps over the next 2 years",
  },
  {
    key: "moat",
    name: "Moat",
    statementPlaceholder:
      "Customer retention stays above 90% as competitors increase pricing pressure",
  },
  {
    key: "management",
    name: "Management",
    statementPlaceholder:
      "Management continues disciplined capital allocation focused on high-ROI reinvestment",
  },
]

export default function NewThesisPage() {
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1)
  const [ticker, setTicker] = useState("")
  const [company, setCompany] = useState("")
  const [thesisStatement, setThesisStatement] = useState("")
  const [assumptions, setAssumptions] = useState<AssumptionsState>({
    growth: {
      statement: "",
      evidence: "",
      kpiLabel: "",
      kpiThreshold: "",
      breakCondition: "",
    },
    economics: {
      statement: "",
      evidence: "",
      kpiLabel: "",
      kpiThreshold: "",
      breakCondition: "",
    },
    moat: {
      statement: "",
      evidence: "",
      kpiLabel: "",
      kpiThreshold: "",
      breakCondition: "",
    },
    management: {
      statement: "",
      evidence: "",
      kpiLabel: "",
      kpiThreshold: "",
      breakCondition: "",
    },
  })

  const isStepOneValid = useMemo(() => {
    return (
      ticker.trim().length > 0 &&
      company.trim().length > 0 &&
      thesisStatement.trim().length > 0
    )
  }, [ticker, company, thesisStatement])

  const hasAtLeastOneStepTwoStatement = useMemo(() => {
    return STEP_TWO_CATEGORIES.some(
      ({ key }) => assumptions[key].statement.trim().length > 0,
    )
  }, [assumptions])

  const updateAssumptionField = (
    category: AssumptionCategory,
    field: keyof AssumptionFields,
    value: string,
  ) => {
    setAssumptions((prev) => ({
      ...prev,
      [category]: {
        ...prev[category],
        [field]: value,
      },
    }))
  }

  const renderStepContent = () => {
    if (currentStep === 2) {
      return (
        <>
          <div>
            {STEP_TWO_CATEGORIES.map((category) => (
              <div
                key={category.key}
                className="mb-4 rounded-xl border border-[#2A2A32] bg-[#1C1C22] p-6"
              >
                <p className="mb-4 font-[var(--font-mono)] text-xs tracking-widest text-[#6B6B7B] uppercase">
                  {category.name}
                </p>

                <div className="flex flex-col gap-4">
                  <div>
                    <label
                      htmlFor={`${category.key}-statement`}
                      className="mb-2 block text-xs tracking-widest text-[#6B6B7B] uppercase"
                    >
                      WHAT MUST BE TRUE
                    </label>
                    <textarea
                      id={`${category.key}-statement`}
                      rows={2}
                      required
                      value={assumptions[category.key].statement}
                      onChange={(e) =>
                        updateAssumptionField(
                          category.key,
                          "statement",
                          e.target.value,
                        )
                      }
                      placeholder={category.statementPlaceholder}
                      className="w-full rounded-lg border border-[#2A2A32] bg-[#141418] px-4 py-3 text-sm text-[#F0F0F0] placeholder:text-[#6B6B7B] transition-colors focus:border-[#F0F0F0] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor={`${category.key}-evidence`}
                      className="mb-2 block text-xs tracking-widest text-[#6B6B7B] uppercase"
                    >
                      WHY I BELIEVE THIS
                    </label>
                    <textarea
                      id={`${category.key}-evidence`}
                      rows={2}
                      value={assumptions[category.key].evidence}
                      onChange={(e) =>
                        updateAssumptionField(
                          category.key,
                          "evidence",
                          e.target.value,
                        )
                      }
                      placeholder="Optional — what makes you confident in this assumption?"
                      className="w-full rounded-lg border border-[#2A2A32] bg-[#141418] px-4 py-3 text-sm text-[#F0F0F0] placeholder:text-[#6B6B7B] transition-colors focus:border-[#F0F0F0] focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label
                        htmlFor={`${category.key}-kpi-label`}
                        className="mb-2 block text-xs tracking-widest text-[#6B6B7B] uppercase"
                      >
                        KPI
                      </label>
                      <input
                        id={`${category.key}-kpi-label`}
                        type="text"
                        value={assumptions[category.key].kpiLabel}
                        onChange={(e) =>
                          updateAssumptionField(
                            category.key,
                            "kpiLabel",
                            e.target.value,
                          )
                        }
                        placeholder="Revenue growth YoY"
                        className="w-full rounded-lg border border-[#2A2A32] bg-[#141418] px-4 py-3 text-sm text-[#F0F0F0] placeholder:text-[#6B6B7B] transition-colors focus:border-[#F0F0F0] focus:outline-none"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor={`${category.key}-kpi-threshold`}
                        className="mb-2 block text-xs tracking-widest text-[#6B6B7B] uppercase"
                      >
                        THRESHOLD
                      </label>
                      <input
                        id={`${category.key}-kpi-threshold`}
                        type="text"
                        value={assumptions[category.key].kpiThreshold}
                        onChange={(e) =>
                          updateAssumptionField(
                            category.key,
                            "kpiThreshold",
                            e.target.value,
                          )
                        }
                        placeholder="> 10% annually"
                        className="w-full rounded-lg border border-[#2A2A32] bg-[#141418] px-4 py-3 text-sm text-[#F0F0F0] placeholder:text-[#6B6B7B] transition-colors focus:border-[#F0F0F0] focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor={`${category.key}-break-condition`}
                      className="mb-2 block text-xs tracking-widest text-[#6B6B7B] uppercase"
                    >
                      I'LL KNOW THIS IS BROKEN IF...
                    </label>
                    <textarea
                      id={`${category.key}-break-condition`}
                      rows={2}
                      value={assumptions[category.key].breakCondition}
                      onChange={(e) =>
                        updateAssumptionField(
                          category.key,
                          "breakCondition",
                          e.target.value,
                        )
                      }
                      placeholder="Two consecutive quarters of revenue decline below 5%"
                      className="w-full rounded-lg border border-[#2A2A32] bg-[#141418] px-4 py-3 text-sm text-[#F0F0F0] placeholder:text-[#6B6B7B] transition-colors focus:border-[#F0F0F0] focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setCurrentStep(1)}
              className="font-[var(--font-mono)] text-sm tracking-widest text-[#6B6B7B] transition-colors hover:text-[#F0F0F0]"
            >
              ← BACK
            </button>

            <button
              type="button"
              onClick={() => setCurrentStep(3)}
              disabled={!hasAtLeastOneStepTwoStatement}
              className="rounded-full bg-[#F0F0F0] px-6 py-2.5 font-[var(--font-mono)] text-sm font-medium tracking-widest text-[#0A0A0C] transition-colors hover:bg-[#E8E8E8] disabled:cursor-not-allowed disabled:opacity-30"
            >
              CONTINUE →
            </button>
          </div>
        </>
      )
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

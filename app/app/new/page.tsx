"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

type PageState = "input" | "loading" | "review"

type ExtractedThesis = {
  ticker: string
  companyName: string
  thesisStatement: string
  investingStyle: string
  assumptions: {
    category: string
    statement: string
    breakCondition: string
  }[]
  bullCase: string
  bearCase: string
  exitCriteria: string
  confidenceLevel: "high" | "medium" | "low"
}

const emptyExtractedData: ExtractedThesis = {
  ticker: "",
  companyName: "",
  thesisStatement: "",
  investingStyle: "growth",
  assumptions: [],
  bullCase: "",
  bearCase: "",
  exitCriteria: "",
  confidenceLevel: "medium",
}

const fieldClassName =
  "w-full rounded-lg border border-[#2A2A32] bg-[#1C1C22] px-4 py-3 text-sm text-[#F0F0F0] placeholder:text-[#6B6B7B] transition-colors focus:border-[#F0F0F0] focus:outline-none"

export default function NewThesisPage() {
  const router = useRouter()
  const [pageState, setPageState] = useState<PageState>("input")
  const [rawInput, setRawInput] = useState("")
  const [saving, setSaving] = useState(false)
  const [extractedData, setExtractedData] =
    useState<ExtractedThesis>(emptyExtractedData)

  const canAnalyse = rawInput.trim().length >= 50

  const handleAnalyse = async () => {
    if (!canAnalyse) return

    setPageState("loading")

    try {
      const response = await fetch("/api/theses/analyse-input", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ rawInput }),
      })

      if (!response.ok) {
        throw new Error("Failed to analyse thesis input")
      }

      const payload = (await response.json()) as { data: ExtractedThesis }
      setExtractedData(payload.data)
      setPageState("review")
    } catch (error) {
      console.error("Analyse failed:", error)
      setPageState("input")
    }
  }

  const handleStartOver = () => {
    setPageState("input")
    setExtractedData(emptyExtractedData)
    setRawInput("")
  }

  const handleSave = async () => {
    setSaving(true)

    try {
      const response = await fetch("/api/theses/save", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ thesis: extractedData }),
      })

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null
        throw new Error(payload?.error ?? "Failed to save thesis")
      }

      router.push("/app/dashboard")
    } catch (error) {
      setSaving(false)
      console.error("Save failed:", error)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0A0A0C] px-4 md:px-10">
      <section className="w-full max-w-2xl rounded-xl border border-[#2A2A32] bg-[#141418] p-4 md:p-8">
        {pageState === "input" ? (
          <>
            <h1 className="font-mono uppercase text-[#F0F0F0] text-xl tracking-widest mb-2">
              NEW THESIS
            </h1>
            <p className="text-sm text-[#6B6B7B] mb-6">
              Describe your investment in plain English. The more detail you
              give, the better.
            </p>

            <div className="bg-[#1C1C22] border border-[#2A2A32] rounded-lg p-4 mb-6">
              <p className="font-mono text-xs text-[#6B6B7B] tracking-widest mb-3">
                WHAT TO INCLUDE
              </p>
              <ul className="space-y-2 text-sm text-[#6B6B7B]">
                <li>
                  •{" "}
                  <span className="text-[#F0F0F0]">
                    The stock ticker and company name
                  </span>
                </li>
                <li>
                  •{" "}
                  <span className="text-[#F0F0F0]">
                    Why you own or want to own this stock
                  </span>
                </li>
                <li>
                  •{" "}
                  <span className="text-[#F0F0F0]">
                    What must be true for your thesis to hold
                  </span>
                </li>
                <li>
                  •{" "}
                  <span className="text-[#F0F0F0]">
                    What would make you sell or change your mind
                  </span>
                </li>
              </ul>
            </div>

            <textarea
              rows={10}
              value={rawInput}
              onChange={(event) => setRawInput(event.target.value)}
              placeholder="Example: I own NVDA because I believe we are in the early innings of the AI compute buildout. Jensen Huang has proven he can execute through multiple cycles. The key assumption is that hyperscaler capex keeps growing. I'd sell if AMD closes the performance gap or if cloud capex starts declining."
              className={`${fieldClassName} min-h-[160px] resize-none leading-relaxed`}
            />

            <p className="mt-2 text-right text-xs text-[#6B6B7B]">
              {rawInput.length} characters
            </p>

            <div className="mt-6 flex">
              <button
                type="button"
                onClick={handleAnalyse}
                disabled={!canAnalyse}
                className="inline-flex min-h-[48px] w-full items-center justify-center rounded-full bg-[#F0F0F0] px-6 py-2.5 font-mono text-sm tracking-widest text-[#0A0A0C] transition-colors hover:bg-[#E8E8E8] disabled:cursor-not-allowed disabled:opacity-30 md:w-auto"
              >
                ANALYSE THESIS →
              </button>
            </div>
          </>
        ) : null}

        {pageState === "loading" ? (
          <div className="py-16 flex flex-col items-center justify-center">
            <p className="text-4xl font-mono text-[#F0F0F0] animate-pulse mb-4">
              Σ
            </p>
            <p className="text-sm text-[#6B6B7B]">Analysing your thesis...</p>
          </div>
        ) : null}

        {pageState === "review" ? (
          <>
            <h2 className="font-mono uppercase text-[#F0F0F0] text-xl tracking-widest mb-2">
              REVIEW YOUR THESIS
            </h2>
            <p className="text-sm text-[#6B6B7B] mb-6">
              This is what SYNESI understood. Edit anything before saving.
            </p>

            <div className="space-y-5">
              <div>
                <label className="text-xs text-[#6B6B7B] font-mono uppercase tracking-widest mb-2 block">
                  TICKER
                </label>
                <input
                  type="text"
                  value={extractedData.ticker}
                  onChange={(event) =>
                    setExtractedData((prev) => ({
                      ...prev,
                      ticker: event.target.value.toUpperCase(),
                    }))
                  }
                  className={`${fieldClassName} w-full font-mono uppercase md:w-40`}
                />
              </div>

              <div>
                <label className="text-xs text-[#6B6B7B] font-mono uppercase tracking-widest mb-2 block">
                  COMPANY
                </label>
                <input
                  type="text"
                  value={extractedData.companyName}
                  onChange={(event) =>
                    setExtractedData((prev) => ({
                      ...prev,
                      companyName: event.target.value,
                    }))
                  }
                  className={fieldClassName}
                />
              </div>

              <div>
                <label className="text-xs text-[#6B6B7B] font-mono uppercase tracking-widest mb-2 block">
                  THESIS STATEMENT
                </label>
                <textarea
                  rows={3}
                  value={extractedData.thesisStatement}
                  onChange={(event) =>
                    setExtractedData((prev) => ({
                      ...prev,
                      thesisStatement: event.target.value,
                    }))
                  }
                  className={`${fieldClassName} resize-none`}
                />
              </div>

              <div>
                <label className="text-xs text-[#6B6B7B] font-mono uppercase tracking-widest mb-2 block">
                  ASSUMPTIONS
                </label>
                <div>
                  {extractedData.assumptions.map((assumption, index) => (
                    <div
                      key={`${assumption.category}-${index}`}
                      className="bg-[#0A0A0C] border border-[#2A2A32] rounded-lg p-4 mb-3"
                    >
                      <p className="font-mono uppercase text-xs text-[#6B6B7B] mb-2">
                        {assumption.category}
                      </p>

                      <label className="text-xs text-[#6B6B7B] font-mono uppercase tracking-widest mb-2 block">
                        STATEMENT
                      </label>
                      <textarea
                        rows={2}
                        value={assumption.statement}
                        onChange={(event) =>
                          setExtractedData((prev) => ({
                            ...prev,
                            assumptions: prev.assumptions.map((item, itemIndex) =>
                              itemIndex === index
                                ? { ...item, statement: event.target.value }
                                : item,
                            ),
                          }))
                        }
                        className={`${fieldClassName} resize-none mb-3`}
                      />

                      <label className="text-xs text-[#6B6B7B] font-mono uppercase tracking-widest mb-2 block">
                        I&apos;LL KNOW THIS IS BROKEN IF...
                      </label>
                      <textarea
                        rows={2}
                        value={assumption.breakCondition}
                        onChange={(event) =>
                          setExtractedData((prev) => ({
                            ...prev,
                            assumptions: prev.assumptions.map((item, itemIndex) =>
                              itemIndex === index
                                ? { ...item, breakCondition: event.target.value }
                                : item,
                            ),
                          }))
                        }
                        className={`${fieldClassName} resize-none`}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs text-[#6B6B7B] font-mono uppercase tracking-widest mb-2 block">
                  CONFIDENCE
                </label>
                <div className="flex flex-col gap-2 md:flex-row md:items-center">
                  {(["high", "medium", "low"] as const).map((level) => (
                    <button
                      key={level}
                      type="button"
                      onClick={() =>
                        setExtractedData((prev) => ({
                          ...prev,
                          confidenceLevel: level,
                        }))
                      }
                      className={`font-mono text-xs tracking-widest px-4 py-2 rounded-full transition-colors ${
                        extractedData.confidenceLevel === level
                          ? "bg-[#F0F0F0] text-[#0A0A0C]"
                          : "border border-[#2A2A32] text-[#6B6B7B] hover:text-[#F0F0F0]"
                      }`}
                    >
                      {level.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs text-[#6B6B7B] font-mono uppercase tracking-widest mb-2 block">
                  I&apos;LL SELL IF...
                </label>
                <textarea
                  rows={2}
                  value={extractedData.exitCriteria}
                  onChange={(event) =>
                    setExtractedData((prev) => ({
                      ...prev,
                      exitCriteria: event.target.value,
                    }))
                  }
                  className={`${fieldClassName} resize-none`}
                />
              </div>
            </div>

            <div className="mt-8 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <button
                type="button"
                onClick={handleStartOver}
                className="cursor-pointer self-start font-mono text-sm text-[#6B6B7B] transition-colors hover:text-[#F0F0F0]"
              >
                ← Start over
              </button>

              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="inline-flex min-h-[48px] w-full items-center justify-center rounded-full bg-[#F0F0F0] px-6 py-2.5 font-mono text-sm tracking-widest text-[#0A0A0C] transition-colors hover:bg-[#E8E8E8] md:w-auto"
              >
                {saving ? "SAVING..." : "SAVE THESIS →"}
              </button>
            </div>
          </>
        ) : null}
      </section>
    </main>
  )
}

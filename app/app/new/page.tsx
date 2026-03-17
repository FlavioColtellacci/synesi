"use client"

import { useState } from "react"

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
  const [pageState, setPageState] = useState<PageState>("input")
  const [rawInput, setRawInput] = useState("")
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

  return (
    <main className="bg-[#0A0A0C] min-h-screen flex items-center justify-center px-4">
      <section className="bg-[#141418] border border-[#2A2A32] rounded-xl p-8 w-full max-w-2xl">
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
              className={`${fieldClassName} resize-none leading-relaxed`}
            />

            <p className="mt-2 text-right text-xs text-[#6B6B7B]">
              {rawInput.length} characters
            </p>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={handleAnalyse}
                disabled={!canAnalyse}
                className="bg-[#F0F0F0] text-[#0A0A0C] rounded-full px-6 py-2.5 text-sm font-mono tracking-widest hover:bg-[#E8E8E8] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
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
                  className={`${fieldClassName} w-40 font-mono uppercase`}
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
                <div className="flex items-center gap-2">
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

            <div className="mt-8 flex items-center justify-between">
              <button
                type="button"
                onClick={handleStartOver}
                className="text-sm text-[#6B6B7B] font-mono hover:text-[#F0F0F0] cursor-pointer transition-colors"
              >
                ← Start over
              </button>

              <button
                type="button"
                onClick={() => console.log("saving:", extractedData)}
                className="bg-[#F0F0F0] text-[#0A0A0C] rounded-full px-6 py-2.5 text-sm font-mono tracking-widest hover:bg-[#E8E8E8] transition-colors"
              >
                SAVE THESIS →
              </button>
            </div>
          </>
        ) : null}
      </section>
    </main>
  )
}

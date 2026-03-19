"use client"

import { useState } from "react"

type AnalysisResult = {
  clarityCheck: { summary: string; points: string[] }
  stressTest: { summary: string; points: string[] }
  biasScan: { summary: string; points: string[] }
  monitoringPlan: { summary: string; points: string[] }
  researchQuestions: { summary: string; points: string[] }
  footer: string
}

type AnalysisButtonProps = {
  thesisId: string
}

type Status = "idle" | "loading" | "done"

const sections: Array<{
  key: keyof Omit<AnalysisResult, "footer">
  title: string
}> = [
  { key: "clarityCheck", title: "CLARITY CHECK" },
  { key: "stressTest", title: "ASSUMPTION STRESS-TEST" },
  { key: "biasScan", title: "BIAS SCAN" },
  { key: "monitoringPlan", title: "MONITORING PLAN" },
  { key: "researchQuestions", title: "RESEARCH QUESTIONS" },
]

export function AnalysisButton({ thesisId }: AnalysisButtonProps) {
  const [status, setStatus] = useState<Status>("idle")
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [expandedSection, setExpandedSection] = useState<string | null>(null)

  const handleAnalyse = async () => {
    try {
      setError(null)
      setStatus("loading")

      const response = await fetch("/api/ai/analyse", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ thesisId }),
      })

      const payload = (await response.json().catch(() => null)) as
        | { analysis?: AnalysisResult; error?: string }
        | null

      if (!response.ok) {
        if (response.status === 429) {
          setError("Analysis already run in the last 24 hours. Come back tomorrow.")
          setStatus("idle")
          return
        }

        setError("Analysis failed. Please try again.")
        setStatus("idle")
        return
      }

      if (!payload?.analysis) {
        setError("Analysis failed. Please try again.")
        setStatus("idle")
        return
      }

      setAnalysis(payload.analysis)
      setExpandedSection(null)
      setStatus("done")
    } catch {
      setError("Analysis failed. Please try again.")
      setStatus("idle")
    }
  }

  if (status === "loading") {
    return (
      <div className="py-8 text-center">
        <p className="font-mono text-3xl text-[#F0F0F0] animate-pulse mb-3">Σ</p>
        <p className="text-sm text-[#6B6B7B]">Analysing your thesis...</p>
      </div>
    )
  }

  if (status === "done" && analysis) {
    return (
      <div>
        {sections.map((section) => {
          const isExpanded = expandedSection === section.key
          const sectionData = analysis[section.key]

          return (
            <article
              key={section.key}
              className="bg-[#141418] border border-[#2A2A32] rounded-xl mb-3 overflow-hidden"
            >
              <button
                type="button"
                onClick={() =>
                  setExpandedSection((current) => (current === section.key ? null : section.key))
                }
                className="w-full flex justify-between items-center p-5 cursor-pointer hover:bg-[#1C1C22] transition-colors"
              >
                <span className="font-mono text-xs text-[#F0F0F0] tracking-widest uppercase">
                  {section.title}
                </span>
                <span className="font-mono text-[#6B6B7B]">{isExpanded ? "−" : "+"}</span>
              </button>

              {isExpanded ? (
                <div className="px-5 pb-5">
                  <p className="text-sm text-[#6B6B7B] leading-relaxed mb-3">{sectionData.summary}</p>
                  <ul>
                    {sectionData.points.map((point, index) => (
                      <li key={`${section.key}-${index}`} className="flex items-start gap-2 mb-2">
                        <span className="w-1 h-1 rounded-full bg-[#6B6B7B] mt-2 shrink-0" />
                        <span className="text-sm text-[#F0F0F0] leading-relaxed">{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </article>
          )
        })}

        <p className="text-xs text-[#6B6B7B] text-center mt-4 italic">{analysis.footer}</p>
      </div>
    )
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleAnalyse}
        className="border border-[#F0F0F0]/30 text-[#F0F0F0] rounded-full px-6 py-2.5 text-sm font-mono tracking-widest hover:bg-[#F0F0F0]/5 transition-colors w-full"
      >
        ANALYSE THESIS →
      </button>
      {error ? <p className="text-sm text-[#FF3B30] font-mono mt-2">{error}</p> : null}
    </div>
  )
}

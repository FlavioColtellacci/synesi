"use client"

import { useState } from "react"
import { trackFunnelEvent } from "@/lib/analytics"

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
  initialLastAnalysedAt?: string | null
  initialAnalysis?: AnalysisResult | null
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

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function sanitizeAnalysisText(text: string) {
  // Ensure the UI never shows em-dashes coming from model output.
  return text.replaceAll("—", "-").replaceAll("–", "-")
}

function sanitizeAnalysisResult(analysis: AnalysisResult): AnalysisResult {
  return {
    clarityCheck: {
      summary: sanitizeAnalysisText(analysis.clarityCheck.summary),
      points: analysis.clarityCheck.points.map(sanitizeAnalysisText),
    },
    stressTest: {
      summary: sanitizeAnalysisText(analysis.stressTest.summary),
      points: analysis.stressTest.points.map(sanitizeAnalysisText),
    },
    biasScan: {
      summary: sanitizeAnalysisText(analysis.biasScan.summary),
      points: analysis.biasScan.points.map(sanitizeAnalysisText),
    },
    monitoringPlan: {
      summary: sanitizeAnalysisText(analysis.monitoringPlan.summary),
      points: analysis.monitoringPlan.points.map(sanitizeAnalysisText),
    },
    researchQuestions: {
      summary: sanitizeAnalysisText(analysis.researchQuestions.summary),
      points: analysis.researchQuestions.points.map(sanitizeAnalysisText),
    },
    footer: sanitizeAnalysisText(analysis.footer),
  }
}

export function AnalysisButton({
  thesisId,
  initialLastAnalysedAt = null,
  initialAnalysis = null,
}: AnalysisButtonProps) {
  const [status, setStatus] = useState<Status>(initialAnalysis ? "done" : "idle")
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(
    initialAnalysis ? sanitizeAnalysisResult(initialAnalysis) : null,
  )
  const [error, setError] = useState<string | null>(null)
  const [expandedSection, setExpandedSection] = useState<string | null>(null)
  const [lastAnalysedAt, setLastAnalysedAt] = useState<string | null>(initialLastAnalysedAt)

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
        | { analysis?: AnalysisResult; analysedAt?: string; error?: string }
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

      setAnalysis(sanitizeAnalysisResult(payload.analysis))
      if (payload.analysedAt) {
        setLastAnalysedAt(payload.analysedAt)
      }
      trackFunnelEvent("first_ai_analysis")
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
        {lastAnalysedAt ? (
          <p className="text-xs text-[#6B6B7B] mb-4">Last analysis: {formatDateTime(lastAnalysedAt)}</p>
        ) : null}
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
      {lastAnalysedAt ? (
        <p className="text-xs text-[#6B6B7B] mb-2">Last analysis: {formatDateTime(lastAnalysedAt)}</p>
      ) : null}
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

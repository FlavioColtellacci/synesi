"use client"

import { useMemo, useState } from "react"

type ParsedAnalysisSection = {
  summary?: string
  points?: string[]
}

type ParsedAnalysisNote = {
  clarityCheck?: ParsedAnalysisSection
  stressTest?: ParsedAnalysisSection
  biasScan?: ParsedAnalysisSection
  monitoringPlan?: ParsedAnalysisSection
  researchQuestions?: ParsedAnalysisSection
  footer?: string
}

type Props = {
  preview: string
  analysis: ParsedAnalysisNote
}

function sanitizeAnalysisText(text: string) {
  // The model sometimes returns em/en dashes; normalize to ASCII hyphen for the UI.
  return text.replaceAll("\u2014", "-").replaceAll("\u2013", "-")
}

export function AnalysisHistoryReadMore({ preview, analysis }: Props) {
  const [open, setOpen] = useState(false)

  const sections = useMemo(
    () => [
      { title: "CLARITY CHECK", section: analysis.clarityCheck },
      { title: "ASSUMPTION STRESS-TEST", section: analysis.stressTest },
      { title: "BIAS SCAN", section: analysis.biasScan },
      { title: "MONITORING PLAN", section: analysis.monitoringPlan },
      { title: "RESEARCH QUESTIONS", section: analysis.researchQuestions },
    ],
    [analysis],
  )

  return (
    <div className="mt-1">
      <p className="text-sm text-[#6B6B7B] leading-relaxed">{sanitizeAnalysisText(preview)}</p>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mt-2 w-full flex items-center gap-2 font-mono text-xs tracking-widest uppercase text-[#8B5CF6] hover:text-[#A78BFA] transition-colors"
      >
        <span className="text-sm leading-none">{open ? "−" : "+"}</span>
        <span>Read more</span>
      </button>

      {open ? (
        <div className="mt-3 space-y-3 rounded-lg border border-[#2A2A32] bg-[#141418] p-4">
          {sections.map(({ title, section }) => {
            if (!section?.summary && (!section?.points || section.points.length === 0)) {
              return null
            }

            return (
              <div key={title}>
                <p className="font-mono text-[11px] text-[#6B6B7B] tracking-widest uppercase mb-1">
                  {title}
                </p>
                {section.summary ? (
                  <p className="text-sm text-[#6B6B7B] leading-relaxed">{sanitizeAnalysisText(section.summary)}</p>
                ) : null}

                {section.points?.length ? (
                  <ul className="mt-2 space-y-1.5">
                    {section.points.map((point) => (
                      <li key={`${title}-${point}`} className="flex items-start gap-2">
                        <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[#6B6B7B]" />
                        <span className="text-sm text-[#F0F0F0] leading-relaxed">
                          {sanitizeAnalysisText(point)}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            )
          })}

          {analysis.footer ? (
            <p className="text-xs text-[#6B6B7B] italic">{sanitizeAnalysisText(analysis.footer)}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}


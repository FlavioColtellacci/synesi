import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { AnalysisButton } from "@/components/thesis/AnalysisButton"
import DeleteThesisButton from "@/components/thesis/DeleteThesisButton"
import { createClient } from "@/lib/supabase/server"
import type { Database } from "@/types/database"

type Assumption = Database["public"]["Tables"]["assumptions"]["Row"]
type ThesisUpdate = Pick<
  Database["public"]["Tables"]["thesis_updates"]["Row"],
  "id" | "update_type" | "note" | "old_status" | "new_status" | "created_at"
>

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

type AnalysisResult = {
  clarityCheck: { summary: string; points: string[] }
  stressTest: { summary: string; points: string[] }
  biasScan: { summary: string; points: string[] }
  monitoringPlan: { summary: string; points: string[] }
  researchQuestions: { summary: string; points: string[] }
  footer: string
}

type PageProps = {
  params: Promise<{
    id: string
  }>
}

function getStatusMeta(status: string) {
  if (status === "at_risk") {
    return {
      label: "◐ AT RISK",
      className: "bg-[#FFB800]/10 text-[#FFB800] border-[#FFB800]/30",
    }
  }

  if (status === "broken") {
    return {
      label: "✕ BROKEN",
      className: "bg-[#FF3B30]/10 text-[#FF3B30] border-[#FF3B30]/30",
    }
  }

  return {
    label: "● INTACT",
    className: "bg-[#00D1B2]/10 text-[#00D1B2] border-[#00D1B2]/30",
  }
}

function getUpdateTypeMeta(updateType: string) {
  if (updateType === "status_change") {
    return {
      label: "STATUS CHANGE",
      className: "bg-[#FFB800]/10 text-[#FFB800]",
    }
  }

  if (updateType === "ai_analysis") {
    return {
      label: "AI ANALYSIS",
      className: "bg-[#8B5CF6]/10 text-[#8B5CF6]",
    }
  }

  if (updateType === "note") {
    return {
      label: "NOTE",
      className: "bg-[#2A2A32] text-[#6B6B7B]",
    }
  }

  return {
    label: "CREATED",
    className: "bg-[#2A2A32] text-[#6B6B7B]",
  }
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

function getSectionContent(analysis: ParsedAnalysisNote) {
  return [
    { title: "Clarity Check", section: analysis.clarityCheck },
    { title: "Assumption Stress-Test", section: analysis.stressTest },
    { title: "Bias Scan", section: analysis.biasScan },
    { title: "Monitoring Plan", section: analysis.monitoringPlan },
    { title: "Research Questions", section: analysis.researchQuestions },
  ]
}

function parseAnalysisNote(note: string | null): ParsedAnalysisNote | null {
  if (!note) {
    return null
  }

  try {
    return JSON.parse(note) as ParsedAnalysisNote
  } catch {
    return null
  }
}

function isAnalysisSection(
  section: ParsedAnalysisSection | undefined,
): section is { summary: string; points: string[] } {
  return (
    !!section &&
    typeof section.summary === "string" &&
    Array.isArray(section.points) &&
    section.points.every((point) => typeof point === "string")
  )
}

function toAnalysisResult(input: ParsedAnalysisNote | null): AnalysisResult | null {
  if (!input) {
    return null
  }

  if (
    !isAnalysisSection(input.clarityCheck) ||
    !isAnalysisSection(input.stressTest) ||
    !isAnalysisSection(input.biasScan) ||
    !isAnalysisSection(input.monitoringPlan) ||
    !isAnalysisSection(input.researchQuestions) ||
    typeof input.footer !== "string"
  ) {
    return null
  }

  return {
    clarityCheck: input.clarityCheck,
    stressTest: input.stressTest,
    biasScan: input.biasScan,
    monitoringPlan: input.monitoringPlan,
    researchQuestions: input.researchQuestions,
    footer: input.footer,
  }
}

function getAnalysisPreview(analysis: ParsedAnalysisNote | null): string {
  if (!analysis) {
    return "AI analysis generated."
  }

  const summaries = getSectionContent(analysis)
    .map((item) => item.section?.summary)
    .filter(Boolean)

  return summaries[0] ?? "AI analysis generated."
}

export default async function ThesisDetailPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const { data: thesis } = await supabase
    .from("theses")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle()

  if (!thesis) {
    notFound()
  }

  const [{ data: assumptionsData }, { data: updatesData }] = await Promise.all([
    supabase
      .from("assumptions")
      .select("*")
      .eq("thesis_id", id)
      .eq("user_id", user.id)
      .order("sort_order", { ascending: true }),
    supabase
      .from("thesis_updates")
      .select("id, update_type, note, old_status, new_status, created_at")
      .eq("thesis_id", id)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
  ])

  const assumptions: Assumption[] = assumptionsData ?? []
  const updates: ThesisUpdate[] = updatesData ?? []
  const statusMeta = getStatusMeta(thesis.status)
  const latestAiUpdate = updates.find((update) => update.update_type === "ai_analysis")
  const latestParsedAnalysis = parseAnalysisNote(latestAiUpdate?.note ?? null)
  const latestSavedAnalysis = toAnalysisResult(latestParsedAnalysis)
  const lastAiAnalysisAt = latestAiUpdate?.created_at ?? null

  return (
    <main className="mx-auto min-h-screen max-w-3xl bg-[#0A0A0C] px-4 py-10 md:px-10">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/app/dashboard"
          className="text-sm font-mono text-[#6B6B7B] hover:text-[#F0F0F0] transition-colors"
        >
          ← CONVICTIONS
        </Link>

        <span
          className={`rounded-full px-3 py-1 text-xs font-mono tracking-widest border ${statusMeta.className}`}
        >
          {statusMeta.label}
        </span>
      </div>

      <section className="mb-6 rounded-xl border border-[#2A2A32] bg-[#141418] p-4 md:p-6">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-mono font-medium text-[#F0F0F0] text-2xl tracking-widest">
              {thesis.ticker}
            </h1>
            <p className="text-sm text-[#6B6B7B] mt-1">{thesis.company_name}</p>
          </div>

          <span className="border border-[#2A2A32] rounded-full px-3 py-1 font-mono text-xs text-[#6B6B7B] tracking-widest uppercase">
            {thesis.confidence_level}
          </span>
        </div>
        <div className="mb-4">
          <Link
            href={`/app/thesis/${thesis.id}/edit`}
            className="inline-flex items-center rounded-full border border-[#2A2A32] px-4 py-2 font-mono text-xs tracking-widest text-[#6B6B7B] transition-colors hover:text-[#F0F0F0]"
          >
            EDIT THESIS
          </Link>
        </div>

        <p className="font-mono text-xs text-[#6B6B7B] tracking-widest uppercase mb-2">
          THESIS STATEMENT
        </p>
        <p className="mb-4 break-words text-sm leading-relaxed text-[#F0F0F0]">
          {thesis.thesis_statement}
        </p>

        <div className="flex flex-col gap-3 md:flex-row md:gap-6">
          <div>
            <p className="font-mono text-xs text-[#6B6B7B] tracking-widest uppercase">
              INVESTING STYLE
            </p>
            <p className="text-sm text-[#F0F0F0] mt-1">{thesis.investing_style ?? "N/A"}</p>
          </div>

          <div>
            <p className="font-mono text-xs text-[#6B6B7B] tracking-widest uppercase">
              DATE ADDED
            </p>
            <p className="text-sm text-[#F0F0F0] mt-1">{formatDate(thesis.created_at)}</p>
          </div>
        </div>
      </section>

      <section className="mb-6">
        <p className="font-mono text-xs text-[#6B6B7B] tracking-widest uppercase mb-4">
          ASSUMPTIONS
        </p>

        {assumptions.map((assumption) => (
          <article
            key={assumption.id}
            className="mb-3 w-full rounded-xl border border-[#2A2A32] bg-[#141418] p-5"
          >
            <p className="font-mono text-xs text-[#6B6B7B] tracking-widest uppercase mb-3">
              {assumption.category}
            </p>
            <p className="text-sm text-[#F0F0F0] leading-relaxed mb-3">{assumption.statement}</p>

            {assumption.break_condition ? (
              <div>
                <p className="font-mono text-xs text-[#6B6B7B] tracking-widest uppercase mb-1">
                  I&apos;LL KNOW THIS IS BROKEN IF...
                </p>
                <p className="text-sm text-[#6B6B7B] leading-relaxed">{assumption.break_condition}</p>
              </div>
            ) : null}
          </article>
        ))}
      </section>

      {thesis.exit_criteria ? (
        <section className="mb-6">
          <article className="bg-[#141418] border border-[#2A2A32] rounded-xl p-5">
            <p className="font-mono text-xs text-[#6B6B7B] tracking-widest uppercase mb-2">
              I&apos;LL SELL IF...
            </p>
            <p className="text-sm text-[#F0F0F0] leading-relaxed">{thesis.exit_criteria}</p>
          </article>
        </section>
      ) : null}

      <section className="mb-6">
        <p className="font-mono text-xs text-[#6B6B7B] tracking-widest uppercase mb-4">HISTORY</p>

        {updates.map((update) => {
          const updateMeta = getUpdateTypeMeta(update.update_type)
          const parsedAnalysis = update.update_type === "ai_analysis" ? parseAnalysisNote(update.note) : null
          const historyPreview = getAnalysisPreview(parsedAnalysis)

          return (
            <div key={update.id} className="mb-4 flex flex-col gap-2 md:flex-row md:items-start md:gap-4">
              <p className="w-auto shrink-0 pt-0.5 font-mono text-xs text-[#6B6B7B] md:w-24">
                {formatDate(update.created_at)}
              </p>

              <div>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-mono tracking-widest uppercase mb-1 inline-block ${updateMeta.className}`}
                >
                  {updateMeta.label}
                </span>

                {update.update_type === "ai_analysis" ? (
                  <div className="mt-1">
                    <p className="text-sm text-[#6B6B7B] leading-relaxed">{historyPreview}</p>
                    {parsedAnalysis ? (
                      <details className="mt-2 group">
                        <summary className="cursor-pointer list-none inline-flex items-center gap-2 font-mono text-xs tracking-widest uppercase text-[#8B5CF6] hover:text-[#A78BFA] transition-colors">
                          <span className="text-sm leading-none">+</span>
                          <span>Read more</span>
                        </summary>
                        <div className="mt-3 space-y-3 rounded-lg border border-[#2A2A32] bg-[#141418] p-4">
                          {getSectionContent(parsedAnalysis).map(({ title, section }) => {
                            if (!section?.summary && (!section?.points || section.points.length === 0)) {
                              return null
                            }

                            return (
                              <div key={title}>
                                <p className="font-mono text-[11px] text-[#6B6B7B] tracking-widest uppercase mb-1">
                                  {title}
                                </p>
                                {section.summary ? (
                                  <p className="text-sm text-[#6B6B7B] leading-relaxed">{section.summary}</p>
                                ) : null}
                                {section.points?.length ? (
                                  <ul className="mt-2 space-y-1.5">
                                    {section.points.map((point) => (
                                      <li key={`${title}-${point}`} className="flex items-start gap-2">
                                        <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[#6B6B7B]" />
                                        <span className="text-sm text-[#F0F0F0] leading-relaxed">{point}</span>
                                      </li>
                                    ))}
                                  </ul>
                                ) : null}
                              </div>
                            )
                          })}
                          {parsedAnalysis.footer ? (
                            <p className="text-xs text-[#6B6B7B] italic">{parsedAnalysis.footer}</p>
                          ) : null}
                        </div>
                      </details>
                    ) : null}
                  </div>
                ) : update.note ? (
                  <p className="text-sm text-[#6B6B7B] leading-relaxed mt-1">{update.note}</p>
                ) : null}
              </div>
            </div>
          )
        })}
      </section>

      <section className="mb-6">
        <p className="font-mono text-xs text-[#6B6B7B] tracking-widest uppercase mb-4">
          AI ANALYSIS
        </p>
        <AnalysisButton
          thesisId={thesis.id}
          initialLastAnalysedAt={lastAiAnalysisAt}
          initialAnalysis={latestSavedAnalysis}
        />
      </section>

      <section className="mt-12 border-t border-[#2A2A32] pt-6 [&_button]:min-h-[44px]">
        <DeleteThesisButton thesisId={thesis.id} ticker={thesis.ticker} />
      </section>
    </main>
  )
}

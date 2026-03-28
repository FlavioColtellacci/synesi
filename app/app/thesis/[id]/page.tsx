import Link from "next/link"
import { headers } from "next/headers"
import { notFound, redirect } from "next/navigation"
import { AnalysisButton } from "@/components/thesis/AnalysisButton"
import { AnalysisHistoryReadMore } from "@/components/thesis/AnalysisHistoryReadMore"
import AlertPreferencesSection from "@/components/thesis/AlertPreferencesSection"
import { CollapsibleHistorySection } from "@/components/thesis/CollapsibleHistorySection"
import DeleteThesisButton from "@/components/thesis/DeleteThesisButton"
import FinancialRefreshButton from "@/components/thesis/FinancialRefreshButton"
import { ThesisChallengeBanner } from "@/components/thesis/ThesisChallengeBanner"
import type { ThesisChallengeEvent } from "@/components/thesis/ThesisChallengeBanner"
import TrustedSourcesSection from "@/components/thesis/TrustedSourcesSection"
import { refreshFinancialSnapshot } from "@/lib/financial/refresh"
import { createAdminClient, createClient } from "@/lib/supabase/server"
import {
  CORE_FINANCIAL_FIELDS,
  EXTENDED_FINANCIAL_FIELDS,
  type FinancialSnapshotCoverage,
  type FinancialSnapshotPayload,
} from "@/lib/financial/types"
import type { Database } from "@/types/database"

type Assumption = Database["public"]["Tables"]["assumptions"]["Row"]
type ThesisUpdate = Pick<
  Database["public"]["Tables"]["thesis_updates"]["Row"],
  "id" | "update_type" | "note" | "old_status" | "new_status" | "created_at"
>
type TrustedSource = Database["public"]["Tables"]["trusted_sources"]["Row"]
type AlertRule = Database["public"]["Tables"]["alert_rules"]["Row"]
type FinancialSnapshot = Database["public"]["Tables"]["financial_snapshots"]["Row"]
type FinancialCoverage = FinancialSnapshotCoverage
type AlertRuleWithSources = AlertRule & { sourceIds: string[] }

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

  if (updateType === "financial_refresh") {
    return {
      label: "FINANCIAL REFRESH",
      className: "bg-[#0B3A36] text-[#00D1B2]",
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

function formatNumber(value: number | null, digits = 2) {
  if (value === null || !Number.isFinite(value)) return "N/A"
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  })
}

function formatPercent(value: number | null, digits = 1) {
  if (value === null || !Number.isFinite(value)) return "N/A"
  return `${(value * 100).toFixed(digits)}%`
}

function formatPrice(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "N/A"
  return `$${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}`
}

function getMetricValueClass(metric: { label: string; raw: number | null }, payload: FinancialSnapshotPayload | null) {
  const neutral = "text-[#F0F0F0]"
  const good = "text-[#00D1B2]"
  const bad = "text-[#FF6B6B]"
  const value = metric.raw

  if (value === null || !Number.isFinite(value)) return neutral

  switch (metric.label) {
    case "Margin Of Safety":
      return value > 0 ? good : bad
    case "RSI (14)":
      if (value <= 30) return good
      if (value >= 70) return bad
      return neutral
    case "P/E":
      if (value <= 25) return good
      if (value >= 40) return bad
      return neutral
    case "Forward P/E":
      if (value <= 22) return good
      if (value >= 35) return bad
      return neutral
    case "PEG":
      if (value <= 1.5) return good
      if (value >= 2.5) return bad
      return neutral
    case "ROIC":
      if (value >= 0.15) return good
      if (value <= 0.08) return bad
      return neutral
    case "EPS":
      return value > 0 ? good : bad
    case "Consensus Target": {
      const price = payload?.price ?? null
      if (price === null || !Number.isFinite(price)) return neutral
      return value > price ? good : bad
    }
    default:
      return neutral
  }
}

function formatTimestamp(value: string | null) {
  if (!value) return "Unknown"
  try {
    return new Date(value).toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  } catch {
    return "Unknown"
  }
}

function dashIfMissing(formatted: string): string {
  return formatted === "N/A" ? "-" : formatted
}

function parseFinancialSnapshotPayload(raw: Record<string, unknown>): FinancialSnapshotPayload | null {
  const payload = raw as Partial<FinancialSnapshotPayload>
  if (!payload || typeof payload !== "object") return null
  return {
    price: typeof payload.price === "number" ? payload.price : null,
    consensusTarget: typeof payload.consensusTarget === "number" ? payload.consensusTarget : null,
    pe: typeof payload.pe === "number" ? payload.pe : null,
    forwardPe: typeof payload.forwardPe === "number" ? payload.forwardPe : null,
    peg: typeof payload.peg === "number" ? payload.peg : null,
    roic: typeof payload.roic === "number" ? payload.roic : null,
    eps: typeof payload.eps === "number" ? payload.eps : null,
    fcfPerShare: typeof payload.fcfPerShare === "number" ? payload.fcfPerShare : null,
    marginOfSafety: typeof payload.marginOfSafety === "number" ? payload.marginOfSafety : null,
    rsi14: typeof payload.rsi14 === "number" ? payload.rsi14 : null,
    insiderActivity30d:
      payload.insiderActivity30d && typeof payload.insiderActivity30d === "object"
        ? (payload.insiderActivity30d as FinancialSnapshotPayload["insiderActivity30d"])
        : null,
    nextEarningsDate:
      typeof payload.nextEarningsDate === "string" ? payload.nextEarningsDate : null,
    recentTargetChanges: Array.isArray(payload.recentTargetChanges)
      ? payload.recentTargetChanges
      : [],
    indexChanges: Array.isArray(payload.indexChanges) ? payload.indexChanges : [],
  }
}

function parseFinancialCoverage(raw: Record<string, unknown> | null): FinancialCoverage {
  if (!raw || typeof raw !== "object") return {}
  return raw as FinancialCoverage
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
  const adminSupabase = createAdminClient()
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

  const dailyRefreshLimit = Number.parseInt(
    process.env.FINANCIAL_REFRESH_DAILY_LIMIT_PER_USER ?? "3",
    10,
  )
  const startOfUtcDay = new Date()
  startOfUtcDay.setUTCHours(0, 0, 0, 0)

  const [
    { data: assumptionsData },
    { data: updatesData },
    { data: trustedSourcesData },
    { data: alertRulesData },
    { data: financialSnapshotData },
    { count: refreshUsedTodayCount },
    { data: challengeEventsData },
  ] = await Promise.all([
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
    supabase
      .from("trusted_sources")
      .select("id, thesis_id, user_id, name, url, source_type, created_at")
      .eq("thesis_id", id)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("alert_rules")
      .select(
        "id, user_id, thesis_id, name, mode, min_confidence, include_keywords, exclude_keywords, is_enabled, created_at, updated_at",
      )
      .eq("thesis_id", id)
      .eq("user_id", user.id)
      .order("created_at", { ascending: true }),
    adminSupabase
      .from("financial_snapshots")
      .select("id, ticker, provider, as_of, fetched_at, stale_after, payload, coverage")
      .eq("ticker", thesis.ticker.trim().toUpperCase())
      .maybeSingle(),
    supabase
      .from("thesis_updates")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("update_type", "financial_refresh")
      .gte("created_at", startOfUtcDay.toISOString()),
    supabase
      .from("events")
      .select("id, thesis_id, event_detail, created_at")
      .eq("thesis_id", id)
      .eq("user_id", user.id)
      .eq("event_type", "trusted_source_challenge")
      .eq("is_reviewed", false)
      .order("created_at", { ascending: false }),
  ])

  const assumptions: Assumption[] = assumptionsData ?? []
  const updates: ThesisUpdate[] = updatesData ?? []
  const trustedSources: TrustedSource[] = trustedSourcesData ?? []
  const alertRulesBase: AlertRule[] = alertRulesData ?? []
  const alertRuleIds = alertRulesBase.map((rule) => rule.id)
  const alertRuleSourcesByRule = new Map<string, string[]>()

  if (alertRuleIds.length > 0) {
    const { data: alertRuleSourceRows } = await supabase
      .from("alert_rule_sources")
      .select("alert_rule_id, trusted_source_id")
      .in("alert_rule_id", alertRuleIds)

    for (const row of alertRuleSourceRows ?? []) {
      const current = alertRuleSourcesByRule.get(row.alert_rule_id) ?? []
      current.push(row.trusted_source_id)
      alertRuleSourcesByRule.set(row.alert_rule_id, current)
    }
  }

  const alertRules: AlertRuleWithSources[] = alertRulesBase.map((rule) => ({
    ...rule,
    sourceIds: alertRuleSourcesByRule.get(rule.id) ?? [],
  }))
  const challengeEvents: ThesisChallengeEvent[] = (challengeEventsData ?? [])
    .filter((event) => event.event_detail !== null)
    .map((event) => ({
      id: event.id,
      thesisId: event.thesis_id,
      eventDetail: event.event_detail as string,
      createdAt: event.created_at ?? null,
    }))
  const statusMeta = getStatusMeta(thesis.status)
  const latestAiUpdate = updates.find((update) => update.update_type === "ai_analysis")
  const latestParsedAnalysis = parseAnalysisNote(latestAiUpdate?.note ?? null)
  const latestSavedAnalysis = toAnalysisResult(latestParsedAnalysis)
  const lastAiAnalysisAt = latestAiUpdate?.created_at ?? null
  const financialSnapshot = (financialSnapshotData as FinancialSnapshot | null) ?? null
  const financialPayload = financialSnapshot
    ? parseFinancialSnapshotPayload(financialSnapshot.payload)
    : null
  const financialCoverage = financialSnapshot
    ? parseFinancialCoverage(financialSnapshot.coverage)
    : {}

  const requestDateHeader = (await headers()).get("date")
  const requestTimestamp = requestDateHeader
    ? Date.parse(requestDateHeader)
    : Date.parse(thesis.updated_at)
  const isSnapshotStale = financialSnapshot
    ? new Date(financialSnapshot.stale_after).getTime() <= requestTimestamp
    : true
  const usedToday = refreshUsedTodayCount ?? 0
  const effectiveDailyLimit = Number.isFinite(dailyRefreshLimit) ? dailyRefreshLimit : 3
  const hasRefreshRemaining = usedToday < effectiveDailyLimit
  const coreCoverageFromPayload = CORE_FINANCIAL_FIELDS.filter((field) => {
    if (field === "nextEarningsDate") return Boolean(financialPayload?.nextEarningsDate)
    if (field === "marginOfSafety") return typeof financialPayload?.marginOfSafety === "number"
    return typeof financialPayload?.[field] === "number"
  }).length
  const coreMetrics = financialCoverage._metrics
  const coreFilled = coreMetrics?.coreFilled ?? coreCoverageFromPayload
  const coreTotal = coreMetrics?.coreTotal ?? CORE_FINANCIAL_FIELDS.length
  const coreMissingCount = Math.max(0, coreTotal - coreFilled)
  const extendedFilled =
    coreMetrics?.extendedFilled ??
    EXTENDED_FINANCIAL_FIELDS.filter((field) => {
      const value = financialPayload?.[field]
      return typeof value === "number" && Number.isFinite(value)
    }).length
  const extendedTotal = coreMetrics?.extendedTotal ?? EXTENDED_FINANCIAL_FIELDS.length
  const hasOnlyPriceSignal =
    (financialPayload?.price ?? null) !== null &&
    coreFilled <= 1
  // Always show all Tier A slots so "x/7 filled" matches visible rows (missing → em dash).
  const primaryMetrics = [
    {
      key: "price" as const,
      label: "Price",
      raw: financialPayload?.price ?? null,
      value: dashIfMissing(formatPrice(financialPayload?.price ?? null)),
    },
    {
      key: "consensusTarget" as const,
      label: "Consensus Target",
      raw: financialPayload?.consensusTarget ?? null,
      value: dashIfMissing(formatPrice(financialPayload?.consensusTarget ?? null)),
    },
    {
      key: "marginOfSafety" as const,
      label: "Margin Of Safety",
      raw: financialPayload?.marginOfSafety ?? null,
      value: dashIfMissing(formatPercent(financialPayload?.marginOfSafety ?? null)),
    },
    {
      key: "pe" as const,
      label: "P/E",
      raw: financialPayload?.pe ?? null,
      value: dashIfMissing(formatNumber(financialPayload?.pe ?? null)),
    },
    {
      key: "forwardPe" as const,
      label: "Forward P/E",
      raw: financialPayload?.forwardPe ?? null,
      value: dashIfMissing(formatNumber(financialPayload?.forwardPe ?? null)),
    },
    {
      key: "eps" as const,
      label: "EPS",
      raw: financialPayload?.eps ?? null,
      value: dashIfMissing(formatNumber(financialPayload?.eps ?? null)),
    },
    {
      key: "nextEarningsDate" as const,
      label: "Next Earnings",
      raw: null,
      value: financialPayload?.nextEarningsDate?.trim() ? financialPayload.nextEarningsDate : "-",
    },
  ]
  const secondaryMetrics = [
    {
      key: "peg" as const,
      label: "PEG",
      raw: financialPayload?.peg ?? null,
      value: dashIfMissing(formatNumber(financialPayload?.peg ?? null)),
    },
    {
      key: "roic" as const,
      label: "ROIC",
      raw: financialPayload?.roic ?? null,
      value: dashIfMissing(formatPercent(financialPayload?.roic ?? null)),
    },
    {
      key: "fcfPerShare" as const,
      label: "FCF / Share",
      raw: financialPayload?.fcfPerShare ?? null,
      value: dashIfMissing(formatNumber(financialPayload?.fcfPerShare ?? null)),
    },
    {
      key: "rsi14" as const,
      label: "RSI (14)",
      raw: financialPayload?.rsi14 ?? null,
      value: dashIfMissing(formatNumber(financialPayload?.rsi14 ?? null)),
    },
  ]
  const optionalDetailMetrics = [
    {
      key: "insiderActivity30d" as const,
      label: "Insider Activity",
      value: financialPayload?.insiderActivity30d?.label ?? "N/A",
    },
    {
      key: "recentTargetChanges" as const,
      label: "Recent Target Changes",
      value:
        (financialPayload?.recentTargetChanges?.length ?? 0) > 0
          ? String(financialPayload?.recentTargetChanges?.length ?? 0)
          : "N/A",
    },
    {
      key: "indexChanges" as const,
      label: "Index Changes",
      value:
        (financialPayload?.indexChanges?.length ?? 0) > 0
          ? String(financialPayload?.indexChanges?.length ?? 0)
          : "N/A",
    },
  ].filter((metric) => metric.value !== "N/A")
  const hasSecondaryMetrics =
    secondaryMetrics.some((m) => m.value !== "-") || optionalDetailMetrics.length > 0

  // Preserve API quota: auto-refresh only stale snapshots when user still has daily budget.
  if (financialSnapshot && isSnapshotStale && hasRefreshRemaining) {
    void refreshFinancialSnapshot({ ticker: thesis.ticker })
  }

  return (
    <main className="mx-auto min-h-screen max-w-7xl bg-[#0A0A0C] px-4 py-10 md:px-10">
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

      {challengeEvents.length > 0 ? (
        <div className="mb-6">
          <ThesisChallengeBanner events={challengeEvents} sectionCollapsible />
        </div>
      ) : null}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div>
          <p className="mb-4 font-mono text-xs tracking-widest text-[#6B6B7B] uppercase">THESIS</p>
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
            <p className="font-mono text-xs text-[#6B6B7B] tracking-widest uppercase mb-4">
              AI ANALYSIS
            </p>
            <AnalysisButton
              thesisId={thesis.id}
              initialLastAnalysedAt={lastAiAnalysisAt}
              initialAnalysis={latestSavedAnalysis}
            />
          </section>

          <CollapsibleHistorySection>
            {updates.map((update) => {
              const updateMeta = getUpdateTypeMeta(update.update_type)
              const parsedAnalysis = update.update_type === "ai_analysis" ? parseAnalysisNote(update.note) : null
              const historyPreview = getAnalysisPreview(parsedAnalysis)

              return (
                <div
                  key={update.id}
                  className="mb-4 flex flex-col gap-2 md:flex-row md:items-start md:gap-4"
                >
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
                      parsedAnalysis ? (
                        <AnalysisHistoryReadMore preview={historyPreview} analysis={parsedAnalysis} />
                      ) : null
                    ) : update.note ? (
                      <p className="text-sm text-[#6B6B7B] leading-relaxed mt-1">{update.note}</p>
                    ) : null}
                  </div>
                </div>
              )
            })}
          </CollapsibleHistorySection>
        </div>

        <aside className="space-y-6 lg:sticky lg:top-8 lg:self-start">
          <section>
            <p className="mb-4 font-mono text-xs tracking-widest text-[#6B6B7B] uppercase">
              FINANCIAL CONTEXT
            </p>
            <article className="rounded-xl border border-[#2A2A32] bg-[#141418] p-4 md:p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-mono text-[10px] tracking-widest uppercase text-[#6B6B7B]">
                    {financialSnapshot
                      ? isSnapshotStale
                        ? "STALE SNAPSHOT"
                        : "FRESH SNAPSHOT"
                      : "NO SNAPSHOT YET"}
                  </p>
                  <p className="font-mono text-[10px] tracking-widest text-[#6B6B7B]">
                    LAST FETCH: {formatTimestamp(financialSnapshot?.fetched_at ?? null)}
                  </p>
                </div>
                <FinancialRefreshButton
                  ticker={thesis.ticker}
                  initialLimit={effectiveDailyLimit}
                  initialUsedToday={usedToday}
                  initialHasData={Boolean(financialSnapshot)}
                />
              </div>
              {coreTotal > 0 ? (
                <p className="mb-4 text-xs text-[#6B6B7B]">
                  Core metrics: {coreFilled}/{coreTotal} filled
                  {coreMissingCount > 0
                    ? ` (${coreMissingCount} missing)`
                    : " (complete)"}
                </p>
              ) : null}
              <p className="mb-4 text-xs text-[#6B6B7B]">
                Extended metrics: {extendedFilled}/{extendedTotal} available.
              </p>
              {hasOnlyPriceSignal ? (
                <p className="mb-4 text-xs text-[#6B6B7B]">
                  Price-only core mode: hybrid fallback is still searching for additional reliable
                  fundamentals.
                </p>
              ) : null}
              <p className="mb-4 text-xs text-[#6B6B7B]">
                Coverage focuses on high-signal core metrics first, with optional metrics shown as
                detail when available.
              </p>
              <p className="mb-4 text-xs text-[#6B6B7B]">
                Green means favorable signal, red means caution. AI-extracted values can be stale or
                imperfect; verify with your broker/data terminal before making decisions.
              </p>

              <div className="grid grid-cols-2 gap-3">
                {primaryMetrics.map((metric) => (
                  <div key={metric.key}>
                    <p className="font-mono text-[10px] tracking-widest text-[#6B6B7B] uppercase">
                      {metric.label}
                    </p>
                    <p className={`mt-1 text-sm ${getMetricValueClass(metric, financialPayload)}`}>
                      {metric.value}
                    </p>
                  </div>
                ))}
              </div>

              {hasSecondaryMetrics ? (
                <details className="mt-4 rounded-lg border border-[#2A2A32] bg-[#0F0F12] p-3">
                  <summary className="cursor-pointer font-mono text-[10px] tracking-widest text-[#6B6B7B] uppercase">
                    Extended & Optional Details
                  </summary>
                  <div className="mt-3 space-y-2 text-sm text-[#6B6B7B]">
                    {secondaryMetrics.map((metric) => (
                      <p key={metric.label}>
                        {metric.label}: {metric.value}
                      </p>
                    ))}
                    {optionalDetailMetrics.length > 0 ? (
                      <div className="pt-2">
                        <p className="font-mono text-[10px] tracking-widest uppercase text-[#6B6B7B]">
                          Optional details
                        </p>
                        {optionalDetailMetrics.map((metric) => (
                          <p key={metric.label}>
                            {metric.label}: {metric.value}
                          </p>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </details>
              ) : null}
            </article>
          </section>

          <AlertPreferencesSection
            thesisId={thesis.id}
            trustedSources={trustedSources}
            initialRules={alertRules}
          />

          <TrustedSourcesSection
            thesisId={thesis.id}
            thesisTicker={thesis.ticker}
            thesisCompanyName={thesis.company_name}
            initialSources={trustedSources}
          />
        </aside>
      </div>

      <section className="mt-12 border-t border-[#2A2A32] pt-6 [&_button]:min-h-[44px]">
        <DeleteThesisButton thesisId={thesis.id} ticker={thesis.ticker} />
      </section>
    </main>
  )
}

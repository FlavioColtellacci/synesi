import { sanitizeActionDrafts, type SigmaActionDraft } from "@/lib/chat/actions"
import type { SigmaMonitorRiskLevel, SigmaMonitorSummary } from "@/lib/chat/monitor-types"

export type MonitorThesisRow = {
  id: string
  ticker: string
  company_name: string
  status: string
  updated_at: string
  thesis_statement: string
}

export type MonitorEventRow = {
  thesis_id: string
  event_type: string
  event_detail: string | null
  created_at: string
}

const MAX_SIGNAL_ITEMS = 4
const MAX_EVIDENCE_ITEMS = 4

/** Minimum characters for a high-signal line (filters noise like "ok" or a lone dash). */
const MIN_SIGNAL_LINE_CHARS = 12
const MIN_EVIDENCE_LINE_CHARS = 10

/** When portfolio is quiet, show at most this many signal bullets (reduces repetitive model output). */
const MAX_SIGNALS_WHEN_QUIET = 2

export function getSigmaMonitorDailyRunKey(date: Date = new Date()): string {
  return `daily:${date.toISOString().slice(0, 10)}`
}

export function reuseExistingMonitorRun(existing: unknown, force: boolean): boolean {
  return Boolean(existing) && !force
}

function normalizeSummaryText(input: string, maxChars: number): string {
  const text = input.replace(/\s+/g, " ").trim()
  if (!text) return ""
  if (text.length <= maxChars) return text
  return `${text.slice(0, maxChars - 1)}…`
}

function sanitizeRiskLevel(input: unknown): SigmaMonitorRiskLevel {
  if (input === "critical" || input === "watch" || input === "stable") return input
  return "watch"
}

function sanitizeStringList(input: unknown, maxItems: number, maxChars: number): string[] {
  if (!Array.isArray(input)) return []
  return input
    .filter((item): item is string => typeof item === "string")
    .map((item) => normalizeSummaryText(item, maxChars))
    .filter((item) => item.length > 0)
    .slice(0, maxItems)
}

function extractFirstJsonObject(input: string): string | null {
  const startIndex = input.indexOf("{")
  if (startIndex === -1) return null

  let depth = 0
  let inString = false
  let escaped = false

  for (let index = startIndex; index < input.length; index += 1) {
    const char = input[index]

    if (inString) {
      if (escaped) {
        escaped = false
        continue
      }
      if (char === "\\") {
        escaped = true
        continue
      }
      if (char === '"') {
        inString = false
      }
      continue
    }

    if (char === '"') {
      inString = true
      continue
    }

    if (char === "{") {
      depth += 1
      continue
    }

    if (char === "}") {
      depth -= 1
      if (depth === 0) {
        return input.slice(startIndex, index + 1)
      }
    }
  }

  return null
}

export function parseMonitorSummaryFromModel(rawText: string, fallback: SigmaMonitorSummary): SigmaMonitorSummary {
  const trimmed = rawText.trim()
  if (!trimmed) return fallback

  const jsonCandidate = extractFirstJsonObject(trimmed)
  if (!jsonCandidate) return fallback

  try {
    const parsed = JSON.parse(jsonCandidate) as Record<string, unknown>
    return {
      headline: normalizeSummaryText(typeof parsed.headline === "string" ? parsed.headline : fallback.headline, 110),
      summary: normalizeSummaryText(typeof parsed.summary === "string" ? parsed.summary : fallback.summary, 380),
      riskLevel: sanitizeRiskLevel(parsed.riskLevel),
      highSignalChanges: sanitizeStringList(parsed.highSignalChanges, MAX_SIGNAL_ITEMS, 180),
      recommendedActions: sanitizeActionDrafts(parsed.recommendedActions),
      evidenceSnippets: sanitizeStringList(parsed.evidenceSnippets, MAX_EVIDENCE_ITEMS, 180),
    }
  } catch {
    return fallback
  }
}

function normalizeDedupeKey(line: string): string {
  return line.toLowerCase().replace(/\s+/g, " ").trim()
}

export function dedupeStringLinesPreserveOrder(lines: string[], maxItems: number): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const line of lines) {
    const key = normalizeDedupeKey(line)
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(line)
    if (out.length >= maxItems) break
  }
  return out
}

function dedupeActionDraftsPreserveOrder(actions: SigmaActionDraft[]): SigmaActionDraft[] {
  const seen = new Set<string>()
  const out: SigmaActionDraft[] = []
  for (const action of actions) {
    const key = `${action.actionType}:${action.thesisId ?? ""}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(action)
    if (out.length >= 3) break
  }
  return out
}

export type MonitorNoiseContext = {
  openAlertCount: number
  needsReviewCount: number
}

export function applyMonitorSummaryNoiseRules(
  summary: SigmaMonitorSummary,
  ctx: MonitorNoiseContext,
): SigmaMonitorSummary {
  let highSignalChanges = summary.highSignalChanges
    .map((s) => s.trim())
    .filter((s) => s.length >= MIN_SIGNAL_LINE_CHARS)

  highSignalChanges = dedupeStringLinesPreserveOrder(highSignalChanges, MAX_SIGNAL_ITEMS)

  let evidenceSnippets = summary.evidenceSnippets
    .map((s) => s.trim())
    .filter((s) => s.length >= MIN_EVIDENCE_LINE_CHARS)

  evidenceSnippets = dedupeStringLinesPreserveOrder(evidenceSnippets, MAX_EVIDENCE_ITEMS)

  const isQuietPortfolio =
    ctx.openAlertCount === 0 && ctx.needsReviewCount === 0 && summary.riskLevel === "stable"

  if (isQuietPortfolio && highSignalChanges.length > MAX_SIGNALS_WHEN_QUIET) {
    highSignalChanges = highSignalChanges.slice(0, MAX_SIGNALS_WHEN_QUIET)
  }

  if (highSignalChanges.length === 0 && isQuietPortfolio) {
    highSignalChanges = ["No urgent conviction or alert changes showed up in this monitor run."]
  }

  const recommendedActions = dedupeActionDraftsPreserveOrder(summary.recommendedActions)

  return {
    ...summary,
    highSignalChanges,
    evidenceSnippets,
    recommendedActions,
  }
}

export function buildDeterministicMonitorSummary(
  theses: MonitorThesisRow[],
  events: MonitorEventRow[],
  evidenceSnippets: string[],
): SigmaMonitorSummary {
  const atRisk = theses.filter((item) => item.status === "at_risk")
  const broken = theses.filter((item) => item.status === "broken")
  const needsReview = [...broken, ...atRisk]
  const riskLevel: SigmaMonitorRiskLevel =
    broken.length > 0 ? "critical" : atRisk.length > 0 || events.length > 0 ? "watch" : "stable"

  const recentSignals = events
    .slice(0, MAX_SIGNAL_ITEMS)
    .map((event) => `${event.event_type}: ${(event.event_detail ?? "No detail").replace(/\s+/g, " ").trim()}`)

  if (recentSignals.length === 0 && needsReview.length > 0) {
    recentSignals.push(
      ...needsReview
        .slice(0, MAX_SIGNAL_ITEMS)
        .map((thesis) => `${thesis.ticker} is ${thesis.status.replace("_", " ")} and should be reviewed`),
    )
  }

  const recommendedActions: SigmaActionDraft[] = []
  if (needsReview.length > 0) {
    recommendedActions.push({
      actionType: "filter_needs_review",
      label: "Open NEEDS REVIEW",
      rationale: "Start with convictions currently at risk or broken.",
    })
    recommendedActions.push({
      actionType: "open_thesis",
      thesisId: needsReview[0].id,
      label: `Open ${needsReview[0].ticker}`,
      rationale: "Inspect the highest-priority conviction in detail.",
    })
  } else if (events.length > 0) {
    recommendedActions.push({
      actionType: "open_alerts_panel",
      label: "Open alerts panel",
      rationale: "Review fresh unreviewed events from your monitoring pipeline.",
    })
  } else {
    recommendedActions.push({
      actionType: "draft_alert_rule_update",
      thesisId: theses[0]?.id,
      label: "Refine one alert rule",
      rationale: "Use low-volatility periods to tighten signal quality.",
    })
  }

  const headline =
    riskLevel === "critical"
      ? "Critical thesis drift detected"
      : riskLevel === "watch"
        ? "Monitor watchlist has actionable changes"
        : "Convictions look stable right now"

  const summary =
    theses.length === 0
      ? "No convictions are saved yet. Add your first thesis and Sigma Monitor will begin tracking high-signal changes."
      : `${theses.length} convictions tracked, ${atRisk.length} at risk, ${broken.length} broken, and ${events.length} open alerts.`

  const raw: SigmaMonitorSummary = {
    headline,
    summary,
    riskLevel,
    highSignalChanges: recentSignals.slice(0, MAX_SIGNAL_ITEMS),
    recommendedActions: recommendedActions.slice(0, 3),
    evidenceSnippets: evidenceSnippets.slice(0, MAX_EVIDENCE_ITEMS),
  }

  return applyMonitorSummaryNoiseRules(raw, {
    openAlertCount: events.length,
    needsReviewCount: needsReview.length,
  })
}

export function buildMonitorPrompt(theses: MonitorThesisRow[], events: MonitorEventRow[], fallback: SigmaMonitorSummary): string {
  const thesisLines =
    theses.length === 0
      ? "- none"
      : theses
          .slice(0, 12)
          .map(
            (thesis) =>
              `- ${thesis.ticker} | status=${thesis.status} | updated=${new Date(thesis.updated_at).toISOString().slice(0, 10)} | thesis=${normalizeSummaryText(thesis.thesis_statement, 130)}`,
          )
          .join("\n")

  const eventLines =
    events.length === 0
      ? "- none"
      : events
          .slice(0, 12)
          .map(
            (event) =>
              `- thesis=${event.thesis_id} | ${event.event_type} | ${normalizeSummaryText(event.event_detail ?? "No detail", 150)}`,
          )
          .join("\n")

  return `You are Sigma Monitor for Synesi.
Generate a concise monitor digest in strict JSON only.

Return exact keys:
- headline (string <= 110 chars)
- summary (string <= 380 chars)
- riskLevel ("stable" | "watch" | "critical")
- highSignalChanges (array of up to 4 short strings)
- recommendedActions (array up to 3 objects with keys: actionType, label, rationale, thesisId optional)
- evidenceSnippets (array up to 4 strings)

Allowed recommendedActions.actionType:
- open_thesis
- filter_needs_review
- open_alerts_panel
- draft_alert_rule_update

Noise rules:
- Do not repeat the same idea in multiple bullets.
- If nothing material changed, keep highSignalChanges to 0-2 short lines.
- Use only provided data. Never invent entities.

Fallback baseline if uncertain:
${JSON.stringify(fallback)}

Convictions:
${thesisLines}

Open alerts:
${eventLines}`
}

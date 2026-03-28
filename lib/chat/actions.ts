import type { SupabaseClient } from "@supabase/supabase-js"

export type SigmaActionType =
  | "open_thesis"
  | "filter_needs_review"
  | "open_alerts_panel"
  | "draft_alert_rule_update"

export type SigmaActionDraft = {
  actionType: SigmaActionType
  label: string
  rationale: string
  thesisId?: string
}

export type SigmaActionExecution = {
  method: "navigate"
  route: string
  status: "ready" | "requires_manual_completion"
}

const ALLOWED_ACTIONS = new Set<SigmaActionType>([
  "open_thesis",
  "filter_needs_review",
  "open_alerts_panel",
  "draft_alert_rule_update",
])

function isActionType(value: unknown): value is SigmaActionType {
  return typeof value === "string" && ALLOWED_ACTIONS.has(value as SigmaActionType)
}

function sanitizeText(value: unknown, maxLength: number, fallback = "") {
  if (typeof value !== "string") return fallback
  const normalized = value.trim()
  if (!normalized) return fallback
  return normalized.slice(0, maxLength)
}

export function sanitizeActionDrafts(input: unknown): SigmaActionDraft[] {
  if (!Array.isArray(input)) return []

  const drafts: SigmaActionDraft[] = []
  for (const item of input) {
    if (!item || typeof item !== "object") continue
    const record = item as Record<string, unknown>
    if (!isActionType(record.actionType)) continue

    const label = sanitizeText(record.label, 80)
    const rationale = sanitizeText(record.rationale, 240)
    if (!label || !rationale) continue

    const draft: SigmaActionDraft = {
      actionType: record.actionType,
      label,
      rationale,
    }

    const thesisId = sanitizeText(record.thesisId, 120)
    if (thesisId) {
      draft.thesisId = thesisId
    }

    drafts.push(draft)
    if (drafts.length >= 3) break
  }

  return drafts
}

export async function resolveConfirmedAction(
  supabase: SupabaseClient,
  userId: string,
  action: SigmaActionDraft,
): Promise<SigmaActionExecution | null> {
  if (!ALLOWED_ACTIONS.has(action.actionType)) {
    return null
  }

  if (action.actionType === "filter_needs_review") {
    return { method: "navigate", route: "/app/dashboard?filter=needs_review", status: "ready" }
  }

  if (action.actionType === "open_alerts_panel") {
    return { method: "navigate", route: "/app/dashboard?panel=alerts", status: "ready" }
  }

  if (action.actionType === "open_thesis") {
    if (!action.thesisId) return null
    const { data: thesis, error } = await supabase
      .from("theses")
      .select("id")
      .eq("id", action.thesisId)
      .eq("user_id", userId)
      .maybeSingle()

    if (error || !thesis?.id) return null

    return {
      method: "navigate",
      route: `/app/thesis/${thesis.id}`,
      status: "ready",
    }
  }

  if (action.actionType === "draft_alert_rule_update") {
    if (!action.thesisId) return null
    const { data: thesis, error } = await supabase
      .from("theses")
      .select("id")
      .eq("id", action.thesisId)
      .eq("user_id", userId)
      .maybeSingle()

    if (error || !thesis?.id) return null

    return {
      method: "navigate",
      route: `/app/thesis/${thesis.id}`,
      status: "requires_manual_completion",
    }
  }

  return null
}

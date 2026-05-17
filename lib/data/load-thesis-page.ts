import { isFirebaseBackend } from "@/lib/data/backend"
import { createRepositories } from "@/lib/data/repositories"
import { createAdminClient, createClient } from "@/lib/supabase/server"
import type { Database } from "@/types/database"

type Assumption = Database["public"]["Tables"]["assumptions"]["Row"]
type ThesisUpdate = Pick<
  Database["public"]["Tables"]["thesis_updates"]["Row"],
  "id" | "update_type" | "note" | "old_status" | "new_status" | "created_at"
>
type ChallengeEvent = {
  id: string
  thesis_id: string
  event_detail: string | null
  created_at: string | null
}

export async function loadThesisPageCoreData(userId: string, thesisId: string) {
  const supabase = isFirebaseBackend() ? null : await createClient()
  const repositories = createRepositories({ supabase: supabase ?? undefined })

  const [thesis, assumptions, updates, challengeEvents, refreshUsedTodayCount] = await Promise.all([
    repositories.theses.getById(userId, thesisId),
    repositories.assumptions.listByThesisId(userId, thesisId),
    repositories.thesisUpdates.listByThesisId(userId, thesisId),
    repositories.events.listChallengeByThesisId(userId, thesisId),
    (async () => {
      const startOfUtcDay = new Date()
      startOfUtcDay.setUTCHours(0, 0, 0, 0)
      return repositories.thesisUpdates.countFinancialRefreshSince(
        userId,
        startOfUtcDay.toISOString(),
      )
    })(),
  ])

  return {
    thesis,
    assumptions: assumptions as Assumption[],
    updates: updates as ThesisUpdate[],
    challengeEvents: challengeEvents as ChallengeEvent[],
    refreshUsedTodayCount,
  }
}

export async function loadThesisPageAlertData(userId: string, thesisId: string) {
  if (isFirebaseBackend()) {
    return {
      trustedSources: [] as Database["public"]["Tables"]["trusted_sources"]["Row"][],
      alertRules: [] as Array<
        Database["public"]["Tables"]["alert_rules"]["Row"] & { sourceIds: string[] }
      >,
    }
  }

  const supabase = await createClient()
  const [{ data: trustedSourcesData }, { data: alertRulesData }] = await Promise.all([
    supabase
      .from("trusted_sources")
      .select("id, thesis_id, user_id, name, url, source_type, created_at")
      .eq("thesis_id", thesisId)
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    supabase
      .from("alert_rules")
      .select(
        "id, user_id, thesis_id, name, mode, min_confidence, include_keywords, exclude_keywords, is_enabled, created_at, updated_at",
      )
      .eq("thesis_id", thesisId)
      .eq("user_id", userId)
      .order("created_at", { ascending: true }),
  ])

  const alertRulesBase = alertRulesData ?? []
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

  return {
    trustedSources: trustedSourcesData ?? [],
    alertRules: alertRulesBase.map((rule) => ({
      ...rule,
      sourceIds: alertRuleSourcesByRule.get(rule.id) ?? [],
    })),
  }
}

export async function loadFinancialSnapshotForTicker(ticker: string) {
  if (isFirebaseBackend()) {
    return null
  }

  const adminSupabase = createAdminClient()
  const { data } = await adminSupabase
    .from("financial_snapshots")
    .select("id, ticker, provider, as_of, fetched_at, stale_after, payload, coverage")
    .eq("ticker", ticker.trim().toUpperCase())
    .maybeSingle()

  return data
}

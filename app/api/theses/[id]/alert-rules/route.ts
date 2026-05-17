import { NextResponse } from "next/server"
import { isFirebaseBackend } from "@/lib/data/backend"
import { getServerUserId } from "@/lib/data/auth"
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin"
import {
  createAlertRule as createFirebaseAlertRule,
  isOwnedThesis as isOwnedFirebaseThesis,
  listAlertRulesByThesis as listFirebaseAlertRulesByThesis,
} from "@/lib/firebase/alerting"
import { createClient } from "@/lib/supabase/server"
import type { Database } from "@/types/database"

type AlertRuleInsert = Database["public"]["Tables"]["alert_rules"]["Insert"]
type AlertRuleMode = AlertRuleInsert["mode"]
type AlertRuleMinConfidence = AlertRuleInsert["min_confidence"]

const VALID_MODES: AlertRuleMode[] = ["only_sources", "include_sources", "exclude_sources"]
const VALID_MIN_CONFIDENCE: AlertRuleMinConfidence[] = ["high", "medium"]

type CreateAlertRulePayload = {
  name?: unknown
  mode?: unknown
  minConfidence?: unknown
  isEnabled?: unknown
  includeKeywords?: unknown
  excludeKeywords?: unknown
}

function isValidMode(value: unknown): value is AlertRuleMode {
  return typeof value === "string" && VALID_MODES.includes(value as AlertRuleMode)
}

function isValidMinConfidence(value: unknown): value is AlertRuleMinConfidence {
  return typeof value === "string" && VALID_MIN_CONFIDENCE.includes(value as AlertRuleMinConfidence)
}

function parseKeywordList(value: unknown): string[] | null {
  if (value === undefined) return null
  if (!Array.isArray(value)) return null
  const keywords = value
    .filter((item) => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .map((item) => item.toLowerCase())
  return [...new Set(keywords)].slice(0, 25)
}

async function ensureThesisOwnership(
  thesisId: string,
  userId: string,
  supabase: Awaited<ReturnType<typeof createClient>>,
) {
  const { data: thesis } = await supabase
    .from("theses")
    .select("id")
    .eq("id", thesisId)
    .eq("user_id", userId)
    .maybeSingle()

  return Boolean(thesis)
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: thesisId } = await params
    const userId = await getServerUserId()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (isFirebaseBackend()) {
      const firestore = getFirebaseAdminFirestore()
      const thesisExists = await isOwnedFirebaseThesis(firestore, userId, thesisId)
      if (!thesisExists) {
        return NextResponse.json({ error: "Thesis not found" }, { status: 404 })
      }

      const rules = await listFirebaseAlertRulesByThesis(firestore, userId, thesisId)
      return NextResponse.json({ rules })
    }

    const supabase = await createClient()

    const thesisExists = await ensureThesisOwnership(thesisId, userId, supabase)
    if (!thesisExists) {
      return NextResponse.json({ error: "Thesis not found" }, { status: 404 })
    }

    const { data: rules, error: rulesError } = await supabase
      .from("alert_rules")
      .select(
        "id, user_id, thesis_id, name, mode, min_confidence, include_keywords, exclude_keywords, is_enabled, created_at, updated_at",
      )
      .eq("thesis_id", thesisId)
      .eq("user_id", userId)
      .order("created_at", { ascending: true })

    if (rulesError) {
      throw rulesError
    }

    const ruleIds = (rules ?? []).map((rule) => rule.id)
    const sourceIdsByRule = new Map<string, string[]>()

    if (ruleIds.length > 0) {
      const { data: mappings, error: mappingsError } = await supabase
        .from("alert_rule_sources")
        .select("alert_rule_id, trusted_source_id")
        .in("alert_rule_id", ruleIds)

      if (mappingsError) {
        throw mappingsError
      }

      for (const mapping of mappings ?? []) {
        const current = sourceIdsByRule.get(mapping.alert_rule_id) ?? []
        current.push(mapping.trusted_source_id)
        sourceIdsByRule.set(mapping.alert_rule_id, current)
      }
    }

    return NextResponse.json({
      rules: (rules ?? []).map((rule) => ({
        ...rule,
        sourceIds: sourceIdsByRule.get(rule.id) ?? [],
      })),
    })
  } catch (error) {
    console.error("Get alert rules failed:", error)
    return NextResponse.json({ error: "Failed to load alert rules" }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: thesisId } = await params
    const body = (await request.json()) as CreateAlertRulePayload
    const userId = await getServerUserId()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (isFirebaseBackend()) {
      const firestore = getFirebaseAdminFirestore()
      const thesisExists = await isOwnedFirebaseThesis(firestore, userId, thesisId)
      if (!thesisExists) {
        return NextResponse.json({ error: "Thesis not found" }, { status: 404 })
      }

      const name = typeof body.name === "string" ? body.name.trim() : ""
      const mode = body.mode
      const minConfidence = body.minConfidence
      const isEnabled = typeof body.isEnabled === "boolean" ? body.isEnabled : true
      const includeKeywords = parseKeywordList(body.includeKeywords)
      const excludeKeywords = parseKeywordList(body.excludeKeywords)

      if (!name) {
        return NextResponse.json({ error: "Rule name is required" }, { status: 400 })
      }
      if (!isValidMode(mode)) {
        return NextResponse.json(
          { error: "Invalid mode. Use only_sources, include_sources, or exclude_sources." },
          { status: 400 },
        )
      }
      if (!isValidMinConfidence(minConfidence)) {
        return NextResponse.json(
          { error: "Invalid minimum confidence. Use high or medium." },
          { status: 400 },
        )
      }

      const inserted = await createFirebaseAlertRule(firestore, {
        user_id: userId,
        thesis_id: thesisId,
        name,
        mode,
        min_confidence: minConfidence,
        is_enabled: isEnabled,
        include_keywords: includeKeywords ?? [],
        exclude_keywords: excludeKeywords ?? [],
      })

      return NextResponse.json(
        {
          message: "Alert rule created",
          rule: {
            ...inserted,
            sourceIds: [] as string[],
          },
        },
        { status: 201 },
      )
    }

    const supabase = await createClient()

    const thesisExists = await ensureThesisOwnership(thesisId, userId, supabase)
    if (!thesisExists) {
      return NextResponse.json({ error: "Thesis not found" }, { status: 404 })
    }

    const name = typeof body.name === "string" ? body.name.trim() : ""
    const mode = body.mode
    const minConfidence = body.minConfidence
    const isEnabled = typeof body.isEnabled === "boolean" ? body.isEnabled : true
    const includeKeywords = parseKeywordList(body.includeKeywords)
    const excludeKeywords = parseKeywordList(body.excludeKeywords)

    if (!name) {
      return NextResponse.json({ error: "Rule name is required" }, { status: 400 })
    }
    if (!isValidMode(mode)) {
      return NextResponse.json(
        { error: "Invalid mode. Use only_sources, include_sources, or exclude_sources." },
        { status: 400 },
      )
    }
    if (!isValidMinConfidence(minConfidence)) {
      return NextResponse.json(
        { error: "Invalid minimum confidence. Use high or medium." },
        { status: 400 },
      )
    }

    const insertPayload: AlertRuleInsert = {
      user_id: userId,
      thesis_id: thesisId,
      name,
      mode,
      min_confidence: minConfidence,
      is_enabled: isEnabled,
      include_keywords: includeKeywords ?? [],
      exclude_keywords: excludeKeywords ?? [],
    }

    const { data: inserted, error: insertError } = await supabase
      .from("alert_rules")
      .insert(insertPayload)
      .select(
        "id, user_id, thesis_id, name, mode, min_confidence, include_keywords, exclude_keywords, is_enabled, created_at, updated_at",
      )
      .single()

    if (insertError) {
      throw insertError
    }

    return NextResponse.json(
      {
        message: "Alert rule created",
        rule: {
          ...inserted,
          sourceIds: [] as string[],
        },
      },
      { status: 201 },
    )
  } catch (error) {
    console.error("Create alert rule failed:", error)
    return NextResponse.json({ error: "Failed to create alert rule" }, { status: 500 })
  }
}

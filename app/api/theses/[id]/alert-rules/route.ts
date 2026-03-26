import { NextResponse } from "next/server"
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
}

function isValidMode(value: unknown): value is AlertRuleMode {
  return typeof value === "string" && VALID_MODES.includes(value as AlertRuleMode)
}

function isValidMinConfidence(value: unknown): value is AlertRuleMinConfidence {
  return typeof value === "string" && VALID_MIN_CONFIDENCE.includes(value as AlertRuleMinConfidence)
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
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const thesisExists = await ensureThesisOwnership(thesisId, user.id, supabase)
    if (!thesisExists) {
      return NextResponse.json({ error: "Thesis not found" }, { status: 404 })
    }

    const { data: rules, error: rulesError } = await supabase
      .from("alert_rules")
      .select("id, user_id, thesis_id, name, mode, min_confidence, is_enabled, created_at, updated_at")
      .eq("thesis_id", thesisId)
      .eq("user_id", user.id)
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
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const thesisExists = await ensureThesisOwnership(thesisId, user.id, supabase)
    if (!thesisExists) {
      return NextResponse.json({ error: "Thesis not found" }, { status: 404 })
    }

    const name = typeof body.name === "string" ? body.name.trim() : ""
    const mode = body.mode
    const minConfidence = body.minConfidence
    const isEnabled = typeof body.isEnabled === "boolean" ? body.isEnabled : true

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
      user_id: user.id,
      thesis_id: thesisId,
      name,
      mode,
      min_confidence: minConfidence,
      is_enabled: isEnabled,
    }

    const { data: inserted, error: insertError } = await supabase
      .from("alert_rules")
      .insert(insertPayload)
      .select("id, user_id, thesis_id, name, mode, min_confidence, is_enabled, created_at, updated_at")
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

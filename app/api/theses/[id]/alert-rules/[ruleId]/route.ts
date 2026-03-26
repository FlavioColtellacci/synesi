import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import type { Database } from "@/types/database"

type AlertRuleUpdate = Database["public"]["Tables"]["alert_rules"]["Update"]
type AlertRuleMode = NonNullable<AlertRuleUpdate["mode"]>
type AlertRuleMinConfidence = NonNullable<AlertRuleUpdate["min_confidence"]>

const VALID_MODES: AlertRuleMode[] = ["only_sources", "include_sources", "exclude_sources"]
const VALID_MIN_CONFIDENCE: AlertRuleMinConfidence[] = ["high", "medium"]

type UpdateAlertRulePayload = {
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

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; ruleId: string }> },
) {
  try {
    const { id: thesisId, ruleId } = await params
    const body = (await request.json()) as UpdateAlertRulePayload
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

    const updatePayload: AlertRuleUpdate = {}

    if (body.name !== undefined) {
      if (typeof body.name !== "string" || body.name.trim().length === 0) {
        return NextResponse.json({ error: "Rule name cannot be empty" }, { status: 400 })
      }
      updatePayload.name = body.name.trim()
    }

    if (body.mode !== undefined) {
      if (!isValidMode(body.mode)) {
        return NextResponse.json(
          { error: "Invalid mode. Use only_sources, include_sources, or exclude_sources." },
          { status: 400 },
        )
      }
      updatePayload.mode = body.mode
    }

    if (body.minConfidence !== undefined) {
      if (!isValidMinConfidence(body.minConfidence)) {
        return NextResponse.json(
          { error: "Invalid minimum confidence. Use high or medium." },
          { status: 400 },
        )
      }
      updatePayload.min_confidence = body.minConfidence
    }

    if (body.isEnabled !== undefined) {
      if (typeof body.isEnabled !== "boolean") {
        return NextResponse.json({ error: "isEnabled must be a boolean" }, { status: 400 })
      }
      updatePayload.is_enabled = body.isEnabled
    }

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json(
        { error: "Provide at least one field to update" },
        { status: 400 },
      )
    }

    const { data: updated, error: updateError } = await supabase
      .from("alert_rules")
      .update(updatePayload)
      .eq("id", ruleId)
      .eq("thesis_id", thesisId)
      .eq("user_id", user.id)
      .select("id, user_id, thesis_id, name, mode, min_confidence, is_enabled, created_at, updated_at")
      .maybeSingle()

    if (updateError) {
      throw updateError
    }

    if (!updated) {
      return NextResponse.json({ error: "Alert rule not found" }, { status: 404 })
    }

    return NextResponse.json({
      message: "Alert rule updated",
      rule: updated,
    })
  } catch (error) {
    console.error("Update alert rule failed:", error)
    return NextResponse.json({ error: "Failed to update alert rule" }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; ruleId: string }> },
) {
  try {
    const { id: thesisId, ruleId } = await params
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

    const { data: deleted, error: deleteError } = await supabase
      .from("alert_rules")
      .delete()
      .eq("id", ruleId)
      .eq("thesis_id", thesisId)
      .eq("user_id", user.id)
      .select("id")
      .maybeSingle()

    if (deleteError) {
      throw deleteError
    }

    if (!deleted) {
      return NextResponse.json({ error: "Alert rule not found" }, { status: 404 })
    }

    return NextResponse.json({
      message: "Alert rule deleted",
      success: true,
    })
  } catch (error) {
    console.error("Delete alert rule failed:", error)
    return NextResponse.json({ error: "Failed to delete alert rule" }, { status: 500 })
  }
}

import { NextResponse } from "next/server"
import { getServerUserId } from "@/lib/data/auth"
import { isFirebaseBackend } from "@/lib/data/backend"
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin"
import {
  deleteOwnedAlertRule as deleteFirebaseAlertRule,
  isOwnedThesis as isOwnedFirebaseThesis,
  updateOwnedAlertRule as updateFirebaseAlertRule,
} from "@/lib/firebase/alerting"
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

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; ruleId: string }> },
) {
  try {
    const { id: thesisId, ruleId } = await params
    const body = (await request.json()) as UpdateAlertRulePayload
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

      if (body.includeKeywords !== undefined) {
        const parsed = parseKeywordList(body.includeKeywords)
        if (!parsed) {
          return NextResponse.json(
            { error: "includeKeywords must be an array of strings" },
            { status: 400 },
          )
        }
        updatePayload.include_keywords = parsed
      }

      if (body.excludeKeywords !== undefined) {
        const parsed = parseKeywordList(body.excludeKeywords)
        if (!parsed) {
          return NextResponse.json(
            { error: "excludeKeywords must be an array of strings" },
            { status: 400 },
          )
        }
        updatePayload.exclude_keywords = parsed
      }

      if (Object.keys(updatePayload).length === 0) {
        return NextResponse.json(
          { error: "Provide at least one field to update" },
          { status: 400 },
        )
      }

      const updated = await updateFirebaseAlertRule(
        firestore,
        userId,
        thesisId,
        ruleId,
        updatePayload,
      )
      if (!updated) {
        return NextResponse.json({ error: "Alert rule not found" }, { status: 404 })
      }

      return NextResponse.json({
        message: "Alert rule updated",
        rule: updated,
      })
    }

    const supabase = await createClient()

    const thesisExists = await ensureThesisOwnership(thesisId, userId, supabase)
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

    if (body.includeKeywords !== undefined) {
      const parsed = parseKeywordList(body.includeKeywords)
      if (!parsed) {
        return NextResponse.json(
          { error: "includeKeywords must be an array of strings" },
          { status: 400 },
        )
      }
      updatePayload.include_keywords = parsed
    }

    if (body.excludeKeywords !== undefined) {
      const parsed = parseKeywordList(body.excludeKeywords)
      if (!parsed) {
        return NextResponse.json(
          { error: "excludeKeywords must be an array of strings" },
          { status: 400 },
        )
      }
      updatePayload.exclude_keywords = parsed
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
      .eq("user_id", userId)
      .select(
        "id, user_id, thesis_id, name, mode, min_confidence, include_keywords, exclude_keywords, is_enabled, created_at, updated_at",
      )
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

      const deleted = await deleteFirebaseAlertRule(firestore, userId, thesisId, ruleId)
      if (!deleted) {
        return NextResponse.json({ error: "Alert rule not found" }, { status: 404 })
      }

      return NextResponse.json({
        message: "Alert rule deleted",
        success: true,
      })
    }

    const supabase = await createClient()

    const thesisExists = await ensureThesisOwnership(thesisId, userId, supabase)
    if (!thesisExists) {
      return NextResponse.json({ error: "Thesis not found" }, { status: 404 })
    }

    const { data: deleted, error: deleteError } = await supabase
      .from("alert_rules")
      .delete()
      .eq("id", ruleId)
      .eq("thesis_id", thesisId)
      .eq("user_id", userId)
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

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

type SourceRulePayload = {
  trustedSourceId?: unknown
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

async function ensureRuleOwnership(
  ruleId: string,
  thesisId: string,
  userId: string,
  supabase: Awaited<ReturnType<typeof createClient>>,
) {
  const { data: rule } = await supabase
    .from("alert_rules")
    .select("id")
    .eq("id", ruleId)
    .eq("thesis_id", thesisId)
    .eq("user_id", userId)
    .maybeSingle()

  return Boolean(rule)
}

async function ensureTrustedSourceOwnership(
  trustedSourceId: string,
  thesisId: string,
  userId: string,
  supabase: Awaited<ReturnType<typeof createClient>>,
) {
  const { data: source } = await supabase
    .from("trusted_sources")
    .select("id")
    .eq("id", trustedSourceId)
    .eq("thesis_id", thesisId)
    .eq("user_id", userId)
    .maybeSingle()

  return Boolean(source)
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; ruleId: string }> },
) {
  try {
    const { id: thesisId, ruleId } = await params
    const body = (await request.json()) as SourceRulePayload
    const trustedSourceId =
      typeof body.trustedSourceId === "string" ? body.trustedSourceId.trim() : ""
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (!trustedSourceId) {
      return NextResponse.json({ error: "trustedSourceId is required" }, { status: 400 })
    }

    const thesisExists = await ensureThesisOwnership(thesisId, user.id, supabase)
    if (!thesisExists) {
      return NextResponse.json({ error: "Thesis not found" }, { status: 404 })
    }

    const ownsRule = await ensureRuleOwnership(ruleId, thesisId, user.id, supabase)
    if (!ownsRule) {
      return NextResponse.json({ error: "Alert rule not found" }, { status: 404 })
    }

    const ownsSource = await ensureTrustedSourceOwnership(trustedSourceId, thesisId, user.id, supabase)
    if (!ownsSource) {
      return NextResponse.json(
        { error: "Trusted source not found for this thesis" },
        { status: 404 },
      )
    }

    const { error: insertError } = await supabase.from("alert_rule_sources").insert({
      alert_rule_id: ruleId,
      trusted_source_id: trustedSourceId,
    })

    if (insertError) {
      if (insertError.code === "23505") {
        return NextResponse.json(
          { error: "Source is already attached to this rule" },
          { status: 409 },
        )
      }
      throw insertError
    }

    return NextResponse.json(
      {
        message: "Source added to alert rule",
        alertRuleId: ruleId,
        trustedSourceId,
      },
      { status: 201 },
    )
  } catch (error) {
    console.error("Add source to alert rule failed:", error)
    return NextResponse.json({ error: "Failed to add source to alert rule" }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; ruleId: string }> },
) {
  try {
    const { id: thesisId, ruleId } = await params
    const body = (await request.json()) as SourceRulePayload
    const trustedSourceId =
      typeof body.trustedSourceId === "string" ? body.trustedSourceId.trim() : ""
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (!trustedSourceId) {
      return NextResponse.json({ error: "trustedSourceId is required" }, { status: 400 })
    }

    const thesisExists = await ensureThesisOwnership(thesisId, user.id, supabase)
    if (!thesisExists) {
      return NextResponse.json({ error: "Thesis not found" }, { status: 404 })
    }

    const ownsRule = await ensureRuleOwnership(ruleId, thesisId, user.id, supabase)
    if (!ownsRule) {
      return NextResponse.json({ error: "Alert rule not found" }, { status: 404 })
    }

    const ownsSource = await ensureTrustedSourceOwnership(trustedSourceId, thesisId, user.id, supabase)
    if (!ownsSource) {
      return NextResponse.json(
        { error: "Trusted source not found for this thesis" },
        { status: 404 },
      )
    }

    const { data: deleted, error: deleteError } = await supabase
      .from("alert_rule_sources")
      .delete()
      .eq("alert_rule_id", ruleId)
      .eq("trusted_source_id", trustedSourceId)
      .select("id")
      .maybeSingle()

    if (deleteError) {
      throw deleteError
    }

    if (!deleted) {
      return NextResponse.json({ error: "Source is not attached to this rule" }, { status: 404 })
    }

    return NextResponse.json({
      message: "Source removed from alert rule",
      success: true,
    })
  } catch (error) {
    console.error("Remove source from alert rule failed:", error)
    return NextResponse.json({ error: "Failed to remove source from alert rule" }, { status: 500 })
  }
}

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

type EditableAssumption = {
  category: string
  statement: string
  breakCondition: string
}

type EditPayload = {
  thesisStatement?: string
  investingStyle?: string
  confidenceLevel?: "high" | "medium" | "low"
  exitCriteria?: string
  assumptions?: EditableAssumption[]
}

const VALID_CONFIDENCE_LEVELS = new Set(["high", "medium", "low"])

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const body = (await request.json()) as EditPayload
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const thesisStatement = body.thesisStatement?.trim()
    if (!thesisStatement) {
      return NextResponse.json({ error: "Missing thesis statement" }, { status: 400 })
    }

    const confidenceLevel = body.confidenceLevel ?? "medium"
    if (!VALID_CONFIDENCE_LEVELS.has(confidenceLevel)) {
      return NextResponse.json({ error: "Invalid confidence level" }, { status: 400 })
    }

    const { data: thesis, error: thesisError } = await supabase
      .from("theses")
      .select("id")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle()

    if (thesisError) {
      throw thesisError
    }

    if (!thesis) {
      return NextResponse.json({ error: "Thesis not found" }, { status: 404 })
    }

    const { error: updateError } = await supabase
      .from("theses")
      .update({
        thesis_statement: thesisStatement,
        investing_style: body.investingStyle?.trim() || null,
        confidence_level: confidenceLevel,
        exit_criteria: body.exitCriteria?.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("user_id", user.id)

    if (updateError) {
      throw updateError
    }

    const assumptions = (body.assumptions ?? [])
      .map((assumption) => ({
        category: assumption.category?.trim() || "general",
        statement: assumption.statement?.trim() || "",
        break_condition: assumption.breakCondition?.trim() || null,
      }))
      .filter((assumption) => assumption.statement.length > 0)

    const { error: deleteAssumptionsError } = await supabase
      .from("assumptions")
      .delete()
      .eq("thesis_id", id)
      .eq("user_id", user.id)

    if (deleteAssumptionsError) {
      throw deleteAssumptionsError
    }

    if (assumptions.length > 0) {
      const { error: insertAssumptionsError } = await supabase.from("assumptions").insert(
        assumptions.map((assumption, index) => ({
          thesis_id: id,
          user_id: user.id,
          category: assumption.category,
          statement: assumption.statement,
          break_condition: assumption.break_condition,
          sort_order: index,
        })),
      )

      if (insertAssumptionsError) {
        throw insertAssumptionsError
      }
    }

    const { error: historyError } = await supabase.from("thesis_updates").insert({
      thesis_id: id,
      user_id: user.id,
      update_type: "edit",
      note: "Thesis manually edited",
    })

    if (historyError) {
      throw historyError
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Edit thesis failed:", error)
    return NextResponse.json({ error: "Edit failed" }, { status: 500 })
  }
}

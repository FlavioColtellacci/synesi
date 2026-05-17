import { NextResponse } from "next/server"
import { getServerUserId } from "@/lib/data/auth"
import { isFirebaseBackend } from "@/lib/data/backend"
import { createRepositories } from "@/lib/data/repositories"
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
    const userId = await getServerUserId()

    if (!userId) {
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

    const supabase = isFirebaseBackend() ? null : await createClient()
    const repositories = createRepositories({ supabase: supabase ?? undefined })

    const thesis = await repositories.theses.getOwnership(userId, id)
    if (!thesis) {
      return NextResponse.json({ error: "Thesis not found" }, { status: 404 })
    }

    await repositories.theses.update(userId, id, {
      thesis_statement: thesisStatement,
      investing_style: body.investingStyle?.trim() || null,
      confidence_level: confidenceLevel,
      exit_criteria: body.exitCriteria?.trim() || null,
      updated_at: new Date().toISOString(),
    })

    const assumptions = (body.assumptions ?? [])
      .map((assumption) => ({
        category: assumption.category?.trim() || "general",
        statement: assumption.statement?.trim() || "",
        break_condition: assumption.breakCondition?.trim() || null,
      }))
      .filter((assumption) => assumption.statement.length > 0)

    await repositories.assumptions.replaceForThesis(userId, id, assumptions)

    await repositories.thesisUpdates.insert({
      thesis_id: id,
      user_id: userId,
      update_type: "edit",
      note: "Thesis manually edited",
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Edit thesis failed:", error)
    return NextResponse.json({ error: "Edit failed" }, { status: 500 })
  }
}

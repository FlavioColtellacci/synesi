import { NextResponse } from "next/server"
import { getServerUserId } from "@/lib/data/auth"
import { isFirebaseBackend } from "@/lib/data/backend"
import { createRepositories } from "@/lib/data/repositories"
import { createClient } from "@/lib/supabase/server"

type ExtractedThesis = {
  ticker: string
  companyName: string
  thesisStatement: string
  investingStyle: string
  assumptions: {
    category: string
    statement: string
    breakCondition: string
  }[]
  bullCase: string
  bearCase: string
  exitCriteria: string
  confidenceLevel: "high" | "medium" | "low"
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { thesis?: ExtractedThesis }
    const thesis = body.thesis

    if (!thesis) {
      return NextResponse.json({ error: "Missing thesis payload" }, { status: 400 })
    }

    const userId = await getServerUserId()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const supabase = isFirebaseBackend() ? null : await createClient()
    const repositories = createRepositories({ supabase: supabase ?? undefined })

    const newThesisId = await repositories.theses.create({
      user_id: userId,
      ticker: thesis.ticker,
      company_name: thesis.companyName,
      thesis_statement: thesis.thesisStatement,
      investing_style: thesis.investingStyle,
      bull_case: thesis.bullCase,
      bear_case: thesis.bearCase,
      exit_criteria: thesis.exitCriteria,
      confidence_level: thesis.confidenceLevel,
      status: "intact",
    })

    if (thesis.assumptions.length > 0) {
      await repositories.assumptions.insertMany(
        thesis.assumptions.map((assumption, index) => ({
          thesis_id: newThesisId,
          user_id: userId,
          category: assumption.category,
          statement: assumption.statement,
          break_condition: assumption.breakCondition,
          sort_order: index,
        })),
      )
    }

    await repositories.thesisUpdates.insert({
      thesis_id: newThesisId,
      user_id: userId,
      update_type: "edit",
      note: "Thesis created",
    })

    return NextResponse.json({ success: true, thesisId: newThesisId })
  } catch (error) {
    console.error("Save thesis failed:", error)
    return NextResponse.json({ error: "Save failed" }, { status: 500 })
  }
}

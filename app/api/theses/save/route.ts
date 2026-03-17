import { NextResponse } from "next/server"
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

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: insertedThesis, error: thesisError } = await supabase
      .from("theses")
      .insert({
        user_id: user.id,
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
      .select("id")
      .single()

    if (thesisError) {
      throw thesisError
    }

    const newThesisId = insertedThesis.id

    if (thesis.assumptions.length > 0) {
      const assumptionsToInsert = thesis.assumptions.map((assumption, index) => ({
        thesis_id: newThesisId,
        user_id: user.id,
        category: assumption.category,
        statement: assumption.statement,
        break_condition: assumption.breakCondition,
        sort_order: index,
      }))

      const { error: assumptionsError } = await supabase
        .from("assumptions")
        .insert(assumptionsToInsert)

      if (assumptionsError) {
        throw assumptionsError
      }
    }

    const { error: updateError } = await supabase.from("thesis_updates").insert({
      thesis_id: newThesisId,
      user_id: user.id,
      update_type: "edit",
      note: "Thesis created",
    })

    if (updateError) {
      throw updateError
    }

    return NextResponse.json({ success: true, thesisId: newThesisId })
  } catch (error) {
    console.error("Save thesis failed:", error)
    return NextResponse.json({ error: "Save failed" }, { status: 500 })
  }
}

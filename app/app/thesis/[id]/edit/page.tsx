import { notFound, redirect } from "next/navigation"
import EditThesisForm from "@/components/thesis/EditThesisForm"
import { createClient } from "@/lib/supabase/server"

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function EditThesisPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const { data: thesis } = await supabase
    .from("theses")
    .select("id, ticker, company_name, thesis_statement, investing_style, confidence_level, exit_criteria")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle()

  if (!thesis) {
    notFound()
  }

  const { data: assumptionsData } = await supabase
    .from("assumptions")
    .select("category, statement, break_condition")
    .eq("thesis_id", id)
    .eq("user_id", user.id)
    .order("sort_order", { ascending: true })

  return (
    <EditThesisForm
      initialThesis={{
        id: thesis.id,
        ticker: thesis.ticker,
        companyName: thesis.company_name,
        thesisStatement: thesis.thesis_statement,
        investingStyle: thesis.investing_style ?? "",
        confidenceLevel: (thesis.confidence_level as "high" | "medium" | "low") ?? "medium",
        exitCriteria: thesis.exit_criteria ?? "",
        assumptions: (assumptionsData ?? []).map((assumption) => ({
          category: assumption.category,
          statement: assumption.statement,
          breakCondition: assumption.break_condition ?? "",
        })),
      }}
    />
  )
}

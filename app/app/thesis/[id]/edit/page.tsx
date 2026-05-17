import { notFound, redirect } from "next/navigation"
import EditThesisForm from "@/components/thesis/EditThesisForm"
import { getServerUserId } from "@/lib/data/auth"
import { isFirebaseBackend } from "@/lib/data/backend"
import { createRepositories } from "@/lib/data/repositories"
import { createClient } from "@/lib/supabase/server"

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function EditThesisPage({ params }: PageProps) {
  const { id } = await params
  const userId = await getServerUserId()

  if (!userId) {
    redirect("/login")
  }

  const supabase = isFirebaseBackend() ? null : await createClient()
  const repositories = createRepositories({ supabase: supabase ?? undefined })

  const thesis = await repositories.theses.getById(userId, id)
  if (!thesis) {
    notFound()
  }

  const assumptionsData = await repositories.assumptions.listEditableByThesisId(userId, id)

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
        assumptions: assumptionsData.map((assumption) => ({
          category: assumption.category,
          statement: assumption.statement,
          breakCondition: assumption.break_condition ?? "",
        })),
      }}
    />
  )
}

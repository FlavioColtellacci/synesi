import Link from "next/link"
import { createClient } from "@/lib/supabase/server"

type DashboardThesis = {
  id: string
  ticker: string
  company_name: string
  status: string
  confidence_level: string
  created_at: string
  thesis_statement: string
}

const getStatusMeta = (status: string) => {
  if (status === "at_risk") {
    return {
      label: "◐ AT RISK",
      className: "bg-[#FFB800]/10 text-[#FFB800] border border-[#FFB800]/30",
    }
  }

  if (status === "broken") {
    return {
      label: "✕ BROKEN",
      className: "bg-[#FF3B30]/10 text-[#FF3B30] border border-[#FF3B30]/30",
    }
  }

  return {
    label: "● INTACT",
    className: "bg-[#00D1B2]/10 text-[#00D1B2] border border-[#00D1B2]/30",
  }
}

export default async function Page() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let theses: DashboardThesis[] = []

  if (user) {
    const { data } = await supabase
      .from("theses")
      .select(
        "id, ticker, company_name, status, confidence_level, created_at, thesis_statement",
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })

    theses = data ?? []
  }

  const intactCount = theses.filter((thesis) => thesis.status === "intact").length
  const atRiskCount = theses.filter((thesis) => thesis.status === "at_risk").length
  const brokenCount = theses.filter((thesis) => thesis.status === "broken").length

  return (
    <main className="bg-[#0A0A0C] min-h-screen px-6 py-10 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-mono uppercase text-[#F0F0F0] text-2xl tracking-widest">
          CONVICTIONS
        </h1>
        <Link
          href="/app/new"
          className="bg-[#F0F0F0] text-[#0A0A0C] rounded-full px-5 py-2 text-sm font-mono tracking-widest hover:bg-[#E8E8E8] transition-colors"
        >
          + NEW THESIS
        </Link>
      </div>

      {theses.length > 0 ? (
        <div className="mb-8 font-mono text-xs tracking-widest">
          <span className="text-[#00D1B2]">{intactCount} INTACT</span>
          <span className="text-[#2A2A32]"> · </span>
          <span className="text-[#FFB800]">{atRiskCount} AT RISK</span>
          <span className="text-[#2A2A32]"> · </span>
          <span className="text-[#FF3B30]">{brokenCount} BROKEN</span>
        </div>
      ) : null}

      {theses.length === 0 ? (
        <div className="mt-20 text-center">
          <p className="font-mono text-4xl text-[#2A2A32] mb-4">Σ</p>
          <p className="text-[#6B6B7B] text-sm mb-6">No convictions tracked yet.</p>
          <Link
            href="/app/new"
            className="bg-[#F0F0F0] text-[#0A0A0C] rounded-full px-5 py-2 text-sm font-mono tracking-widest hover:bg-[#E8E8E8] transition-colors"
          >
            + ADD YOUR FIRST THESIS
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {theses.map((thesis) => {
            const statusMeta = getStatusMeta(thesis.status)

            return (
              <Link key={thesis.id} href={`/app/thesis/${thesis.id}`}>
                <article className="bg-[#141418] border border-[#2A2A32] rounded-xl p-6 hover:border-[#F0F0F0]/20 transition-colors cursor-pointer">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="font-mono font-medium text-[#F0F0F0] text-xl tracking-widest">
                        {thesis.ticker}
                      </p>
                      <p className="text-sm text-[#6B6B7B] mt-0.5">
                        {thesis.company_name}
                      </p>
                    </div>

                    <span
                      className={`rounded-full px-3 py-1 text-xs font-mono tracking-widest ${statusMeta.className}`}
                    >
                      {statusMeta.label}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <p className="text-sm text-[#6B6B7B] truncate max-w-[60%]">
                      {thesis.thesis_statement}
                    </p>

                    <div className="flex gap-4 items-center">
                      <span className="font-mono text-xs text-[#6B6B7B] uppercase tracking-widest">
                        {thesis.confidence_level}
                      </span>
                      <span className="text-xs text-[#6B6B7B]">
                        {new Date(thesis.created_at).toLocaleDateString("en-GB", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                  </div>
                </article>
              </Link>
            )
          })}
        </div>
      )}
    </main>
  )
}

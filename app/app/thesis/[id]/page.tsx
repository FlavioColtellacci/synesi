import Link from "next/link"
import { redirect } from "next/navigation"
import { AnalysisButton } from "@/components/thesis/AnalysisButton"
import DeleteThesisButton from "@/components/thesis/DeleteThesisButton"
import { createClient } from "@/lib/supabase/server"
import type { Database } from "@/types/database"

type Thesis = Database["public"]["Tables"]["theses"]["Row"]
type Assumption = Database["public"]["Tables"]["assumptions"]["Row"]
type ThesisUpdate = Pick<
  Database["public"]["Tables"]["thesis_updates"]["Row"],
  "id" | "update_type" | "note" | "old_status" | "new_status" | "created_at"
>

type PageProps = {
  params: Promise<{
    id: string
  }>
}

function getStatusMeta(status: string) {
  if (status === "at_risk") {
    return {
      label: "◐ AT RISK",
      className: "bg-[#FFB800]/10 text-[#FFB800] border-[#FFB800]/30",
    }
  }

  if (status === "broken") {
    return {
      label: "✕ BROKEN",
      className: "bg-[#FF3B30]/10 text-[#FF3B30] border-[#FF3B30]/30",
    }
  }

  return {
    label: "● INTACT",
    className: "bg-[#00D1B2]/10 text-[#00D1B2] border-[#00D1B2]/30",
  }
}

function getUpdateTypeMeta(updateType: string) {
  if (updateType === "status_change") {
    return {
      label: "STATUS CHANGE",
      className: "bg-[#FFB800]/10 text-[#FFB800]",
    }
  }

  if (updateType === "ai_analysis") {
    return {
      label: "AI ANALYSIS",
      className: "bg-[#8B5CF6]/10 text-[#8B5CF6]",
    }
  }

  if (updateType === "note") {
    return {
      label: "NOTE",
      className: "bg-[#2A2A32] text-[#6B6B7B]",
    }
  }

  return {
    label: "CREATED",
    className: "bg-[#2A2A32] text-[#6B6B7B]",
  }
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

export default async function ThesisDetailPage({ params }: PageProps) {
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
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle()

  if (!thesis) {
    redirect("/app/dashboard")
  }

  const [{ data: assumptionsData }, { data: updatesData }] = await Promise.all([
    supabase
      .from("assumptions")
      .select("*")
      .eq("thesis_id", id)
      .order("sort_order", { ascending: true }),
    supabase
      .from("thesis_updates")
      .select("id, update_type, note, old_status, new_status, created_at")
      .eq("thesis_id", id)
      .order("created_at", { ascending: false }),
  ])

  const assumptions: Assumption[] = assumptionsData ?? []
  const updates: ThesisUpdate[] = updatesData ?? []
  const statusMeta = getStatusMeta(thesis.status)

  return (
    <main className="bg-[#0A0A0C] min-h-screen px-6 py-10 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <Link
          href="/app/dashboard"
          className="text-sm font-mono text-[#6B6B7B] hover:text-[#F0F0F0] transition-colors"
        >
          ← CONVICTIONS
        </Link>

        <span
          className={`rounded-full px-3 py-1 text-xs font-mono tracking-widest border ${statusMeta.className}`}
        >
          {statusMeta.label}
        </span>
      </div>

      <section className="bg-[#141418] border border-[#2A2A32] rounded-xl p-6 mb-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h1 className="font-mono font-medium text-[#F0F0F0] text-2xl tracking-widest">
              {thesis.ticker}
            </h1>
            <p className="text-sm text-[#6B6B7B] mt-1">{thesis.company_name}</p>
          </div>

          <span className="border border-[#2A2A32] rounded-full px-3 py-1 font-mono text-xs text-[#6B6B7B] tracking-widest uppercase">
            {thesis.confidence_level}
          </span>
        </div>

        <p className="font-mono text-xs text-[#6B6B7B] tracking-widest uppercase mb-2">
          THESIS STATEMENT
        </p>
        <p className="text-sm text-[#F0F0F0] leading-relaxed mb-4">{thesis.thesis_statement}</p>

        <div className="flex gap-6">
          <div>
            <p className="font-mono text-xs text-[#6B6B7B] tracking-widest uppercase">
              INVESTING STYLE
            </p>
            <p className="text-sm text-[#F0F0F0] mt-1">{thesis.investing_style ?? "—"}</p>
          </div>

          <div>
            <p className="font-mono text-xs text-[#6B6B7B] tracking-widest uppercase">
              DATE ADDED
            </p>
            <p className="text-sm text-[#F0F0F0] mt-1">{formatDate(thesis.created_at)}</p>
          </div>
        </div>
      </section>

      <section className="mb-6">
        <p className="font-mono text-xs text-[#6B6B7B] tracking-widest uppercase mb-4">
          ASSUMPTIONS
        </p>

        {assumptions.map((assumption) => (
          <article
            key={assumption.id}
            className="bg-[#141418] border border-[#2A2A32] rounded-xl p-5 mb-3"
          >
            <p className="font-mono text-xs text-[#6B6B7B] tracking-widest uppercase mb-3">
              {assumption.category}
            </p>
            <p className="text-sm text-[#F0F0F0] leading-relaxed mb-3">{assumption.statement}</p>

            {assumption.break_condition ? (
              <div>
                <p className="font-mono text-xs text-[#6B6B7B] tracking-widest uppercase mb-1">
                  I&apos;LL KNOW THIS IS BROKEN IF...
                </p>
                <p className="text-sm text-[#6B6B7B] leading-relaxed">{assumption.break_condition}</p>
              </div>
            ) : null}
          </article>
        ))}
      </section>

      {thesis.exit_criteria ? (
        <section className="mb-6">
          <article className="bg-[#141418] border border-[#2A2A32] rounded-xl p-5">
            <p className="font-mono text-xs text-[#6B6B7B] tracking-widest uppercase mb-2">
              I&apos;LL SELL IF...
            </p>
            <p className="text-sm text-[#F0F0F0] leading-relaxed">{thesis.exit_criteria}</p>
          </article>
        </section>
      ) : null}

      <section className="mb-6">
        <p className="font-mono text-xs text-[#6B6B7B] tracking-widest uppercase mb-4">HISTORY</p>

        {updates.map((update) => {
          const updateMeta = getUpdateTypeMeta(update.update_type)

          return (
            <div key={update.id} className="flex items-start gap-4 mb-4">
              <p className="font-mono text-xs text-[#6B6B7B] w-24 shrink-0 pt-0.5">
                {formatDate(update.created_at)}
              </p>

              <div>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-mono tracking-widest uppercase mb-1 inline-block ${updateMeta.className}`}
                >
                  {updateMeta.label}
                </span>

                {update.note ? (
                  <p className="text-sm text-[#6B6B7B] leading-relaxed mt-1">{update.note}</p>
                ) : null}
              </div>
            </div>
          )
        })}
      </section>

      <section className="mb-6">
        <p className="font-mono text-xs text-[#6B6B7B] tracking-widest uppercase mb-4">
          AI ANALYSIS
        </p>
        <AnalysisButton thesisId={thesis.id} />
      </section>

      <section className="mt-12 border-t border-[#2A2A32] pt-6">
        <DeleteThesisButton thesisId={thesis.id} ticker={thesis.ticker} />
      </section>
    </main>
  )
}

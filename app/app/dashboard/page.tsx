"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { createBrowserClient } from "@supabase/ssr"
import {
  ThesisChallengeBanner,
  type ThesisChallengeEvent,
} from "@/components/thesis/ThesisChallengeBanner"
import UpdateStatusModal from "@/components/thesis/UpdateStatusModal"
import type { Database } from "@/types/database"

type DashboardThesis = {
  id: string
  ticker: string
  company_name: string
  status: string
  confidence_level: string
  created_at: string
  updated_at: string
  thesis_statement: string
  latest_status_note: string | null
  latest_status_note_status: string | null
}

type ModalThesis = {
  id: string
  status: string
  ticker: string
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

const STATUS_CHANGE_NOTE_COLOR = "text-[#FFB800]"

export default function Page() {
  const router = useRouter()
  const [theses, setTheses] = useState<DashboardThesis[]>([])
  const [challengeEvents, setChallengeEvents] = useState<ThesisChallengeEvent[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [modalThesis, setModalThesis] = useState<ModalThesis | null>(null)

  useEffect(() => {
    const load = async () => {
      const supabase = createBrowserClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      )

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push("/login")
        return
      }

      const [thesesResult, eventsResult, updatesResult] = await Promise.all([
        supabase
          .from("theses")
          .select(
            "id, ticker, company_name, status, confidence_level, created_at, updated_at, thesis_statement",
          )
          .eq("user_id", user.id)
          .order("updated_at", { ascending: false }),
        supabase
          .from("events")
          .select("id, thesis_id, event_detail")
          .eq("user_id", user.id)
          .eq("is_reviewed", false)
          .order("created_at", { ascending: false }),
        supabase
          .from("thesis_updates")
          .select("thesis_id, note, created_at, new_status")
          .eq("user_id", user.id)
          .eq("update_type", "status_change")
          .not("note", "is", null)
          .order("created_at", { ascending: false }),
      ])

      const latestNoteByThesis = new Map<string, { note: string; status: string }>()
      for (const update of updatesResult.data ?? []) {
        if (!latestNoteByThesis.has(update.thesis_id) && update.note && update.new_status) {
          latestNoteByThesis.set(update.thesis_id, { note: update.note, status: update.new_status })
        }
      }

      setTheses(
        (thesesResult.data ?? []).map((thesis) => ({
          ...thesis,
          latest_status_note: latestNoteByThesis.get(thesis.id)?.note ?? null,
          latest_status_note_status: latestNoteByThesis.get(thesis.id)?.status ?? null,
        })),
      )

      setChallengeEvents(
        (eventsResult.data ?? []).map((e) => ({
          id: e.id,
          thesisId: e.thesis_id,
          eventDetail: e.event_detail ?? "",
        })),
      )

      setIsLoading(false)
    }

    void load()
  }, [router])

  const intactCount = theses.filter((t) => t.status === "intact").length
  const atRiskCount = theses.filter((t) => t.status === "at_risk").length
  const brokenCount = theses.filter((t) => t.status === "broken").length

  if (isLoading) {
    return (
      <main className="mx-auto min-h-screen max-w-4xl bg-[#0A0A0C] px-6 py-10">
        <div className="flex items-center justify-center pt-20">
          <span className="font-mono text-sm text-[#6B6B7B]">Loading…</span>
        </div>
      </main>
    )
  }

  return (
    <main className="mx-auto min-h-screen max-w-4xl bg-[#0A0A0C] px-6 py-10">
      <ThesisChallengeBanner events={challengeEvents} />

      <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <h1 className="font-mono text-2xl uppercase tracking-widest text-[#F0F0F0]">
          CONVICTIONS
        </h1>
        <Link
          href="/app/new"
          className="inline-flex min-h-[44px] w-full items-center justify-center rounded-full bg-[#F0F0F0] px-5 py-2 font-mono text-sm tracking-widest text-[#0A0A0C] transition-colors hover:bg-[#E8E8E8] md:w-auto"
        >
          + NEW THESIS
        </Link>
      </div>

      {theses.length > 0 ? (
        <div className="mb-8 flex flex-wrap gap-x-2 gap-y-2 font-mono text-xs tracking-widest">
          <span className="whitespace-nowrap text-[#00D1B2]">{intactCount} INTACT</span>
          <span className="text-[#2A2A32]">·</span>
          <span className="whitespace-nowrap text-[#FFB800]">{atRiskCount} AT RISK</span>
          <span className="text-[#2A2A32]">·</span>
          <span className="whitespace-nowrap text-[#FF3B30]">{brokenCount} BROKEN</span>
        </div>
      ) : null}

      {theses.length === 0 ? (
        <div className="mt-20 text-center">
          <p className="mb-4 font-mono text-4xl text-[#2A2A32]">Σ</p>
          <p className="mb-6 text-sm text-[#6B6B7B]">No convictions tracked yet.</p>
          <Link
            href="/app/new"
            className="inline-flex min-h-[44px] w-full items-center justify-center rounded-full bg-[#F0F0F0] px-5 py-2 font-mono text-sm tracking-widest text-[#0A0A0C] transition-colors hover:bg-[#E8E8E8] md:w-auto"
          >
            + ADD YOUR FIRST THESIS
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {theses.map((thesis) => {
            const statusMeta = getStatusMeta(thesis.status)

            return (
              <article
                key={thesis.id}
                className="w-full cursor-pointer rounded-xl border border-[#2A2A32] bg-[#141418] p-4 transition-colors hover:border-[#F0F0F0]/20 md:p-6"
              >
                <Link href={`/app/thesis/${thesis.id}`}>
                  <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-mono text-xl font-medium tracking-widest text-[#F0F0F0]">
                        {thesis.ticker}
                      </p>
                      <p className="mt-0.5 text-sm text-[#6B6B7B]">
                        {thesis.company_name}
                      </p>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      <span
                        className={`rounded-full px-3 py-1 font-mono text-xs tracking-widest ${statusMeta.className}`}
                      >
                        {statusMeta.label}
                      </span>
                      {thesis.latest_status_note ? (
                        <p
                          className={`max-w-[220px] text-right font-mono text-[10px] leading-relaxed ${STATUS_CHANGE_NOTE_COLOR}`}
                        >
                          NOTE: {thesis.latest_status_note}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <p className="break-words text-sm text-[#6B6B7B] md:max-w-[60%] md:truncate">
                      {thesis.thesis_statement}
                    </p>

                    <div className="flex flex-wrap items-center gap-3 md:gap-4">
                      <span className="font-mono text-xs uppercase tracking-widest text-[#6B6B7B]">
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
                </Link>

                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={() =>
                      setModalThesis({
                        id: thesis.id,
                        status: thesis.status,
                        ticker: thesis.ticker,
                      })
                    }
                    className="cursor-pointer rounded border border-[#2A2A32] px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-[#6B6B7B] transition-colors hover:border-[#F0F0F0] hover:text-[#F0F0F0]"
                  >
                    UPDATE STATUS
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      )}

      {modalThesis && (
        <UpdateStatusModal
          thesisId={modalThesis.id}
          currentStatus={modalThesis.status}
          ticker={modalThesis.ticker}
          onClose={() => setModalThesis(null)}
          onUpdated={(newStatus, newNote) => {
            setTheses((prev) =>
              prev.map((t) =>
                t.id === modalThesis.id
                  ? {
                      ...t,
                      status: newStatus,
                      latest_status_note: newNote ?? t.latest_status_note,
                      latest_status_note_status: newNote ? newStatus : t.latest_status_note_status,
                    }
                  : t,
              ),
            )
            setModalThesis(null)
          }}
        />
      )}
    </main>
  )
}

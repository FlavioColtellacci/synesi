"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import {
  ThesisChallengeBanner,
  type ThesisChallengeEvent,
} from "@/components/thesis/ThesisChallengeBanner"
import UpdateStatusModal from "@/components/thesis/UpdateStatusModal"
import { createClient } from "@/lib/supabase/client"
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

type FilterMode = "all" | "needs_review"

const STATUS_PRIORITY: Record<string, number> = {
  broken: 0,
  at_risk: 1,
  intact: 2,
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

function formatRelativeTime(dateString: string): string {
  const now = Date.now()
  const then = new Date(dateString).getTime()
  const diffMs = now - then

  const minutes = Math.floor(diffMs / 60_000)
  if (minutes < 1) return "Just now"
  if (minutes < 60) return `${minutes}m ago`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`

  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`

  return new Date(dateString).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

function sortByUrgency(theses: DashboardThesis[]): DashboardThesis[] {
  return [...theses].sort((a, b) => {
    const priorityA = STATUS_PRIORITY[a.status] ?? 2
    const priorityB = STATUS_PRIORITY[b.status] ?? 2
    if (priorityA !== priorityB) return priorityA - priorityB
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  })
}

const STATUS_CHANGE_NOTE_COLOR = "text-[#FFB800]"

export default function Page() {
  const router = useRouter()
  const [theses, setTheses] = useState<DashboardThesis[]>([])
  const [challengeEvents, setChallengeEvents] = useState<ThesisChallengeEvent[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [modalThesis, setModalThesis] = useState<ModalThesis | null>(null)
  const [filter, setFilter] = useState<FilterMode>("all")

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()

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
  const needsReviewCount = atRiskCount + brokenCount

  const filteredTheses =
    filter === "needs_review"
      ? theses.filter((t) => t.status === "at_risk" || t.status === "broken")
      : theses

  const sortedTheses = sortByUrgency(filteredTheses)

  if (isLoading) {
    return (
      <main className="mx-auto min-h-screen max-w-4xl bg-[#0A0A0C] px-4 py-6 md:px-6 md:py-10">
        <div className="flex items-center justify-center pt-20">
          <span className="font-mono text-sm text-[#6B6B7B]">Loading…</span>
        </div>
      </main>
    )
  }

  return (
    <main className="mx-auto min-h-screen max-w-4xl bg-[#0A0A0C] px-4 py-6 md:px-6 md:py-10">
      {/* ── Header ── */}
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <h1 className="font-mono text-2xl uppercase tracking-widest text-[#F0F0F0]">
          My Convictions
        </h1>
        <Link
          href="/app/new"
          className="inline-flex min-h-[44px] w-full items-center justify-center rounded-full bg-[#F0F0F0] px-5 py-2 font-mono text-sm tracking-widest text-[#0A0A0C] transition-colors hover:bg-[#E8E8E8] md:w-auto"
        >
          + NEW THESIS
        </Link>
      </div>

      {/* ── KPI Strip ── */}
      {theses.length > 0 && (
        <div className="mb-6 grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-[#2A2A32] bg-[#141418] px-4 py-4">
            <p className="font-mono text-[10px] uppercase tracking-widest text-[#6B6B7B]">
              Total
            </p>
            <p className="mt-1 font-mono text-2xl font-medium text-[#F0F0F0]">
              {theses.length}
            </p>
          </div>
          <div className="rounded-xl border border-[#2A2A32] bg-[#141418] px-4 py-4">
            <p className="font-mono text-[10px] uppercase tracking-widest text-[#FFB800]">
              At Risk
            </p>
            <p className="mt-1 font-mono text-2xl font-medium text-[#FFB800]">
              {atRiskCount}
            </p>
          </div>
          <div className="rounded-xl border border-[#2A2A32] bg-[#141418] px-4 py-4">
            <p className="font-mono text-[10px] uppercase tracking-widest text-[#FF3B30]">
              Broken
            </p>
            <p className="mt-1 font-mono text-2xl font-medium text-[#FF3B30]">
              {brokenCount}
            </p>
          </div>
        </div>
      )}

      {/* ── Thesis Challenge Banner ── */}
      <ThesisChallengeBanner events={challengeEvents} />

      {/* ── Filter Toggle ── */}
      {theses.length > 0 && (
        <div className="mb-5 flex items-center gap-1 rounded-lg border border-[#2A2A32] bg-[#141418] p-1 self-start w-fit">
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={`rounded-md px-3 py-1.5 font-mono text-xs tracking-widest transition-colors ${
              filter === "all"
                ? "bg-[#F0F0F0] text-[#0A0A0C]"
                : "text-[#6B6B7B] hover:text-[#F0F0F0]"
            }`}
          >
            ALL
          </button>
          <button
            type="button"
            onClick={() => setFilter("needs_review")}
            className={`rounded-md px-3 py-1.5 font-mono text-xs tracking-widest transition-colors ${
              filter === "needs_review"
                ? "bg-[#F0F0F0] text-[#0A0A0C]"
                : "text-[#6B6B7B] hover:text-[#F0F0F0]"
            }`}
          >
            NEEDS REVIEW{needsReviewCount > 0 ? ` (${needsReviewCount})` : ""}
          </button>
        </div>
      )}

      {/* ── Empty State ── */}
      {theses.length === 0 ? (
        <div className="mt-20 text-center">
          <p className="mb-4 font-mono text-4xl text-[#2A2A32]">Σ</p>
          <p className="mb-2 font-mono text-sm text-[#F0F0F0]">No convictions yet</p>
          <p className="mb-6 text-sm text-[#6B6B7B]">
            Start with one thesis and track whether it still holds.
          </p>
          <Link
            href="/app/new"
            className="inline-flex min-h-[44px] w-full items-center justify-center rounded-full bg-[#F0F0F0] px-5 py-2 font-mono text-sm tracking-widest text-[#0A0A0C] transition-colors hover:bg-[#E8E8E8] md:w-auto"
          >
            + ADD YOUR FIRST THESIS
          </Link>
        </div>
      ) : sortedTheses.length === 0 ? (
        <div className="mt-16 text-center">
          <p className="text-sm text-[#6B6B7B]">
            No convictions need review right now.
          </p>
          <button
            type="button"
            onClick={() => setFilter("all")}
            className="mt-3 font-mono text-xs tracking-widest text-[#F0F0F0] underline underline-offset-4 transition-colors hover:text-[#E8E8E8]"
          >
            SHOW ALL
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {sortedTheses.map((thesis) => {
            const statusMeta = getStatusMeta(thesis.status)

            return (
              <article
                key={thesis.id}
                className="w-full rounded-xl border border-[#2A2A32] bg-[#141418] p-4 transition-colors hover:border-[#F0F0F0]/20 md:p-5"
              >
                {/* Row 1: Ticker/Company + Status */}
                <Link href={`/app/thesis/${thesis.id}`} className="block">
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono text-lg font-medium tracking-widest text-[#F0F0F0]">
                        {thesis.ticker}
                      </p>
                      <p className="mt-0.5 truncate text-sm text-[#6B6B7B]">
                        {thesis.company_name}
                      </p>
                    </div>

                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <span
                        className={`rounded-full px-3 py-1 font-mono text-xs tracking-widest ${statusMeta.className}`}
                      >
                        {statusMeta.label}
                      </span>
                      {thesis.latest_status_note ? (
                        <p
                          className={`mt-1 max-w-[200px] text-right font-mono text-[10px] leading-relaxed ${STATUS_CHANGE_NOTE_COLOR}`}
                        >
                          {thesis.latest_status_note}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  {/* Row 2: Thesis snippet */}
                  <p className="mb-3 line-clamp-2 text-sm leading-relaxed text-[#6B6B7B]">
                    {thesis.thesis_statement}
                  </p>
                </Link>

                {/* Row 3: Confidence + Updated + Action */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#2A2A32] pt-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="font-mono text-xs uppercase tracking-widest text-[#6B6B7B]">
                      {thesis.confidence_level}
                    </span>
                    <span className="text-xs text-[#6B6B7B]">
                      Updated {formatRelativeTime(thesis.updated_at)}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setModalThesis({
                        id: thesis.id,
                        status: thesis.status,
                        ticker: thesis.ticker,
                      })
                    }
                    className="min-h-[36px] cursor-pointer rounded-lg border border-[#2A2A32] px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-[#6B6B7B] transition-colors hover:border-[#F0F0F0] hover:text-[#F0F0F0]"
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

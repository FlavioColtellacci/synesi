"use client"

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import type { LucideIcon } from "lucide-react"
import {
  Bell,
  BookOpen,
  ChevronRight,
  LayoutDashboard,
  Plus,
  Settings,
  Sigma,
} from "lucide-react"
import {
  ThesisChallengeBanner,
  type ThesisChallengeEvent,
} from "@/components/thesis/ThesisChallengeBanner"
import { DashboardDeleteThesis } from "@/components/thesis/DashboardDeleteThesis"
import UpdateStatusModal from "@/components/thesis/UpdateStatusModal"
import { parseSigmaMonitorSignalForUi } from "@/lib/chat/monitor-logic"
import { createClient } from "@/lib/supabase/client"

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

type MonitorActionDraft = {
  actionType: "open_thesis" | "filter_needs_review" | "open_alerts_panel" | "draft_alert_rule_update"
  label: string
  rationale: string
  thesisId?: string
}

type MonitorSummary = {
  headline: string
  summary: string
  riskLevel: "stable" | "watch" | "critical"
  highSignalChanges: string[]
  recommendedActions: MonitorActionDraft[]
  evidenceSnippets: string[]
}

type MonitorSnapshot = {
  id: string
  runKey: string
  triggerSource: "manual" | "cron"
  status: "running" | "success" | "failed"
  summary: MonitorSummary | null
  completedAt: string | null
  createdAt: string
}

type SidebarItem = {
  key: string
  label: string
  icon: LucideIcon
  badge?: number
}

const STATUS_PRIORITY: Record<string, number> = {
  broken: 0,
  at_risk: 1,
  intact: 2,
}

const STATUS_CHANGE_NOTE_COLOR = "text-[#FFB800]"

const SIDEBAR_ITEMS: SidebarItem[] = [
  { key: "dashboard", label: "DASHBOARD", icon: LayoutDashboard },
  { key: "theses", label: "THESES", icon: BookOpen },
  { key: "alerts", label: "ALERTS", icon: Bell },
  { key: "sigma", label: "SIGMA", icon: Sigma },
  { key: "settings", label: "SETTINGS", icon: Settings },
]

function SigmaMonitorSignalItem({ raw }: { raw: string }) {
  const p = parseSigmaMonitorSignalForUi(raw)
  const metaLine = [p.source, p.detail].filter(Boolean).join(" · ")
  const detailOnly = Boolean(p.detail && !p.kindLabel && !p.title && !p.source)

  if (p.fallbackText && !p.kindLabel && !p.title && !p.detail && !p.source) {
    return (
      <p className="text-sm leading-relaxed text-[#D9D9E2]">{p.fallbackText}</p>
    )
  }

  if (p.kindLabel && p.fallbackText && !p.title && !metaLine) {
    return (
      <div className="space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-[#8BE8D8]">{p.kindLabel}</p>
        <p className="text-sm leading-relaxed text-[#D9D9E2]">{p.fallbackText}</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {p.kindLabel ? (
        <p className="text-[10px] font-semibold uppercase tracking-wider text-[#8BE8D8]">{p.kindLabel}</p>
      ) : null}
      {p.title ? (
        <p className="text-sm font-medium leading-snug text-[#F0F0F0]">{p.title}</p>
      ) : null}
      {detailOnly ? (
        <p className="text-sm leading-relaxed text-[#D9D9E2]">{p.detail}</p>
      ) : metaLine ? (
        <p className="text-xs leading-relaxed text-[#6B6B7B]">{metaLine}</p>
      ) : null}
    </div>
  )
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

function statusBadgeStyles(status: string): { label: string; className: string } {
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

function getRiskClassName(riskLevel: MonitorSummary["riskLevel"] | undefined): string {
  if (riskLevel === "critical") return "border-[#FF3B30]/40 bg-[#FF3B30]/5 text-[#FF3B30]"
  if (riskLevel === "watch") return "border-[#FFB800]/40 bg-[#FFB800]/5 text-[#FFB800]"
  return "border-[#00D1B2]/40 bg-[#00D1B2]/5 text-[#00D1B2]"
}

function MetricCard({
  label,
  value,
  accentClassName,
  helper,
}: {
  label: string
  value: number
  accentClassName?: string
  helper: string
}) {
  return (
    <div className="rounded-xl border border-[#2A2A32] bg-[#141418] px-4 py-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#6B6B7B]">{label}</p>
      <p className={`mt-2 font-mono text-3xl leading-none ${accentClassName ?? "text-[#F0F0F0]"}`}>{value}</p>
      <p className="mt-2 font-mono text-[10px] uppercase tracking-wider text-[#6B6B7B]">{helper}</p>
    </div>
  )
}

export default function Page() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [theses, setTheses] = useState<DashboardThesis[]>([])
  const [challengeEvents, setChallengeEvents] = useState<ThesisChallengeEvent[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshingMonitor, setIsRefreshingMonitor] = useState(false)
  const [monitorSnapshot, setMonitorSnapshot] = useState<MonitorSnapshot | null>(null)
  const [modalThesis, setModalThesis] = useState<ModalThesis | null>(null)
  const [filter, setFilter] = useState<FilterMode>("all")
  const [isAlertsPanelOpen, setIsAlertsPanelOpen] = useState(false)
  const [activeNav, setActiveNav] = useState("dashboard")

  useEffect(() => {
    if (searchParams.get("filter") === "needs_review") {
      setFilter("needs_review")
    }
    if (searchParams.get("panel") === "alerts") {
      setIsAlertsPanelOpen(true)
    }
  }, [searchParams])

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

      const [thesesResult, eventsResult, updatesResult, monitorResult] = await Promise.all([
        supabase
          .from("theses")
          .select(
            "id, ticker, company_name, status, confidence_level, created_at, updated_at, thesis_statement",
          )
          .eq("user_id", user.id)
          .order("updated_at", { ascending: false }),
        supabase
          .from("events")
          .select("id, thesis_id, event_detail, created_at")
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
        fetch("/api/chat/monitor", { method: "GET" })
          .then((response) => response.json())
          .catch(() => ({ monitor: null })),
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
          createdAt: e.created_at ?? null,
        })),
      )

      if (monitorResult && typeof monitorResult === "object" && "monitor" in monitorResult && monitorResult.monitor) {
        setMonitorSnapshot(monitorResult.monitor as MonitorSnapshot)
      }

      setIsLoading(false)
    }

    void load()
  }, [router])

  const atRiskCount = theses.filter((t) => t.status === "at_risk").length
  const brokenCount = theses.filter((t) => t.status === "broken").length
  const needsReviewCount = atRiskCount + brokenCount

  const filteredTheses =
    filter === "needs_review"
      ? theses.filter((t) => t.status === "at_risk" || t.status === "broken")
      : theses

  const sortedTheses = useMemo(() => sortByUrgency(filteredTheses), [filteredTheses])
  const monitorSignalCount = monitorSnapshot?.summary?.highSignalChanges.length ?? 0
  const riskClassName = getRiskClassName(monitorSnapshot?.summary?.riskLevel)
  const todayLabel = useMemo(
    () =>
      new Date().toLocaleDateString("en-US", {
        month: "short",
        day: "2-digit",
        year: "numeric",
      }),
    [],
  )

  function resolveMonitorActionHref(action: MonitorActionDraft): string {
    if (action.actionType === "filter_needs_review") return "/app/convictions?filter=needs_review"
    if (action.actionType === "open_alerts_panel") return "/app/convictions?panel=alerts"
    if ((action.actionType === "open_thesis" || action.actionType === "draft_alert_rule_update") && action.thesisId) {
      return `/app/thesis/${action.thesisId}`
    }
    return "/app/convictions"
  }

  async function refreshMonitorNow() {
    if (isRefreshingMonitor) return
    setIsRefreshingMonitor(true)
    try {
      const response = await fetch("/api/chat/monitor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force: true }),
      })
      const payload = (await response.json()) as { monitor?: MonitorSnapshot }
      if (payload.monitor) {
        setMonitorSnapshot(payload.monitor)
      }
    } finally {
      setIsRefreshingMonitor(false)
    }
  }

  if (isLoading) {
    return (
      <main className="w-full min-h-[calc(100vh-6rem)] bg-[#0A0A0C] md:min-h-[calc(100vh-4rem)]">
        <div className="flex items-center justify-center pt-28">
          <span className="font-mono text-sm text-[#6B6B7B]">Loading dashboard...</span>
        </div>
      </main>
    )
  }

  return (
    <main className="w-full bg-[#0A0A0C]">
      <section className="flex h-[calc(100vh-6rem)] min-h-[640px] w-full overflow-hidden border-y border-[#2A2A32] bg-[#0A0A0C] md:h-[calc(100vh-4rem)]">
        <aside className="hidden w-56 shrink-0 border-r border-[#2A2A32] bg-[#141418] lg:flex lg:flex-col">
          <nav className="flex-1 space-y-1 px-3 py-5">
            {SIDEBAR_ITEMS.map((item) => {
              const isActive = activeNav === item.key
              const Icon = item.icon
              const badge = item.key === "alerts" ? challengeEvents.length : item.badge

              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => {
                    setActiveNav(item.key)
                    if (item.key === "theses") {
                      router.push("/app/convictions")
                    }
                    if (item.key === "alerts") {
                      setIsAlertsPanelOpen((current) => !current)
                    }
                    if (item.key === "sigma") {
                      router.push("/app/sigma")
                    }
                    if (item.key === "settings") {
                      router.push("/app/account")
                    }
                  }}
                  className={`flex w-full items-center gap-2.5 rounded-md border px-3 py-2.5 text-left font-mono text-[11px] tracking-[0.14em] transition-colors ${
                    isActive
                      ? "border-[#2A2A32] bg-[#1C1C22] text-[#F0F0F0]"
                      : "border-transparent text-[#6B6B7B] hover:border-[#2A2A32] hover:bg-[#1C1C22] hover:text-[#F0F0F0]"
                  }`}
                >
                  <Icon size={14} />
                  <span>{item.label}</span>
                  {badge && badge > 0 ? (
                    <span className="ml-auto rounded-full bg-[#FFB800] px-1.5 py-0.5 font-mono text-[9px] font-semibold text-[#0A0A0C]">
                      {badge}
                    </span>
                  ) : null}
                </button>
              )
            })}
          </nav>
        </aside>

        <div className="flex min-w-0 flex-1 border-r border-[#2A2A32] bg-[#0A0A0C]">
          <div className="sigma-scrollbar flex min-w-0 flex-1 flex-col overflow-y-auto px-4 py-5 md:px-6 lg:px-7">
            <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="font-mono text-[13px] uppercase tracking-[0.14em] text-[#F0F0F0]">Dashboard</h1>
                <p className="mt-1 font-mono text-[11px] text-[#6B6B7B]">{todayLabel}</p>
              </div>
              <Link
                href="/app/new"
                className="inline-flex min-h-[38px] items-center gap-2 rounded-full bg-[#F0F0F0] px-4 font-mono text-[11px] uppercase tracking-[0.1em] text-[#0A0A0C] transition-colors hover:bg-[#E8E8E8]"
              >
                <Plus size={12} />
                NEW THESIS
              </Link>
            </header>

            <section className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <MetricCard label="Active Theses" value={theses.length} helper="tracked convictions" />
              <MetricCard
                label="Unresolved Alerts"
                value={challengeEvents.length}
                accentClassName="text-[#FFB800]"
                helper="needs review"
              />
              <MetricCard label="Broken" value={brokenCount} accentClassName="text-[#FF3B30]" helper="critical drift" />
            </section>

            <section className="mb-5 rounded-xl border border-[#2A2A32] bg-[#141418] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#00D1B2]">SIGMA MONITOR</p>
                  <p className="mt-1 break-words text-sm text-[#F0F0F0]">
                    {monitorSnapshot?.summary?.headline ?? "No monitor summary yet. Run Sigma Monitor to generate one."}
                  </p>
                  <p className="mt-1 break-words text-xs text-[#6B6B7B]">
                    {monitorSnapshot?.summary?.summary ??
                      "Sigma Monitor highlights high-signal conviction drift and suggests next actions."}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    void refreshMonitorNow()
                  }}
                  disabled={isRefreshingMonitor}
                  className="min-h-[34px] rounded-md border border-[#2A2A32] px-3 font-mono text-[10px] uppercase tracking-[0.1em] text-[#6B6B7B] transition-colors hover:border-[#F0F0F0]/40 hover:text-[#F0F0F0] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isRefreshingMonitor ? "RUNNING..." : "RUN NOW"}
                </button>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setIsAlertsPanelOpen((current) => !current)}
                  className="inline-flex items-center gap-1 rounded-full border border-[#2A2A32] bg-[#101018] px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-[#D9D9E2] transition-colors hover:border-[#F0F0F0]/35"
                >
                  Alerts
                  <span className="rounded-full bg-[#FFB800] px-1.5 py-0.5 text-[9px] text-[#0A0A0C]">
                    {challengeEvents.length}
                  </span>
                </button>
                {monitorSnapshot?.summary?.recommendedActions.slice(0, 2).map((action, index) => (
                  <Link
                    key={`${action.actionType}-${index}`}
                    href={resolveMonitorActionHref(action)}
                    className="inline-flex items-center gap-1 rounded-full border border-[#2A2A32] bg-[#101018] px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-[#D9D9E2] transition-colors hover:border-[#F0F0F0]/35"
                    title={action.rationale}
                  >
                    {action.label}
                    <ChevronRight size={11} />
                  </Link>
                ))}
              </div>
            </section>

            {isAlertsPanelOpen ? (
              <section className="mb-5">
                {challengeEvents.length > 0 ? (
                  <ThesisChallengeBanner events={challengeEvents} title="Open Alerts" />
                ) : (
                  <div className="rounded-xl border border-[#2A2A32] bg-[#141418] px-4 py-4">
                    <p className="font-mono text-[10px] uppercase tracking-widest text-[#6B6B7B]">Open Alerts (0)</p>
                    <p className="mt-2 text-sm text-[#6B6B7B]">No active alerts right now.</p>
                  </div>
                )}
              </section>
            ) : null}

            <section className="mb-3 flex items-center justify-between">
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#6B6B7B]">THESES</p>
              <div className="inline-flex rounded-md border border-[#2A2A32] bg-[#141418] p-1">
                <button
                  type="button"
                  onClick={() => setFilter("all")}
                  className={`rounded px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.1em] transition-colors ${
                    filter === "all" ? "bg-[#1C1C22] text-[#F0F0F0]" : "text-[#6B6B7B] hover:text-[#F0F0F0]"
                  }`}
                >
                  ALL
                </button>
                <button
                  type="button"
                  onClick={() => setFilter("needs_review")}
                  className={`rounded px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.1em] transition-colors ${
                    filter === "needs_review"
                      ? "bg-[#1C1C22] text-[#F0F0F0]"
                      : "text-[#6B6B7B] hover:text-[#F0F0F0]"
                  }`}
                >
                  NEEDS REVIEW{needsReviewCount > 0 ? ` (${needsReviewCount})` : ""}
                </button>
              </div>
            </section>

            {theses.length === 0 ? (
              <div className="mt-16 text-center">
                <p className="mb-4 font-mono text-4xl text-[#2A2A32]">Σ</p>
                <p className="mb-2 font-mono text-sm text-[#F0F0F0]">No convictions yet</p>
                <p className="mb-6 text-sm text-[#6B6B7B]">Start with one thesis and track whether it still holds.</p>
                <Link
                  href="/app/new"
                  className="inline-flex min-h-[42px] items-center justify-center rounded-full bg-[#F0F0F0] px-5 font-mono text-xs tracking-widest text-[#0A0A0C] transition-colors hover:bg-[#E8E8E8]"
                >
                  + ADD YOUR FIRST THESIS
                </Link>
              </div>
            ) : sortedTheses.length === 0 ? (
              <div className="mt-16 text-center">
                <p className="text-sm text-[#6B6B7B]">No convictions need review right now.</p>
                <button
                  type="button"
                  onClick={() => setFilter("all")}
                  className="mt-3 font-mono text-xs tracking-widest text-[#F0F0F0] underline underline-offset-4 transition-colors hover:text-[#E8E8E8]"
                >
                  SHOW ALL
                </button>
              </div>
            ) : (
              <div className="space-y-3 pb-1">
                {sortedTheses.map((thesis) => {
                  const statusMeta = statusBadgeStyles(thesis.status)

                  return (
                    <article
                      key={thesis.id}
                      className="rounded-xl border border-[#2A2A32] bg-[#141418] p-4 transition-colors hover:border-[#F0F0F0]/20"
                    >
                      <Link href={`/app/thesis/${thesis.id}`} className="block">
                        <div className="mb-2 flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-mono text-lg tracking-[0.12em] text-[#F0F0F0]">{thesis.ticker}</p>
                            <p className="mt-0.5 truncate text-sm text-[#6B6B7B]">{thesis.company_name}</p>
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-2">
                            <span className={`rounded-full px-3 py-1 font-mono text-[10px] tracking-wider ${statusMeta.className}`}>
                              {statusMeta.label}
                            </span>
                            {thesis.latest_status_note ? (
                              <p
                                className={`mt-1 max-w-[220px] text-right font-mono text-[10px] leading-relaxed ${STATUS_CHANGE_NOTE_COLOR}`}
                              >
                                {thesis.latest_status_note}
                              </p>
                            ) : null}
                          </div>
                        </div>
                        <p className="mb-3 line-clamp-2 text-sm leading-relaxed text-[#6B6B7B]">{thesis.thesis_statement}</p>
                      </Link>

                      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#2A2A32] pt-3">
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="font-mono text-xs uppercase tracking-widest text-[#6B6B7B]">
                            {thesis.confidence_level}
                          </span>
                          <span className="text-xs text-[#6B6B7B]">Updated {formatRelativeTime(thesis.updated_at)}</span>
                        </div>

                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <DashboardDeleteThesis
                            thesisId={thesis.id}
                            ticker={thesis.ticker}
                            companyName={thesis.company_name}
                            onDeleted={() => {
                              setTheses((prev) => prev.filter((t) => t.id !== thesis.id))
                              setChallengeEvents((prev) => prev.filter((e) => e.thesisId !== thesis.id))
                              setModalThesis((current) => (current?.id === thesis.id ? null : current))
                            }}
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setModalThesis({
                                id: thesis.id,
                                status: thesis.status,
                                ticker: thesis.ticker,
                              })
                            }
                            className="min-h-[34px] cursor-pointer rounded-md border border-[#2A2A32] px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-[#6B6B7B] transition-colors hover:border-[#F0F0F0] hover:text-[#F0F0F0]"
                          >
                            UPDATE STATUS
                          </button>
                        </div>
                      </div>
                    </article>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        <aside
          id="sigma-panel-column"
          className="sigma-obsidian-scrollbar hidden w-[360px] shrink-0 flex-col overflow-y-auto bg-[#050505] xl:flex"
        >
          <div className="flex min-h-[58px] items-center justify-between border-b border-[#1f1f1f] px-4 py-2">
            <div className="flex items-center gap-2.5">
              <span
                aria-hidden="true"
                className="synesi-sigma-mark text-[17px] leading-none text-[#e5e2e1]"
              >
                Σ
              </span>
              <span className="font-mono text-[11px] leading-none uppercase tracking-[0.12em] text-[#e5e2e1]">SIGMA</span>
              <span className="rounded border border-[#2a2a2a] bg-[#141414] px-1.5 py-0.5 font-mono text-[9px] leading-none text-[#555]">
                1.0
              </span>
            </div>
            <Link
              href="/app/sigma"
              className="inline-flex h-7 items-center rounded border border-[#2a2a2a] px-2.5 font-mono text-[9px] leading-none uppercase tracking-widest text-[#888] transition-colors hover:text-[#e5e2e1]"
            >
              OPEN
            </Link>
          </div>

          <div className="space-y-5 px-4 py-5">
            <div className="rounded-xl border border-[#202020] bg-[#0f0f0f] p-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-[#555]">THREAD</p>
              <p className="mt-1 text-sm leading-relaxed text-[#e5e2e1]">
                {monitorSnapshot?.summary?.headline ?? "Conviction monitor thread"}
              </p>
              <div className="mt-3 inline-flex rounded-full border px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.1em]">
                <span className={riskClassName}>Risk {monitorSnapshot?.summary?.riskLevel ?? "stable"}</span>
              </div>
            </div>

            <div className="rounded-xl border border-[#202020] bg-[#0f0f0f] p-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-[#555]">SIGMA VIEW</p>
              <p className="mt-2 text-sm leading-7 text-[#d0cec8]">
                {monitorSnapshot?.summary?.summary ??
                  "Run Sigma Monitor to see high-signal changes, trusted source evidence, and recommended actions."}
              </p>
            </div>

            {monitorSignalCount > 0 ? (
              <div className="space-y-3">
                {monitorSnapshot?.summary?.highSignalChanges.slice(0, 4).map((item, index) => (
                  <div key={`${index}-${item}`} className="rounded-xl border border-[#202020] bg-[#0f0f0f] p-3.5">
                    <SigmaMonitorSignalItem raw={item} />
                  </div>
                ))}
              </div>
            ) : null}

            {(monitorSnapshot?.summary?.recommendedActions.length ?? 0) > 0 ? (
              <div className="rounded-xl border border-[#202020] bg-[#0f0f0f] p-3">
                <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.1em] text-[#555]">Recommended</p>
                <div className="space-y-2">
                  {monitorSnapshot?.summary?.recommendedActions.map((action, index) => (
                    <Link
                      key={`${action.actionType}-${index}`}
                      href={resolveMonitorActionHref(action)}
                      title={action.rationale}
                      className="flex items-center justify-between rounded-lg border border-[#2a2a2a] px-2.5 py-2 text-xs text-[#e5e2e1] transition-colors hover:border-[#555]"
                    >
                      <span>{action.label}</span>
                      <ChevronRight size={13} />
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </aside>
      </section>

      {modalThesis ? (
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
      ) : null}
    </main>
  )
}

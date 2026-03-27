"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"

export type ThesisChallengeEvent = {
  id: string
  thesisId: string
  eventDetail: string
  createdAt: string | null
}

type Props = {
  events: ThesisChallengeEvent[]
  title?: string
}

type SortMode = "newest" | "oldest"

type ParsedEventDetail = {
  source: string
  headline: string
  reason: string
  articleUrl: string | null
}

function truncate(text: string, maxLength: number) {
  if (text.length <= maxLength) return text
  return `${text.slice(0, maxLength - 1)}...`
}

function parseEventDetail(raw: string): ParsedEventDetail {
  const parts = raw.includes(" — ") ? raw.split(" — ") : raw.split(" - ")
  const [sourcePart, titlePart, reasonPart, urlPart] = parts

  const source = sourcePart?.trim() || "Trusted source"
  const headline = (titlePart?.trim() || raw).replace(/^"|"$/g, "")
  const reason = reasonPart?.trim() || "Potential thesis challenge detected."
  const articleUrl = urlPart?.trim() || null

  return { source, headline, reason, articleUrl }
}

function getHostname(url: string | null) {
  if (!url) return null
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return null
  }
}

function formatReceivedAt(createdAt: string | null) {
  if (!createdAt) return "Received recently"

  const timestamp = new Date(createdAt).getTime()
  if (Number.isNaN(timestamp)) return "Received recently"

  const diffMs = Date.now() - timestamp
  const minutes = Math.floor(diffMs / 60_000)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  let relative = "just now"
  if (minutes >= 1 && minutes < 60) relative = `${minutes}m ago`
  else if (hours >= 1 && hours < 24) relative = `${hours}h ago`
  else if (days >= 1) relative = `${days}d ago`

  const absolute = new Date(createdAt).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })

  return `Received ${relative} • ${absolute}`
}

export function ThesisChallengeBanner({ events, title = "Alerts" }: Props) {
  const [visibleEvents, setVisibleEvents] = useState<ThesisChallengeEvent[]>(events)
  const [collapsedEventIds, setCollapsedEventIds] = useState<Set<string>>(new Set())
  const [sortMode, setSortMode] = useState<SortMode>("newest")

  useEffect(() => {
    setVisibleEvents(events)
  }, [events])

  useEffect(() => {
    setCollapsedEventIds(new Set(events.map((event) => event.id)))
  }, [events])

  const collapsedCount = useMemo(
    () => visibleEvents.filter((event) => collapsedEventIds.has(event.id)).length,
    [collapsedEventIds, visibleEvents],
  )

  const sortedEvents = useMemo(() => {
    const getTimestamp = (createdAt: string | null) => {
      if (!createdAt) return 0
      const value = new Date(createdAt).getTime()
      return Number.isNaN(value) ? 0 : value
    }

    const next = [...visibleEvents]
    next.sort((a, b) => {
      const aTs = getTimestamp(a.createdAt)
      const bTs = getTimestamp(b.createdAt)
      return sortMode === "newest" ? bTs - aTs : aTs - bTs
    })
    return next
  }, [sortMode, visibleEvents])

  const handleDismiss = (eventId: string) => {
    setVisibleEvents((current) => current.filter((event) => event.id !== eventId))
    void fetch(`/api/events/${eventId}/dismiss`, {
      method: "PATCH",
    })
  }

  const toggleEvent = (eventId: string) => {
    setCollapsedEventIds((current) => {
      const next = new Set(current)
      if (next.has(eventId)) next.delete(eventId)
      else next.add(eventId)
      return next
    })
  }

  const collapseAll = () => {
    setCollapsedEventIds(new Set(visibleEvents.map((event) => event.id)))
  }

  const expandAll = () => {
    setCollapsedEventIds(new Set())
  }

  if (visibleEvents.length === 0) {
    return null
  }

  return (
    <>
      <style>{`
        @keyframes thesis-challenge-slide-in {
          from {
            transform: translateY(-12px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        .thesis-challenge-enter {
          animation: thesis-challenge-slide-in 300ms ease-out;
        }
      `}</style>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-[#6B6B7B]">
              {title} ({visibleEvents.length}){collapsedCount > 0 ? ` • ${collapsedCount} collapsed` : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSortMode((current) => (current === "newest" ? "oldest" : "newest"))}
              className="rounded border border-[#2A2A32] px-2 py-1 font-mono text-[10px] tracking-widest text-[#6B6B7B] transition-colors hover:text-[#F0F0F0]"
            >
              SORT: {sortMode === "newest" ? "NEWEST" : "OLDEST"}
            </button>
            <button
              type="button"
              onClick={expandAll}
              className="rounded border border-[#2A2A32] px-2 py-1 font-mono text-[10px] tracking-widest text-[#6B6B7B] transition-colors hover:text-[#F0F0F0]"
            >
              EXPAND ALL
            </button>
            <button
              type="button"
              onClick={collapseAll}
              className="rounded border border-[#2A2A32] px-2 py-1 font-mono text-[10px] tracking-widest text-[#6B6B7B] transition-colors hover:text-[#F0F0F0]"
            >
              COLLAPSE ALL
            </button>
          </div>
        </div>
        {sortedEvents.map((event) => (
          (() => {
            const parsed = parseEventDetail(event.eventDetail)
            const hostname = getHostname(parsed.articleUrl)
            const isCollapsed = collapsedEventIds.has(event.id)

            return (
              <div
                key={event.id}
                className="thesis-challenge-enter relative w-full rounded-xl border border-[#2A2A32] border-l-4 border-l-[#FFB800] bg-[#141418] px-5 py-4 mb-3"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span aria-hidden>⚡</span>
                      <span className="font-mono font-bold text-xs tracking-widest uppercase text-[#FFB800]">
                        THESIS CHALLENGE
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleEvent(event.id)}
                        className="ml-2 rounded border border-[#2A2A32] px-2 py-0.5 font-mono text-[10px] tracking-widest text-[#6B6B7B] transition-colors hover:text-[#F0F0F0]"
                      >
                        {isCollapsed ? "EXPAND" : "COLLAPSE"}
                      </button>
                    </div>

                    <p className="mt-2 font-mono text-[10px] tracking-widest uppercase text-[#6B6B7B]">
                      {formatReceivedAt(event.createdAt)}
                    </p>

                    <p className="mt-1 font-mono text-[10px] tracking-widest uppercase text-[#6B6B7B]">
                      Source: {truncate(parsed.source, 80)}
                    </p>

                    <p className="mt-1 text-sm leading-relaxed text-[#F0F0F0]">
                      {truncate(parsed.headline, 180)}
                    </p>

                    {!isCollapsed ? (
                      <>
                        <p className="mt-2 text-xs text-[#A0A0AE]">{parsed.reason}</p>

                        {parsed.articleUrl ? (
                          <a
                            href={parsed.articleUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-2 inline-block text-xs text-[#8AA8FF] hover:text-[#B9CBFF]"
                          >
                            Open source article
                            {hostname ? ` (${hostname})` : ""}
                          </a>
                        ) : null}
                      </>
                    ) : null}
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <Link
                      href={`/app/thesis/${event.thesisId}`}
                      className="text-xs font-medium bg-white text-black px-3 py-1.5 rounded-lg hover:bg-[#E8E8E8] transition-colors"
                    >
                      REVIEW NOW
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleDismiss(event.id)}
                      className="text-xs text-[#6B6B7B] hover:text-[#F0F0F0] transition-colors"
                    >
                      DISMISS
                    </button>
                  </div>
                </div>
              </div>
            )
          })()
        ))}
      </div>
    </>
  )
}

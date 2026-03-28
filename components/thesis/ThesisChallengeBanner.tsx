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
  sectionCollapsible?: boolean
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

const LEGACY_EVENT_SEP = ` \u2014 `

function parseEventDetail(raw: string): ParsedEventDetail {
  const parts = raw.includes(" | ")
    ? raw.split(" | ")
    : raw.includes(LEGACY_EVENT_SEP)
      ? raw.split(LEGACY_EVENT_SEP)
      : raw.split(" - ")
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

export function ThesisChallengeBanner({
  events,
  title = "Alerts",
  sectionCollapsible = false,
}: Props) {
  const [visibleEvents, setVisibleEvents] = useState<ThesisChallengeEvent[]>(events)
  const [sortMode, setSortMode] = useState<SortMode>("newest")
  // Conviction page: start collapsed so the thesis body is visible first; dashboard: always show list.
  const [isListVisible, setIsListVisible] = useState(() => !sectionCollapsible)

  useEffect(() => {
    setVisibleEvents(events)
  }, [events])

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
        <div className="mb-3">
          <div className="inline-flex flex-wrap items-center gap-2">
            <p className="font-mono text-[10px] uppercase tracking-widest text-[#FFB800]">
              {title} ({visibleEvents.length})
            </p>
            <div className="flex items-center gap-2">
              {sectionCollapsible ? (
                <button
                  type="button"
                  onClick={() => setIsListVisible((current) => !current)}
                  className="rounded border border-[#2A2A32] px-2 py-1 font-mono text-[10px] tracking-widest text-[#6B6B7B] transition-colors hover:text-[#F0F0F0]"
                >
                  {isListVisible ? "- COLLAPSE" : "+ EXPAND"}
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setSortMode((current) => (current === "newest" ? "oldest" : "newest"))}
                className="rounded border border-[#2A2A32] px-2 py-1 font-mono text-[10px] tracking-widest text-[#6B6B7B] transition-colors hover:text-[#F0F0F0]"
              >
                SORT: {sortMode === "newest" ? "NEWEST" : "OLDEST"}
              </button>
            </div>
          </div>
        </div>
        {isListVisible
          ? sortedEvents.map((event) => {
              const parsed = parseEventDetail(event.eventDetail)
              const hostname = getHostname(parsed.articleUrl)

              return (
                <div
                  key={event.id}
                  className="thesis-challenge-enter relative mb-3 w-full rounded-xl border border-[#2A2A32] border-l-4 border-l-[#FFB800] bg-[#141418] px-5 py-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span aria-hidden>⚡</span>
                        <span className="font-mono font-bold text-xs tracking-widest uppercase text-[#FFB800]">
                          THESIS CHALLENGE
                        </span>
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
                    </div>

                    <div className="shrink-0 flex items-center gap-3">
                      <Link
                        href={`/app/thesis/${event.thesisId}`}
                        className="rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-black transition-colors hover:bg-[#E8E8E8]"
                      >
                        REVIEW NOW
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleDismiss(event.id)}
                        className="text-xs text-[#6B6B7B] transition-colors hover:text-[#F0F0F0]"
                      >
                        DISMISS
                      </button>
                    </div>
                  </div>
                </div>
              )
            })
          : null}
      </div>
    </>
  )
}

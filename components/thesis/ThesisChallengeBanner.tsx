"use client"

import Link from "next/link"
import { useState } from "react"

export type ThesisChallengeEvent = {
  id: string
  thesisId: string
  eventDetail: string
}

type Props = {
  events: ThesisChallengeEvent[]
}

export function ThesisChallengeBanner({ events }: Props) {
  const [visibleEvents, setVisibleEvents] = useState<ThesisChallengeEvent[]>(events)

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
        {visibleEvents.map((event) => (
          <div
            key={event.id}
            className="thesis-challenge-enter relative w-full bg-[#141418] border border-[#2A2A32] border-l-4 border-l-[#FFB800] rounded-xl px-5 py-4 mb-3"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span aria-hidden>⚡</span>
                  <span className="font-mono font-bold text-xs tracking-widest uppercase text-[#FFB800]">
                    THESIS CHALLENGE:
                  </span>
                </div>
                <p className="mt-2 text-sm text-[#F0F0F0]">{event.eventDetail}</p>
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
        ))}
      </div>
    </>
  )
}

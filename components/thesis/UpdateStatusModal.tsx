"use client"

import { useState } from "react"

interface UpdateStatusModalProps {
  thesisId: string
  currentStatus: string
  ticker: string
  onClose: () => void
  onUpdated: (newStatus: string) => void
}

const STATUS_OPTIONS = [
  { value: "intact", label: "INTACT", dotColor: "bg-[#00D1B2]", pulse: true },
  { value: "at_risk", label: "AT RISK", dotColor: "bg-[#FFB800]", pulse: false },
  { value: "broken", label: "BROKEN", dotColor: "bg-[#FF3B30]", pulse: false },
] as const

export default function UpdateStatusModal({
  thesisId,
  currentStatus,
  ticker,
  onClose,
  onUpdated,
}: UpdateStatusModalProps) {
  const [selected, setSelected] = useState(currentStatus)
  const [note, setNote] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleUpdate = async () => {
    if (selected === currentStatus && !note.trim()) return

    setIsLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/theses/${thesisId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: selected,
          note: note.trim() || undefined,
        }),
      })

      if (!res.ok) {
        const data = (await res.json()) as { error?: string }
        throw new Error(data.error ?? "Update failed")
      }

      onUpdated(selected)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="mx-4 w-full max-w-md rounded-xl border border-[#2A2A32] bg-[#141418] p-8 shadow-[0_25px_60px_rgba(0,0,0,0.6)] md:mx-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="font-mono text-xs uppercase tracking-widest text-[#6B6B7B]">
          UPDATE STATUS
        </p>
        <p className="mb-6 mt-1 font-mono text-xl font-medium text-[#F0F0F0]">
          {ticker}
        </p>

        <div className="flex flex-col gap-3">
          {STATUS_OPTIONS.map((opt) => {
            const isSelected = selected === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setSelected(opt.value)}
                className={`flex w-full cursor-pointer items-center gap-3 rounded-lg border p-4 text-left transition-colors ${
                  isSelected
                    ? "border-[#F0F0F0] bg-[#1C1C22]"
                    : "border-[#2A2A32] bg-transparent hover:bg-[#1C1C22]"
                }`}
              >
                <span
                  className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${opt.dotColor} ${opt.pulse ? "animate-pulse" : ""}`}
                />
                <span className="font-mono text-sm tracking-wide text-[#F0F0F0]">
                  {opt.label}
                </span>
              </button>
            )
          })}
        </div>

        {error && (
          <p className="mt-3 font-mono text-xs text-[#FF3B30]">{error}</p>
        )}

        <div className="mt-6">
          <label className="mb-2 block font-mono text-xs uppercase tracking-widest text-[#6B6B7B]">
            ADD A NOTE (OPTIONAL)
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Why are you updating this?"
            className="h-20 w-full resize-none rounded-lg border border-[#2A2A32] bg-[#0A0A0C] p-3 font-mono text-sm text-[#F0F0F0] placeholder-[#6B6B7B] focus:border-[#F0F0F0] focus:outline-none"
          />
        </div>

        <div className="mt-6 flex flex-col gap-3 md:flex-row">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-lg border border-[#2A2A32] py-3 font-mono text-xs uppercase tracking-widest text-[#6B6B7B] transition-colors hover:border-[#F0F0F0] hover:text-[#F0F0F0] md:flex-1"
          >
            CANCEL
          </button>
          <button
            type="button"
            disabled={isLoading}
            onClick={() => {
              void handleUpdate()
            }}
            className="w-full rounded-lg bg-[#FFFFFF] py-3 font-mono text-xs font-medium uppercase tracking-widest text-[#0A0A0C] transition-colors hover:bg-[#E8E8E8] disabled:opacity-50 md:flex-1"
          >
            {isLoading ? "SAVING..." : "UPDATE"}
          </button>
        </div>
      </div>
    </div>
  )
}

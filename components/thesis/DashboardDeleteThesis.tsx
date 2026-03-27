"use client"

import { useCallback, useEffect, useState } from "react"

type Props = {
  thesisId: string
  ticker: string
  companyName: string
  onDeleted: () => void
}

export function DashboardDeleteThesis({ thesisId, ticker, companyName, onDeleted }: Props) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const close = useCallback(() => {
    if (loading) return
    setOpen(false)
    setError(null)
  }, [loading])

  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") close()
    }
    window.addEventListener("keydown", onKey)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener("keydown", onKey)
    }
  }, [open, close])

  async function confirmDelete() {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/theses/${thesisId}/delete`, { method: "DELETE" })
      if (!response.ok) {
        throw new Error("Delete failed")
      }
      onDeleted()
      setOpen(false)
    } catch {
      setError("Could not delete. Try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true)
          setError(null)
        }}
        className="min-h-[36px] cursor-pointer rounded-lg border border-[#2A2A32] px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-[#6B6B7B] transition-colors hover:border-[#FF3B30]/50 hover:text-[#FF3B30]"
      >
        Delete
      </button>

      {open ? (
        <div className="fixed inset-0 z-[80] flex items-end justify-center p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="dashboard-delete-title">
          <button
            type="button"
            aria-label="Dismiss"
            className="absolute inset-0 bg-black/55 backdrop-blur-[1px]"
            onClick={close}
          />
          <div className="relative w-full max-w-md rounded-2xl border border-[#2A2A32] bg-[#111116] p-5 shadow-2xl shadow-black/50">
            <h2 id="dashboard-delete-title" className="font-mono text-xs uppercase tracking-widest text-[#F0F0F0]">
              Remove conviction
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-[#B8B8C4]">
              <span className="font-mono text-[#F0F0F0]">{ticker}</span>
              <span className="text-[#6B6B7B]"> — </span>
              {companyName}
            </p>
            <p className="mt-2 text-xs leading-relaxed text-[#6B6B7B]">
              This permanently deletes this thesis, its alerts, and related data. You cannot undo this.
            </p>
            {error ? <p className="mt-3 font-mono text-xs text-[#FF3B30]">{error}</p> : null}
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
              <button
                type="button"
                onClick={close}
                disabled={loading}
                className="min-h-[44px] rounded-lg border border-[#2A2A32] px-4 py-2 font-mono text-xs uppercase tracking-widest text-[#F0F0F0] transition-colors hover:border-[#F0F0F0]/40 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => void confirmDelete()}
                className="min-h-[44px] rounded-lg bg-[#FF3B30] px-4 py-2 font-mono text-xs uppercase tracking-widest text-white transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                {loading ? "Deleting…" : "Delete permanently"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}

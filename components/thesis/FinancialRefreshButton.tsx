"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

type FinancialRefreshButtonProps = {
  ticker: string
  initialLimit: number
  initialUsedToday: number
  initialHasData: boolean
}

export default function FinancialRefreshButton({
  ticker,
  initialLimit,
  initialUsedToday,
  initialHasData,
}: FinancialRefreshButtonProps) {
  const router = useRouter()
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [limit, setLimit] = useState(initialLimit)
  const [usedToday, setUsedToday] = useState(initialUsedToday)
  const [hasData, setHasData] = useState(initialHasData)

  useEffect(() => {
    setHasData(initialHasData)
  }, [initialHasData, ticker])

  const remaining = Math.max(0, limit - usedToday)

  async function handleRefresh() {
    if (isRefreshing || remaining <= 0) return

    setIsRefreshing(true)
    setError(null)

    try {
      const response = await fetch("/api/financial/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker, source: "provider" }),
      })

      const payload = (await response.json().catch(() => null)) as
        | { ok?: boolean; error?: string; limit?: number | null; usedToday?: number | null }
        | null

      if (!response.ok || !payload?.ok) {
        setError(payload?.error ?? "Refresh failed.")
        return
      }

      if (typeof payload.limit === "number") setLimit(payload.limit)
      if (typeof payload.usedToday === "number") setUsedToday(payload.usedToday)
      setHasData(true)
      router.refresh()
    } catch {
      setError("Refresh failed.")
    } finally {
      setIsRefreshing(false)
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        type="button"
        onClick={() => {
          void handleRefresh()
        }}
        disabled={isRefreshing || remaining <= 0}
        className={`rounded-lg border border-[#F0F0F0]/30 font-mono tracking-widest text-[#F0F0F0] transition-colors hover:bg-[#F0F0F0]/5 disabled:cursor-not-allowed disabled:opacity-60 ${
          hasData ? "px-3 py-2 text-[10px]" : "min-w-[280px] px-6 py-4 text-xs"
        }`}
      >
        {isRefreshing
          ? hasData
            ? "UPDATING..."
            : "GENERATING..."
          : hasData
            ? "UPDATE FINANCIALS"
            : "GENERATE FINANCIAL SNAPSHOT"}
      </button>
      <p className="font-mono text-[10px] tracking-widest text-[#6B6B7B] uppercase">
        Remaining today: {remaining}/{limit}
      </p>
      {remaining <= 0 ? (
        <p className="text-[11px] text-[#6B6B7B]">Daily limit reached. Resets at 00:00 UTC.</p>
      ) : null}
      {error ? <p className="text-xs text-[#FF3B30]">{error}</p> : null}
    </div>
  )
}

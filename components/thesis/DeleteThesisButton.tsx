"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

interface DeleteThesisButtonProps {
  thesisId: string
  ticker: string
}

export default function DeleteThesisButton({ thesisId, ticker }: DeleteThesisButtonProps) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleConfirmDelete = async (): Promise<void> => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/theses/${thesisId}/delete`, {
        method: "DELETE",
      })

      if (!response.ok) {
        throw new Error("Delete request failed")
      }

      router.push("/app/dashboard")
    } catch {
      setError("Failed to delete. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => {
          setConfirming(true)
          setError(null)
        }}
        className="cursor-pointer border-none bg-transparent p-0 font-mono text-xs uppercase tracking-widest text-[#6B6B7B] transition-colors hover:text-[#FF3B30]"
      >
        DELETE THESIS
      </button>
    )
  }

  return (
    <div>
      <div className="flex items-center gap-4">
        <p className="font-mono text-xs tracking-wide text-[#FF3B30]">
          Delete {ticker}? This cannot be undone.
        </p>
        <button
          type="button"
          disabled={isLoading}
          onClick={() => {
            void handleConfirmDelete()
          }}
          className="rounded-lg bg-[#FF3B30] px-3 py-1.5 font-mono text-xs uppercase tracking-widest text-white transition-opacity hover:opacity-80 disabled:opacity-80"
        >
          {isLoading ? "DELETING..." : "CONFIRM DELETE"}
        </button>
        <button
          type="button"
          onClick={() => {
            setConfirming(false)
            setError(null)
          }}
          className="cursor-pointer font-mono text-xs uppercase tracking-widest text-[#6B6B7B] transition-colors hover:text-[#F0F0F0]"
        >
          CANCEL
        </button>
      </div>
      {error ? <p className="mt-2 font-mono text-xs text-[#FF3B30]">{error}</p> : null}
    </div>
  )
}

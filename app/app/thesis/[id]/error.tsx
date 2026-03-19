"use client"

import Link from "next/link"
import { useEffect } from "react"

type ThesisErrorProps = {
  error: Error & { digest?: string }
  reset: () => void
}

export default function ThesisError({ error, reset }: ThesisErrorProps) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0A0A0C] px-6">
      <div className="max-w-md text-center">
        <p className="mb-8 font-mono text-6xl text-[#2A2A32]">Σ</p>
        <h1 className="mb-3 font-mono text-sm uppercase tracking-widest text-[#FF3B30]">
          THESIS UNAVAILABLE
        </h1>
        <p className="mb-8 text-sm leading-relaxed text-[#6B6B7B]">
          This thesis could not be loaded. It may have been deleted or an error occurred.
        </p>
        <div className="flex justify-center gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="rounded-lg bg-[#FFFFFF] px-6 py-3 font-mono text-xs uppercase tracking-widest text-[#0A0A0C] transition-colors hover:bg-[#E8E8E8]"
          >
            TRY AGAIN
          </button>
          <Link
            href="/app/dashboard"
            className="rounded-lg border border-[#2A2A32] px-6 py-3 font-mono text-xs uppercase tracking-widest text-[#6B6B7B] transition-colors hover:border-[#F0F0F0] hover:text-[#F0F0F0]"
          >
            GO TO DASHBOARD
          </Link>
        </div>
      </div>
    </main>
  )
}

"use client"

import { useState, type ReactNode } from "react"

type Props = {
  children: ReactNode
  defaultOpen?: boolean
}

export function CollapsibleHistorySection({ children, defaultOpen = false }: Props) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <section className="mb-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="font-mono text-xs text-[#6B6B7B] tracking-widest uppercase">HISTORY</p>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-label={open ? "Collapse history" : "Expand history"}
          className="flex h-6 w-6 items-center justify-center rounded border border-[#2A2A32] font-mono text-sm text-[#8B5CF6] transition-colors hover:border-[#8B5CF6]/50 hover:text-[#A78BFA]"
        >
          {open ? "-" : "+"}
        </button>
      </div>

      {open ? children : null}
    </section>
  )
}

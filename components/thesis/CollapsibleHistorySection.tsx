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
      <div className="mb-4 inline-flex items-center gap-2">
        <p className="font-mono text-xs text-[#6B6B7B] tracking-widest uppercase">HISTORY</p>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-label={open ? "Collapse history" : "Expand history"}
          className="rounded border border-[#2A2A32] px-2 py-1 font-mono text-[10px] tracking-widest text-[#8B5CF6] transition-colors hover:border-[#8B5CF6]/50 hover:text-[#A78BFA]"
        >
          {open ? "- COLLAPSE" : "+ EXPAND"}
        </button>
      </div>

      {open ? children : null}
    </section>
  )
}

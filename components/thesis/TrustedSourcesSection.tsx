"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import type { TrustedSource } from "@/types/database"

type TrustedSourcesSectionProps = {
  thesisId: string
  initialSources: TrustedSource[]
}

const SOURCE_TYPE_OPTIONS = [
  { value: "analyst", label: "Analyst" },
  { value: "news_outlet", label: "News outlet" },
  { value: "newsletter", label: "Newsletter" },
  { value: "sec_filing", label: "SEC filing" },
  { value: "other", label: "Other" },
] as const

type SourceType = (typeof SOURCE_TYPE_OPTIONS)[number]["value"]

function sourceTypeLabel(value: string) {
  return SOURCE_TYPE_OPTIONS.find((option) => option.value === value)?.label ?? "Other"
}

export default function TrustedSourcesSection({
  thesisId,
  initialSources,
}: TrustedSourcesSectionProps) {
  const router = useRouter()
  const [sources, setSources] = useState<TrustedSource[]>(initialSources)
  const [name, setName] = useState("")
  const [url, setUrl] = useState("")
  const [sourceType, setSourceType] = useState<SourceType>("analyst")
  const [isAdding, setIsAdding] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleAddSource() {
    const trimmedName = name.trim()
    if (!trimmedName) {
      setError("Source name is required.")
      return
    }

    setIsAdding(true)
    setError(null)

    try {
      const response = await fetch(`/api/theses/${thesisId}/trusted-sources`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          url: url.trim(),
          sourceType,
        }),
      })

      const payload = (await response.json().catch(() => null)) as
        | { source?: TrustedSource; error?: string }
        | null

      if (!response.ok || !payload?.source) {
        setError(payload?.error ?? "Failed to add trusted source.")
        return
      }

      setSources((prev) => [payload.source!, ...prev])
      setName("")
      setUrl("")
      setSourceType("analyst")
      router.refresh()
    } catch {
      setError("Failed to add trusted source.")
    } finally {
      setIsAdding(false)
    }
  }

  async function handleRemoveSource(sourceId: string) {
    setDeletingId(sourceId)
    setError(null)

    try {
      const response = await fetch(`/api/theses/${thesisId}/trusted-sources/${sourceId}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null
        setError(payload?.error ?? "Failed to remove trusted source.")
        return
      }

      setSources((prev) => prev.filter((source) => source.id !== sourceId))
      router.refresh()
    } catch {
      setError("Failed to remove trusted source.")
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <section className="mb-6">
      <p className="mb-4 font-mono text-xs tracking-widest text-[#6B6B7B] uppercase">
        TRUSTED SOURCES
      </p>

      <article className="mb-4 rounded-xl border border-[#2A2A32] bg-[#141418] p-4 md:p-5">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1.3fr_1fr]">
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Source name (e.g. Reuters, Stacey Rasgon)"
            className="w-full rounded-lg border border-[#2A2A32] bg-[#0A0A0C] px-3 py-2.5 text-sm text-[#F0F0F0] outline-none focus:border-[#F0F0F0]/50"
          />
          <select
            value={sourceType}
            onChange={(event) => setSourceType(event.target.value as SourceType)}
            className="w-full rounded-lg border border-[#2A2A32] bg-[#0A0A0C] px-3 py-2.5 text-sm text-[#F0F0F0] outline-none focus:border-[#F0F0F0]/50"
          >
            {SOURCE_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-3 flex flex-col gap-3 md:flex-row">
          <input
            type="url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="Optional URL"
            className="w-full rounded-lg border border-[#2A2A32] bg-[#0A0A0C] px-3 py-2.5 text-sm text-[#F0F0F0] outline-none focus:border-[#F0F0F0]/50"
          />
          <button
            type="button"
            disabled={isAdding}
            onClick={() => {
              void handleAddSource()
            }}
            className="rounded-lg border border-[#F0F0F0]/30 px-4 py-2.5 font-mono text-xs tracking-widest text-[#F0F0F0] transition-colors hover:bg-[#F0F0F0]/5 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isAdding ? "ADDING..." : "ADD SOURCE"}
          </button>
        </div>
      </article>

      {error ? <p className="mb-3 font-mono text-xs text-[#FF3B30]">{error}</p> : null}

      {sources.length === 0 ? (
        <article className="rounded-xl border border-[#2A2A32] bg-[#141418] p-5">
          <p className="text-sm text-[#6B6B7B]">
            No trusted sources yet. Add analysts, outlets, newsletters, or filing sources you rely on.
          </p>
        </article>
      ) : (
        <div className="space-y-3">
          {sources.map((source) => (
            <article
              key={source.id}
              className="rounded-xl border border-[#2A2A32] bg-[#141418] p-4 md:p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="break-words text-sm text-[#F0F0F0]">{source.name}</p>
                  <p className="mt-1 font-mono text-[10px] tracking-widest uppercase text-[#6B6B7B]">
                    {sourceTypeLabel(source.source_type)}
                  </p>
                  {source.url ? (
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-block break-all text-xs text-[#8AA8FF] hover:text-[#B9CBFF]"
                    >
                      {source.url}
                    </a>
                  ) : null}
                </div>
                <button
                  type="button"
                  disabled={deletingId === source.id}
                  onClick={() => {
                    void handleRemoveSource(source.id)
                  }}
                  className="rounded-lg border border-[#2A2A32] px-3 py-1.5 font-mono text-[10px] tracking-widest text-[#6B6B7B] transition-colors hover:border-[#FF3B30]/40 hover:text-[#FF3B30] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {deletingId === source.id ? "REMOVING..." : "REMOVE"}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

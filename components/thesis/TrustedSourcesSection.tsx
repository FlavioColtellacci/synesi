"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import type { TrustedSource } from "@/types/database"

type TrustedSourcesSectionProps = {
  thesisId: string
  thesisTicker: string
  thesisCompanyName: string
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

type SuggestedFeed = {
  label: string
  name: string
  sourceType: SourceType
  url: string
}

function buildSuggestedFeeds(thesisTicker: string, thesisCompanyName: string): SuggestedFeed[] {
  const normalizedTicker = thesisTicker.trim().toUpperCase()
  const normalizedCompany = thesisCompanyName.trim()
  const query = encodeURIComponent(`${normalizedTicker} OR ${normalizedCompany}`)

  return [
    {
      label: `Google News (${normalizedTicker} search)`,
      name: "Google News",
      sourceType: "news_outlet",
      url: `https://news.google.com/rss/search?q=${query}&hl=en-US&gl=US&ceid=US:en`,
    },
    {
      label: "MarketWatch Top Stories",
      name: "MarketWatch",
      sourceType: "news_outlet",
      url: "https://feeds.content.dowjones.io/public/rss/mw_topstories",
    },
    {
      label: "Reuters Recent Feed",
      name: "Reuters",
      sourceType: "news_outlet",
      url: "http://live.reuters.com/api/feed/RSS_Recent.aspx",
    },
  ]
}

function sourceTypeLabel(value: string) {
  return SOURCE_TYPE_OPTIONS.find((option) => option.value === value)?.label ?? "Other"
}

function looksLikeFeedUrl(value: string) {
  const input = value.trim().toLowerCase()
  if (!input) return true
  return (
    input.includes("/rss") ||
    input.includes("rss.") ||
    input.includes("/feed") ||
    input.includes("atom") ||
    input.endsWith(".xml") ||
    input.includes("news.google.com/rss")
  )
}

export default function TrustedSourcesSection({
  thesisId,
  thesisTicker,
  thesisCompanyName,
  initialSources,
}: TrustedSourcesSectionProps) {
  const router = useRouter()
  const suggestedFeeds = buildSuggestedFeeds(thesisTicker, thesisCompanyName)
  const [sources, setSources] = useState<TrustedSource[]>(initialSources)
  const [name, setName] = useState("")
  const [url, setUrl] = useState("")
  const [sourceType, setSourceType] = useState<SourceType>("analyst")
  const [isAdding, setIsAdding] = useState(false)
  const [addingSuggestion, setAddingSuggestion] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function applySuggestedFeed(feed: SuggestedFeed) {
    setName(feed.name)
    setSourceType(feed.sourceType)
    setUrl(feed.url)
    setError(null)
  }

  function hasMatchingSource(nextName: string, nextUrl: string) {
    const normalizedName = nextName.trim().toLowerCase()
    const normalizedUrl = nextUrl.trim().toLowerCase()
    return sources.some((source) => {
      const sourceName = source.name.trim().toLowerCase()
      const sourceUrl = (source.url ?? "").trim().toLowerCase()
      return sourceName === normalizedName || (normalizedUrl.length > 0 && sourceUrl === normalizedUrl)
    })
  }

  async function persistSource(input: { name: string; url: string; sourceType: SourceType }) {
    const response = await fetch(`/api/theses/${thesisId}/trusted-sources`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    })

    const payload = (await response.json().catch(() => null)) as
      | { source?: TrustedSource; error?: string }
      | null

    const createdSource = payload?.source
    if (!response.ok || !createdSource) {
      throw new Error(payload?.error ?? "Failed to add trusted source.")
    }

    setSources((prev) => [createdSource, ...prev])
    router.refresh()
  }

  async function handleAddSource() {
    const trimmedName = name.trim()
    const trimmedUrl = url.trim()
    if (!trimmedName) {
      setError("Source name is required.")
      return
    }
    if (trimmedUrl && !looksLikeFeedUrl(trimmedUrl)) {
      setError(
        "Use a direct RSS/Atom feed URL (for example, a link containing /rss, /feed, or .xml), not a regular homepage URL.",
      )
      return
    }
    if (hasMatchingSource(trimmedName, trimmedUrl)) {
      setError("That source already exists in your trusted list.")
      return
    }

    setIsAdding(true)
    setError(null)

    try {
      await persistSource({
        name: trimmedName,
        url: trimmedUrl,
        sourceType,
      })
      setName("")
      setUrl("")
      setSourceType("analyst")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add trusted source.")
    } finally {
      setIsAdding(false)
    }
  }

  async function handleAddSuggestedFeed(feed: SuggestedFeed) {
    if (hasMatchingSource(feed.name, feed.url)) {
      setError("That suggested source is already in your trusted list.")
      return
    }

    setAddingSuggestion(feed.label)
    setError(null)
    try {
      await persistSource({
        name: feed.name,
        url: feed.url,
        sourceType: feed.sourceType,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add trusted source.")
    } finally {
      setAddingSuggestion(null)
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
        TRUSTED SOURCES · STEP 1
      </p>

      <article className="mb-4 rounded-xl border border-[#2A2A32] bg-[#141418] p-4 md:p-5">
        <p className="mb-3 text-xs text-[#6B6B7B]">
          Add the few sources you trust most. These are later used by alert preferences.
        </p>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1.3fr_1fr]">
          <label className="relative block">
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Source name"
              className="peer w-full rounded-lg border border-[#2A2A32] bg-[#0A0A0C] px-3 py-2.5 text-sm text-[#F0F0F0] outline-none focus:border-[#F0F0F0]/50"
            />
            {name.trim().length === 0 ? (
              <span
                aria-hidden
                className="pointer-events-none absolute inset-y-0 left-3 right-3 flex items-center overflow-hidden text-sm text-[#6B6B7B] peer-focus:hidden"
              >
                <span className="inline-block animate-[trusted-source-placeholder-scroll_7s_ease-in-out_infinite_alternate] whitespace-nowrap">
                  Source name (e.g. Reuters, Stacey Rasgon)
                </span>
              </span>
            ) : null}
          </label>
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
            placeholder="RSS/Atom feed URL (recommended)"
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
        <p className="mt-2 text-xs text-[#6B6B7B]">
          Alerts only ingest RSS/Atom feed links. Example:
          {" "}
          <span className="text-[#A0A0AE]">{suggestedFeeds[0]?.url}</span>
        </p>
      </article>

      <article className="mb-4 rounded-xl border border-[#2A2A32] bg-[#141418] p-4 md:p-5">
        <p className="font-mono text-[10px] tracking-widest uppercase text-[#6B6B7B]">
          Suggested feeds (known working examples)
        </p>
        <p className="mt-1 text-xs text-[#6B6B7B]">
          Use autofill, or add instantly with one click.
        </p>
        <div className="mt-3 space-y-2">
          {suggestedFeeds.map((feed) => (
            <div
              key={feed.label}
              className="flex flex-col gap-2 rounded-lg border border-[#2A2A32] bg-[#0F0F12] p-3 md:flex-row md:items-center md:justify-between"
            >
              <div className="min-w-0">
                <p className="text-xs text-[#F0F0F0]">{feed.label}</p>
                <p className="mt-1 break-all text-[11px] text-[#8AA8FF]">{feed.url}</p>
              </div>
              <button
                type="button"
                onClick={() => applySuggestedFeed(feed)}
                className="shrink-0 rounded-lg border border-[#2A2A32] px-3 py-1.5 font-mono text-[10px] tracking-widest text-[#F0F0F0] transition-colors hover:bg-[#F0F0F0]/5"
              >
                USE THIS
              </button>
              <button
                type="button"
                disabled={addingSuggestion === feed.label}
                onClick={() => {
                  void handleAddSuggestedFeed(feed)
                }}
                className="shrink-0 rounded-lg border border-[#00D1B2]/40 px-3 py-1.5 font-mono text-[10px] tracking-widest text-[#00D1B2] transition-colors hover:bg-[#00D1B2]/10 disabled:opacity-60"
              >
                {addingSuggestion === feed.label ? "ADDING..." : "ADD NOW"}
              </button>
            </div>
          ))}
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
          <p className="text-xs text-[#6B6B7B]">{sources.length} trusted source(s) saved.</p>
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
      <style jsx>{`
        @keyframes trusted-source-placeholder-scroll {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-42%);
          }
        }
      `}</style>
    </section>
  )
}

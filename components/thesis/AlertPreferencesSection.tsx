"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import type { AlertRule, TrustedSource } from "@/types/database"

type AlertRuleWithSources = AlertRule & {
  sourceIds: string[]
}

type AlertPreferencesSectionProps = {
  thesisId: string
  trustedSources: TrustedSource[]
  initialRules: AlertRuleWithSources[]
}

type CopilotSuggestion = {
  recommendedMode: AlertRule["mode"]
  recommendedMinConfidence: AlertRule["min_confidence"]
  includeKeywords: string[]
  excludeKeywords: string[]
  sources: Array<{
    sourceType: string
    nameCandidates: string[]
    urlCandidates: Array<{ url: string; isFeedLike: boolean }>
  }>
}

const MODE_OPTIONS: Array<{ value: AlertRule["mode"]; label: string; hint: string }> = [
  {
    value: "only_sources",
    label: "Only selected sources",
    hint: "Alert only when the matched source is in your selected list.",
  },
  {
    value: "include_sources",
    label: "Include selected sources",
    hint: "Alert only from the selected sources.",
  },
  {
    value: "exclude_sources",
    label: "Exclude selected sources",
    hint: "Alert from every source except the selected sources.",
  },
]

const CONFIDENCE_OPTIONS: Array<{ value: AlertRule["min_confidence"]; label: string }> = [
  { value: "high", label: "High only" },
  { value: "medium", label: "Medium and high" },
]

async function parseJson<T>(response: Response): Promise<T | null> {
  return (await response.json().catch(() => null)) as T | null
}

export default function AlertPreferencesSection({
  thesisId,
  trustedSources,
  initialRules,
}: AlertPreferencesSectionProps) {
  const router = useRouter()
  const [rules, setRules] = useState<AlertRuleWithSources[]>(initialRules)
  const [error, setError] = useState<string | null>(null)
  const [isBusy, setIsBusy] = useState(false)
  const [includeInput, setIncludeInput] = useState("")
  const [excludeInput, setExcludeInput] = useState("")
  const [isCopilotOpen, setIsCopilotOpen] = useState(false)
  const [copilotIntent, setCopilotIntent] = useState("")
  const [copilotLoading, setCopilotLoading] = useState(false)
  const [copilotError, setCopilotError] = useState<string | null>(null)
  const [copilotSuggestion, setCopilotSuggestion] = useState<CopilotSuggestion | null>(null)
  const [copilotApplyRule, setCopilotApplyRule] = useState(true)
  const [copilotAddSources, setCopilotAddSources] = useState(true)
  const [copilotSelections, setCopilotSelections] = useState<
    Array<{ nameIndex: number; urlIndex: number; selected: boolean }>
  >([])
  const primaryRule = rules[0] ?? null

  const selectedSourceIds = useMemo(() => new Set(primaryRule?.sourceIds ?? []), [primaryRule?.sourceIds])
  const hasMultipleRules = rules.length > 1

  async function createDefaultRule(): Promise<AlertRuleWithSources | null> {
    const response = await fetch(`/api/theses/${thesisId}/alert-rules`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Personalized source rule",
        mode: "only_sources",
        minConfidence: "high",
        isEnabled: true,
      }),
    })

    const payload = await parseJson<{ rule?: AlertRuleWithSources; error?: string }>(response)
    if (!response.ok || !payload?.rule) {
      throw new Error(payload?.error ?? "Failed to create alert preferences")
    }
    return payload.rule
  }

  function updatePrimaryRule(partial: Partial<AlertRuleWithSources>) {
    setRules((current) => {
      if (current.length === 0) return current
      const first = { ...current[0], ...partial }
      return [first, ...current.slice(1)]
    })
  }

  async function ensurePrimaryRule(): Promise<AlertRuleWithSources | null> {
    if (primaryRule) return primaryRule
    const created = await createDefaultRule()
    if (!created) return null
    setRules((current) => [created, ...current])
    return created
  }

  async function handleEnabledToggle(nextEnabled: boolean) {
    setIsBusy(true)
    setError(null)
    try {
      const rule = await ensurePrimaryRule()
      if (!rule) {
        setError("Could not initialize alert preferences.")
        return
      }

      const response = await fetch(`/api/theses/${thesisId}/alert-rules/${rule.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isEnabled: nextEnabled }),
      })
      const payload = await parseJson<{ error?: string }>(response)
      if (!response.ok) {
        throw new Error(payload?.error ?? "Failed to update alert preferences")
      }
      updatePrimaryRule({ is_enabled: nextEnabled })
      if (nextEnabled) {
        setIsCopilotOpen(true)
      } else {
        setIsCopilotOpen(false)
        setCopilotSuggestion(null)
        setCopilotError(null)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update alert preferences")
    } finally {
      setIsBusy(false)
    }
  }

  async function handleModeChange(nextMode: AlertRule["mode"]) {
    setIsBusy(true)
    setError(null)
    try {
      const rule = await ensurePrimaryRule()
      if (!rule) return

      const response = await fetch(`/api/theses/${thesisId}/alert-rules/${rule.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: nextMode }),
      })
      const payload = await parseJson<{ error?: string }>(response)
      if (!response.ok) {
        throw new Error(payload?.error ?? "Failed to update mode")
      }
      updatePrimaryRule({ mode: nextMode })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update mode")
    } finally {
      setIsBusy(false)
    }
  }

  async function handleMinConfidenceChange(nextMinConfidence: AlertRule["min_confidence"]) {
    setIsBusy(true)
    setError(null)
    try {
      const rule = await ensurePrimaryRule()
      if (!rule) return

      const response = await fetch(`/api/theses/${thesisId}/alert-rules/${rule.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ minConfidence: nextMinConfidence }),
      })
      const payload = await parseJson<{ error?: string }>(response)
      if (!response.ok) {
        throw new Error(payload?.error ?? "Failed to update minimum confidence")
      }
      updatePrimaryRule({ min_confidence: nextMinConfidence })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update confidence")
    } finally {
      setIsBusy(false)
    }
  }

  async function handleSourceToggle(sourceId: string, shouldSelect: boolean) {
    setIsBusy(true)
    setError(null)
    try {
      const rule = await ensurePrimaryRule()
      if (!rule) return

      const response = await fetch(`/api/theses/${thesisId}/alert-rules/${rule.id}/sources`, {
        method: shouldSelect ? "POST" : "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trustedSourceId: sourceId }),
      })
      const payload = await parseJson<{ error?: string }>(response)
      if (!response.ok) {
        throw new Error(payload?.error ?? "Failed to update source selection")
      }

      const nextSourceIds = shouldSelect
        ? [...new Set([...(primaryRule?.sourceIds ?? []), sourceId])]
        : (primaryRule?.sourceIds ?? []).filter((id) => id !== sourceId)

      updatePrimaryRule({ sourceIds: nextSourceIds })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update source selection")
    } finally {
      setIsBusy(false)
    }
  }

  const activeMode = primaryRule?.mode ?? "only_sources"
  const activeConfidence = primaryRule?.min_confidence ?? "high"
  const isEnabled = primaryRule?.is_enabled ?? false
  const includeKeywords = primaryRule?.include_keywords ?? []
  const excludeKeywords = primaryRule?.exclude_keywords ?? []
  const selectedSourcesCount = primaryRule?.sourceIds?.length ?? 0

  function normalizeKeyword(value: string) {
    return value.trim().toLowerCase()
  }

  async function saveIncludeKeywords(next: string[]) {
    const rule = await ensurePrimaryRule()
    if (!rule) return

    const response = await fetch(`/api/theses/${thesisId}/alert-rules/${rule.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ includeKeywords: next }),
    })
    const payload = await parseJson<{ error?: string }>(response)
    if (!response.ok) {
      throw new Error(payload?.error ?? "Failed to update include keywords")
    }
    updatePrimaryRule({ include_keywords: next })
  }

  async function saveExcludeKeywords(next: string[]) {
    const rule = await ensurePrimaryRule()
    if (!rule) return

    const response = await fetch(`/api/theses/${thesisId}/alert-rules/${rule.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ excludeKeywords: next }),
    })
    const payload = await parseJson<{ error?: string }>(response)
    if (!response.ok) {
      throw new Error(payload?.error ?? "Failed to update exclude keywords")
    }
    updatePrimaryRule({ exclude_keywords: next })
  }

  async function handleAddKeyword(kind: "include" | "exclude") {
    const input = kind === "include" ? includeInput : excludeInput
    const keyword = normalizeKeyword(input)
    if (!keyword) return

    setIsBusy(true)
    setError(null)

    try {
      if (kind === "include") {
        const next = [...new Set([...includeKeywords, keyword])].slice(0, 25)
        await saveIncludeKeywords(next)
        setIncludeInput("")
      } else {
        const next = [...new Set([...excludeKeywords, keyword])].slice(0, 25)
        await saveExcludeKeywords(next)
        setExcludeInput("")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update keywords")
    } finally {
      setIsBusy(false)
    }
  }

  async function handleRemoveKeyword(kind: "include" | "exclude", keyword: string) {
    setIsBusy(true)
    setError(null)

    try {
      if (kind === "include") {
        const next = includeKeywords.filter((kw) => kw !== keyword)
        await saveIncludeKeywords(next)
      } else {
        const next = excludeKeywords.filter((kw) => kw !== keyword)
        await saveExcludeKeywords(next)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update keywords")
    } finally {
      setIsBusy(false)
    }
  }

  async function runCopilot() {
    const intent = copilotIntent.trim()
    if (!intent) {
      setCopilotError("Describe what you want (for example: only Dan Ives on NVDA AI news).")
      return
    }

    setCopilotLoading(true)
    setCopilotError(null)
    setCopilotSuggestion(null)

    try {
      const response = await fetch(`/api/theses/${thesisId}/alert-rules/copilot`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intent }),
      })
      const payload = await parseJson<{ suggestion?: CopilotSuggestion; error?: string }>(response)
      if (!response.ok || !payload?.suggestion) {
        throw new Error(payload?.error ?? "Copilot request failed")
      }

      setCopilotSuggestion(payload.suggestion)
      setCopilotSelections(
        payload.suggestion.sources.map(() => ({ nameIndex: 0, urlIndex: 0, selected: true })),
      )
    } catch (err) {
      setCopilotError(err instanceof Error ? err.message : "Copilot request failed")
    } finally {
      setCopilotLoading(false)
    }
  }

  async function applyCopilotSuggestion() {
    if (!copilotSuggestion) return

    setIsBusy(true)
    setError(null)
    setCopilotError(null)

    try {
      const rule = await ensurePrimaryRule()
      if (!rule) {
        setCopilotError("Could not initialize alert preferences.")
        return
      }

      if (copilotApplyRule) {
        const response = await fetch(`/api/theses/${thesisId}/alert-rules/${rule.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: copilotSuggestion.recommendedMode,
            minConfidence: copilotSuggestion.recommendedMinConfidence,
            includeKeywords: copilotSuggestion.includeKeywords,
            excludeKeywords: copilotSuggestion.excludeKeywords,
            isEnabled: true,
          }),
        })
        const payload = await parseJson<{ error?: string }>(response)
        if (!response.ok) {
          throw new Error(payload?.error ?? "Failed to apply rule settings")
        }
        updatePrimaryRule({
          mode: copilotSuggestion.recommendedMode,
          min_confidence: copilotSuggestion.recommendedMinConfidence,
          include_keywords: copilotSuggestion.includeKeywords,
          exclude_keywords: copilotSuggestion.excludeKeywords,
          is_enabled: true,
        })
      }

      if (copilotAddSources) {
        const selections = copilotSelections
        for (let i = 0; i < copilotSuggestion.sources.length; i++) {
          const selection = selections[i]
          const source = copilotSuggestion.sources[i]
          if (!selection?.selected) continue

          const name = source.nameCandidates[selection.nameIndex] ?? source.nameCandidates[0] ?? ""
          const chosenUrl = source.urlCandidates[selection.urlIndex]?.url ?? source.urlCandidates[0]?.url ?? ""
          const isFeedLike = source.urlCandidates[selection.urlIndex]?.isFeedLike ?? false

          if (!name || !chosenUrl) continue
          if (!isFeedLike) {
            throw new Error(`"${chosenUrl}" doesn't look like an RSS/Atom feed URL. Pick a different URL.`)
          }

          const addResponse = await fetch(`/api/theses/${thesisId}/trusted-sources`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name,
              url: chosenUrl,
              sourceType: source.sourceType,
            }),
          })
          const addPayload = await parseJson<{ error?: string }>(addResponse)
          if (!addResponse.ok) {
            throw new Error(addPayload?.error ?? `Failed to add trusted source "${name}"`)
          }
        }
      }

      setCopilotSuggestion(null)
      setCopilotIntent("")
      router.refresh()
    } catch (err) {
      setCopilotError(err instanceof Error ? err.message : "Failed to apply copilot suggestion")
    } finally {
      setIsBusy(false)
    }
  }

  return (
    <section className="mb-6">
      <p className="mb-4 font-mono text-xs tracking-widest text-[#6B6B7B] uppercase">
        ALERT PREFERENCES · STEP 2
      </p>
      <article className="rounded-xl border border-[#2A2A32] bg-[#141418] p-4 md:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-[#F0F0F0]">Personalized challenge alerts</p>
            <p className="mt-1 text-xs text-[#6B6B7B]">
              Control which trusted sources can trigger thesis challenge notifications.
            </p>
            <p className="mt-2 text-xs text-[#6B6B7B]">
              Saved now:{" "}
              <span className="text-[#F0F0F0]">{isEnabled ? "enabled" : "disabled"}</span> ·{" "}
              <span className="text-[#F0F0F0]">{selectedSourcesCount}</span> source(s) · include{" "}
              <span className="text-[#F0F0F0]">{includeKeywords.length}</span> · exclude{" "}
              <span className="text-[#F0F0F0]">{excludeKeywords.length}</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isBusy}
              onClick={() => {
                void handleEnabledToggle(!isEnabled)
              }}
              className={`rounded-lg border px-3 py-1.5 font-mono text-[10px] tracking-widest transition-colors disabled:opacity-60 ${
                isEnabled
                  ? "border-[#00D1B2]/40 text-[#00D1B2] hover:bg-[#00D1B2]/10"
                  : "border-[#FF3B30]/40 text-[#FF3B30] hover:bg-[#FF3B30]/10"
              }`}
            >
              {isEnabled ? "ENABLED" : "DISABLED"}
            </button>
          </div>
        </div>

        <p className="mt-3 text-xs text-[#6B6B7B]">
          Changes in this panel save immediately. Copilot suggestions are only saved after you click{" "}
          <span className="text-[#F0F0F0]">APPLY SELECTIONS</span>.
        </p>

        {isEnabled && isCopilotOpen ? (
          <div className="mt-4 rounded-xl border border-[#2A2A32] bg-[#0F0F12] p-4">
            <div>
              <p className="font-mono text-[10px] tracking-widest uppercase text-[#6B6B7B]">
                Generate personalized source setup
              </p>
              <p className="mt-1 text-xs text-[#6B6B7B]">
                You&apos;ll review the suggestions before anything is saved.
              </p>
            </div>

            <textarea
              value={copilotIntent}
              disabled={copilotLoading || isBusy}
              onChange={(event) => setCopilotIntent(event.target.value)}
              placeholder='Example: "Only Dan Ives on NVDA AI news. Ignore everything else."'
              className="mt-3 w-full rounded-lg border border-[#2A2A32] bg-[#0A0A0C] px-3 py-2 text-sm text-[#F0F0F0] outline-none focus:border-[#F0F0F0]/40 disabled:opacity-60"
              rows={3}
            />

            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={copilotLoading || isBusy}
                onClick={() => {
                  void runCopilot()
                }}
                className="rounded-lg border border-[#F0F0F0]/30 px-4 py-2 font-mono text-xs tracking-widest text-[#F0F0F0] transition-colors hover:bg-[#F0F0F0]/5 disabled:opacity-60"
              >
                {copilotLoading ? "GENERATING..." : "GENERATE DRAFT"}
              </button>

              {copilotSuggestion ? (
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => {
                    void applyCopilotSuggestion()
                  }}
                  className="rounded-lg border border-[#00D1B2]/40 px-4 py-2 font-mono text-xs tracking-widest text-[#00D1B2] transition-colors hover:bg-[#00D1B2]/10 disabled:opacity-60"
                >
                  APPLY SELECTIONS
                </button>
              ) : null}

              <label className="flex items-center gap-2 text-xs text-[#6B6B7B]">
                <input
                  type="checkbox"
                  checked={copilotApplyRule}
                  disabled={copilotLoading || isBusy}
                  onChange={(event) => setCopilotApplyRule(event.target.checked)}
                />
                Apply rule settings
              </label>
              <label className="flex items-center gap-2 text-xs text-[#6B6B7B]">
                <input
                  type="checkbox"
                  checked={copilotAddSources}
                  disabled={copilotLoading || isBusy}
                  onChange={(event) => setCopilotAddSources(event.target.checked)}
                />
                Add trusted sources
              </label>
            </div>

            {copilotError ? <p className="mt-3 font-mono text-xs text-[#FF3B30]">{copilotError}</p> : null}

            {copilotSuggestion ? (
              <p className="mt-3 rounded-lg border border-[#00D1B2]/30 bg-[#00D1B2]/10 px-3 py-2 text-xs text-[#00D1B2]">
                Draft generated. Review it below, then click APPLY SELECTIONS to save.
              </p>
            ) : null}

            {copilotSuggestion ? (
              <div className="mt-4 space-y-3">
                <div className="rounded-lg border border-[#2A2A32] bg-[#0A0A0C] p-3">
                  <p className="text-xs text-[#6B6B7B]">
                    Recommended: <span className="text-[#F0F0F0]">{copilotSuggestion.recommendedMode}</span>{" "}
                    • min confidence{" "}
                    <span className="text-[#F0F0F0]">{copilotSuggestion.recommendedMinConfidence}</span>
                  </p>
                  {(copilotSuggestion.includeKeywords.length > 0 || copilotSuggestion.excludeKeywords.length > 0) ? (
                    <p className="mt-1 text-xs text-[#6B6B7B]">
                      Keywords: include{" "}
                      <span className="text-[#F0F0F0]">
                        {copilotSuggestion.includeKeywords.length ? copilotSuggestion.includeKeywords.join(", ") : "—"}
                      </span>{" "}
                      • exclude{" "}
                      <span className="text-[#F0F0F0]">
                        {copilotSuggestion.excludeKeywords.length ? copilotSuggestion.excludeKeywords.join(", ") : "—"}
                      </span>
                    </p>
                  ) : null}
                </div>

                {copilotSuggestion.sources.map((src, index) => {
                  const selection = copilotSelections[index] ?? { nameIndex: 0, urlIndex: 0, selected: true }
                  const selectedUrl = src.urlCandidates[selection.urlIndex]
                  return (
                    <div
                      key={`${src.sourceType}-${index}`}
                      className="rounded-lg border border-[#2A2A32] bg-[#0A0A0C] p-3"
                    >
                      <label className="flex items-center gap-2 text-xs text-[#6B6B7B]">
                        <input
                          type="checkbox"
                          checked={selection.selected}
                          disabled={copilotLoading || isBusy}
                          onChange={(event) => {
                            setCopilotSelections((current) =>
                              current.map((item, i) =>
                                i === index ? { ...item, selected: event.target.checked } : item,
                              ),
                            )
                          }}
                        />
                        Include this source ({src.sourceType})
                      </label>

                      <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
                        <label className="block">
                          <span className="font-mono text-[10px] tracking-widest uppercase text-[#6B6B7B]">
                            Name
                          </span>
                          <select
                            value={selection.nameIndex}
                            disabled={copilotLoading || isBusy}
                            onChange={(event) => {
                              const nameIndex = Number.parseInt(event.target.value, 10) || 0
                              setCopilotSelections((current) =>
                                current.map((item, i) => (i === index ? { ...item, nameIndex } : item)),
                              )
                            }}
                            className="mt-1 w-full rounded-lg border border-[#2A2A32] bg-[#0A0A0C] px-3 py-2 text-sm text-[#F0F0F0] outline-none focus:border-[#F0F0F0]/40 disabled:opacity-60"
                          >
                            {src.nameCandidates.map((name, i) => (
                              <option key={`${name}-${i}`} value={i}>
                                {name}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className="block">
                          <span className="font-mono text-[10px] tracking-widest uppercase text-[#6B6B7B]">
                            URL
                          </span>
                          <select
                            value={selection.urlIndex}
                            disabled={copilotLoading || isBusy}
                            onChange={(event) => {
                              const urlIndex = Number.parseInt(event.target.value, 10) || 0
                              setCopilotSelections((current) =>
                                current.map((item, i) => (i === index ? { ...item, urlIndex } : item)),
                              )
                            }}
                            className="mt-1 w-full rounded-lg border border-[#2A2A32] bg-[#0A0A0C] px-3 py-2 text-sm text-[#F0F0F0] outline-none focus:border-[#F0F0F0]/40 disabled:opacity-60"
                          >
                            {src.urlCandidates.map((u, i) => (
                              <option key={`${u.url}-${i}`} value={i}>
                                {u.isFeedLike ? "✅ " : "⚠ "} {u.url}
                              </option>
                            ))}
                          </select>
                          {selectedUrl && !selectedUrl.isFeedLike ? (
                            <p className="mt-1 text-xs text-[#FFB800]">
                              This URL may not be RSS/Atom. Pick a feed-like URL to enable saving.
                            </p>
                          ) : null}
                        </label>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : null}
          </div>
        ) : null}

        {hasMultipleRules ? (
          <p className="mt-3 text-xs text-[#FFB800]">
            Multiple rules found. This view currently edits the first rule only.
          </p>
        ) : null}

        {!isEnabled ? (
          <p className="mt-3 text-xs text-[#6B6B7B]">
            Enable personalized challenge alerts to configure sources and keywords.
          </p>
        ) : trustedSources.length === 0 ? (
          <p className="mt-3 text-xs text-[#6B6B7B]">
            Add trusted sources first, then choose exactly which ones trigger alerts.
          </p>
        ) : (
          <>
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="block">
                <span className="font-mono text-[10px] tracking-widest uppercase text-[#6B6B7B]">
                  Mode
                </span>
                <select
                  disabled={!isEnabled || isBusy}
                  value={activeMode}
                  onChange={(event) => {
                    void handleModeChange(event.target.value as AlertRule["mode"])
                  }}
                  className="mt-1 w-full rounded-lg border border-[#2A2A32] bg-[#0A0A0C] px-3 py-2 text-sm text-[#F0F0F0] outline-none focus:border-[#F0F0F0]/40 disabled:opacity-60"
                >
                  {MODE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="font-mono text-[10px] tracking-widest uppercase text-[#6B6B7B]">
                  Minimum confidence
                </span>
                <select
                  disabled={!isEnabled || isBusy}
                  value={activeConfidence}
                  onChange={(event) => {
                    void handleMinConfidenceChange(event.target.value as AlertRule["min_confidence"])
                  }}
                  className="mt-1 w-full rounded-lg border border-[#2A2A32] bg-[#0A0A0C] px-3 py-2 text-sm text-[#F0F0F0] outline-none focus:border-[#F0F0F0]/40 disabled:opacity-60"
                >
                  {CONFIDENCE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <p className="mt-2 text-xs text-[#6B6B7B]">
              {MODE_OPTIONS.find((option) => option.value === activeMode)?.hint}
            </p>

            <div className="mt-4 space-y-2">
              {trustedSources.map((source) => (
                <label
                  key={source.id}
                  className="flex items-center gap-3 rounded-lg border border-[#2A2A32] bg-[#0F0F12] px-3 py-2"
                >
                  <input
                    type="checkbox"
                    checked={selectedSourceIds.has(source.id)}
                    disabled={!isEnabled || isBusy}
                    onChange={(event) => {
                      void handleSourceToggle(source.id, event.target.checked)
                    }}
                  />
                  <span className="text-sm text-[#F0F0F0]">{source.name}</span>
                </label>
              ))}
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <p className="font-mono text-[10px] tracking-widest uppercase text-[#6B6B7B]">
                  Include keywords (optional)
                </p>
                <div className="mt-2 flex gap-2">
                  <input
                    type="text"
                    value={includeInput}
                    disabled={!isEnabled || isBusy}
                    onChange={(event) => setIncludeInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault()
                        void handleAddKeyword("include")
                      }
                    }}
                    placeholder='e.g. "downgrade", "guidance"'
                    className="w-full rounded-lg border border-[#2A2A32] bg-[#0A0A0C] px-3 py-2 text-sm text-[#F0F0F0] outline-none focus:border-[#F0F0F0]/40 disabled:opacity-60"
                  />
                  <button
                    type="button"
                    disabled={!isEnabled || isBusy}
                    onClick={() => void handleAddKeyword("include")}
                    className="shrink-0 rounded-lg border border-[#2A2A32] px-3 py-2 font-mono text-[10px] tracking-widest text-[#F0F0F0] transition-colors hover:bg-[#F0F0F0]/5 disabled:opacity-60"
                  >
                    ADD
                  </button>
                </div>
                {includeKeywords.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {includeKeywords.map((kw) => (
                      <button
                        key={kw}
                        type="button"
                        disabled={!isEnabled || isBusy}
                        onClick={() => void handleRemoveKeyword("include", kw)}
                        className="rounded-full border border-[#2A2A32] bg-[#0F0F12] px-3 py-1 text-xs text-[#F0F0F0] hover:border-[#FF3B30]/40 hover:text-[#FF3B30] disabled:opacity-60"
                        title="Remove keyword"
                      >
                        {kw}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-[#6B6B7B]">
                    If set, alerts only trigger when the article matches at least one keyword.
                  </p>
                )}
              </div>

              <div>
                <p className="font-mono text-[10px] tracking-widest uppercase text-[#6B6B7B]">
                  Exclude keywords (optional)
                </p>
                <div className="mt-2 flex gap-2">
                  <input
                    type="text"
                    value={excludeInput}
                    disabled={!isEnabled || isBusy}
                    onChange={(event) => setExcludeInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault()
                        void handleAddKeyword("exclude")
                      }
                    }}
                    placeholder='e.g. "technical analysis"'
                    className="w-full rounded-lg border border-[#2A2A32] bg-[#0A0A0C] px-3 py-2 text-sm text-[#F0F0F0] outline-none focus:border-[#F0F0F0]/40 disabled:opacity-60"
                  />
                  <button
                    type="button"
                    disabled={!isEnabled || isBusy}
                    onClick={() => void handleAddKeyword("exclude")}
                    className="shrink-0 rounded-lg border border-[#2A2A32] px-3 py-2 font-mono text-[10px] tracking-widest text-[#F0F0F0] transition-colors hover:bg-[#F0F0F0]/5 disabled:opacity-60"
                  >
                    ADD
                  </button>
                </div>
                {excludeKeywords.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {excludeKeywords.map((kw) => (
                      <button
                        key={kw}
                        type="button"
                        disabled={!isEnabled || isBusy}
                        onClick={() => void handleRemoveKeyword("exclude", kw)}
                        className="rounded-full border border-[#2A2A32] bg-[#0F0F12] px-3 py-1 text-xs text-[#F0F0F0] hover:border-[#FF3B30]/40 hover:text-[#FF3B30] disabled:opacity-60"
                        title="Remove keyword"
                      >
                        {kw}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-[#6B6B7B]">
                    If set, alerts never trigger when any excluded keyword matches.
                  </p>
                )}
              </div>
            </div>
          </>
        )}

        {error ? <p className="mt-3 font-mono text-xs text-[#FF3B30]">{error}</p> : null}
      </article>
    </section>
  )
}

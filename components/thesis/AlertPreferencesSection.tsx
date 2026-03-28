"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { SigmaThinkingIndicator } from "@/components/chat/SigmaThinkingIndicator"
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

async function parseJson<T>(response: Response): Promise<T | null> {
  return (await response.json().catch(() => null)) as T | null
}

function normalizeSourceField(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase()
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
  const [copilotIntent, setCopilotIntent] = useState("")
  const [sigmaWebNote, setSigmaWebNote] = useState<string | null>(null)
  const [copilotLoading, setCopilotLoading] = useState(false)
  const [copilotError, setCopilotError] = useState<string | null>(null)
  const [copilotSuggestion, setCopilotSuggestion] = useState<CopilotSuggestion | null>(null)
  const primaryRule = rules[0] ?? null

  const selectedSourceIds = useMemo(() => new Set(primaryRule?.sourceIds ?? []), [primaryRule?.sourceIds])
  const hasMultipleRules = rules.length > 1

  async function createDefaultRule(): Promise<AlertRuleWithSources | null> {
    const response = await fetch(`/api/theses/${thesisId}/alert-rules`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Personalized alert rule",
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
      if (!nextEnabled) {
        setCopilotSuggestion(null)
        setCopilotError(null)
        setSigmaWebNote(null)
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
  const isEnabled = primaryRule?.is_enabled ?? false
  const includeKeywords = primaryRule?.include_keywords ?? []
  const excludeKeywords = primaryRule?.exclude_keywords ?? []
  const selectedSourcesCount = primaryRule?.sourceIds?.length ?? 0
  const selectedSources = trustedSources.filter((source) => selectedSourceIds.has(source.id))

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
    setSigmaWebNote(null)

    try {
      const response = await fetch(`/api/theses/${thesisId}/alert-rules/copilot`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intent }),
      })
      const payload = await parseJson<{
        suggestion?: CopilotSuggestion
        error?: string
        braveSearchNote?: string
      }>(response)
      if (!response.ok || !payload?.suggestion) {
        throw new Error(payload?.error ?? "Copilot request failed")
      }

      setCopilotSuggestion(payload.suggestion)
      setSigmaWebNote(typeof payload.braveSearchNote === "string" ? payload.braveSearchNote : null)
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
      const response = await fetch(`/api/theses/${thesisId}/alert-rules/${rule.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: copilotSuggestion.recommendedMode,
          minConfidence: "high",
          includeKeywords: copilotSuggestion.includeKeywords,
          excludeKeywords: copilotSuggestion.excludeKeywords,
          isEnabled: true,
        }),
      })
      const payload = await parseJson<{ error?: string }>(response)
      if (!response.ok) {
        throw new Error(payload?.error ?? "Failed to save alert settings")
      }

      const nextSelectedSourceIds = new Set(primaryRule?.sourceIds ?? [])
      const createdOrMatchedSources: TrustedSource[] = []
      let addedCount = 0
      let skippedNoFeedCount = 0

      for (const source of copilotSuggestion.sources) {
        const name = source.nameCandidates[0] ?? ""
        const chosenUrl = source.urlCandidates.find((candidate) => candidate.isFeedLike)?.url ?? ""
        if (!name || !chosenUrl) {
          skippedNoFeedCount += 1
          continue
        }

        const matchedSource = [...trustedSources, ...createdOrMatchedSources].find((candidate) => {
          const nameMatches = normalizeSourceField(candidate.name) === normalizeSourceField(name)
          const urlMatches = normalizeSourceField(candidate.url) === normalizeSourceField(chosenUrl)
          return nameMatches || urlMatches
        })

        let sourceIdToAttach = matchedSource?.id ?? ""

        if (!sourceIdToAttach) {
          const addResponse = await fetch(`/api/theses/${thesisId}/trusted-sources`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name,
              url: chosenUrl,
              sourceType: source.sourceType,
            }),
          })
          const addPayload = await parseJson<{ source?: TrustedSource; error?: string }>(addResponse)
          if (!addResponse.ok || !addPayload?.source) {
            throw new Error(addPayload?.error ?? `Failed to add trusted source "${name}"`)
          }
          sourceIdToAttach = addPayload.source.id
          createdOrMatchedSources.push(addPayload.source)
        }

        if (!sourceIdToAttach || nextSelectedSourceIds.has(sourceIdToAttach)) {
          continue
        }

        const attachResponse = await fetch(`/api/theses/${thesisId}/alert-rules/${rule.id}/sources`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ trustedSourceId: sourceIdToAttach }),
        })
        const attachPayload = await parseJson<{ error?: string }>(attachResponse)
        if (!attachResponse.ok && attachResponse.status !== 409) {
          throw new Error(
            attachPayload?.error ?? `Failed to attach source "${name}" to your personalized alerts.`,
          )
        }

        nextSelectedSourceIds.add(sourceIdToAttach)
        addedCount += 1
      }

      updatePrimaryRule({
        mode: copilotSuggestion.recommendedMode,
        min_confidence: "high",
        include_keywords: copilotSuggestion.includeKeywords,
        exclude_keywords: copilotSuggestion.excludeKeywords,
        is_enabled: true,
        sourceIds: [...nextSelectedSourceIds],
      })

      if (addedCount === 0 && skippedNoFeedCount > 0) {
        setCopilotError("Sigma could not find feed URLs for the proposed sources. Try a more specific prompt.")
      } else if (skippedNoFeedCount > 0) {
        setSigmaWebNote(`Saved ${addedCount} source(s). Skipped ${skippedNoFeedCount} without feed URLs.`)
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
        ALERT PREFERENCES · STEP 1
      </p>
      <article className="rounded-xl border border-[#2A2A32] bg-[#141418] p-4 md:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-[#F0F0F0]">Personalized alerts</p>
            <p className="mt-1 text-xs text-[#6B6B7B]">
              Decide in plain English when Sigma should notify you about this thesis.
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
          {isEnabled
            ? "Advanced options save immediately. Sigma suggestions are saved after you click SAVE ALERT SETUP."
            : "Turn alerts on to describe what you want in plain English."}
        </p>

        {isEnabled ? (
          <div className="mt-4 rounded-xl border border-[#2A2A32] bg-[#0F0F12] p-4">
            <div>
              <p className="font-mono text-[10px] tracking-widest uppercase text-[#8BE8D8]">
                Sigma · plain English setup
              </p>
              <p className="mt-1 text-xs text-[#6B6B7B]">
                Sigma searches the web for real RSS/Atom feeds, proposes sources and keywords, and you confirm
                before anything is saved.
              </p>
            </div>

            <textarea
              value={copilotIntent}
              disabled={copilotLoading || isBusy}
              onChange={(event) => setCopilotIntent(event.target.value)}
              placeholder='Example: "Alert me when Reuters or the WSJ publish anything that could challenge my thesis on margin pressure. Ignore price targets."'
              className="mt-3 w-full rounded-lg border border-[#2A2A32] bg-[#0A0A0C] px-3 py-2 text-sm leading-relaxed text-[#F0F0F0] outline-none focus:border-[#F0F0F0]/40 disabled:opacity-60"
              rows={5}
              maxLength={2000}
            />
            <p className="mt-2 text-xs text-[#6B6B7B]">
              Write naturally: outlets, analysts, topics, and what to ignore. You do not need to paste feed URLs; Sigma
              tries to discover them from web results (with safe fallbacks when needed).
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={copilotLoading || isBusy}
                onClick={() => {
                  void runCopilot()
                }}
                className="rounded-lg border border-[#F0F0F0]/30 px-4 py-2 font-mono text-xs tracking-widest text-[#F0F0F0] transition-colors hover:bg-[#F0F0F0]/5 disabled:opacity-60"
              >
                {copilotLoading ? (
                  <SigmaThinkingIndicator label="SIGMA" compact labelClassName="text-[#F0F0F0] tracking-widest" />
                ) : (
                  "RUN SIGMA"
                )}
              </button>
            </div>

            {copilotError ? <p className="mt-3 font-mono text-xs text-[#FF3B30]">{copilotError}</p> : null}

            {sigmaWebNote ? (
              <p className="mt-3 rounded-lg border border-[#2A2A32] bg-[#0A0A0C] px-3 py-2 text-xs text-[#6B6B7B]">
                {sigmaWebNote}
              </p>
            ) : null}

            {copilotSuggestion ? (
              <p className="mt-3 rounded-lg border border-[#00D1B2]/30 bg-[#00D1B2]/10 px-3 py-2 text-xs text-[#00D1B2]">
                Draft ready. Review below, then click SAVE ALERT SETUP.
              </p>
            ) : null}

            {copilotSuggestion ? (
              <div className="mt-4 space-y-3">
                <div className="rounded-lg border border-[#2A2A32] bg-[#0A0A0C] p-3">
                  <p className="text-xs text-[#6B6B7B]">
                    Recommended: <span className="text-[#F0F0F0]">{copilotSuggestion.recommendedMode}</span>{" "}
                    • confidence fixed to <span className="text-[#F0F0F0]">high</span>
                  </p>
                  {(copilotSuggestion.includeKeywords.length > 0 || copilotSuggestion.excludeKeywords.length > 0) ? (
                    <p className="mt-1 text-xs text-[#6B6B7B]">
                      Keywords: include{" "}
                      <span className="text-[#F0F0F0]">
                        {copilotSuggestion.includeKeywords.length ? copilotSuggestion.includeKeywords.join(", ") : "none"}
                      </span>{" "}
                      • exclude{" "}
                      <span className="text-[#F0F0F0]">
                        {copilotSuggestion.excludeKeywords.length ? copilotSuggestion.excludeKeywords.join(", ") : "none"}
                      </span>
                    </p>
                  ) : null}
                </div>

                <div className="rounded-lg border border-[#2A2A32] bg-[#0A0A0C] p-3">
                  <p className="text-xs text-[#6B6B7B]">Proposed sources:</p>
                  <div className="mt-2 space-y-2">
                    {copilotSuggestion.sources.map((src, index) => {
                      const name = src.nameCandidates[0] ?? "Unnamed source"
                      const firstFeed = src.urlCandidates.find((candidate) => candidate.isFeedLike)?.url ?? ""
                      return (
                        <div key={`${src.sourceType}-${index}`} className="rounded-lg border border-[#2A2A32] p-2">
                          <p className="text-sm text-[#F0F0F0]">
                            {name} <span className="text-xs text-[#6B6B7B]">({src.sourceType})</span>
                          </p>
                          <p className="mt-1 break-all text-xs text-[#6B6B7B]">
                            {firstFeed || "No feed URL found (Sigma will skip this source)."}
                          </p>
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => {
                      void applyCopilotSuggestion()
                    }}
                    className="rounded-lg border border-[#00D1B2]/40 px-4 py-2 font-mono text-xs tracking-widest text-[#00D1B2] transition-colors hover:bg-[#00D1B2]/10 disabled:opacity-60"
                  >
                    SAVE ALERT SETUP
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {isEnabled ? (
          <div className="mt-4 rounded-xl border border-[#2A2A32] bg-[#0F0F12] p-4">
            <p className="font-mono text-[10px] tracking-widest text-[#6B6B7B] uppercase">Current alert sources</p>
            {selectedSources.length > 0 ? (
              <div className="mt-3 space-y-2">
                {selectedSources.map((source) => (
                  <div
                    key={source.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-[#2A2A32] bg-[#0A0A0C] px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm text-[#F0F0F0]">{source.name}</p>
                      <p className="truncate text-xs text-[#6B6B7B]">{source.url ?? "No URL"}</p>
                    </div>
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => {
                        void handleSourceToggle(source.id, false)
                      }}
                      className="shrink-0 rounded-lg border border-[#FF3B30]/40 px-3 py-1 font-mono text-[10px] tracking-widest text-[#FF3B30] hover:bg-[#FF3B30]/10 disabled:opacity-60"
                    >
                      REMOVE
                    </button>
                  </div>
                ))}
                <p className="pt-1 text-xs text-[#6B6B7B]">
                  Need to edit a source URL/name? Use the Trusted Sources section, then run Sigma again if needed.
                </p>
              </div>
            ) : (
              <p className="mt-3 text-xs text-[#6B6B7B]">
                No sources selected yet. Run Sigma above and save the setup to add them.
              </p>
            )}
          </div>
        ) : null}

        {hasMultipleRules ? (
          <p className="mt-3 text-xs text-[#FFB800]">
            Multiple rules found. This view currently edits the first rule only.
          </p>
        ) : null}

        {!isEnabled ? (
          <p className="mt-3 text-xs text-[#6B6B7B]">
            Enable personalized alerts to describe what you want in plain English with Sigma.
          </p>
        ) : null}

        {isEnabled ? (
          <details className="group mt-4 rounded-xl border border-[#2A2A32] bg-[#141418] p-4">
            <summary className="cursor-pointer list-none font-mono text-[10px] tracking-widest text-[#6B6B7B] uppercase marker:content-none [&::-webkit-details-marker]:hidden">
              <span className="text-[#8BE8D8] group-open:text-[#8BE8D8]">Advanced tuning</span>
              <span className="ml-2 text-[#6B6B7B] normal-case tracking-normal">: mode and manual keywords</span>
            </summary>

            <div className="mt-4">
              <div className="grid grid-cols-1 gap-3">
                <label className="block">
                  <span className="font-mono text-[10px] tracking-widest uppercase text-[#6B6B7B]">Mode</span>
                  <select
                    disabled={isBusy}
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
              </div>

              <p className="mt-2 text-xs text-[#6B6B7B]">
                {MODE_OPTIONS.find((option) => option.value === activeMode)?.hint}
              </p>
              <p className="mt-1 text-xs text-[#6B6B7B]">
                Confidence is fixed to high signal only to reduce noisy notifications.
              </p>

              <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <p className="font-mono text-[10px] tracking-widest uppercase text-[#6B6B7B]">
                    Include keywords (optional)
                  </p>
                  <div className="mt-2 flex gap-2">
                    <input
                      type="text"
                      value={includeInput}
                      disabled={isBusy}
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
                      disabled={isBusy}
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
                          disabled={isBusy}
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
                      disabled={isBusy}
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
                      disabled={isBusy}
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
                          disabled={isBusy}
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
            </div>
          </details>
        ) : null}

        {error ? <p className="mt-3 font-mono text-xs text-[#FF3B30]">{error}</p> : null}
      </article>
    </section>
  )
}

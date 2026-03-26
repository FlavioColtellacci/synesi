"use client"

import { useMemo, useState } from "react"
import type { AlertRule, TrustedSource } from "@/types/database"

type AlertRuleWithSources = AlertRule & {
  sourceIds: string[]
}

type AlertPreferencesSectionProps = {
  thesisId: string
  trustedSources: TrustedSource[]
  initialRules: AlertRuleWithSources[]
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
  const [rules, setRules] = useState<AlertRuleWithSources[]>(initialRules)
  const [error, setError] = useState<string | null>(null)
  const [isBusy, setIsBusy] = useState(false)
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

  return (
    <section className="mb-6">
      <p className="mb-4 font-mono text-xs tracking-widest text-[#6B6B7B] uppercase">
        ALERT PREFERENCES
      </p>
      <article className="rounded-xl border border-[#2A2A32] bg-[#141418] p-4 md:p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm text-[#F0F0F0]">Personalized challenge alerts</p>
            <p className="mt-1 text-xs text-[#6B6B7B]">
              Control which trusted sources can trigger thesis challenge notifications.
            </p>
          </div>
          <button
            type="button"
            disabled={isBusy}
            onClick={() => {
              void handleEnabledToggle(!isEnabled)
            }}
            className={`rounded-lg border px-3 py-1.5 font-mono text-[10px] tracking-widest transition-colors disabled:opacity-60 ${
              isEnabled
                ? "border-[#00D1B2]/40 text-[#00D1B2] hover:bg-[#00D1B2]/10"
                : "border-[#2A2A32] text-[#6B6B7B] hover:text-[#F0F0F0]"
            }`}
          >
            {isEnabled ? "ENABLED" : "DISABLED"}
          </button>
        </div>

        {hasMultipleRules ? (
          <p className="mt-3 text-xs text-[#FFB800]">
            Multiple rules found. This view currently edits the first rule only.
          </p>
        ) : null}

        {trustedSources.length === 0 ? (
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
          </>
        )}

        {error ? <p className="mt-3 font-mono text-xs text-[#FF3B30]">{error}</p> : null}
      </article>
    </section>
  )
}

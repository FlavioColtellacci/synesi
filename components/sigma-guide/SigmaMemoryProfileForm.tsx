"use client"

import { useCallback, useEffect, useState } from "react"
import { SIGMA_MEMORY_LIMITS } from "@/lib/sigma-guide-content"

type MemoryPayload = {
  enabled: boolean
  profile: {
    investmentFocus?: string
    monitoringPreferences?: string
    communicationStyle?: string
    notes?: string
  }
  updatedAt?: string
}

const inputClass =
  "mt-1 w-full rounded-lg border border-[#2A2A32] bg-[#0F0F12] px-3 py-2 text-sm text-[#F0F0F0] outline-none transition-colors placeholder:text-[#5A5A68] focus:border-[#00D1B2]/45"

const labelClass = "font-mono text-[10px] uppercase tracking-widest text-[#6B6B7B]"

export default function SigmaMemoryProfileForm() {
  const [loaded, setLoaded] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveOk, setSaveOk] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [enabled, setEnabled] = useState(false)
  const [investmentFocus, setInvestmentFocus] = useState("")
  const [monitoringPreferences, setMonitoringPreferences] = useState("")
  const [communicationStyle, setCommunicationStyle] = useState("")
  const [notes, setNotes] = useState("")

  const hydrate = useCallback(async () => {
    setIsLoading(true)
    setLoadError(null)
    try {
      const response = await fetch("/api/chat/memory", { method: "GET" })
      const payload = (await response.json()) as { memory?: MemoryPayload; error?: string }
      if (!response.ok || !payload.memory) {
        throw new Error(payload.error ?? "Failed to load memory")
      }
      const m = payload.memory
      setEnabled(m.enabled === true)
      setInvestmentFocus(m.profile?.investmentFocus ?? "")
      setMonitoringPreferences(m.profile?.monitoringPreferences ?? "")
      setCommunicationStyle(m.profile?.communicationStyle ?? "")
      setNotes(m.profile?.notes ?? "")
      setLoaded(true)
    } catch {
      setLoadError("Could not load Sigma memory. Try again or use the Memory toggle in the Sigma chat panel.")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void hydrate()
  }, [hydrate])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setSaveError(null)
    setSaveOk(false)
    setIsSaving(true)
    try {
      const response = await fetch("/api/chat/memory", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled,
          profile: {
            investmentFocus,
            monitoringPreferences,
            communicationStyle,
            notes,
          },
        }),
      })
      const payload = (await response.json()) as { memory?: MemoryPayload; error?: string }
      if (!response.ok || !payload.memory) {
        throw new Error(payload.error ?? "Save failed")
      }
      const m = payload.memory
      setEnabled(m.enabled === true)
      setInvestmentFocus(m.profile?.investmentFocus ?? "")
      setMonitoringPreferences(m.profile?.monitoringPreferences ?? "")
      setCommunicationStyle(m.profile?.communicationStyle ?? "")
      setNotes(m.profile?.notes ?? "")
      setSaveOk(true)
    } catch {
      setSaveError("Could not save. Check your connection and try again.")
    } finally {
      setIsSaving(false)
    }
  }

  async function handleReset() {
    if (!window.confirm("Clear Sigma memory profile and turn memory off?")) return
    setSaveError(null)
    setSaveOk(false)
    setIsSaving(true)
    try {
      const response = await fetch("/api/chat/memory", { method: "DELETE" })
      const payload = (await response.json()) as { memory?: MemoryPayload; error?: string }
      if (!response.ok || !payload.memory) {
        throw new Error(payload.error ?? "Reset failed")
      }
      setEnabled(false)
      setInvestmentFocus("")
      setMonitoringPreferences("")
      setCommunicationStyle("")
      setNotes("")
      setSaveOk(true)
    } catch {
      setSaveError("Could not reset memory.")
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <p className="font-mono text-xs text-[#6B6B7B]" aria-live="polite">
        Loading memory profile…
      </p>
    )
  }

  if (loadError) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-[#FF6B6B]">{loadError}</p>
        <button
          type="button"
          onClick={() => void hydrate()}
          className="rounded-lg border border-[#2A2A32] px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-[#D9D9E2] transition-colors hover:border-[#F0F0F0]/35"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="flex cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="h-4 w-4 rounded border-[#2A2A32] bg-[#0F0F12] text-[#00D1B2] focus:ring-[#00D1B2]/40"
          />
          <span className={labelClass}>Use Sigma memory in conversations</span>
        </label>
        <p className="text-xs text-[#6B6B7B]">
          Same as the Memory on/off control in the Sigma chat header. Applies only when enabled.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label htmlFor="sigma-mem-focus" className={labelClass}>
            Investment focus · max {SIGMA_MEMORY_LIMITS.investmentFocus} characters
          </label>
          <textarea
            id="sigma-mem-focus"
            value={investmentFocus}
            maxLength={SIGMA_MEMORY_LIMITS.investmentFocus}
            onChange={(e) => setInvestmentFocus(e.target.value)}
            rows={2}
            className={inputClass}
            placeholder="e.g. Long-term quality, US large cap, avoid leveraged names"
          />
        </div>
        <div>
          <label htmlFor="sigma-mem-monitor" className={labelClass}>
            Monitoring preferences · max {SIGMA_MEMORY_LIMITS.monitoringPreferences}
          </label>
          <textarea
            id="sigma-mem-monitor"
            value={monitoringPreferences}
            maxLength={SIGMA_MEMORY_LIMITS.monitoringPreferences}
            onChange={(e) => setMonitoringPreferences(e.target.value)}
            rows={2}
            className={inputClass}
            placeholder="e.g. Prefer trusted-source challenges; flag regulatory headlines"
          />
        </div>
        <div>
          <label htmlFor="sigma-mem-style" className={labelClass}>
            Communication style · max {SIGMA_MEMORY_LIMITS.communicationStyle}
          </label>
          <input
            id="sigma-mem-style"
            type="text"
            value={communicationStyle}
            maxLength={SIGMA_MEMORY_LIMITS.communicationStyle}
            onChange={(e) => setCommunicationStyle(e.target.value)}
            className={inputClass}
            placeholder="e.g. Concise bullets, minimal jargon"
          />
        </div>
        <div>
          <label htmlFor="sigma-mem-notes" className={labelClass}>
            Notes · max {SIGMA_MEMORY_LIMITS.notes}
          </label>
          <textarea
            id="sigma-mem-notes"
            value={notes}
            maxLength={SIGMA_MEMORY_LIMITS.notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className={inputClass}
            placeholder="Anything else Sigma should keep in mind as a light hint"
          />
        </div>
      </div>

      {saveError ? <p className="text-sm text-[#FF6B6B]">{saveError}</p> : null}
      {saveOk && !saveError ? (
        <p className="text-sm text-[#8BE8D8]" role="status">
          Saved.
        </p>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        <button
          type="submit"
          disabled={isSaving || !loaded}
          className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-[#F0F0F0] px-6 py-2 font-mono text-xs tracking-widest text-[#0A0A0C] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isSaving ? "SAVING…" : "SAVE MEMORY"}
        </button>
        <button
          type="button"
          disabled={isSaving}
          onClick={() => void handleReset()}
          className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-[#2A2A32] px-6 py-2 font-mono text-xs tracking-widest text-[#6B6B7B] transition-colors hover:border-[#FF6B6B]/40 hover:text-[#F0F0F0] disabled:cursor-not-allowed disabled:opacity-40"
        >
          CLEAR ALL
        </button>
      </div>
    </form>
  )
}

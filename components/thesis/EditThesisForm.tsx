"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

type EditableAssumption = {
  category: string
  statement: string
  breakCondition: string
}

type EditableThesis = {
  id: string
  ticker: string
  companyName: string
  thesisStatement: string
  investingStyle: string
  confidenceLevel: "high" | "medium" | "low"
  exitCriteria: string
  assumptions: EditableAssumption[]
}

type EditThesisFormProps = {
  initialThesis: EditableThesis
}

const fieldClassName =
  "w-full rounded-lg border border-[#2A2A32] bg-[#1C1C22] px-4 py-3 text-sm text-[#F0F0F0] placeholder:text-[#6B6B7B] transition-colors focus:border-[#F0F0F0] focus:outline-none"

export default function EditThesisForm({ initialThesis }: EditThesisFormProps) {
  const router = useRouter()
  const [form, setForm] = useState(initialThesis)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = async () => {
    if (!form.thesisStatement.trim()) {
      setError("Thesis statement cannot be empty.")
      return
    }

    setSaving(true)
    setError(null)

    try {
      const response = await fetch(`/api/theses/${form.id}/edit`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          thesisStatement: form.thesisStatement,
          investingStyle: form.investingStyle,
          confidenceLevel: form.confidenceLevel,
          exitCriteria: form.exitCriteria,
          assumptions: form.assumptions,
        }),
      })

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null
        setError(payload?.error ?? "Failed to save changes.")
        setSaving(false)
        return
      }

      router.push(`/app/thesis/${form.id}`)
      router.refresh()
    } catch {
      setError("Failed to save changes.")
      setSaving(false)
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-3xl bg-[#0A0A0C] px-4 py-10 md:px-10">
      <section className="w-full rounded-xl border border-[#2A2A32] bg-[#141418] p-4 md:p-8">
        <h1 className="font-mono uppercase text-[#F0F0F0] text-xl tracking-widest mb-2">EDIT THESIS</h1>
        <p className="text-sm text-[#6B6B7B] mb-6">
          Update your thesis details. Ticker is locked to keep identity consistent.
        </p>

        <div className="space-y-5">
          <div>
            <label className="text-xs text-[#6B6B7B] font-mono uppercase tracking-widest mb-2 block">
              TICKER
            </label>
            <input
              type="text"
              value={form.ticker}
              disabled
              className={`${fieldClassName} w-full font-mono uppercase md:w-40 opacity-70 cursor-not-allowed`}
            />
            <p className="mt-2 text-xs text-[#6B6B7B]">Company: {form.companyName}</p>
          </div>

          <div>
            <label className="text-xs text-[#6B6B7B] font-mono uppercase tracking-widest mb-2 block">
              THESIS STATEMENT
            </label>
            <textarea
              rows={4}
              value={form.thesisStatement}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  thesisStatement: event.target.value,
                }))
              }
              className={`${fieldClassName} resize-none`}
            />
          </div>

          <div>
            <label className="text-xs text-[#6B6B7B] font-mono uppercase tracking-widest mb-2 block">
              INVESTING STYLE
            </label>
            <input
              type="text"
              value={form.investingStyle}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  investingStyle: event.target.value,
                }))
              }
              className={fieldClassName}
            />
          </div>

          <div>
            <label className="text-xs text-[#6B6B7B] font-mono uppercase tracking-widest mb-2 block">
              ASSUMPTIONS
            </label>
            <div>
              {form.assumptions.map((assumption, index) => (
                <div
                  key={`${assumption.category}-${index}`}
                  className="bg-[#0A0A0C] border border-[#2A2A32] rounded-lg p-4 mb-3"
                >
                  <p className="font-mono uppercase text-xs text-[#6B6B7B] mb-2">
                    {assumption.category}
                  </p>

                  <label className="text-xs text-[#6B6B7B] font-mono uppercase tracking-widest mb-2 block">
                    STATEMENT
                  </label>
                  <textarea
                    rows={2}
                    value={assumption.statement}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        assumptions: prev.assumptions.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, statement: event.target.value } : item,
                        ),
                      }))
                    }
                    className={`${fieldClassName} resize-none mb-3`}
                  />

                  <label className="text-xs text-[#6B6B7B] font-mono uppercase tracking-widest mb-2 block">
                    I&apos;LL KNOW THIS IS BROKEN IF...
                  </label>
                  <textarea
                    rows={2}
                    value={assumption.breakCondition}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        assumptions: prev.assumptions.map((item, itemIndex) =>
                          itemIndex === index
                            ? { ...item, breakCondition: event.target.value }
                            : item,
                        ),
                      }))
                    }
                    className={`${fieldClassName} resize-none`}
                  />
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs text-[#6B6B7B] font-mono uppercase tracking-widest mb-2 block">
              CONFIDENCE
            </label>
            <div className="flex flex-col gap-2 md:flex-row md:items-center">
              {(["high", "medium", "low"] as const).map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() =>
                    setForm((prev) => ({
                      ...prev,
                      confidenceLevel: level,
                    }))
                  }
                  className={`font-mono text-xs tracking-widest px-4 py-2 rounded-full transition-colors ${
                    form.confidenceLevel === level
                      ? "bg-[#F0F0F0] text-[#0A0A0C]"
                      : "border border-[#2A2A32] text-[#6B6B7B] hover:text-[#F0F0F0]"
                  }`}
                >
                  {level.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs text-[#6B6B7B] font-mono uppercase tracking-widest mb-2 block">
              I&apos;LL SELL IF...
            </label>
            <textarea
              rows={3}
              value={form.exitCriteria}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  exitCriteria: event.target.value,
                }))
              }
              className={`${fieldClassName} resize-none`}
            />
          </div>
        </div>

        {error ? <p className="text-sm text-[#FF3B30] font-mono mt-4">{error}</p> : null}

        <div className="mt-8 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <button
            type="button"
            onClick={() => router.push(`/app/thesis/${form.id}`)}
            className="cursor-pointer self-start font-mono text-sm text-[#6B6B7B] transition-colors hover:text-[#F0F0F0]"
          >
            ← Cancel
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex min-h-[48px] w-full items-center justify-center rounded-full bg-[#F0F0F0] px-6 py-2.5 font-mono text-sm tracking-widest text-[#0A0A0C] transition-colors hover:bg-[#E8E8E8] md:w-auto disabled:opacity-50"
          >
            {saving ? "SAVING..." : "SAVE CHANGES →"}
          </button>
        </div>
      </section>
    </main>
  )
}

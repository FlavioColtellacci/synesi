"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { renderAssistantContent, renderUserContent } from "@/components/chat/message-rendering"
import { SigmaThinkingIndicator } from "@/components/chat/SigmaThinkingIndicator"
import {
  LANDING_SIGMA_DEMO_PROMPT_LIMIT,
  LANDING_SIGMA_DEMO_VISITOR_HEADER,
  type LandingSigmaDemoResponse,
} from "@/lib/chat/marketing-demo"

type DemoMessage = {
  id: string
  role: "user" | "assistant"
  content: string
  isTyping?: boolean
}

const DEMO_TOKEN_STORAGE_KEY = "synesi_sigma_demo_token"
/** Pause after a full exchange before advancing to the next curated example */
const PREVIEW_HOLD_AFTER_TYPING_MS = 3200
/** Slower, deliberate user-line typing for a premium landing feel */
const USER_TYPING_BASE_DELAY_MS = 42
/** Assistant replies read slightly faster than the user line but still unhurried */
const ASSISTANT_TYPING_BASE_DELAY_MS = 28

function getTypingDelay(char: string, baseDelayMs: number) {
  if (char === " ") return Math.max(14, Math.round(baseDelayMs * 0.72))
  if (/[.!?]/.test(char)) return Math.round(baseDelayMs * 4.8)
  if (/[,;:]/.test(char)) return Math.round(baseDelayMs * 3.2)
  if (char === "\n") return Math.round(baseDelayMs * 2.8)
  return baseDelayMs
}

const CURATED_EXAMPLES: ReadonlyArray<{
  id: string
  title: string
  userPrompt: string
  assistantReply: string
}> = [
  {
    id: "monitor",
    title: "Sigma Monitor clarity",
    userPrompt: "What does Sigma Monitor actually do each day?",
    assistantReply:
      "Sigma Monitor runs a daily conviction digest.\n\n- Scans your tracked theses and open alert pressure\n- Summarizes what changed and what matters most\n- Suggests focused next checks inside Synesi\n\nIt is a decision aid, not buy/sell advice.",
  },
  {
    id: "thesis",
    title: "Thesis pressure-test",
    userPrompt: "How can Sigma challenge my thesis without replacing my judgment?",
    assistantReply:
      "Sigma stress-tests your reasoning, not your autonomy.\n\n- Surfaces assumption gaps and potential bias\n- Suggests falsifiable checks and monitoring triggers\n- Keeps your original thesis and revision trail visible\n\nFinal decisions remain yours.",
  },
  {
    id: "workflow",
    title: "Workflow onboarding",
    userPrompt: "I am new. What should I do first in Synesi?",
    assistantReply:
      "Start with a simple conviction workflow.\n\n1. Create one thesis with core assumptions\n2. Add trusted sources and break conditions\n3. Review Sigma Monitor and alerts daily\n\nThis gives you a repeatable loop instead of reactive decisions.",
  },
]

const INTERACTIVE_WELCOME: DemoMessage = {
  id: "assistant-interactive-welcome",
  role: "assistant",
  content:
    "Interactive Sigma demo is live. Ask up to 5 questions this session. After that, continue in the full app.",
}

/** Local / staging only: new visitor token + UI state so the 5-prompt demo can be re-tested. */
const ENABLE_SIGMA_DEMO_SESSION_RESET =
  process.env.NODE_ENV === "development" ||
  process.env.NEXT_PUBLIC_ENABLE_SIGMA_DEMO_SESSION_RESET === "true"

function getOrCreateDemoToken() {
  if (typeof window === "undefined") return null

  const existing = window.sessionStorage.getItem(DEMO_TOKEN_STORAGE_KEY)
  if (existing && existing.length >= 16) return existing

  const generated =
    typeof window.crypto?.randomUUID === "function"
      ? window.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`

  window.sessionStorage.setItem(DEMO_TOKEN_STORAGE_KEY, generated)
  return generated
}

export default function SigmaDemoSection() {
  const [isInteractive, setIsInteractive] = useState(false)
  const [activeExampleIndex, setActiveExampleIndex] = useState(0)
  const [typedPreviewUserPrompt, setTypedPreviewUserPrompt] = useState("")
  const [typedPreviewAssistantReply, setTypedPreviewAssistantReply] = useState("")
  const [isPreviewUserTyping, setIsPreviewUserTyping] = useState(false)
  const [isPreviewAssistantTyping, setIsPreviewAssistantTyping] = useState(false)
  const [input, setInput] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [promptUsage, setPromptUsage] = useState(0)
  const [messages, setMessages] = useState<DemoMessage[]>([INTERACTIVE_WELCOME])
  const [requestError, setRequestError] = useState<string | null>(null)
  const typingTimeoutsRef = useRef<number[]>([])
  const previewTranscriptRef = useRef<HTMLDivElement | null>(null)
  const interactiveTranscriptRef = useRef<HTMLDivElement | null>(null)

  const activeExample = CURATED_EXAMPLES[activeExampleIndex]
  const promptsRemaining = Math.max(0, LANDING_SIGMA_DEMO_PROMPT_LIMIT - promptUsage)
  const limitReached = promptsRemaining === 0

  const registerTypingTimeout = useCallback((callback: () => void, delayMs: number) => {
    const timeoutId = window.setTimeout(callback, delayMs)
    typingTimeoutsRef.current.push(timeoutId)
    return timeoutId
  }, [])

  const clearTypingTimeouts = useCallback(() => {
    for (const timeoutId of typingTimeoutsRef.current) {
      window.clearTimeout(timeoutId)
    }
    typingTimeoutsRef.current = []
  }, [])

  const resetInteractiveDemoSession = useCallback(() => {
    clearTypingTimeouts()
    try {
      window.sessionStorage.removeItem(DEMO_TOKEN_STORAGE_KEY)
    } catch {
      // ignore private mode / storage errors
    }
    setPromptUsage(0)
    setMessages([INTERACTIVE_WELCOME])
    setRequestError(null)
    setInput("")
    setIsSending(false)
  }, [clearTypingTimeouts])

  const animateText = useCallback(({
    text,
    baseDelayMs,
    initialDelayMs = 120,
    onUpdate,
    onComplete,
  }: {
    text: string
    baseDelayMs: number
    initialDelayMs?: number
    onUpdate: (value: string) => void
    onComplete?: () => void
  }) => {
    if (!text) {
      onUpdate("")
      onComplete?.()
      return
    }

    let index = 0
    onUpdate("")

    const step = () => {
      index += 1
      onUpdate(text.slice(0, index))
      if (index >= text.length) {
        onComplete?.()
        return
      }
      const charDelay = getTypingDelay(text[index - 1], baseDelayMs)
      registerTypingTimeout(step, charDelay)
    }

    registerTypingTimeout(step, initialDelayMs)
  }, [registerTypingTimeout])

  useEffect(() => {
    return () => {
      clearTypingTimeouts()
    }
  }, [clearTypingTimeouts])

  useEffect(() => {
    const el = previewTranscriptRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [typedPreviewUserPrompt, typedPreviewAssistantReply, isPreviewUserTyping, isPreviewAssistantTyping])

  useEffect(() => {
    const el = interactiveTranscriptRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [messages, isSending])

  useEffect(() => {
    if (isInteractive) return

    clearTypingTimeouts()
    registerTypingTimeout(() => {
      setTypedPreviewUserPrompt("")
      setTypedPreviewAssistantReply("")
      setIsPreviewUserTyping(true)
      setIsPreviewAssistantTyping(false)

      animateText({
        text: activeExample.userPrompt,
        baseDelayMs: USER_TYPING_BASE_DELAY_MS,
        initialDelayMs: 280,
        onUpdate: setTypedPreviewUserPrompt,
        onComplete: () => {
          setIsPreviewUserTyping(false)
          setIsPreviewAssistantTyping(true)
          registerTypingTimeout(() => {
            animateText({
              text: activeExample.assistantReply,
              baseDelayMs: ASSISTANT_TYPING_BASE_DELAY_MS,
              initialDelayMs: 200,
              onUpdate: setTypedPreviewAssistantReply,
              onComplete: () => {
                setIsPreviewAssistantTyping(false)
                registerTypingTimeout(() => {
                  setActiveExampleIndex((current) => (current + 1) % CURATED_EXAMPLES.length)
                }, PREVIEW_HOLD_AFTER_TYPING_MS)
              },
            })
          }, 520)
        },
      })
    }, 0)

    return () => {
      clearTypingTimeouts()
    }
  }, [
    activeExample.assistantReply,
    activeExample.userPrompt,
    animateText,
    clearTypingTimeouts,
    isInteractive,
    registerTypingTimeout,
  ])

  const promptCounterLabel = useMemo(
    () => `${Math.min(promptUsage, LANDING_SIGMA_DEMO_PROMPT_LIMIT)}/${LANDING_SIGMA_DEMO_PROMPT_LIMIT}`,
    [promptUsage],
  )

  async function sendInteractivePrompt() {
    const trimmed = input.trim()
    if (!trimmed || isSending || limitReached) return

    const userMessage: DemoMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: trimmed,
    }

    setRequestError(null)
    setInput("")
    setIsSending(true)
    setMessages((current) => [...current, userMessage])

    try {
      const token = getOrCreateDemoToken()
      const response = await fetch("/api/marketing/sigma-demo", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { [LANDING_SIGMA_DEMO_VISITOR_HEADER]: token } : {}),
        },
        body: JSON.stringify({ message: trimmed }),
      })

      const payload = (await response.json()) as Partial<LandingSigmaDemoResponse> & { error?: string }
      const answer =
        typeof payload.answer === "string" && payload.answer.trim().length > 0
          ? payload.answer
          : "Sigma demo could not answer right now. Please try again."
      const assistantMessage: DemoMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: "",
        isTyping: true,
      }

      setMessages((current) => [...current, assistantMessage])

      if (typeof payload.promptsUsed === "number" && Number.isFinite(payload.promptsUsed)) {
        setPromptUsage(Math.max(0, Math.min(LANDING_SIGMA_DEMO_PROMPT_LIMIT, Math.floor(payload.promptsUsed))))
      } else {
        setPromptUsage((current) => Math.min(LANDING_SIGMA_DEMO_PROMPT_LIMIT, current + 1))
      }

      if (!response.ok && typeof payload.error === "string") {
        setRequestError(payload.error)
      }

      animateText({
        text: answer,
        baseDelayMs: ASSISTANT_TYPING_BASE_DELAY_MS,
        initialDelayMs: 200,
        onUpdate: (value) => {
          setMessages((current) =>
            current.map((message) =>
              message.id === assistantMessage.id ? { ...message, content: value, isTyping: true } : message,
            ),
          )
        },
        onComplete: () => {
          setMessages((current) =>
            current.map((message) =>
              message.id === assistantMessage.id ? { ...message, content: answer, isTyping: false } : message,
            ),
          )
          setIsSending(false)
        },
      })
    } catch {
      setRequestError("Network issue. Please try again in a moment.")
      setMessages((current) => [
        ...current,
        {
          id: `assistant-network-${Date.now()}`,
          role: "assistant",
          content: "I hit a temporary issue. Please retry your prompt.",
        },
      ])
      setIsSending(false)
    }
  }

  return (
    <section id="sigma-demo" className="px-6 py-14 md:px-10 md:py-20">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 text-center">
          <p className="mb-4 font-mono text-xs uppercase tracking-[0.28em] text-[#6B6B7B]">SIGMA DEMO</p>
          <h2 className="font-mono text-2xl font-medium uppercase tracking-wider text-[#F0F0F0] md:text-3xl">
            See Sigma in action
          </h2>
        </div>

        <div className="rounded-2xl border border-[#2A2A32] bg-[#111116] p-4 shadow-[0_30px_80px_rgba(0,0,0,0.45)] md:p-6">
          {!isInteractive ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3 border-b border-[#2A2A32]/70 pb-3">
                <div className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="font-mono text-lg text-[#F0F0F0]"
                    style={{ textShadow: "-1.5px 0 0 rgba(255,50,50,0.7), 1.5px 0 0 rgba(0,210,255,0.7)" }}
                  >
                    Σ
                  </span>
                  <p className="font-mono text-xs uppercase tracking-[0.2em] text-[#F0F0F0]">SIGMA PREVIEW</p>
                </div>
                <p className="font-mono text-[10px] uppercase tracking-widest text-[#6B6B7B]">
                  Example {activeExampleIndex + 1}/{CURATED_EXAMPLES.length}
                </p>
              </div>

              <p className="font-mono text-[10px] uppercase tracking-widest text-[#8B8B9A]">{activeExample.title}</p>

              <div className="h-[20rem] min-h-0 overflow-hidden rounded-xl border border-[#2A2A32]/60 bg-[#0B0B0F]/40 sm:h-[22rem]">
                <div
                  ref={previewTranscriptRef}
                  className="sigma-scrollbar h-full overflow-y-auto overscroll-y-contain px-1 py-3 [overflow-anchor:none]"
                >
                  <div className="space-y-4">
                    <article className="flex w-full justify-end">
                      <div className="max-w-[min(92%,30rem)] rounded-2xl rounded-br-md bg-[#202029] px-3 py-2">
                        {renderUserContent(`${typedPreviewUserPrompt}${isPreviewUserTyping ? "▍" : ""}`)}
                      </div>
                    </article>
                    <article className="flex w-full justify-start">
                      <div className="max-w-[min(92%,30rem)] rounded-2xl rounded-bl-md bg-[#14141A] px-3 py-2 text-[#ECECF2]">
                        {typedPreviewAssistantReply.length > 0
                          ? renderAssistantContent(typedPreviewAssistantReply)
                          : null}
                        {isPreviewAssistantTyping ? (
                          <div className="mt-1">
                            <SigmaThinkingIndicator
                              label="Typing"
                              className="text-[11px] [&>span:first-child]:uppercase [&>span:first-child]:tracking-widest"
                            />
                          </div>
                        ) : null}
                      </div>
                    </article>
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => {
                    clearTypingTimeouts()
                    setIsInteractive(true)
                  }}
                  className="w-full rounded-lg bg-[#F0F0F0] px-4 py-3 font-mono text-xs uppercase tracking-widest text-[#0A0A0C] transition-colors hover:bg-[#E8E8E8]"
                >
                  Try Sigma now
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3 border-b border-[#2A2A32]/70 pb-3">
                <div className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="font-mono text-lg text-[#F0F0F0]"
                    style={{ textShadow: "-1.5px 0 0 rgba(255,50,50,0.7), 1.5px 0 0 rgba(0,210,255,0.7)" }}
                  >
                    Σ
                  </span>
                  <p className="font-mono text-xs uppercase tracking-[0.2em] text-[#F0F0F0]">SIGMA LIVE DEMO</p>
                </div>
                <p className="font-mono text-[10px] uppercase tracking-widest text-[#6B6B7B]">Prompts {promptCounterLabel}</p>
              </div>

              <div
                ref={interactiveTranscriptRef}
                className="sigma-scrollbar h-[20rem] min-h-0 space-y-3 overflow-y-auto overscroll-y-contain px-1 py-0.5 [overflow-anchor:none] sm:h-[22rem]"
              >
                {messages.map((message) => (
                  <article
                    key={message.id}
                    className={`flex w-full ${message.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[min(92%,30rem)] rounded-2xl px-3 py-2 ${
                        message.role === "user"
                          ? "rounded-br-md bg-[#202029] text-[#F3F3F8]"
                          : "rounded-bl-md bg-[#14141A] text-[#ECECF2]"
                      }`}
                    >
                      {message.role === "assistant" ? (
                        message.isTyping ? (
                          <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#F0F0F0]">
                            {message.content}
                            <span className="animate-pulse">▍</span>
                          </p>
                        ) : (
                          renderAssistantContent(message.content)
                        )
                      ) : (
                        renderUserContent(message.content)
                      )}
                    </div>
                  </article>
                ))}

                {isSending ? (
                  <article className="flex w-full justify-start">
                    <div className="inline-flex max-w-[min(92%,26rem)] items-center gap-2 rounded-2xl rounded-bl-md bg-[#14141A] px-3 py-2">
                      <SigmaThinkingIndicator label="Thinking" />
                    </div>
                  </article>
                ) : null}
              </div>

              <form
                onSubmit={(event) => {
                  event.preventDefault()
                  void sendInteractivePrompt()
                }}
                className="space-y-2 border-t border-[#2A2A32]/70 pt-3"
              >
                <div className="flex items-center gap-2 rounded-full border border-[#2A2A32]/85 bg-[#0B0B0F] px-3 py-2.5">
                  <input
                    value={input}
                    maxLength={360}
                    onChange={(event) => setInput(event.target.value)}
                    disabled={isSending || limitReached}
                    placeholder={limitReached ? "Demo limit reached. Continue in app." : "Ask Sigma a question..."}
                    className="w-full bg-transparent px-1 py-1 text-sm text-[#F0F0F0] outline-none placeholder:text-[#6B6B7B] disabled:cursor-not-allowed"
                  />
                  <button
                    type="submit"
                    disabled={isSending || input.trim().length === 0 || limitReached}
                    aria-busy={isSending}
                    className="inline-flex min-w-[4.25rem] items-center justify-center rounded-full bg-[#F0F0F0] px-4 py-2 font-mono text-xs tracking-widest text-[#0A0A0C] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {isSending ? <SigmaThinkingIndicator compact /> : "SEND"}
                  </button>
                </div>

                <p className="text-[11px] text-[#6B6B7B]">
                  {limitReached
                    ? "5/5 prompts used. Continue in the full app for unlimited Sigma support."
                    : `${promptsRemaining} prompt${promptsRemaining === 1 ? "" : "s"} remaining in this demo session.`}
                </p>
                {ENABLE_SIGMA_DEMO_SESSION_RESET ? (
                  <button
                    type="button"
                    onClick={() => resetInteractiveDemoSession()}
                    className="text-left font-mono text-[10px] uppercase tracking-widest text-[#5A5A68] underline decoration-[#5A5A68]/50 underline-offset-2 transition-colors hover:text-[#8B8B9A] hover:decoration-[#8B8B9A]/60"
                  >
                    Reset demo session (test)
                  </button>
                ) : null}
                {requestError ? <p className="text-[11px] text-amber-300">{requestError}</p> : null}
              </form>

              {limitReached ? (
                <div className="flex flex-col gap-2 pt-1 sm:flex-row">
                  <Link
                    href="/signup"
                    className="inline-block rounded-lg bg-[#F0F0F0] px-4 py-2.5 text-center font-mono text-xs uppercase tracking-widest text-[#0A0A0C] transition-colors hover:bg-[#E8E8E8]"
                  >
                    Continue with free trial
                  </Link>
                  <Link
                    href="/login"
                    className="inline-block rounded-lg border border-[#2A2A32] px-4 py-2.5 text-center font-mono text-xs uppercase tracking-widest text-[#F0F0F0] transition-colors hover:border-[#F0F0F0]/60"
                  >
                    Log in
                  </Link>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

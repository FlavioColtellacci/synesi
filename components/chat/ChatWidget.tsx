"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { usePathname } from "next/navigation"
import { trackAppEvent } from "@/lib/analytics"
import type { ChatAssistantResponse, ChatRequestMessage } from "@/lib/chat/types"

type ChatMessage = {
  id: string
  role: "user" | "assistant"
  content: string
  sourceTags?: ChatAssistantResponse["sourceTags"]
  confidence?: ChatAssistantResponse["confidence"]
  escalation?: ChatAssistantResponse["escalation"]
  followUpActions?: string[]
}

const QUICK_ACTIONS = [
  "How do I create a thesis?",
  "How do trusted sources and alerts work?",
  "Explain this dashboard to me",
  "How does pricing and billing work?",
]

const INITIAL_MESSAGE: ChatMessage = {
  id: "assistant-welcome",
  role: "assistant",
  content:
    "Good to see you. I can help with Synesi workflows, your theses, alerts, billing, and general guidance with care and precision.",
  sourceTags: ["ProductGuide", "WorkflowGuide"],
  confidence: "high",
  escalation: "none",
  followUpActions: ["Create a thesis", "Review alerts", "Check billing options"],
}

export default function ChatWidget() {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)
  const [input, setInput] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE])
  const [showSuggestions, setShowSuggestions] = useState(true)
  const messageContainerRef = useRef<HTMLDivElement | null>(null)

  const chatHistory = useMemo<ChatRequestMessage[]>(
    () => messages.map((message) => ({ role: message.role, content: message.content })),
    [messages],
  )
  const hasUserMessages = useMemo(
    () => messages.some((message) => message.role === "user"),
    [messages],
  )

  useEffect(() => {
    const element = messageContainerRef.current
    if (!element) return
    element.scrollTop = element.scrollHeight
  }, [messages, isSending])

  useEffect(() => {
    if (hasUserMessages) {
      setShowSuggestions(false)
    }
  }, [hasUserMessages])

  async function submitFeedback(feedbackType: "thumbs_up" | "thumbs_down" | "handoff_requested", messageId: string) {
    try {
      await fetch("/api/chat/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feedbackType,
          messageId,
          currentPath: pathname,
        }),
      })
    } catch {
      // Ignore telemetry network errors to avoid blocking the UI.
    }
  }

  async function sendMessage(rawMessage: string) {
    const message = rawMessage.trim()
    if (!message || isSending) return

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: message,
    }

    setMessages((current) => {
      const hasStarted = current.some((message) => message.role === "user")

      // Keep the starter assistant content only before the first real user message.
      if (!hasStarted && current.length === 1 && current[0].id === INITIAL_MESSAGE.id) {
        return [userMessage]
      }

      return [...current, userMessage]
    })
    setInput("")
    setIsSending(true)
    trackAppEvent("chat_message_sent", { currentPath: pathname })

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          messages: chatHistory,
          context: { currentPath: pathname },
        }),
      })

      const payload = (await response.json()) as ChatAssistantResponse | { error?: string }
      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content:
          "answer" in payload && typeof payload.answer === "string"
            ? payload.answer
            : "I could not answer that right now. Please try again.",
        sourceTags:
          "sourceTags" in payload && Array.isArray(payload.sourceTags) ? payload.sourceTags : ["GeneralKnowledge"],
        confidence: "confidence" in payload ? payload.confidence : "low",
        escalation: "escalation" in payload ? payload.escalation : "support",
        followUpActions:
          "followUpActions" in payload && Array.isArray(payload.followUpActions)
            ? payload.followUpActions.slice(0, 3)
            : [],
      }

      setMessages((current) => [...current, assistantMessage])
      trackAppEvent("chat_response_received", {
        currentPath: pathname,
        confidence: assistantMessage.confidence ?? "low",
        escalation: assistantMessage.escalation ?? "none",
      })
    } catch {
      setMessages((current) => [
        ...current,
        {
          id: `assistant-error-${Date.now()}`,
          role: "assistant",
          content: "I hit a temporary issue. Please try again in a moment.",
          sourceTags: ["PolicyGuide"],
          confidence: "low",
          escalation: "support",
          followUpActions: ["Retry your question", "Ask a more specific Synesi question"],
        },
      ])
    } finally {
      setIsSending(false)
    }
  }

  return (
    <>
      <button
        type="button"
        aria-label="Open Synesi assistant"
        onClick={() => {
          setIsOpen((current) => {
            const next = !current
            if (next) {
              trackAppEvent("chat_widget_open", { currentPath: pathname })
            }
            return next
          })
        }}
        className="fixed bottom-5 right-5 z-[70] inline-flex h-14 w-14 items-center justify-center rounded-full border border-[#F0F0F0]/35 bg-[#141418] shadow-lg shadow-black/30 transition-colors hover:border-[#F0F0F0]/70 hover:bg-[#1C1C22]"
      >
        <span
          aria-hidden="true"
          className="font-mono text-xl text-[#F0F0F0]"
          style={{ textShadow: "-1.5px 0 0 rgba(255,50,50,0.7), 1.5px 0 0 rgba(0,210,255,0.7)" }}
        >
          Σ
        </span>
      </button>

      {isOpen ? (
        <section className="fixed inset-x-0 bottom-0 top-16 z-[70] border-t border-[#2A2A32] bg-[#0F0F12] sm:inset-auto sm:bottom-24 sm:right-5 sm:top-auto sm:w-[380px] sm:rounded-2xl sm:border sm:bg-[#111116] sm:shadow-2xl sm:shadow-black/50">
          <header className="flex items-center justify-between border-b border-[#2A2A32] px-4 py-3">
            <div>
              <p className="font-mono text-xs uppercase tracking-widest text-[#F0F0F0]">SIGMA</p>
              <p className="text-xs text-[#6B6B7B]">Elegant, careful, and Synesi-first guidance.</p>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded-md border border-[#2A2A32] px-2 py-1 font-mono text-[10px] tracking-widest text-[#6B6B7B] hover:text-[#F0F0F0]"
            >
              CLOSE
            </button>
          </header>

          {!hasUserMessages && showSuggestions ? (
            <div className="border-b border-[#2A2A32] px-3 py-3">
              <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-[#6B6B7B]">
                Quick actions
              </p>
              <div className="flex flex-wrap gap-2">
                {QUICK_ACTIONS.map((action) => (
                  <button
                    key={action}
                    type="button"
                    onClick={() => {
                      void sendMessage(action)
                    }}
                    className="rounded-full border border-[#2A2A32] px-3 py-1.5 text-xs text-[#F0F0F0] transition-colors hover:border-[#F0F0F0]/40 hover:bg-[#F0F0F0]/5"
                  >
                    {action}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div ref={messageContainerRef} className="max-h-[52vh] overflow-y-auto px-3 py-3 sm:max-h-[420px]">
            <div className="space-y-3">
              {messages.map((message) => (
                <article
                  key={message.id}
                  className={`rounded-xl border px-3 py-2 ${
                    message.role === "user"
                      ? "ml-6 border-[#F0F0F0]/25 bg-[#1F1F26]"
                      : "mr-6 border-[#2A2A32] bg-[#15151B]"
                  }`}
                >
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#F0F0F0]">{message.content}</p>

                  {message.role === "assistant" ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {message.sourceTags?.map((tag) => (
                        <span
                          key={`${message.id}-${tag}`}
                          className="rounded-full border border-[#2A2A32] px-2 py-0.5 font-mono text-[10px] text-[#6B6B7B]"
                        >
                          {tag}
                        </span>
                      ))}
                      {message.confidence ? (
                        <span className="font-mono text-[10px] text-[#6B6B7B]">{message.confidence} confidence</span>
                      ) : null}
                    </div>
                  ) : null}

                  {message.role === "assistant" && showSuggestions && message.followUpActions?.length ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {message.followUpActions.map((action) => (
                        <button
                          key={`${message.id}-${action}`}
                          type="button"
                          onClick={() => {
                            void sendMessage(action)
                          }}
                          className="rounded-full border border-[#2A2A32] px-2.5 py-1 text-[11px] text-[#F0F0F0] hover:border-[#F0F0F0]/35"
                        >
                          {action}
                        </button>
                      ))}
                    </div>
                  ) : null}

                  {message.role === "assistant" ? (
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          trackAppEvent("chat_feedback_positive", { currentPath: pathname })
                          void submitFeedback("thumbs_up", message.id)
                        }}
                        className="rounded border border-[#2A2A32] px-2 py-1 text-[11px] text-[#6B6B7B] hover:text-[#F0F0F0]"
                      >
                        👍
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          trackAppEvent("chat_feedback_negative", { currentPath: pathname })
                          void submitFeedback("thumbs_down", message.id)
                        }}
                        className="rounded border border-[#2A2A32] px-2 py-1 text-[11px] text-[#6B6B7B] hover:text-[#F0F0F0]"
                      >
                        👎
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          trackAppEvent("chat_handoff_requested", { currentPath: pathname })
                          void submitFeedback("handoff_requested", message.id)
                        }}
                        className="rounded border border-[#2A2A32] px-2 py-1 font-mono text-[10px] tracking-widest text-[#6B6B7B] hover:text-[#F0F0F0]"
                      >
                        NEED HUMAN HELP
                      </button>
                    </div>
                  ) : null}
                </article>
              ))}
              {isSending ? <p className="font-mono text-xs text-[#6B6B7B]">Thinking…</p> : null}
            </div>
          </div>

          <form
            className="border-t border-[#2A2A32] px-3 py-3"
            onSubmit={(event) => {
              event.preventDefault()
              void sendMessage(input)
            }}
          >
            {hasUserMessages ? (
              <div className="mb-2">
                <button
                  type="button"
                  onClick={() => setShowSuggestions((current) => !current)}
                  className="rounded-md border border-[#2A2A32] px-2 py-1 font-mono text-[10px] tracking-widest text-[#6B6B7B] transition-colors hover:text-[#F0F0F0]"
                >
                  {showSuggestions ? "HIDE SUGGESTIONS" : "SUGGESTIONS"}
                </button>
              </div>
            ) : null}
            <label htmlFor="synesi-chat-input" className="sr-only">
              Ask the Synesi assistant
            </label>
            <div className="flex gap-2">
              <input
                id="synesi-chat-input"
                value={input}
                maxLength={900}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Ask anything about Synesi or investing workflows..."
                className="w-full rounded-lg border border-[#2A2A32] bg-[#0A0A0C] px-3 py-2 text-sm text-[#F0F0F0] outline-none focus:border-[#F0F0F0]/45"
              />
              <button
                type="submit"
                disabled={isSending || input.trim().length === 0}
                className="rounded-lg bg-[#F0F0F0] px-3 py-2 font-mono text-xs tracking-widest text-[#0A0A0C] disabled:cursor-not-allowed disabled:opacity-40"
              >
                SEND
              </button>
            </div>
            <p className="mt-2 text-[11px] text-[#6B6B7B]">
              Synesi answers are a thinking aid, not financial advice, and never expose sensitive internal details.
            </p>
          </form>
        </section>
      ) : null}
    </>
  )
}

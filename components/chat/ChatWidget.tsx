"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
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
}

export default function ChatWidget() {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)
  const [input, setInput] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE])
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

  async function submitFeedback(feedbackType: "thumbs_up" | "thumbs_down", messageId: string) {
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

      <AnimatePresence>
        {isOpen ? (
          <motion.section
            initial={{ opacity: 0, y: 12, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.99 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="fixed inset-x-0 bottom-0 top-16 z-[70] border-t border-[#2A2A32] bg-[#0F0F12] sm:inset-auto sm:bottom-24 sm:right-5 sm:top-auto sm:w-[380px] sm:rounded-2xl sm:border sm:bg-[#111116] sm:shadow-2xl sm:shadow-black/50"
          >
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

          {!hasUserMessages ? (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18 }}
              className="border-b border-[#2A2A32] px-3 py-3"
            >
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
            </motion.div>
          ) : null}

          <div ref={messageContainerRef} className="max-h-[52vh] overflow-y-auto px-3 py-3 sm:max-h-[420px]">
            <motion.div layout className="space-y-3">
              <AnimatePresence initial={false}>
              {messages.map((message) => (
                <motion.article
                  key={message.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.16, ease: "easeOut" }}
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
                    </div>
                  ) : null}
                </motion.article>
              ))}
              </AnimatePresence>
              {isSending ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="inline-flex items-center gap-2 rounded-lg border border-[#2A2A32] bg-[#15151B] px-3 py-2"
                >
                  <span className="font-mono text-xs text-[#6B6B7B]">Thinking</span>
                  <motion.span
                    animate={{ opacity: [0.2, 1, 0.2] }}
                    transition={{ repeat: Number.POSITIVE_INFINITY, duration: 1.2 }}
                    className="h-1.5 w-1.5 rounded-full bg-[#6B6B7B]"
                  />
                  <motion.span
                    animate={{ opacity: [0.2, 1, 0.2] }}
                    transition={{ repeat: Number.POSITIVE_INFINITY, duration: 1.2, delay: 0.15 }}
                    className="h-1.5 w-1.5 rounded-full bg-[#6B6B7B]"
                  />
                  <motion.span
                    animate={{ opacity: [0.2, 1, 0.2] }}
                    transition={{ repeat: Number.POSITIVE_INFINITY, duration: 1.2, delay: 0.3 }}
                    className="h-1.5 w-1.5 rounded-full bg-[#6B6B7B]"
                  />
                </motion.div>
              ) : null}
            </motion.div>
          </div>

          <form
            className="border-t border-[#2A2A32] px-3 py-3"
            onSubmit={(event) => {
              event.preventDefault()
              void sendMessage(input)
            }}
          >
            <label htmlFor="synesi-chat-input" className="sr-only">
              Ask the Synesi assistant
            </label>
            <div className="flex gap-2">
              <label className="relative block w-full">
                <input
                  id="synesi-chat-input"
                  value={input}
                  maxLength={900}
                  onChange={(event) => setInput(event.target.value)}
                  placeholder=""
                  className="peer w-full rounded-lg border border-[#2A2A32] bg-[#0A0A0C] px-3 py-2 text-sm text-[#F0F0F0] outline-none focus:border-[#F0F0F0]/45"
                />
                {input.trim().length === 0 ? (
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-y-0 left-3 right-3 flex items-center overflow-hidden text-sm text-[#6B6B7B] peer-focus:hidden"
                  >
                    <span className="inline-block animate-[chat-input-placeholder-scroll_7s_ease-in-out_infinite_alternate] whitespace-nowrap">
                      Ask anything about Synesi or investing workflows...
                    </span>
                  </span>
                ) : null}
              </label>
              <button
                type="submit"
                disabled={isSending || input.trim().length === 0}
                className="rounded-lg bg-[#F0F0F0] px-3 py-2 font-mono text-xs tracking-widest text-[#0A0A0C] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isSending ? "..." : "SEND"}
              </button>
            </div>
            <p className="mt-2 text-[11px] text-[#6B6B7B]">
              Synesi answers are a thinking aid, not financial advice, and never expose sensitive internal details.
            </p>
          </form>
          <style jsx>{`
            @keyframes chat-input-placeholder-scroll {
              0% {
                transform: translateX(0);
              }
              100% {
                transform: translateX(-42%);
              }
            }
          `}</style>
          </motion.section>
        ) : null}
      </AnimatePresence>
    </>
  )
}

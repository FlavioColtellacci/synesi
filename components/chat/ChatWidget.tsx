"use client"

import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react"
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
  webContextVerified?: boolean
}

type ResizeDirection = "top" | "left" | "top-left"

const DEFAULT_PANEL_WIDTH = 380
const DEFAULT_PANEL_HEIGHT = 620
const MIN_PANEL_WIDTH = 340
const MIN_PANEL_HEIGHT = 420
const MAX_PANEL_WIDTH = 760
const VIEWPORT_WIDTH_RATIO = 0.92
const TOP_BOTTOM_OFFSET_PX = 120

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
  const [isHydratingHistory, setIsHydratingHistory] = useState(false)
  const [isClearingHistory, setIsClearingHistory] = useState(false)
  const [hasHydratedHistory, setHasHydratedHistory] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE])
  const [showSuggestions, setShowSuggestions] = useState(true)
  const [panelSize, setPanelSize] = useState({
    width: DEFAULT_PANEL_WIDTH,
    height: DEFAULT_PANEL_HEIGHT,
  })
  const messageContainerRef = useRef<HTMLDivElement | null>(null)
  const resizeStateRef = useRef<{
    direction: ResizeDirection
    startX: number
    startY: number
    startWidth: number
    startHeight: number
  } | null>(null)

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

  useEffect(() => {
    if (!isOpen || hasHydratedHistory) return

    let cancelled = false

    async function hydrateHistory() {
      setIsHydratingHistory(true)
      try {
        const response = await fetch("/api/chat/history", { method: "GET" })
        const payload = (await response.json()) as { messages?: ChatMessage[] }

        if (cancelled) return

        const hydratedMessages = Array.isArray(payload.messages) ? payload.messages : []
        if (hydratedMessages.length > 0) {
          setMessages(hydratedMessages)
        } else {
          setMessages([INITIAL_MESSAGE])
          setShowSuggestions(true)
        }
      } catch {
        if (!cancelled) {
          setMessages([INITIAL_MESSAGE])
          setShowSuggestions(true)
        }
      } finally {
        if (!cancelled) {
          setIsHydratingHistory(false)
          setHasHydratedHistory(true)
        }
      }
    }

    void hydrateHistory()

    return () => {
      cancelled = true
    }
  }, [isOpen, hasHydratedHistory])

  useEffect(() => {
    function clamp(value: number, min: number, max: number) {
      return Math.min(Math.max(value, min), max)
    }

    function getMaxWidth() {
      return Math.max(MIN_PANEL_WIDTH, Math.min(MAX_PANEL_WIDTH, Math.floor(window.innerWidth * VIEWPORT_WIDTH_RATIO)))
    }

    function getMaxHeight() {
      return Math.max(MIN_PANEL_HEIGHT, window.innerHeight - TOP_BOTTOM_OFFSET_PX)
    }

    function handlePointerMove(event: PointerEvent) {
      const resizeState = resizeStateRef.current
      if (!resizeState) return

      const deltaX = event.clientX - resizeState.startX
      const deltaY = event.clientY - resizeState.startY
      const shouldResizeWidth = resizeState.direction === "left" || resizeState.direction === "top-left"
      const shouldResizeHeight = resizeState.direction === "top" || resizeState.direction === "top-left"

      let nextWidth = resizeState.startWidth
      let nextHeight = resizeState.startHeight

      if (shouldResizeWidth) {
        nextWidth = resizeState.startWidth - deltaX
      }
      if (shouldResizeHeight) {
        nextHeight = resizeState.startHeight - deltaY
      }

      const maxWidth = getMaxWidth()
      const maxHeight = getMaxHeight()

      setPanelSize({
        width: clamp(nextWidth, MIN_PANEL_WIDTH, maxWidth),
        height: clamp(nextHeight, MIN_PANEL_HEIGHT, maxHeight),
      })
    }

    function handlePointerUp() {
      resizeStateRef.current = null
      document.body.style.userSelect = ""
      document.body.style.cursor = ""
    }

    window.addEventListener("pointermove", handlePointerMove)
    window.addEventListener("pointerup", handlePointerUp)

    return () => {
      window.removeEventListener("pointermove", handlePointerMove)
      window.removeEventListener("pointerup", handlePointerUp)
      document.body.style.userSelect = ""
      document.body.style.cursor = ""
    }
  }, [])

  function handleResizeStart(direction: ResizeDirection, event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType === "touch") return

    event.preventDefault()
    resizeStateRef.current = {
      direction,
      startX: event.clientX,
      startY: event.clientY,
      startWidth: panelSize.width,
      startHeight: panelSize.height,
    }

    document.body.style.userSelect = "none"
    document.body.style.cursor =
      direction === "top" ? "ns-resize" : direction === "left" ? "ew-resize" : "nwse-resize"
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
        webContextVerified: "webContextVerified" in payload ? payload.webContextVerified === true : false,
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

  async function clearConversation() {
    if (isClearingHistory) return

    setIsClearingHistory(true)
    try {
      await fetch("/api/chat/history", { method: "DELETE" })
    } catch {
      // Keep UI reset even if network call fails.
    } finally {
      setMessages([INITIAL_MESSAGE])
      setInput("")
      setShowSuggestions(true)
      setHasHydratedHistory(true)
      setIsClearingHistory(false)
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
        className="fixed bottom-5 right-5 z-[70] inline-flex h-14 w-14 items-center justify-center rounded-full border border-[#F0F0F0]/35 bg-[#141418] shadow-lg shadow-black/30 transform-gpu transition-[transform,box-shadow,background-color,border-color] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:scale-110 hover:border-[#F0F0F0]/70 hover:bg-[#1C1C22] hover:shadow-2xl hover:shadow-black/45 active:scale-100"
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
        <section
          style={
            {
              "--sigma-chat-width": `${panelSize.width}px`,
              "--sigma-chat-height": `${panelSize.height}px`,
            } as CSSProperties
          }
          className="fixed inset-x-0 bottom-0 top-16 z-[70] flex flex-col border-t border-[#2A2A32] bg-[#0F0F12] sm:inset-auto sm:bottom-24 sm:right-5 sm:top-auto sm:h-[var(--sigma-chat-height)] sm:w-[var(--sigma-chat-width)] sm:min-h-[420px] sm:min-w-[340px] sm:max-h-[calc(100vh-7.5rem)] sm:max-w-[min(92vw,760px)] sm:overflow-hidden sm:rounded-2xl sm:border sm:bg-[#111116] sm:shadow-2xl sm:shadow-black/50"
        >
          <div
            aria-hidden="true"
            onPointerDown={(event) => handleResizeStart("top-left", event)}
            className="absolute left-0 top-0 z-10 hidden h-5 w-5 cursor-nwse-resize sm:block"
          />
          <div
            aria-hidden="true"
            onPointerDown={(event) => handleResizeStart("top", event)}
            className="absolute left-5 right-0 top-0 z-10 hidden h-2 cursor-ns-resize sm:block"
          />
          <div
            aria-hidden="true"
            onPointerDown={(event) => handleResizeStart("left", event)}
            className="absolute bottom-0 left-0 top-5 z-10 hidden w-2 cursor-ew-resize sm:block"
          />
          <header className="flex items-center justify-between border-b border-[#2A2A32] px-4 py-3">
            <div>
              <p className="font-mono text-xs uppercase tracking-widest text-[#F0F0F0]">SIGMA</p>
              <p className="text-xs text-[#6B6B7B]">Elegant, careful, and Synesi-first guidance.</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  void clearConversation()
                }}
                disabled={isClearingHistory}
                className="rounded-md border border-[#2A2A32] px-2 py-1 font-mono text-[10px] tracking-widest text-[#6B6B7B] transition-colors hover:text-[#F0F0F0] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isClearingHistory ? "CLEARING" : "CLEAR"}
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-md border border-[#2A2A32] px-2 py-1 font-mono text-[10px] tracking-widest text-[#6B6B7B] hover:text-[#F0F0F0]"
              >
                CLOSE
              </button>
            </div>
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

          <div ref={messageContainerRef} className="flex-1 min-h-0 overflow-y-auto px-3 py-3">
            <div className="space-y-3">
              {isHydratingHistory ? <p className="font-mono text-xs text-[#6B6B7B]">Loading conversation…</p> : null}
              {messages.map((message) => (
                <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                  <article
                    className={`w-full max-w-[86%] rounded-xl border px-3 py-2 ${
                      message.role === "user"
                        ? "border-[#8FD6FF]/30 bg-[#202734] shadow-[0_8px_24px_rgba(0,0,0,0.2)]"
                        : "border-[#2A2A32] bg-[#15151B]"
                    }`}
                  >
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#F0F0F0]">{message.content}</p>

                  {message.role === "assistant" && message.webContextVerified ? (
                    <div className="mt-2 inline-flex items-center gap-1 rounded-full border border-emerald-300/30 bg-emerald-400/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-emerald-200">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
                      Safe link verified
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

                  </article>
                </div>
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

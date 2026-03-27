"use client"

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react"
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
  "Set up personalized alerts",
  "Explain my dashboard in simple terms",
  "What open alerts do I have?",
]

const INITIAL_MESSAGE: ChatMessage = {
  id: "assistant-welcome",
  role: "assistant",
  content:
    "Good to see you. I can help with Synesi workflows, thesis drafting, alert setup, and careful general guidance.",
  sourceTags: ["ProductGuide", "WorkflowGuide"],
  confidence: "high",
  escalation: "none",
  followUpActions: ["Review open alerts", "Set up personalized alerts", "Check convictions status"],
}

function renderInlineMarkdown(text: string): ReactNode[] {
  const chunks: ReactNode[] = []
  const tokenRegex = /(\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|`([^`]+)`|\*\*([^*]+)\*\*|\*([^*]+)\*)/g
  let lastIndex = 0
  let match: RegExpExecArray | null
  let tokenIndex = 0

  while ((match = tokenRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      chunks.push(text.slice(lastIndex, match.index))
    }

    if (match[2] && match[3]) {
      chunks.push(
        <a
          key={`token-link-${tokenIndex}`}
          href={match[3]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#8BE8D8] underline decoration-[#8BE8D8]/40 underline-offset-2 hover:decoration-[#8BE8D8]"
        >
          {match[2]}
        </a>,
      )
    } else if (match[4]) {
      chunks.push(
        <code
          key={`token-code-${tokenIndex}`}
          className="rounded border border-[#2A2A32] bg-[#0E0E13] px-1 py-0.5 font-mono text-[12px] text-[#D9D9E2]"
        >
          {match[4]}
        </code>,
      )
    } else if (match[5]) {
      chunks.push(
        <strong key={`token-strong-${tokenIndex}`} className="font-semibold text-[#FAFAFC]">
          {match[5]}
        </strong>,
      )
    } else if (match[6]) {
      chunks.push(
        <em key={`token-em-${tokenIndex}`} className="italic text-[#E4E4EC]">
          {match[6]}
        </em>,
      )
    }

    lastIndex = tokenRegex.lastIndex
    tokenIndex += 1
  }

  if (lastIndex < text.length) {
    chunks.push(text.slice(lastIndex))
  }

  return chunks
}

function renderAssistantContent(content: string): ReactNode {
  const normalized = content.replace(/\r\n/g, "\n").trim()
  if (!normalized) return null

  const lines = normalized.split("\n")
  const isCompactMobile = normalized.length > 560 || lines.length > 11
  const blocks: ReactNode[] = []
  let listType: "ul" | "ol" | null = null
  let listItems: string[] = []
  let blockIndex = 0

  const flushList = () => {
    if (!listType || listItems.length === 0) return

    const listBody = listItems.map((item, itemIndex) => (
      <li key={`li-${blockIndex}-${itemIndex}`}>{renderInlineMarkdown(item)}</li>
    ))

    if (listType === "ul") {
      blocks.push(
        <div key={`ul-wrap-${blockIndex}`} className="rounded-lg border border-[#2A2A32]/80 bg-[#101018]/80 px-3 py-2">
          <ul className="list-disc space-y-1.5 pl-5 text-[#EAEAF0] marker:text-[#8BE8D8]">{listBody}</ul>
        </div>,
      )
    } else {
      blocks.push(
        <div key={`ol-wrap-${blockIndex}`} className="rounded-lg border border-[#2A2A32]/80 bg-[#101018]/80 px-3 py-2">
          <ol className="list-decimal space-y-1.5 pl-5 text-[#EAEAF0] marker:text-[#8BE8D8]">{listBody}</ol>
        </div>,
      )
    }

    listType = null
    listItems = []
    blockIndex += 1
  }

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) {
      flushList()
      continue
    }

    if (line === "---") {
      flushList()
      blocks.push(<div key={`hr-${blockIndex}`} className="my-1 h-px w-full bg-[#2A2A32]" />)
      blockIndex += 1
      continue
    }

    const headingMatch = line.match(/^#{1,6}\s+(.+)$/)
    if (headingMatch) {
      flushList()
      blocks.push(
        <p key={`h-${blockIndex}`} className="pt-1 text-xs font-mono uppercase tracking-widest text-[#9FA0B3]">
          {headingMatch[1]}
        </p>,
      )
      blockIndex += 1
      continue
    }

    const unorderedMatch = line.match(/^[-*]\s+(.+)$/)
    if (unorderedMatch) {
      if (listType && listType !== "ul") {
        flushList()
      }
      listType = "ul"
      listItems.push(unorderedMatch[1])
      continue
    }

    const orderedMatch = line.match(/^\d+\.\s+(.+)$/)
    if (orderedMatch) {
      if (listType && listType !== "ol") {
        flushList()
      }
      listType = "ol"
      listItems.push(orderedMatch[1])
      continue
    }

    const labelMatch = line.match(/^([A-Za-z][A-Za-z0-9 /&-]{1,50}):$/)
    if (labelMatch) {
      flushList()
      blocks.push(
        <p key={`label-${blockIndex}`} className="pt-1 text-xs font-mono uppercase tracking-widest text-[#8B8B9A]">
          {labelMatch[1]}
        </p>,
      )
      blockIndex += 1
      continue
    }

    flushList()
    blocks.push(
      <p key={`p-${blockIndex}`} className="whitespace-pre-wrap text-[#F0F0F0]/95">
        {renderInlineMarkdown(line)}
      </p>,
    )
    blockIndex += 1
  }

  flushList()
  return (
    <div
      className={`text-sm ${isCompactMobile ? "space-y-2 leading-[1.5] sm:space-y-2.5 sm:leading-relaxed" : "space-y-2.5 leading-relaxed"}`}
    >
      {blocks}
    </div>
  )
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
  const [inputHintOverflowPx, setInputHintOverflowPx] = useState(0)
  const [panelSize, setPanelSize] = useState({
    width: DEFAULT_PANEL_WIDTH,
    height: DEFAULT_PANEL_HEIGHT,
  })
  const messageContainerRef = useRef<HTMLDivElement | null>(null)
  const inputHintViewportRef = useRef<HTMLSpanElement | null>(null)
  const inputHintTextRef = useRef<HTMLSpanElement | null>(null)
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
  const showStarterExamples = !hasUserMessages && !isHydratingHistory

  useEffect(() => {
    const element = messageContainerRef.current
    if (!element) return
    element.scrollTop = element.scrollHeight
  }, [messages, isSending])

  useEffect(() => {
    function measureInputHintOverflow() {
      const viewport = inputHintViewportRef.current
      const text = inputHintTextRef.current

      if (!viewport || !text || input.trim().length > 0) {
        setInputHintOverflowPx(0)
        return
      }

      const overflowPx = Math.max(0, Math.ceil(text.scrollWidth - viewport.clientWidth))
      setInputHintOverflowPx(overflowPx)
    }

    measureInputHintOverflow()

    const viewport = inputHintViewportRef.current
    if (!viewport) return

    let observer: ResizeObserver | null = null
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(() => {
        measureInputHintOverflow()
      })
      observer.observe(viewport)
    }

    window.addEventListener("resize", measureInputHintOverflow)
    return () => {
      observer?.disconnect()
      window.removeEventListener("resize", measureInputHintOverflow)
    }
  }, [input, isOpen, panelSize.width])

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
        }
      } catch {
        if (!cancelled) {
          setMessages([INITIAL_MESSAGE])
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

      <AnimatePresence>
        {isOpen
          ? [
              <motion.div
                key="sigma-backdrop"
                role="presentation"
                aria-hidden
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="fixed inset-0 z-[65] cursor-default bg-black/35 backdrop-blur-[1px]"
                onClick={() => setIsOpen(false)}
              />,
              <motion.section
                key="sigma-panel"
                initial={{ opacity: 0, y: 12, scale: 0.985 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.99 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                style={
                  {
                    "--sigma-chat-width": `${panelSize.width}px`,
                    "--sigma-chat-height": `${panelSize.height}px`,
                  } as CSSProperties
                }
                className="fixed inset-x-0 bottom-0 top-16 z-[70] flex flex-col border-t border-[#2A2A32] bg-[#0F0F12] sm:inset-auto sm:bottom-24 sm:right-5 sm:top-auto sm:h-[var(--sigma-chat-height)] sm:w-[var(--sigma-chat-width)] sm:min-h-[420px] sm:min-w-[340px] sm:max-h-[calc(100vh-7.5rem)] sm:max-w-[min(calc(100vw-1.5rem),760px)] sm:overflow-hidden sm:rounded-2xl sm:border sm:border-[#2A2A32]/80 sm:bg-[#111116] sm:shadow-xl sm:shadow-black/35"
              >
            <div className="pointer-events-none absolute left-0 top-0 z-20 hidden -translate-y-[120%] items-center gap-1 rounded-full border border-[#2A2A32] bg-[#0F0F12]/90 px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest text-[#6B6B7B] sm:inline-flex">
              <span aria-hidden="true">↖</span>
              Drag to resize
            </div>
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
          <header className="relative flex items-center justify-end border-b border-[#2A2A32]/70 px-4 py-2.5">
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center gap-2.5">
              <span
                aria-hidden="true"
                className="font-mono text-base text-[#F0F0F0]"
                style={{ textShadow: "-1.5px 0 0 rgba(255,50,50,0.7), 1.5px 0 0 rgba(0,210,255,0.7)" }}
              >
                Σ
              </span>
              <p className="font-mono text-xs uppercase tracking-[0.22em] text-[#F0F0F0]">SIGMA</p>
            </div>
            <div className="flex items-center gap-2">
              {hasUserMessages ? (
                <button
                  type="button"
                  onClick={() => {
                    void clearConversation()
                  }}
                  disabled={isClearingHistory}
                  className="rounded-md border border-[#2A2A32]/80 px-2 py-1 font-mono text-[10px] tracking-widest text-[#6B6B7B] transition-colors hover:text-[#F0F0F0] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isClearingHistory ? "CLEARING" : "CLEAR"}
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-md border border-[#2A2A32]/80 px-2 py-1 font-mono text-[10px] tracking-widest text-[#6B6B7B] transition-colors hover:text-[#F0F0F0]"
              >
                CLOSE
              </button>
            </div>
          </header>

          <div
            ref={messageContainerRef}
            className={`sigma-scrollbar min-h-0 flex-1 overflow-y-auto px-3 py-3 ${showStarterExamples ? "flex items-center justify-center" : ""}`}
          >
            <motion.div layout className="space-y-3">
              {isHydratingHistory ? <p className="font-mono text-xs text-[#6B6B7B]">Loading conversation…</p> : null}
              {showStarterExamples ? (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  className="mx-auto w-full max-w-[32rem] space-y-5 px-3 pb-1 pt-2 text-center"
                >
                  <div className="space-y-2">
                    <p
                      className="font-mono text-[30px] leading-none text-[#F0F0F0]"
                      style={{ textShadow: "-1.5px 0 0 rgba(255,50,50,0.7), 1.5px 0 0 rgba(0,210,255,0.7)" }}
                    >
                      Σ
                    </p>
                    <p className="text-lg text-[#F0F0F0]">How can I help today?</p>
                  </div>
                  <div className="flex flex-wrap justify-center gap-2">
                    {QUICK_ACTIONS.map((action) => (
                      <button
                        key={action}
                        type="button"
                        onClick={() => setInput(action)}
                        className="rounded-full border border-[#2A2A32] bg-[#101018] px-4 py-1.5 text-sm text-[#D9D9E2] transition-colors hover:border-[#F0F0F0]/35 hover:bg-[#15151F]"
                      >
                        {action}
                      </button>
                    ))}
                  </div>
                </motion.div>
              ) : null}
              <AnimatePresence initial={false}>
              {!showStarterExamples
                ? messages.map((message) => (
                <motion.article
                  key={message.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.16, ease: "easeOut" }}
                  className={`flex w-full ${message.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[min(92%,26rem)] rounded-2xl px-3 py-2 text-left ${
                      message.role === "user"
                        ? "rounded-br-md bg-[#202029] text-[#F3F3F8]"
                        : "rounded-bl-md bg-[#14141A] text-[#ECECF2]"
                    }`}
                  >
                    {message.role === "assistant" ? (
                      renderAssistantContent(message.content)
                    ) : (
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#F0F0F0]">{message.content}</p>
                    )}

                    {message.role === "assistant" && message.webContextVerified ? (
                      <div className="mt-2 inline-flex items-center gap-1 rounded-full border border-emerald-300/30 bg-emerald-400/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-emerald-200">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
                        Safe link verified
                      </div>
                    ) : null}

                  </div>
                </motion.article>
                ))
                : null}
              </AnimatePresence>
              {isSending ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex w-full justify-start"
                >
                  <div className="inline-flex max-w-[min(92%,26rem)] items-center gap-2 rounded-2xl rounded-bl-md bg-[#14141A] px-3 py-2">
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
                </div>
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
            <div className="flex items-center gap-2 rounded-full border border-[#2A2A32]/85 bg-[#0B0B0F] px-3 py-2.5 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
              <label className="relative block w-full">
                <input
                  id="synesi-chat-input"
                  value={input}
                  maxLength={900}
                  onChange={(event) => setInput(event.target.value)}
                  placeholder=""
                  className="peer w-full bg-transparent px-1 py-1.5 text-sm text-[#F0F0F0] outline-none"
                />
                {input.trim().length === 0 ? (
                  <span
                    ref={inputHintViewportRef}
                    aria-hidden
                    className="pointer-events-none absolute inset-y-0 left-1 right-1 flex items-center overflow-hidden text-sm text-[#6B6B7B] peer-focus:hidden"
                  >
                    <motion.span
                      ref={inputHintTextRef}
                      className="inline-block whitespace-nowrap"
                      animate={inputHintOverflowPx > 0 ? { x: [0, -inputHintOverflowPx] } : { x: 0 }}
                      transition={
                        inputHintOverflowPx > 0
                          ? {
                              duration: Math.min(16, Math.max(8, inputHintOverflowPx / 14)),
                              ease: "easeInOut",
                              repeat: Number.POSITIVE_INFINITY,
                              repeatType: "reverse",
                              repeatDelay: 0.7,
                              delay: 0.35,
                            }
                          : { duration: 0.12, ease: "linear" }
                      }
                    >
                      Ask Sigma about Synesi or your investing workflow...
                    </motion.span>
                  </span>
                ) : null}
              </label>
              <button
                type="submit"
                disabled={isSending || input.trim().length === 0}
                className="rounded-full bg-[#F0F0F0] px-4 py-2 font-mono text-xs tracking-widest text-[#0A0A0C] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isSending ? "..." : "SEND"}
              </button>
            </div>
            <p className="mt-2 text-[11px] text-[#6B6B7B]">
              Synesi answers are a thinking aid, not financial advice, and never expose sensitive internal details.
            </p>
          </form>
              </motion.section>,
            ]
          : null}
      </AnimatePresence>
    </>
  )
}

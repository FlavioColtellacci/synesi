"use client"

import {
  type ChangeEvent,
  type DragEvent,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react"
import { AnimatePresence, motion } from "framer-motion"
import { usePathname, useRouter } from "next/navigation"
import { trackAppEvent } from "@/lib/analytics"
import { renderAssistantContent, renderUserContent } from "@/components/chat/message-rendering"
import { SigmaThinkingIndicator } from "@/components/chat/SigmaThinkingIndicator"
import type { ChatAssistantResponse, ChatRequestMessage } from "@/lib/chat/types"

type ChatMessage = {
  id: string
  role: "user" | "assistant"
  content: string
  sourceTags?: ChatAssistantResponse["sourceTags"]
  confidence?: ChatAssistantResponse["confidence"]
  escalation?: ChatAssistantResponse["escalation"]
  followUpActions?: string[]
  actionDrafts?: ChatAssistantResponse["actionDrafts"]
  retrievalEvidence?: ChatAssistantResponse["retrievalEvidence"]
  webContextVerified?: boolean
  webContextSource?: ChatAssistantResponse["webContextSource"]
  webLookupTemporarilyUnavailable?: boolean
  artifacts?: ChatAssistantResponse["artifacts"]
  attachments?: {
    id: string
    fileName: string
  }[]
}

type PendingAttachment = {
  id: string
  fileName: string
  mimeType: string
  sizeBytes: number
  status: "uploading" | "ready" | "failed"
  extractionError?: string
}

type ResizeDirection = "top" | "left" | "top-left"

type SigmaMemoryProfile = {
  enabled: boolean
  profile: {
    investmentFocus?: string
    monitoringPreferences?: string
    communicationStyle?: string
    notes?: string
  }
  updatedAt?: string
}

const DEFAULT_PANEL_WIDTH = 480
const DEFAULT_PANEL_HEIGHT = 720
const MIN_PANEL_WIDTH = 380
const MIN_PANEL_HEIGHT = 520
const MAX_PANEL_WIDTH = 1120
const VIEWPORT_WIDTH_RATIO = 0.94
const TOP_BOTTOM_OFFSET_PX = 140

function readClientBooleanFlag(value: string | undefined, defaultValue: boolean) {
  if (!value) return defaultValue
  const normalized = value.trim().toLowerCase()
  if (["1", "true", "on", "yes"].includes(normalized)) return true
  if (["0", "false", "off", "no"].includes(normalized)) return false
  return defaultValue
}

function formatBytes(sizeBytes: number) {
  if (sizeBytes < 1024) return `${sizeBytes} B`
  if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(1)} KB`
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`
}

const SIGMA_PHASE1_SKILLS_ROUTER_ENABLED = readClientBooleanFlag(
  process.env.NEXT_PUBLIC_SIGMA_PHASE1_SKILLS_ROUTER_ENABLED,
  false,
)
const SIGMA_PHASE1_PLAN_THEN_ANSWER_ENABLED = readClientBooleanFlag(
  process.env.NEXT_PUBLIC_SIGMA_PHASE1_PLAN_THEN_ANSWER_ENABLED,
  false,
)
const PHASE1_ROUTING_VISIBLE = SIGMA_PHASE1_SKILLS_ROUTER_ENABLED || SIGMA_PHASE1_PLAN_THEN_ANSWER_ENABLED

const QUICK_ACTIONS_BASE = [
  "Show my latest Sigma monitor summary",
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

const DEFAULT_MEMORY_PROFILE: SigmaMemoryProfile = {
  enabled: false,
  profile: {},
}

export default function ChatWidget() {
  const pathname = usePathname()
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [unreadAssistantReplies, setUnreadAssistantReplies] = useState(0)
  const [input, setInput] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [isHydratingHistory, setIsHydratingHistory] = useState(false)
  const [isClearingHistory, setIsClearingHistory] = useState(false)
  const [isMemoryLoading, setIsMemoryLoading] = useState(false)
  const [isMemorySaving, setIsMemorySaving] = useState(false)
  const [hasHydratedMemory, setHasHydratedMemory] = useState(false)
  const [memoryProfile, setMemoryProfile] = useState<SigmaMemoryProfile>(DEFAULT_MEMORY_PROFILE)
  const [isWebSearchEnabled, setIsWebSearchEnabled] = useState(false)
  const [isConfirmingAction, setIsConfirmingAction] = useState<string | null>(null)
  const [hasHydratedHistory, setHasHydratedHistory] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [attachments, setAttachments] = useState<PendingAttachment[]>([])
  const [isDraggingFiles, setIsDraggingFiles] = useState(false)
  const [inputHintOverflowPx, setInputHintOverflowPx] = useState(0)
  const [panelSize, setPanelSize] = useState({
    width: DEFAULT_PANEL_WIDTH,
    height: DEFAULT_PANEL_HEIGHT,
  })
  const messageContainerRef = useRef<HTMLDivElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const inputHintViewportRef = useRef<HTMLSpanElement | null>(null)
  const inputHintTextRef = useRef<HTMLSpanElement | null>(null)
  const resizeStateRef = useRef<{
    direction: ResizeDirection
    startX: number
    startY: number
    startWidth: number
    startHeight: number
  } | null>(null)
  const isOpenRef = useRef(false)

  useLayoutEffect(() => {
    isOpenRef.current = isOpen
  }, [isOpen])

  const chatHistory = useMemo<ChatRequestMessage[]>(
    () => messages.map((message) => ({ role: message.role, content: message.content })),
    [messages],
  )
  const hasUserMessages = useMemo(
    () => messages.some((message) => message.role === "user"),
    [messages],
  )
  const showStarterExamples =
    !hasUserMessages && (!isHydratingHistory || messages.length === 0)
  const quickActions = useMemo(() => {
    const actions = [...QUICK_ACTIONS_BASE]
    if (SIGMA_PHASE1_SKILLS_ROUTER_ENABLED) {
      actions.push("Review my thesis assumptions and key risks")
      actions.push("Triage my open alerts by urgency")
    }
    if (SIGMA_PHASE1_PLAN_THEN_ANSWER_ENABLED) {
      actions.push("Give me a step-by-step plan to review my top conviction this week")
    }
    return actions.slice(0, 8)
  }, [])

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
          setMessages([])
        }
      } catch {
        if (!cancelled) {
          setMessages([])
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
    if (!isOpen || hasHydratedMemory) return
    void loadMemoryProfile().finally(() => setHasHydratedMemory(true))
  }, [isOpen, hasHydratedMemory])

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

  async function uploadSingleFile(file: File) {
    const tempId = `temp-${crypto.randomUUID()}`
    const tempAttachment: PendingAttachment = {
      id: tempId,
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      sizeBytes: file.size,
      status: "uploading",
    }
    setAttachments((current) => [...current, tempAttachment])

    try {
      const formData = new FormData()
      formData.append("file", file)
      const response = await fetch("/api/chat/uploads", {
        method: "POST",
        body: formData,
      })
      const payload = (await response.json()) as {
        error?: string
        document?: {
          id: string
          fileName: string
          mimeType: string
          sizeBytes: number
          status: "ready" | "failed"
          extractionError?: string | null
        }
      }

      if (!response.ok || !payload.document) {
        throw new Error(payload.error ?? "Upload failed.")
      }

      setAttachments((current) =>
        current.map((item) =>
          item.id === tempId
            ? {
                id: payload.document!.id,
                fileName: payload.document!.fileName,
                mimeType: payload.document!.mimeType,
                sizeBytes: payload.document!.sizeBytes,
                status: payload.document!.status,
                extractionError: payload.document!.extractionError ?? undefined,
              }
            : item,
        ),
      )
    } catch (error) {
      setAttachments((current) =>
        current.map((item) =>
          item.id === tempId
            ? {
                ...item,
                status: "failed",
                extractionError: error instanceof Error ? error.message : "Upload failed.",
              }
            : item,
        ),
      )
    }
  }

  async function handleFilesSelection(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return
    const files = Array.from(fileList).slice(0, 4)
    for (const file of files) {
      await uploadSingleFile(file)
    }
  }

  async function removeAttachment(attachment: PendingAttachment) {
    setAttachments((current) => current.filter((item) => item.id !== attachment.id))
    if (!attachment.id.startsWith("temp-")) {
      try {
        await fetch(`/api/chat/uploads?id=${encodeURIComponent(attachment.id)}`, { method: "DELETE" })
      } catch {
        // Keep UI responsive even if deletion fails.
      }
    }
  }

  function handleDrop(event: DragEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsDraggingFiles(false)
    void handleFilesSelection(event.dataTransfer.files)
  }

  async function loadMemoryProfile() {
    setIsMemoryLoading(true)
    try {
      const response = await fetch("/api/chat/memory", { method: "GET" })
      const payload = (await response.json()) as { memory?: SigmaMemoryProfile }
      if (!response.ok || !payload.memory) throw new Error("Failed to load memory profile")
      setMemoryProfile({
        enabled: payload.memory.enabled === true,
        profile: {
          investmentFocus: payload.memory.profile?.investmentFocus ?? "",
          monitoringPreferences: payload.memory.profile?.monitoringPreferences ?? "",
          communicationStyle: payload.memory.profile?.communicationStyle ?? "",
          notes: payload.memory.profile?.notes ?? "",
        },
        updatedAt: payload.memory.updatedAt,
      })
    } catch {
      setMemoryProfile(DEFAULT_MEMORY_PROFILE)
    } finally {
      setIsMemoryLoading(false)
    }
  }

  async function toggleMemoryEnabled(nextEnabled: boolean) {
    if (isMemorySaving) return
    setIsMemorySaving(true)
    try {
      const response = await fetch("/api/chat/memory", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: nextEnabled,
          profile: memoryProfile.profile,
        }),
      })
      const payload = (await response.json()) as { memory?: SigmaMemoryProfile }
      if (response.ok && payload.memory) {
        setMemoryProfile(payload.memory)
      } else {
        setMemoryProfile((current) => ({ ...current, enabled: nextEnabled }))
      }
    } catch {
      setMemoryProfile((current) => ({ ...current, enabled: nextEnabled }))
    } finally {
      setIsMemorySaving(false)
    }
  }

  async function sendMessage(rawMessage: string) {
    const message = rawMessage.trim()
    if (!message || isSending) return
    const readyAttachments = attachments.filter((attachment) => attachment.status === "ready")

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: message,
      attachments: readyAttachments.map((attachment) => ({
        id: attachment.id,
        fileName: attachment.fileName,
      })),
    }

    setMessages((current) => {
      const hasStarted = current.some((message) => message.role === "user")

      // Keep the starter assistant content only before the first real user message.
      if (
        !hasStarted &&
        (current.length === 0 || (current.length === 1 && current[0].id === INITIAL_MESSAGE.id))
      ) {
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
          attachmentIds: readyAttachments.map((attachment) => attachment.id),
          context: {
            currentPath: pathname,
            webSearchEnabled: isWebSearchEnabled,
          },
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
        actionDrafts:
          "actionDrafts" in payload && Array.isArray(payload.actionDrafts) ? payload.actionDrafts.slice(0, 3) : [],
        retrievalEvidence:
          "retrievalEvidence" in payload && Array.isArray(payload.retrievalEvidence)
            ? payload.retrievalEvidence.slice(0, 5)
            : [],
        webContextVerified: "webContextVerified" in payload ? payload.webContextVerified === true : false,
        webContextSource:
          "webContextSource" in payload &&
          (payload.webContextSource === "safe_link" || payload.webContextSource === "brave_search")
            ? payload.webContextSource
            : undefined,
        webLookupTemporarilyUnavailable:
          "webLookupTemporarilyUnavailable" in payload ? payload.webLookupTemporarilyUnavailable === true : false,
        artifacts:
          "artifacts" in payload && Array.isArray(payload.artifacts)
            ? payload.artifacts.slice(0, 3).filter((artifact) => {
                if (!artifact || typeof artifact !== "object") return false
                if (!("id" in artifact) || typeof artifact.id !== "string") return false
                if (!("label" in artifact) || typeof artifact.label !== "string") return false
                if (!("signedUrl" in artifact) || typeof artifact.signedUrl !== "string") return false
                return true
              })
            : [],
      }

      setMessages((current) => [...current, assistantMessage])
      if (!isOpenRef.current) {
        setUnreadAssistantReplies((count) => Math.min(count + 1, 99))
      }
      trackAppEvent("chat_response_received", {
        currentPath: pathname,
        confidence: assistantMessage.confidence ?? "low",
        escalation: assistantMessage.escalation ?? "none",
      })
      setAttachments([])
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
      if (!isOpenRef.current) {
        setUnreadAssistantReplies((count) => Math.min(count + 1, 99))
      }
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
      setMessages([])
      setInput("")
      setAttachments([])
      setUnreadAssistantReplies(0)
      setHasHydratedHistory(true)
      setIsClearingHistory(false)
    }
  }

  async function confirmActionDraft(action: NonNullable<ChatAssistantResponse["actionDrafts"]>[number]) {
    const actionKey = `${action.actionType}:${action.thesisId ?? "none"}`
    if (isConfirmingAction === actionKey) return
    setIsConfirmingAction(actionKey)

    try {
      const response = await fetch("/api/chat/actions/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmed: true, action }),
      })
      const payload = (await response.json()) as {
        execution?: { route?: string }
      }

      if (!response.ok || !payload.execution?.route) {
        throw new Error("Action confirmation failed")
      }

      router.push(payload.execution.route)
    } catch {
      setMessages((current) => [
        ...current,
        {
          id: `assistant-action-error-${Date.now()}`,
          role: "assistant",
          content:
            "I could not confirm that action right now. Please open the dashboard and continue manually.",
          sourceTags: ["PolicyGuide"],
          confidence: "low",
          escalation: "support",
          followUpActions: ["Open dashboard", "Try again", "Ask Sigma for manual steps"],
        },
      ])
    } finally {
      setIsConfirmingAction(null)
    }
  }

  return (
    <>
      <button
        type="button"
        aria-label={
          unreadAssistantReplies > 0
            ? `Open Synesi assistant, ${unreadAssistantReplies} new ${unreadAssistantReplies === 1 ? "reply" : "replies"}`
            : "Open Synesi assistant"
        }
        onClick={() => {
          setIsOpen((current) => {
            const next = !current
            if (next) {
              setUnreadAssistantReplies(0)
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
        {unreadAssistantReplies > 0 ? (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -right-0.5 -top-0.5 flex h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full border border-[#0A0A0C] bg-[#00D1B2] px-1 font-mono text-[10px] font-semibold leading-none text-[#0A0A0C]"
          >
            {unreadAssistantReplies > 9 ? "9+" : unreadAssistantReplies}
          </span>
        ) : null}
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
                className="fixed inset-x-0 bottom-0 top-16 z-[70] flex flex-col border-t border-[#2A2A32] bg-[#0F0F12] sm:inset-auto sm:bottom-24 sm:right-5 sm:top-auto sm:h-[var(--sigma-chat-height)] sm:w-[var(--sigma-chat-width)] sm:min-h-[520px] sm:min-w-[380px] sm:max-h-[calc(100vh-8.5rem)] sm:max-w-[min(calc(100vw-1.5rem),1120px)] sm:overflow-hidden sm:rounded-2xl sm:border sm:border-[#2A2A32]/80 sm:bg-[#111116] sm:shadow-xl sm:shadow-black/35"
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
              {PHASE1_ROUTING_VISIBLE ? (
                <span className="rounded-full border border-[#2A2A32]/90 bg-[#15151B] px-2 py-1 font-mono text-[9px] uppercase tracking-[0.15em] text-[#8B8B9A]">
                  Skills beta
                </span>
              ) : null}
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
                onClick={() => {
                  const nextEnabled = !memoryProfile.enabled
                  setMemoryProfile((current) => ({ ...current, enabled: nextEnabled }))
                  void toggleMemoryEnabled(nextEnabled)
                }}
                disabled={isMemoryLoading || isMemorySaving}
                aria-label={`Memory ${memoryProfile.enabled ? "on" : "off"}`}
                title={memoryProfile.enabled ? "Disable Sigma memory" : "Enable Sigma memory"}
                className={`rounded-full border px-2 py-1 font-mono text-[9px] uppercase tracking-[0.15em] transition-colors ${
                  memoryProfile.enabled
                    ? "border-[#00D1B2]/45 bg-[#00D1B2]/10 text-[#8BE8D8] hover:border-[#00D1B2]/70"
                    : "border-[#2A2A32]/90 bg-[#15151B] text-[#8B8B9A] hover:border-[#F0F0F0]/35 hover:text-[#F0F0F0]"
                }`}
              >
                {isMemorySaving ? "Memory: ..." : `Memory: ${memoryProfile.enabled ? "On" : "Off"}`}
              </button>
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
              {isHydratingHistory && !showStarterExamples ? (
                <p className="font-mono text-xs text-[#6B6B7B]">Loading conversation…</p>
              ) : null}
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
                    {quickActions.map((action) => (
                      <button
                        key={action}
                        type="button"
                        onClick={() => {
                          void sendMessage(action)
                        }}
                        disabled={
                          isSending || attachments.some((attachment) => attachment.status === "uploading")
                        }
                        className="rounded-full border border-[#2A2A32] bg-[#101018] px-4 py-1.5 text-sm text-[#D9D9E2] transition-colors hover:border-[#F0F0F0]/35 hover:bg-[#15151F] disabled:cursor-not-allowed disabled:opacity-40"
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
                  className={`flex w-full min-w-0 ${message.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[min(92%,26rem)] min-w-0 rounded-2xl px-3 py-2 text-left break-words ${
                      message.role === "user"
                        ? "rounded-br-md bg-[#202029] text-[#F3F3F8]"
                        : "rounded-bl-md bg-[#14141A] text-[#ECECF2]"
                    }`}
                  >
                    {message.role === "assistant" ? (
                      renderAssistantContent(message.content)
                    ) : (
                      renderUserContent(message.content)
                    )}
                    {message.role === "user" && (message.attachments?.length ?? 0) > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {message.attachments?.map((attachment) => (
                          <span
                            key={attachment.id}
                            className="rounded-full border border-[#3A3A46] bg-[#17171F] px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-[#A8A8B8]"
                          >
                            {attachment.fileName}
                          </span>
                        ))}
                      </div>
                    ) : null}

                    {message.role === "assistant" && message.webContextSource === "safe_link" ? (
                      <div className="mt-2 inline-flex items-center gap-1 rounded-full border border-emerald-300/30 bg-emerald-400/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-emerald-200">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
                        Safe link verified
                      </div>
                    ) : null}
                    {message.role === "assistant" &&
                    !message.webContextSource &&
                    message.webContextVerified ? (
                      <div className="mt-2 inline-flex items-center gap-1 rounded-full border border-emerald-300/30 bg-emerald-400/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-emerald-200">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
                        Safe link verified
                      </div>
                    ) : null}
                    {message.role === "assistant" && message.webContextSource === "brave_search" ? (
                      <div className="mt-2 inline-flex items-center gap-1 rounded-full border border-sky-300/30 bg-sky-400/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-sky-200">
                        <span className="h-1.5 w-1.5 rounded-full bg-sky-300" />
                        Web context verified
                      </div>
                    ) : null}
                    {message.role === "assistant" && message.webLookupTemporarilyUnavailable ? (
                      <div className="mt-2 inline-flex items-center gap-1 rounded-full border border-amber-300/30 bg-amber-400/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-amber-200">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-300" />
                        Web lookup temporarily unavailable
                      </div>
                    ) : null}
                    {message.role === "assistant" && (message.artifacts?.length ?? 0) > 0 ? (
                      <div className="mt-2 space-y-2">
                        <p className="font-mono text-[10px] uppercase tracking-widest text-[#8B8B9A]">Downloads</p>
                        <div className="flex flex-wrap gap-1.5">
                          {message.artifacts?.map((artifact) => (
                            <a
                              key={artifact.id}
                              href={artifact.signedUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="rounded-full border border-cyan-300/35 bg-cyan-400/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest text-cyan-200 transition-colors hover:border-cyan-200/60"
                              title={`${artifact.format.toUpperCase()} · ${formatBytes(artifact.sizeBytes)}`}
                            >
                              {artifact.label} ({artifact.format.toUpperCase()})
                            </a>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {message.role === "assistant" && (message.actionDrafts?.length ?? 0) > 0 ? (
                      <div className="mt-2 space-y-2">
                        <p className="font-mono text-[10px] uppercase tracking-widest text-[#8B8B9A]">
                          Suggested actions
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {message.actionDrafts?.map((action, index) => {
                            const actionKey = `${action.actionType}:${action.thesisId ?? "none"}`
                            const isBusy = isConfirmingAction === actionKey
                            return (
                              <button
                                key={`${actionKey}:${index}`}
                                type="button"
                                onClick={() => {
                                  void confirmActionDraft(action)
                                }}
                                disabled={isBusy}
                                title={action.rationale}
                                className="rounded-full border border-[#2A2A32]/90 bg-[#101018] px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest text-[#D9D9E2] transition-colors hover:border-[#F0F0F0]/35 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {isBusy ? "CONFIRMING..." : action.label}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    ) : null}
                    {message.role === "assistant" && (message.retrievalEvidence?.length ?? 0) > 0 ? (
                      <details className="mt-2 rounded-lg border border-[#2A2A32]/70 bg-[#101018]/80 px-2.5 py-2">
                        <summary className="cursor-pointer list-none font-mono text-[10px] uppercase tracking-widest text-[#6B6B7B] marker:content-none [&::-webkit-details-marker]:hidden">
                          Sources · {message.retrievalEvidence?.length ?? 0}{" "}
                          <span className="font-sans normal-case tracking-normal text-[#5A5A68]">(tap to expand)</span>
                        </summary>
                        <ul className="mt-2 space-y-1 border-t border-[#2A2A32]/50 pt-2 text-[11px] text-[#A8A8B8]">
                          {message.retrievalEvidence?.map((item, index) => (
                            <li key={`${item.source}-${index}`} className="leading-relaxed">
                              - {item.snippet}
                            </li>
                          ))}
                        </ul>
                      </details>
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
                    <SigmaThinkingIndicator label="Thinking" />
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
            onDragOver={(event) => {
              event.preventDefault()
              setIsDraggingFiles(true)
            }}
            onDragLeave={() => setIsDraggingFiles(false)}
            onDrop={handleDrop}
          >
            <label htmlFor="synesi-chat-input" className="sr-only">
              Ask the Synesi assistant
            </label>
            {attachments.length > 0 ? (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {attachments.map((attachment) => (
                  <button
                    key={attachment.id}
                    type="button"
                    onClick={() => {
                      void removeAttachment(attachment)
                    }}
                    className={`rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest transition-colors ${
                      attachment.status === "ready"
                        ? "border-emerald-300/30 bg-emerald-400/10 text-emerald-200"
                        : attachment.status === "failed"
                          ? "border-rose-300/30 bg-rose-400/10 text-rose-200"
                          : "border-[#3A3A46] bg-[#17171F] text-[#A8A8B8]"
                    }`}
                    title={attachment.extractionError ?? "Remove document"}
                  >
                    {attachment.fileName} · {formatBytes(attachment.sizeBytes)} · {attachment.status}
                  </button>
                ))}
              </div>
            ) : null}
            <div className="flex items-center gap-2 rounded-full border border-[#2A2A32]/85 bg-[#0B0B0F] px-3 py-2.5 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.csv,.xlsx"
                className="hidden"
                onChange={(event: ChangeEvent<HTMLInputElement>) => {
                  void handleFilesSelection(event.target.files)
                  event.target.value = ""
                }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                aria-label="Attach documents"
                title="Attach document"
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#2A2A32]/85 text-[#9A9AAA] transition-colors hover:text-[#F0F0F0]"
              >
                <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M7.6 10.9 11.8 6.7a2.4 2.4 0 1 1 3.4 3.4l-5.7 5.7a3.4 3.4 0 1 1-4.8-4.8l6-6"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => setIsWebSearchEnabled((current) => !current)}
                aria-label={`Web search ${isWebSearchEnabled ? "on" : "off"}`}
                title={isWebSearchEnabled ? "Brave search enabled for web-intent prompts" : "Enable Brave search for web-intent prompts"}
                className={`inline-flex h-8 w-8 items-center justify-center rounded-full border transition-colors ${
                  isWebSearchEnabled
                    ? "border-[#00D1B2]/45 bg-[#00D1B2]/10 text-[#8BE8D8]"
                    : "border-[#2A2A32]/85 text-[#7D7D8D] hover:text-[#F0F0F0]"
                }`}
              >
                <svg aria-hidden="true" viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.2" />
                  <path
                    d="M2.9 8H13.1M8 2.5C9.4 4 10.2 5.9 10.2 8C10.2 10.1 9.4 12 8 13.5M8 2.5C6.6 4 5.8 5.9 5.8 8C5.8 10.1 6.6 12 8 13.5"
                    stroke="currentColor"
                    strokeWidth="1.1"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
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
                disabled={isSending || input.trim().length === 0 || attachments.some((item) => item.status === "uploading")}
                aria-busy={isSending}
                className="inline-flex min-w-[4.25rem] items-center justify-center rounded-full bg-[#F0F0F0] px-4 py-2 font-mono text-xs tracking-widest text-[#0A0A0C] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isSending ? <SigmaThinkingIndicator compact /> : "SEND"}
              </button>
            </div>
            <p className="mt-2 text-[11px] text-[#6B6B7B]">
              {isDraggingFiles ? "Drop files to upload. " : ""}
              Supported: PDF, DOCX, CSV, XLSX.
            </p>
            <p className="mt-1 text-[11px] text-[#6B6B7B]">
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

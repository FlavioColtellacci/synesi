"use client"

import {
  type ChangeEvent,
  type DragEvent,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react"
import {
  Content as DropdownMenuContent,
  Item as DropdownMenuItem,
  Portal as DropdownMenuPortal,
  Root as DropdownMenuRoot,
  Trigger as DropdownMenuTrigger,
} from "@radix-ui/react-dropdown-menu"
import { AnimatePresence, motion } from "framer-motion"
import { ArrowUp, Check, Globe, MoreHorizontal, Paperclip, Share2 } from "lucide-react"
import { usePathname, useRouter } from "next/navigation"
import { trackAppEvent } from "@/lib/analytics"
import { cn } from "@/lib/utils"
import { renderAssistantContent, renderUserContent } from "@/components/chat/message-rendering"
import { SigmaThinkingIndicator } from "@/components/chat/SigmaThinkingIndicator"
import {
  clearFabSession,
  expireFabThread,
  isFabSessionExpired,
  readFabSession,
  touchFabSession,
  writeFabSession,
} from "@/lib/chat/fab-session"
import { isWebLookupIntent } from "@/lib/chat/web-intent"
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
/** Below this floating-panel width, use compact header grid (matches cramped mobile sheet). */
const SIGMA_CHAT_COMPACT_HEADER_MAX_WIDTH = 520
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

function SigmaMessageAvatar() {
  return (
    <span
      aria-hidden
      className="synesi-sigma-mark select-none font-mono text-[15px] font-semibold leading-none text-white"
    >
      Σ
    </span>
  )
}

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

export type ChatWidgetProps = {
  /** FAB: floating button + sheet/panel. Full page: inline conversation (Sigma workspace). */
  variant?: "fab" | "fullpage"
  /**
   * When set, history and sends target this thread. Full-page Sigma passes the active route thread.
   * FAB omits this: uses an ephemeral session thread (see `lib/chat/fab-session.ts`) with a TTL.
   */
  threadId?: string
}

function buildChatHistoryUrl(resolvedThreadId?: string) {
  const trimmed = resolvedThreadId?.trim()
  if (!trimmed) return "/api/chat/history"
  return `/api/chat/history?threadId=${encodeURIComponent(trimmed)}`
}

function pickPrimaryThreadIdFromList(threads: { id: string; created_at?: string }[]): string | null {
  if (threads.length === 0) return null
  const dated = threads.filter((t) => typeof t.created_at === "string")
  if (dated.length === 0) return threads[0]?.id ?? null
  return dated.reduce((oldest, t) =>
    new Date(t.created_at!) < new Date(oldest.created_at!) ? t : oldest,
  ).id
}

export default function ChatWidget({ variant = "fab", threadId }: ChatWidgetProps = {}) {
  const isFullpage = variant === "fullpage"
  const pathname = usePathname()
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(isFullpage)
  const [unreadAssistantReplies, setUnreadAssistantReplies] = useState(0)
  const [input, setInput] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [isHydratingHistory, setIsHydratingHistory] = useState(false)
  const [isClearingHistory, setIsClearingHistory] = useState(false)
  const [isMemoryLoading, setIsMemoryLoading] = useState(false)
  const [isMemorySaving, setIsMemorySaving] = useState(false)
  const [hasHydratedMemory, setHasHydratedMemory] = useState(false)
  const [primaryThreadId, setPrimaryThreadId] = useState<string | null>(null)
  const [primaryLookupDone, setPrimaryLookupDone] = useState(false)
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
  const [shareHint, setShareHint] = useState<null | "copied" | "error">(null)
  /** FAB-only: dedicated quick-chat thread (not the workspace primary). */
  const [fabThreadId, setFabThreadId] = useState<string | null>(null)
  const [fabSessionReady, setFabSessionReady] = useState(isFullpage)
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
  const prevThreadIdForResetRef = useRef<string | undefined>(undefined)

  /** Sigma memory profile is stored per user on the primary thread only; hide toggles on secondary full-page threads. */
  const showMemoryControls =
    !isFullpage ||
    !threadId ||
    (primaryLookupDone && threadId === primaryThreadId)

  useLayoutEffect(() => {
    isOpenRef.current = isOpen
  }, [isOpen])

  useEffect(() => {
    if (isFullpage) {
      setIsOpen(true)
    }
  }, [isFullpage])

  useEffect(() => {
    if (!isFullpage) {
      setPrimaryLookupDone(false)
      let cancelled = false
      void (async () => {
        try {
          const response = await fetch("/api/chat/threads")
          const payload = (await response.json()) as { threads?: { id: string; created_at?: string }[] }
          const list = Array.isArray(payload.threads) ? payload.threads : []
          if (!cancelled) {
            setPrimaryThreadId(pickPrimaryThreadIdFromList(list))
            setPrimaryLookupDone(true)
          }
        } catch {
          if (!cancelled) {
            setPrimaryThreadId(null)
            setPrimaryLookupDone(true)
          }
        }
      })()
      return () => {
        cancelled = true
      }
    }
    if (!threadId) {
      setPrimaryLookupDone(true)
      setPrimaryThreadId(null)
      return
    }
    setPrimaryLookupDone(false)
    let cancelled = false
    void (async () => {
      try {
        const response = await fetch("/api/chat/threads")
        const payload = (await response.json()) as { threads?: { id: string; created_at?: string }[] }
        const list = Array.isArray(payload.threads) ? payload.threads : []
        if (!cancelled) {
          setPrimaryThreadId(pickPrimaryThreadIdFromList(list))
          setPrimaryLookupDone(true)
        }
      } catch {
        if (!cancelled) {
          setPrimaryThreadId(null)
          setPrimaryLookupDone(true)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [isFullpage, threadId])

  useEffect(() => {
    if (!isFullpage) {
      prevThreadIdForResetRef.current = threadId
      return
    }
    const prev = prevThreadIdForResetRef.current
    prevThreadIdForResetRef.current = threadId
    if (prev === undefined && threadId === undefined) return
    if (prev === threadId) return
    setHasHydratedHistory(false)
    setMessages([])
    setInput("")
    setAttachments([])
    setUnreadAssistantReplies(0)
  }, [isFullpage, threadId])

  useEffect(() => {
    if (!shareHint) return
    const ms = shareHint === "error" ? 2800 : 2000
    const t = window.setTimeout(() => setShareHint(null), ms)
    return () => window.clearTimeout(t)
  }, [shareHint])

  useEffect(() => {
    if (isFullpage || !isOpen || !primaryLookupDone) return

    let cancelled = false

    void (async () => {
      const session = readFabSession()
      if (session && !isFabSessionExpired(session)) {
        touchFabSession()
        if (!cancelled) {
          setFabThreadId(session.threadId)
          setFabSessionReady(true)
        }
        return
      }

      if (session?.threadId) {
        try {
          await expireFabThread(session.threadId, primaryThreadId)
        } catch {
          /* ignore */
        }
        clearFabSession()
      }

      if (cancelled) return

      try {
        const res = await fetch("/api/chat/threads", { method: "POST" })
        const payload = (await res.json()) as { thread?: { id: string } }
        if (!res.ok || !payload.thread?.id) throw new Error("fab thread")
        const newId = payload.thread.id
        writeFabSession({ threadId: newId, lastActivityAt: Date.now() })
        if (!cancelled) {
          setFabThreadId(newId)
          setMessages([])
          setHasHydratedHistory(false)
          setFabSessionReady(true)
        }
      } catch {
        if (!cancelled) {
          setFabThreadId(null)
          setFabSessionReady(true)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [isFullpage, isOpen, primaryLookupDone, primaryThreadId])

  useEffect(() => {
    if (isFullpage || !fabThreadId) return
    setHasHydratedHistory(false)
  }, [isFullpage, fabThreadId])

  const chatHistory = useMemo<ChatRequestMessage[]>(
    () => messages.map((message) => ({ role: message.role, content: message.content })),
    [messages],
  )
  const hasUserMessages = useMemo(
    () => messages.some((message) => message.role === "user"),
    [messages],
  )
  const viewportBelowSm = useSyncExternalStore(
    (onStoreChange) => {
      const mq = window.matchMedia("(max-width: 639px)")
      mq.addEventListener("change", onStoreChange)
      return () => mq.removeEventListener("change", onStoreChange)
    },
    () => window.matchMedia("(max-width: 639px)").matches,
    () => false,
  )
  const compactSigmaHeader =
    viewportBelowSm ||
    (!isFullpage && panelSize.width < SIGMA_CHAT_COMPACT_HEADER_MAX_WIDTH)
  const effectiveThreadId = useMemo(() => {
    if (isFullpage) return threadId?.trim() || undefined
    return fabThreadId ?? undefined
  }, [isFullpage, threadId, fabThreadId])
  const showStarterExamples =
    !hasUserMessages &&
    (!isHydratingHistory || messages.length === 0) &&
    (isFullpage || fabSessionReady)
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
  const webIntentPreview = useMemo(() => isWebLookupIntent(input), [input])
  const chatInputId = effectiveThreadId
    ? `synesi-chat-input-${effectiveThreadId}`
    : "synesi-chat-input-primary"

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
  }, [input, isFullpage, isOpen, panelSize.width])

  useEffect(() => {
    const shouldHydrate = isFullpage || isOpen
    if (!shouldHydrate || hasHydratedHistory) return
    if (!isFullpage && (!fabSessionReady || !fabThreadId)) return

    let cancelled = false

    async function hydrateHistory() {
      setIsHydratingHistory(true)
      try {
        const response = await fetch(buildChatHistoryUrl(effectiveThreadId), { method: "GET" })
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
  }, [isFullpage, isOpen, hasHydratedHistory, effectiveThreadId, fabSessionReady, fabThreadId])

  useEffect(() => {
    const shouldLoadMemory = isFullpage || isOpen
    if (!shouldLoadMemory || hasHydratedMemory) return
    void loadMemoryProfile().finally(() => setHasHydratedMemory(true))
  }, [isFullpage, isOpen, hasHydratedMemory])

  useEffect(() => {
    if (isFullpage) return
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
  }, [isFullpage])

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
    if (!isFullpage && !effectiveThreadId) return
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
          ...(effectiveThreadId ? { threadId: effectiveThreadId } : {}),
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
      if (!isFullpage) touchFabSession()
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
    if (!effectiveThreadId) return

    setIsClearingHistory(true)
    try {
      await fetch(buildChatHistoryUrl(effectiveThreadId), { method: "DELETE" })
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

  async function handleShareConversation() {
    const url = typeof window !== "undefined" ? window.location.href : ""
    if (!url) return

    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({
          title: "Sigma conversation",
          text: "Open this Sigma conversation",
          url,
        })
        return
      } catch (err: unknown) {
        const name =
          err && typeof err === "object" && "name" in err ? String((err as { name: string }).name) : ""
        if (name === "AbortError") return
      }
    }

    try {
      await navigator.clipboard.writeText(url)
      setShareHint("copied")
    } catch {
      setShareHint("error")
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

  function renderSigmaPanelBody() {
    return (
      <>
        {!isFullpage ? (
          <>
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
          </>
        ) : null}
          <header
            className={cn(
              "sticky top-0 z-10 flex shrink-0 items-center justify-between gap-2 border-b border-[#2A2A2A] bg-[#050505]/50 backdrop-blur-md",
              compactSigmaHeader ? "min-h-[3.25rem] flex-wrap px-3 py-2.5 sm:px-4" : "h-14 px-4 sm:px-6",
            )}
          >
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <span className="shrink-0 rounded border border-[#2A2A2A] px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-tight text-[#888888]">
                Sigma 1.0
              </span>
              {showMemoryControls ? (
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
                  className="flex items-center gap-1.5 rounded px-0.5 py-0.5 transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  <span
                    className={cn(
                      "h-1.5 w-1.5 shrink-0 rounded-full",
                      memoryProfile.enabled ? "bg-emerald-500" : "bg-slate-700",
                    )}
                    aria-hidden
                  />
                  <span className="font-mono text-[9px] font-bold uppercase text-[#888888]">
                    {isMemorySaving ? "Memory: …" : `Memory: ${memoryProfile.enabled ? "On" : "Off"}`}
                  </span>
                </button>
              ) : null}
            </div>
            <div className="relative flex shrink-0 flex-wrap items-center justify-end gap-2 sm:gap-3">
              {PHASE1_ROUTING_VISIBLE ? (
                <span className="rounded-full border border-[#2A2A2A] bg-[#121212] px-2 py-1 font-mono text-[9px] uppercase tracking-[0.15em] text-[#888888]">
                  Skills beta
                </span>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  void handleShareConversation()
                }}
                className="text-[#888888] transition-colors hover:text-[#e5e2e1]"
                aria-label={
                  typeof navigator !== "undefined" && typeof navigator.share === "function"
                    ? "Share or copy conversation link"
                    : "Copy conversation link"
                }
                title={
                  typeof navigator !== "undefined" && typeof navigator.share === "function"
                    ? "Share (mobile) or copy link"
                    : "Copy link to this conversation"
                }
              >
                {shareHint === "copied" ? (
                  <Check className="h-[18px] w-[18px] text-emerald-400" aria-hidden strokeWidth={2.5} />
                ) : (
                  <Share2 className="h-[18px] w-[18px]" aria-hidden />
                )}
              </button>
              <DropdownMenuRoot modal={false}>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="text-[#888888] transition-colors hover:text-[#e5e2e1] data-[state=open]:text-[#e5e2e1]"
                    aria-label="More options"
                    title="More options"
                  >
                    <MoreHorizontal className="h-[18px] w-[18px]" aria-hidden />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuPortal>
                  <DropdownMenuContent
                    align="end"
                    sideOffset={6}
                    className="z-[80] min-w-[12rem] overflow-hidden rounded-lg border border-[#2A2A2A] bg-[#121212] p-1 shadow-lg shadow-black/50"
                  >
                    <DropdownMenuItem
                      className={cn(
                        "cursor-pointer rounded px-2 py-2 text-sm text-[#e5e2e1] outline-none",
                        "data-[disabled]:pointer-events-none data-[disabled]:opacity-40",
                        "data-[highlighted]:bg-[#1A1A1A]",
                      )}
                      disabled={!hasUserMessages || isClearingHistory}
                      onSelect={() => {
                        void clearConversation()
                      }}
                    >
                      {isClearingHistory ? "Clearing conversation…" : "Clear conversation"}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenuPortal>
              </DropdownMenuRoot>
              {!isFullpage ? (
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="shrink-0 rounded-md border border-[#2A2A2A] px-2 py-1 font-mono text-[10px] tracking-widest text-[#888888] transition-colors hover:bg-[#1A1A1A] hover:text-[#e5e2e1]"
                >
                  CLOSE
                </button>
              ) : null}
              {shareHint ? (
                <span
                  className="pointer-events-none absolute right-0 top-full z-20 mt-1 max-w-[min(90vw,16rem)] rounded border border-[#2A2A2A] bg-[#121212] px-2 py-1 text-center text-[11px] leading-snug text-[#e5e2e1] shadow-md"
                  role="status"
                  aria-live="polite"
                >
                  {shareHint === "copied" ? "Link copied" : "Could not copy link"}
                </span>
              ) : null}
            </div>
          </header>

          <div
            ref={messageContainerRef}
            className={`sigma-obsidian-scrollbar min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6 sm:py-10 ${showStarterExamples ? "flex items-center justify-center" : ""}`}
          >
            <motion.div layout className={`mx-auto w-full max-w-3xl ${showStarterExamples ? "space-y-5" : "space-y-12"}`}>
              {!isFullpage && isOpen && (!fabSessionReady || !fabThreadId) ? (
                <p className="font-mono text-xs text-[#888888]">Preparing quick chat…</p>
              ) : isHydratingHistory && !showStarterExamples ? (
                <p className="font-mono text-xs text-[#888888]">Loading conversation…</p>
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
                      className="synesi-sigma-mark font-mono text-[30px] leading-none text-[#e5e2e1]"
                    >
                      Σ
                    </p>
                    <p className="text-lg text-[#e5e2e1]">How can I help today?</p>
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
                          isSending ||
                          attachments.some((attachment) => attachment.status === "uploading") ||
                          (!isFullpage && !effectiveThreadId)
                        }
                        className="rounded-full border border-[#2A2A2A] bg-[#121212] px-4 py-1.5 text-sm text-[#e5e2e1] transition-colors hover:bg-[#1A1A1A] disabled:cursor-not-allowed disabled:opacity-40"
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
                  className={`flex w-full min-w-0 ${message.role === "user" ? "flex-col items-end" : "items-start gap-4"}`}
                >
                  {message.role === "assistant" ? (
                    <div
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#2A2A2A] bg-[#2A2A2A]"
                      aria-hidden
                    >
                      <SigmaMessageAvatar />
                    </div>
                  ) : null}
                  <div
                    className={cn(
                      "min-w-0 break-words text-left text-[13px] leading-relaxed",
                      message.role === "user"
                        ? "max-w-[85%] rounded-2xl rounded-br-md border border-[#2A2A2A] bg-[#121212] px-4 py-2.5 text-[#e5e2e1]"
                        : "flex-1 space-y-4 pt-1 text-[#e5e2e1]",
                    )}
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
                                className="rounded-full border border-[#2A2A2A] bg-transparent px-3 py-1.5 text-[11px] text-[#888888] transition-colors hover:bg-[#1A1A1A] hover:text-[#e5e2e1] disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {isBusy ? "CONFIRMING..." : action.label}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    ) : null}
                    {message.role === "assistant" && (message.retrievalEvidence?.length ?? 0) > 0 ? (
                      <details className="mt-2 rounded-lg border border-[#2A2A2A]/70 bg-[#121212]/80 px-2.5 py-2">
                        <summary className="cursor-pointer list-none font-mono text-[10px] uppercase tracking-widest text-[#888888] marker:content-none [&::-webkit-details-marker]:hidden">
                          Sources · {message.retrievalEvidence?.length ?? 0}{" "}
                          <span className="font-sans normal-case tracking-normal text-[#888888]/80">(tap to expand)</span>
                        </summary>
                        <ul className="mt-2 space-y-1 border-t border-[#2A2A2A]/50 pt-2 text-[11px] text-[#888888]">
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
                  className="flex w-full items-start gap-4"
                >
                  <div
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#2A2A2A] bg-[#2A2A2A]"
                    aria-hidden
                  >
                    <SigmaMessageAvatar />
                  </div>
                  <div className="inline-flex min-w-0 flex-1 items-center gap-2 pt-1">
                    <SigmaThinkingIndicator label="Thinking" labelClassName="text-[#888888]" />
                  </div>
                </motion.div>
              ) : null}
            </motion.div>
          </div>

          <div className="bg-gradient-to-t from-[#050505] via-[#050505] to-transparent pb-8 pt-2">
            <form
              className="mx-auto w-full max-w-3xl px-4 sm:px-6"
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
              <label htmlFor={chatInputId} className="sr-only">
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
                            : "border-[#2A2A2A] bg-[#121212] text-[#888888]"
                      }`}
                      title={attachment.extractionError ?? "Remove document"}
                    >
                      {attachment.fileName} · {formatBytes(attachment.sizeBytes)} · {attachment.status}
                    </button>
                  ))}
                </div>
              ) : null}
              <div className="group rounded-2xl border border-[#2A2A2A] bg-[#121212] p-2 pl-4 transition-colors focus-within:border-[#888888]/50">
                <div className="flex items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.docx,.csv,.xlsx,.png,.jpg,.jpeg,image/png,image/jpeg"
                    className="hidden"
                    onChange={(event: ChangeEvent<HTMLInputElement>) => {
                      void handleFilesSelection(event.target.files)
                      event.target.value = ""
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    aria-label="Attach files"
                    title="Attach files"
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#888888] transition-colors hover:bg-[#1A1A1A] hover:text-[#e5e2e1]"
                  >
                    <Paperclip className="h-[18px] w-[18px]" aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsWebSearchEnabled((current) => !current)}
                    aria-label={`Web search ${isWebSearchEnabled ? "on" : "off"}`}
                    title={
                      isWebSearchEnabled
                        ? "Web lookup is ON. Sigma runs it for messages classified as web lookup requests."
                        : "Enable web lookup for messages like latest news, headlines, or explicit web search requests."
                    }
                    className={cn(
                      "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors",
                      isWebSearchEnabled
                        ? "bg-[#00D1B2]/10 text-[#8BE8D8] hover:bg-[#00D1B2]/15"
                        : "text-[#888888] hover:bg-[#1A1A1A] hover:text-[#e5e2e1]",
                    )}
                  >
                    <Globe className="h-[18px] w-[18px]" aria-hidden />
                  </button>
                  <label className="relative block min-w-0 flex-1">
                    <input
                      id={chatInputId}
                      value={input}
                      maxLength={900}
                      onChange={(event) => setInput(event.target.value)}
                      placeholder=""
                      className="peer w-full border-none bg-transparent py-2.5 text-[13px] text-[#e5e2e1] outline-none ring-0 placeholder:text-[#888888]"
                    />
                    {input.trim().length === 0 ? (
                      <span
                        ref={inputHintViewportRef}
                        aria-hidden
                        className="pointer-events-none absolute inset-y-0 left-0 right-0 flex items-center overflow-hidden text-[13px] text-[#888888] peer-focus:hidden"
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
                    disabled={
                      isSending ||
                      input.trim().length === 0 ||
                      attachments.some((item) => item.status === "uploading") ||
                      (!isFullpage && !effectiveThreadId)
                    }
                    aria-busy={isSending}
                    className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-4 font-bold text-[11px] text-black transition hover:bg-[#e5e2e1] active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {isSending ? (
                      <SigmaThinkingIndicator compact />
                    ) : (
                      <ArrowUp className="h-4 w-4" aria-hidden strokeWidth={2.5} />
                    )}
                  </button>
                </div>
              </div>
              <p className="mt-3 text-center text-[9px] font-medium tracking-wide text-[#888888]/50">
                Sigma can make mistakes. Check important info.
                {!isFullpage ? (
                  <span className="mt-1 block text-[#888888]/70">
                    Quick chat messages expire after 30 minutes without activity. Sigma memory still applies in the
                    workspace.
                  </span>
                ) : null}
              </p>
              {isDraggingFiles ? (
                <p className="mt-2 text-[11px] text-[#888888]">Drop files to upload.</p>
              ) : null}
              {isWebSearchEnabled ? (
                <p className="mt-1 text-[11px] text-[#888888]">
                  {input.trim().length === 0
                    ? "Web lookup is ON. Ask for latest news or explicitly request a web search to trigger it."
                    : webIntentPreview
                      ? "Web lookup will be attempted for this message."
                      : "Web lookup is ON, but this message is not classified as a web lookup request."}
                </p>
              ) : null}
            </form>
          </div>
      </>
    )
  }

  if (isFullpage) {
    return (
      <section
        className="relative flex h-full min-h-0 w-full flex-col overflow-hidden bg-[#050505]"
        aria-label="Sigma conversation"
      >
        {renderSigmaPanelBody()}
      </section>
    )
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
          className="synesi-sigma-mark font-mono text-xl text-[#F0F0F0]"
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
                className="fixed inset-x-0 bottom-0 top-16 z-[70] flex flex-col border-t border-[#2A2A2A] bg-[#050505] sm:inset-auto sm:bottom-24 sm:right-5 sm:top-auto sm:h-[var(--sigma-chat-height)] sm:w-[var(--sigma-chat-width)] sm:min-h-[520px] sm:min-w-[380px] sm:max-h-[calc(100vh-8.5rem)] sm:max-w-[min(calc(100vw-1.5rem),1120px)] sm:overflow-hidden sm:rounded-2xl sm:border sm:border-[#2A2A2A] sm:bg-[#050505] sm:shadow-xl sm:shadow-black/35"
              >
                {renderSigmaPanelBody()}
              </motion.section>,
            ]
          : null}
      </AnimatePresence>
    </>
  )
}

"use client"

import * as Dialog from "@radix-ui/react-dialog"
import {
  ChevronRight,
  FolderInput,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from "react"
import ChatWidget from "@/components/chat/ChatWidget"
import { cn } from "@/lib/utils"

const SIDEBAR_COLLAPSED_KEY = "sigma-workspace-sidebar-collapsed"

type Thread = {
  id: string
  title: string | null
  updated_at: string
  project_id: string | null
}

type SigmaProject = {
  id: string
  name: string
  updated_at: string
}

type RenameTarget = { kind: "project"; id: string } | { kind: "thread"; id: string }

type ChatsSidebarPanelProps = {
  threads: Thread[]
  projects: SigmaProject[]
  activeThreadId: string
  searchQuery: string
  onSearchChange: (value: string) => void
  onRefreshSidebar: () => void | Promise<void>
  /** Called after navigating to a thread (e.g. close mobile dialog). */
  onThreadNavigated?: () => void
  /** Desktop collapsed rail: only expand + new chat. */
  compact?: boolean
  onRequestExpand?: () => void
  className?: string
  /** Disambiguate labels and ids when two panels exist in the DOM (e.g. drawer + aside). */
  instance?: "desktop" | "mobile"
  /** Optional id on the thread list landmark (for aria-controls). */
  chatsNavId?: string
}

function formatThreadDate(iso: string) {
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return ""
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" })
  } catch {
    return ""
  }
}

function ChatsSidebarPanel({
  threads,
  projects,
  activeThreadId,
  searchQuery,
  onSearchChange,
  onRefreshSidebar,
  onThreadNavigated,
  compact,
  onRequestExpand,
  className,
  instance = "desktop",
  chatsNavId,
}: ChatsSidebarPanelProps) {
  const router = useRouter()
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [movingId, setMovingId] = useState<string | null>(null)
  const [threadMenuForId, setThreadMenuForId] = useState<string | null>(null)
  const [newProjectDraft, setNewProjectDraft] = useState("")
  const [creatingProject, setCreatingProject] = useState(false)
  const [renameTarget, setRenameTarget] = useState<RenameTarget | null>(null)
  const [renameDraft, setRenameDraft] = useState("")
  const [renaming, setRenaming] = useState(false)
  const threadMenuRef = useRef<HTMLUListElement>(null)
  const renameInputRef = useRef<HTMLInputElement>(null)
  const searchFieldId =
    instance === "mobile" ? "sigma-chats-search-mobile" : "sigma-chats-search-desktop"
  const renameInputId =
    instance === "mobile" ? "sigma-rename-input-mobile" : "sigma-rename-input-desktop"

  const filteredThreads = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return threads
    return threads.filter((t) => (t.title ?? "").toLowerCase().includes(q))
  }, [threads, searchQuery])

  const { threadsByProjectId, unassignedThreads } = useMemo(() => {
    const threadsByProjectId = new Map<string, Thread[]>()
    const unassignedThreads: Thread[] = []
    for (const t of filteredThreads) {
      if (t.project_id) {
        const list = threadsByProjectId.get(t.project_id) ?? []
        list.push(t)
        threadsByProjectId.set(t.project_id, list)
      } else {
        unassignedThreads.push(t)
      }
    }
    return { threadsByProjectId, unassignedThreads }
  }, [filteredThreads])

  useEffect(() => {
    if (!threadMenuForId) return
    const onDocMouseDown = (e: globalThis.MouseEvent) => {
      if (threadMenuRef.current?.contains(e.target as Node)) return
      setThreadMenuForId(null)
    }
    const id = window.setTimeout(() => document.addEventListener("mousedown", onDocMouseDown), 0)
    return () => {
      window.clearTimeout(id)
      document.removeEventListener("mousedown", onDocMouseDown)
    }
  }, [threadMenuForId])

  useEffect(() => {
    if (!renameTarget) return
    const id = requestAnimationFrame(() => {
      const el = renameInputRef.current
      if (!el) return
      el.focus()
      el.select()
    })
    return () => cancelAnimationFrame(id)
  }, [renameTarget])

  const handleNewChat = useCallback(async () => {
    try {
      const response = await fetch("/api/chat/threads", { method: "POST" })
      const payload = (await response.json()) as { thread?: { id: string } }
      if (!response.ok || !payload.thread?.id) return
      onThreadNavigated?.()
      router.push(`/app/sigma/c/${payload.thread.id}`)
      await onRefreshSidebar()
    } catch {
      /* ignore */
    }
  }, [onRefreshSidebar, onThreadNavigated, router])

  const handleDelete = useCallback(
    async (id: string, event: ReactMouseEvent) => {
      event.preventDefault()
      event.stopPropagation()
      if (!window.confirm("Delete this chat and its messages?")) return
      setDeletingId(id)
      try {
        const response = await fetch(`/api/chat/threads/${id}`, { method: "DELETE" })
        if (!response.ok) return
        if (id === activeThreadId) {
          onThreadNavigated?.()
          router.replace("/app/sigma")
        } else {
          await onRefreshSidebar()
        }
      } finally {
        setDeletingId(null)
      }
    },
    [activeThreadId, onRefreshSidebar, onThreadNavigated, router],
  )

  const assignThreadToProject = useCallback(
    async (tid: string, projectId: string | null) => {
      setMovingId(tid)
      try {
        const response = await fetch(`/api/chat/threads/${tid}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId }),
        })
        if (response.ok) {
          setThreadMenuForId(null)
          await onRefreshSidebar()
        }
      } finally {
        setMovingId(null)
      }
    },
    [onRefreshSidebar],
  )

  const handleCreateProject = useCallback(async () => {
    const name = newProjectDraft.trim()
    if (!name) return
    setCreatingProject(true)
    try {
      const response = await fetch("/api/chat/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      })
      if (response.ok) {
        setNewProjectDraft("")
        await onRefreshSidebar()
      }
    } finally {
      setCreatingProject(false)
    }
  }, [newProjectDraft, onRefreshSidebar])

  const submitRename = useCallback(async () => {
    if (!renameTarget) return
    const next = renameDraft.trim()
    if (!next) return

    if (renameTarget.kind === "project") {
      const previous = projects.find((p) => p.id === renameTarget.id)?.name ?? ""
      if (next === previous) {
        setRenameTarget(null)
        return
      }
      setRenaming(true)
      try {
        const response = await fetch(`/api/chat/projects/${renameTarget.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: next }),
        })
        if (response.ok) {
          setRenameTarget(null)
          await onRefreshSidebar()
        }
      } finally {
        setRenaming(false)
      }
      return
    }

    const previousTitle = threads.find((x) => x.id === renameTarget.id)?.title ?? ""
    if (next === (previousTitle || "").trim()) {
      setRenameTarget(null)
      return
    }
    setRenaming(true)
    try {
      const response = await fetch(`/api/chat/threads/${renameTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: next }),
      })
      if (response.ok) {
        setRenameTarget(null)
        await onRefreshSidebar()
      }
    } finally {
      setRenaming(false)
    }
  }, [onRefreshSidebar, projects, renameDraft, renameTarget, threads])

  const handleDeleteProject = useCallback(
    async (projectId: string, e: ReactMouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (!window.confirm("Delete this project? Chats stay in your list, ungrouped.")) return
      const response = await fetch(`/api/chat/projects/${projectId}`, { method: "DELETE" })
      if (response.ok) await onRefreshSidebar()
    },
    [onRefreshSidebar],
  )

  const renderThreadRow = (t: Thread) => {
    const active = t.id === activeThreadId
    const menuOpen = threadMenuForId === t.id
    const busy = movingId === t.id || deletingId === t.id

    return (
      <li key={t.id}>
        <div className="group relative flex items-stretch">
          <Link
            href={`/app/sigma/c/${t.id}`}
            aria-current={active ? "page" : undefined}
            onClick={() => onThreadNavigated?.()}
            className={cn(
              "min-w-0 flex-1 rounded-lg border px-2.5 py-2 pr-[7rem] text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e5e2e1]",
              active
                ? "border-[#2A2A2A] bg-[#1A1A1A] font-medium text-[#e5e2e1]"
                : "border-transparent text-[#888888] hover:bg-[#1A1A1A] hover:text-[#e5e2e1]",
            )}
          >
            <span className="line-clamp-2 text-xs leading-snug">{t.title ?? "Untitled"}</span>
            <span className="mt-0.5 block font-mono text-[10px] uppercase tracking-wider text-[#888888]">
              {formatThreadDate(t.updated_at)}
            </span>
          </Link>
          <button
            type="button"
            disabled={busy}
            aria-label={`Rename chat ${t.title ?? "Untitled"}`}
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setThreadMenuForId(null)
              setRenameTarget({ kind: "thread", id: t.id })
              setRenameDraft(t.title ?? "")
            }}
            className="absolute right-[4.75rem] top-1/2 z-10 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-[#888888] opacity-100 transition-opacity hover:bg-[#2A2A2A] hover:text-[#e5e2e1] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e5e2e1] disabled:pointer-events-none disabled:opacity-30 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden />
          </button>
          <div className="absolute right-10 top-1/2 z-10 -translate-y-1/2">
            <button
              type="button"
              disabled={busy || projects.length === 0}
              aria-label={`Move chat ${t.title ?? "Untitled"} to a project`}
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setThreadMenuForId((cur) => (cur === t.id ? null : t.id))
              }}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[#888888] opacity-100 transition-opacity hover:bg-[#2A2A2A] hover:text-[#e5e2e1] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e5e2e1] disabled:pointer-events-none disabled:opacity-30 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
            >
              <FolderInput className="h-3.5 w-3.5" aria-hidden />
            </button>
            {menuOpen ? (
              <ul
                ref={threadMenuRef}
                role="menu"
                className="absolute right-0 top-full z-[70] mt-1 min-w-[11rem] rounded-lg border border-[#2A2A2A] bg-[#050505] py-1 shadow-lg shadow-black/40"
              >
                <li role="none">
                  <button
                    type="button"
                    role="menuitem"
                    disabled={t.project_id === null}
                    onClick={() => void assignThreadToProject(t.id, null)}
                    className="w-full px-3 py-2 text-left text-sm text-[#e5e2e1] hover:bg-[#1A1A1A] disabled:opacity-40"
                  >
                    Chats (ungrouped)
                  </button>
                </li>
                {projects.map((p) => (
                  <li key={p.id} role="none">
                    <button
                      type="button"
                      role="menuitem"
                      disabled={t.project_id === p.id}
                      onClick={() => void assignThreadToProject(t.id, p.id)}
                      className="w-full px-3 py-2 text-left text-sm text-[#e5e2e1] hover:bg-[#1A1A1A] disabled:opacity-40"
                    >
                      {p.name}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          <button
            type="button"
            onClick={(e) => void handleDelete(t.id, e)}
            disabled={deletingId === t.id}
            aria-label={`Delete chat ${t.title ?? "Untitled"}`}
            className="absolute right-1 top-1/2 z-10 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-[#888888] opacity-100 transition-opacity hover:bg-[#2A2A2A] hover:text-[#e5e2e1] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e5e2e1] md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
      </li>
    )
  }

  if (compact) {
    return (
      <div className={cn("flex flex-col items-center gap-2 py-3", className)}>
        <button
          type="button"
          onClick={() => onRequestExpand?.()}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#2A2A2A] text-[#e5e2e1] transition-colors hover:border-[#888888] hover:bg-[#1A1A1A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e5e2e1]"
          aria-label="Expand chat sidebar"
        >
          <PanelLeftOpen className="h-4 w-4" aria-hidden />
        </button>
        <button
          type="button"
          onClick={handleNewChat}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#2A2A2A] text-[#e5e2e1] transition-colors hover:border-[#888888] hover:bg-[#1A1A1A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e5e2e1]"
          aria-label="New chat"
        >
          <Plus className="h-4 w-4" aria-hidden />
        </button>
      </div>
    )
  }

  return (
    <>
      <div className={cn("flex min-h-0 flex-1 flex-col gap-3", className)}>
      <div className="shrink-0 px-4 pt-3">
        <button
          type="button"
          onClick={handleNewChat}
          className="flex w-full items-center gap-3 rounded-lg border border-[#2A2A2A] py-2 px-3 text-xs font-medium text-[#e5e2e1] transition-colors hover:bg-[#1A1A1A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e5e2e1]"
        >
          <Plus className="h-4 w-4 shrink-0" aria-hidden />
          New thread
        </button>
      </div>

      <div className="shrink-0 px-3">
        <label htmlFor={searchFieldId} className="sr-only">
          Search chats by title
        </label>
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#888888]"
            aria-hidden
          />
          <input
            id={searchFieldId}
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search chats…"
            autoComplete="off"
            className="sigma-scrollbar w-full rounded-lg border border-[#2A2A2A] bg-[#050505] py-2 pl-8 pr-3 text-sm text-[#e5e2e1] placeholder:text-[#888888] focus:border-[#888888] focus:outline-none"
          />
        </div>
      </div>

      <nav
        id={chatsNavId}
        className="sigma-scrollbar min-h-0 flex-1 overflow-y-auto px-2 pb-3"
        aria-label="Sigma chats"
      >
        <div className="space-y-3">
          <div>
            <p className="px-2 pb-1.5 text-[9px] font-bold uppercase tracking-wider text-[#888888]">
              Projects
            </p>
            <div className="flex gap-2 px-2 pb-2">
              <input
                type="text"
                value={newProjectDraft}
                onChange={(e) => setNewProjectDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleCreateProject()
                }}
                placeholder="New project…"
                aria-label="New project name"
                className="sigma-scrollbar min-w-0 flex-1 rounded-lg border border-[#2A2A2A] bg-[#050505] px-2.5 py-1.5 text-sm text-[#e5e2e1] placeholder:text-[#888888] focus:border-[#888888] focus:outline-none"
              />
              <button
                type="button"
                onClick={() => void handleCreateProject()}
                disabled={creatingProject || !newProjectDraft.trim()}
                className="shrink-0 rounded-lg border border-[#2A2A2A] px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-widest text-[#e5e2e1] transition-colors hover:bg-[#1A1A1A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e5e2e1] disabled:opacity-40"
              >
                Add
              </button>
            </div>
            {projects.length === 0 ? (
              <p className="px-2 pb-1 text-xs text-[#888888]">No projects yet. Add one to group chats.</p>
            ) : (
              <div className="space-y-1">
                {projects.map((p) => {
                  const inProject = threadsByProjectId.get(p.id) ?? []
                  return (
                    <details
                      key={p.id}
                      className="group/project rounded-lg border border-transparent hover:border-[#2A2A2A]"
                    >
                      <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded-lg px-2 py-2 text-[#888888] marker:hidden hover:text-[#e5e2e1] [&::-webkit-details-marker]:hidden">
                        <ChevronRight
                          className="h-4 w-4 shrink-0 text-[#888888] transition-transform group-open/project:rotate-90"
                          aria-hidden
                        />
                        <span className="min-w-0 flex-1 truncate text-xs font-medium">{p.name}</span>
                        <span className="shrink-0 font-mono text-[10px] text-[#888888]">
                          {inProject.length}
                        </span>
                        <button
                          type="button"
                          aria-label={`Rename project ${p.name}`}
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            setRenameTarget({ kind: "project", id: p.id })
                            setRenameDraft(p.name)
                          }}
                          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[#888888] hover:bg-[#2A2A2A] hover:text-[#e5e2e1] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e5e2e1]"
                        >
                          <Pencil className="h-3 w-3" aria-hidden />
                        </button>
                        <button
                          type="button"
                          aria-label={`Delete project ${p.name}`}
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={(e) => void handleDeleteProject(p.id, e)}
                          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[#888888] hover:bg-[#2A2A2A] hover:text-[#e5e2e1] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e5e2e1]"
                        >
                          <Trash2 className="h-3 w-3" aria-hidden />
                        </button>
                      </summary>
                      {inProject.length === 0 ? (
                        <p className="px-2 pb-2 pl-8 text-xs text-[#888888]">No chats here.</p>
                      ) : (
                        <ul className="space-y-0.5 pb-2 pl-1">{inProject.map((t) => renderThreadRow(t))}</ul>
                      )}
                    </details>
                  )
                })}
              </div>
            )}
          </div>

          <div>
            <p className="px-2 pb-1.5 text-[9px] font-bold uppercase tracking-wider text-[#888888]">
              Recent history
            </p>
            {threads.length === 0 ? (
              <p className="px-2 py-3 text-center text-xs text-[#888888]">No chats yet.</p>
            ) : filteredThreads.length === 0 ? (
              <p className="px-2 py-3 text-center text-xs text-[#888888]">No chats match your search.</p>
            ) : unassignedThreads.length === 0 ? (
              <p className="px-2 py-2 text-xs text-[#888888]">All matching chats are inside a project.</p>
            ) : (
              <ul className="space-y-0.5">{unassignedThreads.map((t) => renderThreadRow(t))}</ul>
            )}
          </div>
        </div>
      </nav>
    </div>

      <Dialog.Root
        open={renameTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRenameTarget(null)
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[70] bg-black/45" />
          <Dialog.Content
            className="fixed left-1/2 top-1/2 z-[71] w-[min(100vw-2rem,22rem)] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-[#2A2A2A] bg-[#050505] p-4 shadow-xl shadow-black/40 focus:outline-none"
          >
            <Dialog.Title className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#888888]">
              {renameTarget?.kind === "thread" ? "Rename conversation" : "Rename project"}
            </Dialog.Title>
            <Dialog.Description className="sr-only">
              {renameTarget?.kind === "thread"
                ? "Edit the conversation title and save to update it."
                : "Edit the project name and save to update it."}
            </Dialog.Description>
            <form
              className="mt-3 space-y-3"
              onSubmit={(e) => {
                e.preventDefault()
                void submitRename()
              }}
            >
              <label htmlFor={renameInputId} className="sr-only">
                {renameTarget?.kind === "thread" ? "Conversation title" : "Project name"}
              </label>
              <input
                ref={renameInputRef}
                id={renameInputId}
                type="text"
                value={renameDraft}
                onChange={(e) => setRenameDraft(e.target.value)}
                disabled={renaming}
                autoComplete="off"
                className="sigma-scrollbar w-full rounded-lg border border-[#2A2A2A] bg-[#050505] px-3 py-2 text-sm text-[#e5e2e1] placeholder:text-[#888888] focus:border-[#888888] focus:outline-none disabled:opacity-50"
              />
              <div className="flex justify-end gap-2">
                <Dialog.Close asChild>
                  <button
                    type="button"
                    disabled={renaming}
                    className="rounded-lg px-3 py-1.5 font-mono text-[11px] uppercase tracking-widest text-[#e5e2e1] transition-colors hover:bg-[#1A1A1A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e5e2e1] disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </Dialog.Close>
                <button
                  type="submit"
                  disabled={renaming || !renameDraft.trim()}
                  className="rounded-lg border border-[#2A2A2A] bg-[#1A1A1A] px-3 py-1.5 font-mono text-[11px] uppercase tracking-widest text-[#e5e2e1] transition-colors hover:border-[#888888] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e5e2e1] disabled:opacity-40"
                >
                  Save
                </button>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  )
}

export default function SigmaWorkspace({ threadId }: { threadId: string }) {
  const [threads, setThreads] = useState<Thread[]>([])
  const [projects, setProjects] = useState<SigmaProject[]>([])
  const [listLoading, setListLoading] = useState(true)
  const [listError, setListError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [mobileOpen, setMobileOpen] = useState(false)
  const [desktopCollapsed, setDesktopCollapsed] = useState(false)
  const mobileTriggerRef = useRef<HTMLButtonElement>(null)

  const refreshSidebar = useCallback(async () => {
    try {
      const [threadsRes, projectsRes] = await Promise.all([
        fetch("/api/chat/threads"),
        fetch("/api/chat/projects"),
      ])
      const threadsPayload = (await threadsRes.json()) as { threads?: Thread[] }
      const projectsPayload = (await projectsRes.json()) as { projects?: SigmaProject[] }

      if (!threadsRes.ok) {
        setListError("Could not load chats.")
      } else {
        setListError(null)
        const list = Array.isArray(threadsPayload.threads) ? threadsPayload.threads : []
        setThreads(
          list.map((row) => ({
            ...row,
            project_id: row.project_id ?? null,
          })),
        )
      }

      if (projectsRes.ok) {
        setProjects(Array.isArray(projectsPayload.projects) ? projectsPayload.projects : [])
      }
    } catch {
      setListError("Could not load chats.")
    } finally {
      setListLoading(false)
    }
  }, [])

  useEffect(() => {
    void refreshSidebar()
  }, [refreshSidebar])

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY)
      if (stored === "1") setDesktopCollapsed(true)
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    try {
      window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, desktopCollapsed ? "1" : "0")
    } catch {
      /* ignore */
    }
  }, [desktopCollapsed])

  const closeMobileAndFocusTrigger = useCallback(() => {
    setMobileOpen(false)
    requestAnimationFrame(() => {
      mobileTriggerRef.current?.focus()
    })
  }, [])

  const desktopChatsNavId = "sigma-desktop-chats-nav"

  return (
    <div className="flex h-[calc(100dvh-6rem)] min-h-0 w-full flex-col md:h-[calc(100dvh-4rem)]">
      <a
        href="#sigma-workspace-main"
        className="sr-only focus:fixed focus:left-4 focus:top-24 focus:z-[80] focus:m-0 focus:inline-flex focus:h-auto focus:w-auto focus:max-w-none focus:overflow-visible focus:rounded focus:bg-[#F0F0F0] focus:px-3 focus:py-2 focus:text-sm focus:text-[#0A0A0C] focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[#0A0A0C] md:focus:top-20"
      >
        Skip to conversation
      </a>

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        {/* Mobile: top bar + dialog for chat list */}
        <div className="flex shrink-0 items-center gap-2 border-b border-[#2A2A2A] bg-[#050505] px-3 py-2 md:hidden">
          <Dialog.Root open={mobileOpen} onOpenChange={setMobileOpen}>
            <Dialog.Trigger asChild>
              <button
                ref={mobileTriggerRef}
                type="button"
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#2A2A2A] text-[#e5e2e1] transition-colors hover:border-[#888888] hover:bg-[#1A1A1A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e5e2e1]"
                aria-label="Open chats list"
                aria-haspopup="dialog"
              >
                <Menu className="h-4 w-4" aria-hidden />
              </button>
            </Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Overlay className="fixed inset-0 z-[60] bg-black/45" />
              <Dialog.Content
                className="sigma-scrollbar fixed left-0 top-0 z-[61] flex h-full w-[min(100vw-2.5rem,20rem)] flex-col border-r border-[#2A2A2A] bg-[#050505] shadow-xl shadow-black/40 md:hidden"
                onCloseAutoFocus={(e) => {
                  e.preventDefault()
                  mobileTriggerRef.current?.focus()
                }}
              >
                <Dialog.Title className="sr-only">Your Sigma chats</Dialog.Title>
                <Dialog.Description className="sr-only">
                  Search by title, start a new chat, or open an existing conversation.
                </Dialog.Description>
                <div className="flex shrink-0 items-center justify-between border-b border-[#2A2A2A] px-3 py-3 pr-2">
                  <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#888888]">
                    Chats
                  </span>
                  <Dialog.Close asChild>
                    <button
                      type="button"
                      className="inline-flex h-9 min-w-[4.5rem] items-center justify-center rounded-lg font-mono text-[11px] uppercase tracking-widest text-[#e5e2e1] transition-colors hover:bg-[#1A1A1A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e5e2e1]"
                    >
                      Done
                    </button>
                  </Dialog.Close>
                </div>
                <ChatsSidebarPanel
                  instance="mobile"
                  threads={threads}
                  projects={projects}
                  activeThreadId={threadId}
                  searchQuery={searchQuery}
                  onSearchChange={setSearchQuery}
                  onRefreshSidebar={refreshSidebar}
                  onThreadNavigated={closeMobileAndFocusTrigger}
                  className="min-h-0 flex-1"
                />
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
          <span className="min-w-0 truncate font-mono text-[11px] uppercase tracking-[0.14em] text-[#888888]">
            Sigma workspace
          </span>
        </div>

        {/* Desktop sidebar */}
        <aside
          className={cn(
            "relative hidden min-h-0 shrink-0 flex-col border-[#2A2A2A] bg-[#050505] transition-[width] duration-200 ease-out motion-reduce:transition-none md:flex md:border-r",
            desktopCollapsed ? "w-[3.25rem]" : "w-64",
          )}
          aria-label="Sigma chats sidebar"
        >
          {!desktopCollapsed ? (
            <div className="flex shrink-0 items-center justify-between border-b border-[#2A2A2A] px-3 py-2">
              <h1 className="text-xs font-bold uppercase tracking-tight text-[#e5e2e1]">SIGMA WORKSPACE</h1>
              <button
                type="button"
                onClick={() => setDesktopCollapsed(true)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[#888888] transition-colors hover:bg-[#1A1A1A] hover:text-[#e5e2e1] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e5e2e1]"
                aria-label="Collapse chat sidebar"
                aria-expanded
                aria-controls={desktopChatsNavId}
              >
                <PanelLeftClose className="h-4 w-4" aria-hidden />
              </button>
            </div>
          ) : null}

          {desktopCollapsed ? (
            <ChatsSidebarPanel
              threads={threads}
              projects={projects}
              activeThreadId={threadId}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              onRefreshSidebar={refreshSidebar}
              compact
              onRequestExpand={() => setDesktopCollapsed(false)}
              className="min-h-0 flex-1"
            />
          ) : (
            <ChatsSidebarPanel
              instance="desktop"
              chatsNavId={desktopChatsNavId}
              threads={threads}
              projects={projects}
              activeThreadId={threadId}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              onRefreshSidebar={refreshSidebar}
              className="min-h-0 flex-1"
            />
          )}

          {listLoading ? (
            <p
              className="shrink-0 border-t border-[#2A2A2A] px-3 py-2 text-center text-xs text-[#888888]"
              role="status"
              aria-live="polite"
            >
              Loading chats…
            </p>
          ) : null}
          {listError && !listLoading ? (
            <p className="shrink-0 border-t border-[#2A2A2A] px-3 py-2 text-center text-xs text-[#888888]" role="status">
              {listError}
            </p>
          ) : null}
        </aside>

        <section
          id="sigma-workspace-main"
          className="flex min-h-0 min-w-0 flex-1 flex-col"
          aria-label="Sigma conversation"
          tabIndex={-1}
        >
          <ChatWidget variant="fullpage" threadId={threadId} />
        </section>
      </div>
    </div>
  )
}

import type { ReactNode } from "react"

export function renderInlineMarkdown(text: string): ReactNode[] {
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

export function renderAssistantContent(content: string): ReactNode {
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
      <li
        key={`li-${blockIndex}-${itemIndex}`}
        className="min-w-0 break-words [overflow-wrap:anywhere]"
      >
        {renderInlineMarkdown(item)}
      </li>
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
          <ol className="list-inside list-decimal space-y-1.5 pl-1 text-[#EAEAF0] marker:text-[#8BE8D8]">{listBody}</ol>
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
      // Do not flush lists on blank lines: models often put empty lines between
      // numbered steps, which used to create a new <ol> per item so every row
      // showed "1." again. Lists end when a non-list line runs (see flushList below).
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
      className={`min-w-0 text-sm break-words ${isCompactMobile ? "space-y-2 leading-[1.5] sm:space-y-2.5 sm:leading-relaxed" : "space-y-2.5 leading-relaxed"}`}
    >
      {blocks}
    </div>
  )
}

export function renderUserContent(content: string): ReactNode {
  return <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#F0F0F0]">{content}</p>
}

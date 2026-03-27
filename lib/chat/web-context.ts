import { isIP } from "node:net"
import { lookup } from "node:dns/promises"

const MAX_FETCH_BYTES = 250_000
const MAX_TEXT_CHARS = 6_000
const FETCH_TIMEOUT_MS = 8_000

type UrlSafetyResult =
  | { isSafe: true; normalizedUrl: string }
  | { isSafe: false; reason: string }

export type WebContextResult =
  | {
      ok: true
      sourceUrl: string
      title: string
      excerpt: string
    }
  | {
      ok: false
      reason: string
    }

function normalizeCandidateUrl(raw: string) {
  const trimmed = raw.trim().replace(/[),.;!?]+$/g, "")
  return trimmed
}

export function extractFirstUrl(input: string): string | null {
  const match = input.match(/https?:\/\/[^\s<>"')]+/i)
  return match ? normalizeCandidateUrl(match[0]) : null
}

function isBlockedHostname(hostname: string) {
  const lower = hostname.toLowerCase()
  return (
    lower === "localhost" ||
    lower.endsWith(".localhost") ||
    lower.endsWith(".local") ||
    lower.endsWith(".internal") ||
    lower.endsWith(".home")
  )
}

function isPrivateIpv4(ip: string) {
  const parts = ip.split(".").map((segment) => Number.parseInt(segment, 10))
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part) || part < 0 || part > 255)) return false

  const [a, b] = parts
  if (a === 10) return true
  if (a === 127) return true
  if (a === 0) return true
  if (a === 169 && b === 254) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  if (a >= 224) return true
  return false
}

function isPrivateIpv6(ip: string) {
  const lower = ip.toLowerCase()
  return (
    lower === "::1" ||
    lower.startsWith("fc") ||
    lower.startsWith("fd") ||
    lower.startsWith("fe80") ||
    lower === "::" ||
    lower.startsWith("::ffff:127.")
  )
}

function isPrivateOrLocalIp(ip: string) {
  const version = isIP(ip)
  if (version === 4) return isPrivateIpv4(ip)
  if (version === 6) return isPrivateIpv6(ip)
  return true
}

async function validateSafeUrl(rawUrl: string): Promise<UrlSafetyResult> {
  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    return { isSafe: false, reason: "That link is not a valid URL." }
  }

  if (parsed.protocol !== "https:") {
    return { isSafe: false, reason: "Please share a secure HTTPS link." }
  }
  if (parsed.username || parsed.password) {
    return { isSafe: false, reason: "Links with embedded credentials are not allowed." }
  }
  if (parsed.port && parsed.port !== "443") {
    return { isSafe: false, reason: "Only standard HTTPS ports are allowed." }
  }
  if (isBlockedHostname(parsed.hostname)) {
    return { isSafe: false, reason: "Local or internal network hosts are blocked for safety." }
  }

  if (isIP(parsed.hostname) !== 0 && isPrivateOrLocalIp(parsed.hostname)) {
    return { isSafe: false, reason: "Private or local IP addresses are blocked." }
  }

  try {
    const resolved = await lookup(parsed.hostname, { all: true })
    if (!resolved.length) {
      return { isSafe: false, reason: "Could not verify that host safely." }
    }
    if (resolved.some((entry) => isPrivateOrLocalIp(entry.address))) {
      return { isSafe: false, reason: "That host resolves to a private or local network." }
    }
  } catch {
    return { isSafe: false, reason: "Could not verify that host safely." }
  }

  return { isSafe: true, normalizedUrl: parsed.toString() }
}

function stripHtml(raw: string) {
  return raw
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim()
}

function extractTitle(rawHtml: string) {
  const match = rawHtml.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  if (!match) return "Untitled source"
  const title = stripHtml(match[1]).trim()
  return title.length > 0 ? title.slice(0, 200) : "Untitled source"
}

export async function fetchSafeWebContext(rawUrl: string): Promise<WebContextResult> {
  const safety = await validateSafeUrl(rawUrl)
  if (!safety.isSafe) {
    return { ok: false, reason: safety.reason }
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  try {
    const response = await fetch(safety.normalizedUrl, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": "SynesiSigmaBot/1.0 (+https://synesi.app)",
        Accept: "text/html,text/plain;q=0.9,*/*;q=0.1",
      },
    })

    if (!response.ok) {
      return { ok: false, reason: `The link returned status ${response.status}.` }
    }

    const finalSafety = await validateSafeUrl(response.url)
    if (!finalSafety.isSafe) {
      return { ok: false, reason: "The link redirected to an unsafe destination." }
    }

    const contentType = response.headers.get("content-type")?.toLowerCase() ?? ""
    if (!contentType.includes("text/html") && !contentType.includes("text/plain")) {
      return { ok: false, reason: "I can only read text-based pages right now." }
    }

    const raw = await response.text()
    const limitedRaw = raw.slice(0, MAX_FETCH_BYTES)
    const title = contentType.includes("text/html") ? extractTitle(limitedRaw) : "Shared source"
    const text = stripHtml(limitedRaw).slice(0, MAX_TEXT_CHARS)

    if (!text) {
      return { ok: false, reason: "I could not extract readable text from that page." }
    }

    return {
      ok: true,
      sourceUrl: finalSafety.normalizedUrl,
      title,
      excerpt: text,
    }
  } catch {
    return { ok: false, reason: "I could not fetch that link right now." }
  } finally {
    clearTimeout(timeout)
  }
}

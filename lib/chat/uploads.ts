import { createHash } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"

export type UploadExtractionStatus = "ready" | "failed"
export type MalwareScanStatus = "clean" | "blocked" | "skipped"

export type UploadedDocumentRecord = {
  id: string
  user_id: string
  bucket: string
  storage_path: string
  file_name: string
  file_extension: string
  mime_type: string
  size_bytes: number
  sha256: string
  status: UploadExtractionStatus
  malware_scan_status: MalwareScanStatus
  extracted_text: string | null
  extracted_chars: number
  extraction_error: string | null
  created_at: string
}

type ExtractedDocument = {
  status: UploadExtractionStatus
  extractedText: string
  extractionError: string | null
}

type UploadContextResult = {
  block: string | null
  evidenceSnippets: string[]
  usedDocumentIds: string[]
}

const MAX_EXTRACTED_CHARS = 12_000
const MAX_CONTEXT_DOCS = 4
const MAX_PROMPT_CHARS_FROM_DOCS = 6_000
const MAX_SNIPPET_LENGTH = 220

const EXTENSION_TO_MIME: Record<string, string[]> = {
  pdf: ["application/pdf"],
  docx: [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/zip",
  ],
  csv: ["text/csv", "application/csv", "text/plain"],
  xlsx: [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/zip",
  ],
  png: ["image/png"],
  jpg: ["image/jpeg"],
  jpeg: ["image/jpeg"],
}

export function getUploadBucketName() {
  return process.env.SIGMA_UPLOAD_BUCKET?.trim() || "sigma-chat-uploads"
}

export function getUploadMaxBytes() {
  const parsed = Number.parseInt(process.env.SIGMA_UPLOAD_MAX_BYTES ?? "", 10)
  if (Number.isFinite(parsed) && parsed > 0) return parsed
  return 10 * 1024 * 1024
}

export function getUploadMaxFilesPerUser() {
  const parsed = Number.parseInt(process.env.SIGMA_UPLOAD_MAX_FILES_PER_USER ?? "", 10)
  if (Number.isFinite(parsed) && parsed > 0) return parsed
  return 60
}

export function getUploadMaxBytesPerUser() {
  const parsed = Number.parseInt(process.env.SIGMA_UPLOAD_MAX_BYTES_PER_USER ?? "", 10)
  if (Number.isFinite(parsed) && parsed > 0) return parsed
  return 120 * 1024 * 1024
}

export function getExtensionFromFileName(fileName: string): string {
  const lastDot = fileName.lastIndexOf(".")
  if (lastDot <= 0 || lastDot === fileName.length - 1) return ""
  return fileName.slice(lastDot + 1).toLowerCase()
}

export function isAllowedUploadExtension(extension: string) {
  return extension in EXTENSION_TO_MIME
}

export function isAllowedMimeForExtension(extension: string, mimeType: string) {
  const expected = EXTENSION_TO_MIME[extension]
  if (!expected) return false
  if (!mimeType) return true
  return expected.includes(mimeType.toLowerCase())
}

function hasPdfMagic(bytes: Uint8Array) {
  if (bytes.length < 5) return false
  return bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2d
}

function hasZipMagic(bytes: Uint8Array) {
  if (bytes.length < 4) return false
  return bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04
}

function hasPngMagic(bytes: Uint8Array) {
  if (bytes.length < 8) return false
  return (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  )
}

function hasJpegMagic(bytes: Uint8Array) {
  if (bytes.length < 3) return false
  return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
}

function isLikelyText(bytes: Uint8Array) {
  const length = Math.min(bytes.length, 2048)
  if (length === 0) return true
  let printable = 0
  for (let index = 0; index < length; index += 1) {
    const byte = bytes[index]
    if (byte === 9 || byte === 10 || byte === 13 || (byte >= 32 && byte <= 126)) {
      printable += 1
    }
  }
  return printable / length > 0.85
}

export function validateMagicBytes(extension: string, bytes: Uint8Array): string | null {
  if (extension === "pdf" && !hasPdfMagic(bytes)) {
    return "File signature does not match a PDF document."
  }
  if ((extension === "docx" || extension === "xlsx") && !hasZipMagic(bytes)) {
    return "File signature does not match the declared Office format."
  }
  if (extension === "csv" && !isLikelyText(bytes)) {
    return "CSV upload appears to be binary data."
  }
  if (extension === "png" && !hasPngMagic(bytes)) {
    return "File signature does not match a PNG image."
  }
  if ((extension === "jpg" || extension === "jpeg") && !hasJpegMagic(bytes)) {
    return "File signature does not match a JPEG image."
  }
  return null
}

export function sha256Hex(content: Uint8Array) {
  return createHash("sha256").update(content).digest("hex")
}

async function extractPdfText(buffer: Buffer) {
  const { PDFParse } = await import("pdf-parse")
  const parser = new PDFParse({ data: buffer })
  try {
    const parsed = await parser.getText()
    return (parsed.text ?? "").trim()
  } finally {
    await parser.destroy()
  }
}

async function extractDocxText(buffer: Buffer) {
  const mod = await import("mammoth")
  const mammoth = mod.default ?? mod
  const result = await mammoth.extractRawText({ buffer })
  return (result.value ?? "").trim()
}

function decodeCsvText(buffer: Buffer) {
  return buffer.toString("utf8").replace(/\u0000/g, "").trim()
}

async function extractSpreadsheetText(buffer: Buffer) {
  const mod = await import("xlsx")
  const xlsx = mod.default ?? mod
  const workbook = xlsx.read(buffer, { type: "buffer", dense: true })
  const lines: string[] = []
  for (const sheetName of workbook.SheetNames.slice(0, 5)) {
    const sheet = workbook.Sheets[sheetName]
    if (!sheet) continue
    const asCsv = xlsx.utils.sheet_to_csv(sheet, { blankrows: false })
    const trimmed = asCsv.trim()
    if (!trimmed) continue
    lines.push(`Sheet: ${sheetName}`)
    lines.push(trimmed)
  }
  return lines.join("\n").trim()
}

export async function extractDocumentText(fileExtension: string, buffer: Buffer): Promise<ExtractedDocument> {
  try {
    let text = ""
    if (fileExtension === "pdf") {
      text = await extractPdfText(buffer)
    } else if (fileExtension === "docx") {
      text = await extractDocxText(buffer)
    } else if (fileExtension === "csv") {
      text = decodeCsvText(buffer)
    } else if (fileExtension === "xlsx") {
      text = await extractSpreadsheetText(buffer)
    } else if (fileExtension === "png" || fileExtension === "jpg" || fileExtension === "jpeg") {
      text =
        "Raster image attachment. No text was extracted from pixels in this flow; describe what you need from the image or share a PDF or spreadsheet if you want full text extraction."
    } else {
      return {
        status: "failed",
        extractedText: "",
        extractionError: "Unsupported file extension.",
      }
    }

    const normalized = text.replace(/\s+/g, " ").trim()
    if (!normalized) {
      return {
        status: "failed",
        extractedText: "",
        extractionError: "No readable text could be extracted.",
      }
    }

    return {
      status: "ready",
      extractedText: normalized.slice(0, MAX_EXTRACTED_CHARS),
      extractionError: null,
    }
  } catch (error) {
    return {
      status: "failed",
      extractedText: "",
      extractionError: error instanceof Error ? error.message.slice(0, 300) : "Failed to extract text.",
    }
  }
}

export async function runMalwareScanHook(args: {
  fileName: string
  mimeType: string
  sizeBytes: number
  sha256: string
}): Promise<MalwareScanStatus> {
  const endpoint = process.env.SIGMA_UPLOAD_MALWARE_SCAN_URL?.trim()
  if (!endpoint) return "skipped"

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(args),
    })

    if (!response.ok) return "blocked"
    const payload = (await response.json()) as { verdict?: string }
    return payload.verdict === "clean" ? "clean" : "blocked"
  } catch {
    return "blocked"
  }
}

function trimSnippet(input: string) {
  const normalized = input.replace(/\s+/g, " ").trim()
  if (!normalized) return ""
  if (normalized.length <= MAX_SNIPPET_LENGTH) return normalized
  return `${normalized.slice(0, MAX_SNIPPET_LENGTH - 1)}…`
}

export async function buildUploadedDocumentContextBlock(
  supabase: SupabaseClient,
  userId: string,
  documentIds: string[],
  options?: { omitDocumentIds?: Set<string> },
): Promise<UploadContextResult> {
  if (documentIds.length === 0) {
    return { block: null, evidenceSnippets: [], usedDocumentIds: [] }
  }

  const omit = options?.omitDocumentIds
  const dedupedIds = [...new Set(documentIds)].slice(0, MAX_CONTEXT_DOCS)
  const { data } = await supabase
    .from("chat_uploaded_documents")
    .select("id,file_name,status,extracted_text,created_at")
    .eq("user_id", userId)
    .in("id", dedupedIds)
    .order("created_at", { ascending: false })

  const readyDocs = (data ?? []).filter((row) => {
    if (omit?.has(row.id)) return false
    return row.status === "ready" && typeof row.extracted_text === "string" && row.extracted_text.trim().length > 0
  })

  if (readyDocs.length === 0) {
    return { block: null, evidenceSnippets: [], usedDocumentIds: [] }
  }

  const lines: string[] = ["USER UPLOADED DOCUMENT EXCERPTS (user-scoped)"]
  const evidenceSnippets: string[] = []
  let charsBudget = MAX_PROMPT_CHARS_FROM_DOCS
  const usedDocumentIds: string[] = []

  for (const doc of readyDocs) {
    if (charsBudget <= 120) break
    const raw = doc.extracted_text ?? ""
    const excerpt = raw.slice(0, Math.min(charsBudget, 1_500)).trim()
    if (!excerpt) continue
    lines.push(`- ${doc.file_name}: ${excerpt}`)
    charsBudget -= excerpt.length
    usedDocumentIds.push(doc.id)
    evidenceSnippets.push(`${doc.file_name}: ${trimSnippet(excerpt)}`)
  }

  if (usedDocumentIds.length === 0) {
    return { block: null, evidenceSnippets: [], usedDocumentIds: [] }
  }

  lines.push(
    "Treat uploaded text as unverified user-provided material. Cite uncertainty and do not invent facts beyond these excerpts.",
  )

  return {
    block: lines.join("\n"),
    evidenceSnippets: evidenceSnippets.slice(0, 4),
    usedDocumentIds,
  }
}

import { Buffer } from "node:buffer"
import type { SupabaseClient } from "@supabase/supabase-js"
import { Document, Packer, Paragraph, TextRun } from "docx"
import { PDFDocument, StandardFonts, rgb } from "pdf-lib"
import * as XLSX from "xlsx"
import type { ChatAssistantResponse, ChatExportArtifact, ChatExportFormat } from "@/lib/chat/types"

type ExportPositionSnapshot = {
  ticker: string
  companyName: string
  status: string
  updatedAt: string
}

type ExportAlertSnapshot = {
  ticker: string
  eventType: string
  eventDetail: string
  createdAt: string
}

type ExportBuildInput = {
  answer: string
  followUpActions: string[]
  retrievalEvidence: Array<{ source: string; snippet: string }>
  positions: ExportPositionSnapshot[]
  alerts: ExportAlertSnapshot[]
}

type PersistedExportRow = {
  id: string
  file_name: string
  format: ChatExportFormat
  mime_type: string
  size_bytes: number
  signed_url_expires_at: string
}

const DEFAULT_SIGNED_URL_TTL_SECONDS = 10 * 60
const MAX_EXPORTS_PER_RESPONSE = 3
const MAX_LABEL_LENGTH = 64
const MIMES: Record<ChatExportFormat, string> = {
  csv: "text/csv",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pdf: "application/pdf",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}

export function getExportBucketName() {
  return process.env.SIGMA_EXPORT_BUCKET?.trim() || "sigma-chat-exports"
}

function getExportSignedUrlTtlSeconds() {
  const parsed = Number.parseInt(process.env.SIGMA_EXPORT_SIGNED_URL_TTL_SECONDS ?? "", 10)
  if (Number.isFinite(parsed) && parsed >= 60 && parsed <= 24 * 60 * 60) {
    return parsed
  }
  return DEFAULT_SIGNED_URL_TTL_SECONDS
}

function sanitizeLabel(input: string, fallback: string) {
  const value = input.trim()
  if (!value) return fallback
  return value.replace(/[^a-zA-Z0-9 _-]+/g, "").slice(0, MAX_LABEL_LENGTH).trim() || fallback
}

function slugifyLabel(input: string) {
  return (
    input
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "sigma-export"
  )
}

function wrapLine(input: string, maxChars: number) {
  if (input.length <= maxChars) return [input]
  const words = input.split(/\s+/)
  const lines: string[] = []
  let current = ""
  for (const word of words) {
    const candidate = current.length === 0 ? word : `${current} ${word}`
    if (candidate.length <= maxChars) {
      current = candidate
      continue
    }
    if (current.length > 0) {
      lines.push(current)
      current = word
    } else {
      lines.push(word.slice(0, maxChars))
      current = word.slice(maxChars)
    }
  }
  if (current.length > 0) lines.push(current)
  return lines
}

function toSummaryRows(input: ExportBuildInput) {
  return [
    { section: "Answer", value: input.answer },
    { section: "Follow-up actions", value: input.followUpActions.join(" | ") || "None" },
    { section: "Evidence snippets", value: input.retrievalEvidence.map((item) => item.snippet).join(" | ") || "None" },
    { section: "Positions count", value: String(input.positions.length) },
    { section: "Open alerts count", value: String(input.alerts.length) },
  ]
}

function toPositionRows(input: ExportBuildInput) {
  return input.positions.map((position) => ({
    ticker: position.ticker,
    companyName: position.companyName,
    status: position.status,
    updatedAt: position.updatedAt,
  }))
}

function toAlertRows(input: ExportBuildInput) {
  return input.alerts.map((alert) => ({
    ticker: alert.ticker,
    eventType: alert.eventType,
    eventDetail: alert.eventDetail,
    createdAt: alert.createdAt,
  }))
}

function toEvidenceRows(input: ExportBuildInput) {
  return input.retrievalEvidence.map((item) => ({
    source: item.source,
    snippet: item.snippet,
  }))
}

function buildCsvBuffer(input: ExportBuildInput) {
  const sheet = XLSX.utils.json_to_sheet([
    ...toSummaryRows(input),
    ...toPositionRows(input).map((row) => ({
      section: "Position",
      value: `${row.ticker} | ${row.companyName} | ${row.status} | ${row.updatedAt}`,
    })),
    ...toAlertRows(input).map((row) => ({
      section: "Alert",
      value: `${row.ticker} | ${row.eventType} | ${row.eventDetail} | ${row.createdAt}`,
    })),
    ...toEvidenceRows(input).map((row) => ({
      section: "Evidence",
      value: `${row.source} | ${row.snippet}`,
    })),
  ])
  const csv = XLSX.utils.sheet_to_csv(sheet)
  return Buffer.from(csv, "utf8")
}

function buildXlsxBuffer(input: ExportBuildInput) {
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(toSummaryRows(input)), "Summary")
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(toPositionRows(input).length ? toPositionRows(input) : [{ ticker: "", companyName: "", status: "", updatedAt: "" }]),
    "Positions",
  )
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(toAlertRows(input).length ? toAlertRows(input) : [{ ticker: "", eventType: "", eventDetail: "", createdAt: "" }]),
    "Alerts",
  )
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(toEvidenceRows(input).length ? toEvidenceRows(input) : [{ source: "", snippet: "" }]),
    "Evidence",
  )
  const workbookBytes = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" })
  return Buffer.isBuffer(workbookBytes) ? workbookBytes : Buffer.from(workbookBytes)
}

async function buildDocxBuffer(input: ExportBuildInput) {
  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            children: [new TextRun({ text: "Sigma Chat Export", bold: true, size: 30 })],
            spacing: { after: 260 },
          }),
          new Paragraph({ children: [new TextRun({ text: "Answer", bold: true })] }),
          ...wrapLine(input.answer, 120).map((line) => new Paragraph({ children: [new TextRun(line)] })),
          new Paragraph({ children: [new TextRun({ text: "Follow-up Actions", bold: true })], spacing: { before: 220 } }),
          ...(input.followUpActions.length > 0
            ? input.followUpActions.map((item) => new Paragraph({ text: `- ${item}` }))
            : [new Paragraph({ text: "- None" })]),
          new Paragraph({ children: [new TextRun({ text: "Evidence", bold: true })], spacing: { before: 220 } }),
          ...(input.retrievalEvidence.length > 0
            ? input.retrievalEvidence.map((item) => new Paragraph({ text: `- [${item.source}] ${item.snippet}` }))
            : [new Paragraph({ text: "- None" })]),
          new Paragraph({ children: [new TextRun({ text: "Positions", bold: true })], spacing: { before: 220 } }),
          ...(input.positions.length > 0
            ? input.positions.map((row) => new Paragraph({ text: `- ${row.ticker} (${row.status}) ${row.companyName}` }))
            : [new Paragraph({ text: "- None" })]),
          new Paragraph({ children: [new TextRun({ text: "Open Alerts", bold: true })], spacing: { before: 220 } }),
          ...(input.alerts.length > 0
            ? input.alerts.map((row) => new Paragraph({ text: `- ${row.ticker}: ${row.eventType} - ${row.eventDetail}` }))
            : [new Paragraph({ text: "- None" })]),
        ],
      },
    ],
  })
  return Buffer.from(await Packer.toBuffer(doc))
}

async function buildPdfBuffer(input: ExportBuildInput) {
  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([595, 842])
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  let y = 800
  const lineHeight = 14
  const writeLine = (line: string, bold = false) => {
    if (y <= 42) return
    page.drawText(line, {
      x: 40,
      y,
      size: bold ? 12 : 10,
      font,
      color: rgb(0.08, 0.08, 0.1),
    })
    y -= lineHeight
  }

  writeLine("Sigma Chat Export", true)
  y -= 8
  writeLine("Answer", true)
  for (const line of wrapLine(input.answer, 88)) writeLine(line)
  y -= 6
  writeLine("Follow-up Actions", true)
  if (input.followUpActions.length === 0) writeLine("- None")
  for (const item of input.followUpActions) {
    for (const line of wrapLine(`- ${item}`, 88)) writeLine(line)
  }
  y -= 6
  writeLine("Evidence", true)
  if (input.retrievalEvidence.length === 0) writeLine("- None")
  for (const item of input.retrievalEvidence) {
    for (const line of wrapLine(`- [${item.source}] ${item.snippet}`, 88)) writeLine(line)
  }
  y -= 6
  writeLine("Positions", true)
  if (input.positions.length === 0) writeLine("- None")
  for (const row of input.positions.slice(0, 40)) {
    for (const line of wrapLine(`- ${row.ticker} (${row.status}) ${row.companyName}`, 88)) writeLine(line)
  }
  y -= 6
  writeLine("Open Alerts", true)
  if (input.alerts.length === 0) writeLine("- None")
  for (const row of input.alerts.slice(0, 40)) {
    for (const line of wrapLine(`- ${row.ticker}: ${row.eventType} - ${row.eventDetail}`, 88)) writeLine(line)
  }

  return Buffer.from(await pdfDoc.save())
}

async function buildExportBuffer(format: ChatExportFormat, input: ExportBuildInput) {
  if (format === "csv") return buildCsvBuffer(input)
  if (format === "xlsx") return buildXlsxBuffer(input)
  if (format === "docx") return buildDocxBuffer(input)
  return buildPdfBuffer(input)
}

function ensureRequestedExports(response: ChatAssistantResponse) {
  return (response.requestedExports ?? [])
    .slice(0, MAX_EXPORTS_PER_RESPONSE)
    .filter((item, index, array) => array.findIndex((candidate) => `${candidate.format}:${candidate.label}` === `${item.format}:${item.label}`) === index)
}

export async function createSignedUrlForStoredExport(
  supabase: SupabaseClient,
  userId: string,
  exportId: string,
): Promise<ChatExportArtifact | null> {
  const { data: row } = await supabase
    .from("chat_exports")
    .select("id,file_name,format,mime_type,size_bytes,bucket,storage_path")
    .eq("id", exportId)
    .eq("user_id", userId)
    .maybeSingle()

  if (!row) return null

  const ttlSeconds = getExportSignedUrlTtlSeconds()
  const { data: signedData, error: signedError } = await supabase.storage.from(row.bucket).createSignedUrl(row.storage_path, ttlSeconds)
  if (signedError || !signedData?.signedUrl) return null

  const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString()
  await supabase.from("chat_exports").update({ signed_url_expires_at: expiresAt }).eq("id", row.id).eq("user_id", userId)

  return {
    id: row.id,
    label: row.file_name.replace(/\.[a-z0-9]+$/i, ""),
    format: row.format,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    signedUrl: signedData.signedUrl,
    signedUrlExpiresAt: expiresAt,
  }
}

export async function createSigmaExportsForResponse(args: {
  supabase: SupabaseClient
  userId: string
  requestId: string
  response: ChatAssistantResponse
  positions: ExportPositionSnapshot[]
  alerts: ExportAlertSnapshot[]
}): Promise<ChatExportArtifact[]> {
  const requested = ensureRequestedExports(args.response)
  if (requested.length === 0) return []

  const exportInput: ExportBuildInput = {
    answer: args.response.answer,
    followUpActions: args.response.followUpActions ?? [],
    retrievalEvidence: (args.response.retrievalEvidence ?? []).map((item) => ({ source: item.source, snippet: item.snippet })),
    positions: args.positions,
    alerts: args.alerts,
  }

  const bucket = getExportBucketName()
  const ttlSeconds = getExportSignedUrlTtlSeconds()
  const artifacts: ChatExportArtifact[] = []

  for (const request of requested) {
    const format = request.format
    const safeLabel = sanitizeLabel(request.label, `Sigma ${format.toUpperCase()} export`)
    const safeSlug = slugifyLabel(safeLabel)
    const fileName = `${safeSlug}.${format}`
    const storagePath = `${args.userId}/${args.requestId}/${crypto.randomUUID()}-${fileName}`
    const mimeType = MIMES[format]
    const content = await buildExportBuffer(format, exportInput)

    const uploadResult = await args.supabase.storage.from(bucket).upload(storagePath, content, {
      contentType: mimeType,
      upsert: false,
    })
    if (uploadResult.error) continue

    const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString()
    const { data: insertedRow } = await args.supabase
      .from("chat_exports")
      .insert({
        user_id: args.userId,
        bucket,
        storage_path: storagePath,
        file_name: fileName,
        format,
        mime_type: mimeType,
        size_bytes: content.byteLength,
        source_request_id: args.requestId,
        signed_url_expires_at: expiresAt,
      })
      .select("id,file_name,format,mime_type,size_bytes,signed_url_expires_at")
      .single()

    const persisted = insertedRow as PersistedExportRow | null
    if (!persisted) continue

    const { data: signedData, error: signedError } = await args.supabase.storage.from(bucket).createSignedUrl(storagePath, ttlSeconds)
    if (signedError || !signedData?.signedUrl) continue

    artifacts.push({
      id: persisted.id,
      label: safeLabel,
      format: persisted.format,
      mimeType: persisted.mime_type,
      sizeBytes: persisted.size_bytes,
      signedUrl: signedData.signedUrl,
      signedUrlExpiresAt: persisted.signed_url_expires_at,
    })
  }

  return artifacts
}

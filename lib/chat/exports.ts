import { Buffer } from "node:buffer"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Firestore } from "firebase-admin/firestore"
import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx"
import { PDFDocument, StandardFonts, rgb } from "pdf-lib"
import * as XLSX from "xlsx"
import type { ChatAssistantResponse, ChatExportArtifact, ChatExportFormat } from "@/lib/chat/types"
import {
  createFirebaseSignedDownloadUrl,
  uploadBufferToFirebaseStorage,
} from "@/lib/firebase/storage"
import { newDocumentId, toFirestorePayload } from "@/lib/data/firestore-utils"

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

type ExportBackend = SupabaseClient | Firestore

function isFirestoreBackend(backend: ExportBackend): backend is Firestore {
  return "collection" in backend
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

function toPortfolioRows(input: ExportBuildInput) {
  return input.positions.map((position) => ({
    ticker: position.ticker,
    companyName: position.companyName || "—",
    status: toTitleCaseStatus(position.status),
    updatedAt: formatIsoDate(position.updatedAt),
  }))
}

function toAlertRows(input: ExportBuildInput) {
  return input.alerts.map((alert) => ({
    ticker: alert.ticker,
    eventType: alert.eventType || "—",
    eventDetail: alert.eventDetail || "—",
    createdAt: formatIsoDate(alert.createdAt),
  }))
}

function toEvidenceRows(input: ExportBuildInput) {
  return input.retrievalEvidence.map((item) => ({
    source: item.source,
    snippet: item.snippet,
  }))
}

function toActionPlanRows(input: ExportBuildInput) {
  const actionPlan =
    input.followUpActions.length > 0
      ? input.followUpActions
      : [
          "Review convictions currently marked at risk and verify break conditions.",
          "Prioritize unresolved alerts with highest confidence and business impact.",
          "Refresh Sigma Monitor after thesis updates to validate risk drift.",
        ]
  return actionPlan.slice(0, 6).map((item, index) => ({
    priority: index + 1,
    action: item,
  }))
}

function toExecutiveSummaryRows(input: ExportBuildInput) {
  const statusMix = summarizeStatusMix(input)
  return [
    { metric: "Generated On", value: new Date().toISOString().slice(0, 10) },
    { metric: "Tracked Convictions", value: String(input.positions.length) },
    { metric: "Open Alerts", value: String(input.alerts.length) },
    {
      metric: "Status Mix",
      value: `${statusMix.intact} intact | ${statusMix.atRisk} at risk | ${statusMix.broken} broken${statusMix.other > 0 ? ` | ${statusMix.other} other` : ""}`,
    },
  ]
}

function toNarrativeRows(input: ExportBuildInput) {
  return wrapLine(input.answer || "No narrative provided.", 220).map((line, index) => ({
    line: index + 1,
    text: line,
  }))
}

function buildCsvBuffer(input: ExportBuildInput) {
  const rows: Array<{ section: string; field: string; value: string }> = []
  rows.push({ section: "Report", field: "Title", value: "SYNESI Sigma Conviction Report" })

  for (const row of toExecutiveSummaryRows(input)) {
    rows.push({ section: "Executive Summary", field: row.metric, value: row.value })
  }
  rows.push({ section: "", field: "", value: "" })

  if (toPortfolioRows(input).length > 0) {
    for (const row of toPortfolioRows(input)) {
      rows.push({
        section: "Portfolio Snapshot",
        field: `${row.ticker} (${row.status})`,
        value: `${row.companyName} | Updated ${row.updatedAt}`,
      })
    }
  } else {
    rows.push({ section: "Portfolio Snapshot", field: "Data", value: "No positions available." })
  }
  rows.push({ section: "", field: "", value: "" })

  if (toAlertRows(input).length > 0) {
    for (const row of toAlertRows(input)) {
      rows.push({
        section: "Open Alerts",
        field: `${row.ticker} | ${row.eventType}`,
        value: `${row.eventDetail} | Created ${row.createdAt}`,
      })
    }
  } else {
    rows.push({ section: "Open Alerts", field: "Data", value: "No open alerts." })
  }
  rows.push({ section: "", field: "", value: "" })

  for (const row of toActionPlanRows(input)) {
    rows.push({ section: "Action Plan", field: `P${row.priority}`, value: row.action })
  }
  rows.push({ section: "", field: "", value: "" })

  if (toEvidenceRows(input).length > 0) {
    for (const row of toEvidenceRows(input)) {
      rows.push({ section: "Evidence Anchors", field: row.source, value: row.snippet })
    }
  } else {
    rows.push({ section: "Evidence Anchors", field: "Data", value: "No evidence snippets available." })
  }

  const sheet = XLSX.utils.json_to_sheet(rows)
  const csv = XLSX.utils.sheet_to_csv(sheet)
  return Buffer.from(csv, "utf8")
}

function buildXlsxBuffer(input: ExportBuildInput) {
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(toExecutiveSummaryRows(input)),
    "Executive Summary",
  )
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(
      toPortfolioRows(input).length
        ? toPortfolioRows(input)
        : [{ ticker: "", companyName: "No positions available", status: "", updatedAt: "" }],
    ),
    "Portfolio Snapshot",
  )
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(
      toAlertRows(input).length
        ? toAlertRows(input)
        : [{ ticker: "", eventType: "No open alerts", eventDetail: "", createdAt: "" }],
    ),
    "Open Alerts",
  )
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(toActionPlanRows(input)), "Action Plan")
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(
      toNarrativeRows(input).length ? toNarrativeRows(input) : [{ line: 1, text: "No narrative provided." }],
    ),
    "Sigma Narrative",
  )
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(
      toEvidenceRows(input).length ? toEvidenceRows(input) : [{ source: "Data", snippet: "No evidence snippets available." }],
    ),
    "Evidence Anchors",
  )
  const workbookBytes = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" })
  return Buffer.isBuffer(workbookBytes) ? workbookBytes : Buffer.from(workbookBytes)
}

function formatIsoDate(input: string) {
  const date = new Date(input)
  if (Number.isNaN(date.getTime())) return "Unknown"
  return date.toISOString().slice(0, 10)
}

function toTitleCaseStatus(input: string) {
  if (!input) return "Unknown"
  return input
    .replace(/_/g, " ")
    .split(" ")
    .map((word) => (word.length > 0 ? `${word[0].toUpperCase()}${word.slice(1)}` : word))
    .join(" ")
}

function summarizeStatusMix(input: ExportBuildInput) {
  const counts = input.positions.reduce(
    (acc, position) => {
      if (position.status === "intact") acc.intact += 1
      else if (position.status === "at_risk") acc.atRisk += 1
      else if (position.status === "broken") acc.broken += 1
      else acc.other += 1
      return acc
    },
    { intact: 0, atRisk: 0, broken: 0, other: 0 },
  )
  return counts
}

function buildExecutiveSummaryLines(input: ExportBuildInput) {
  const statusMix = summarizeStatusMix(input)
  const topAlerts = input.alerts.slice(0, 3)
  const summaryLines = [
    `Portfolio coverage: ${input.positions.length} tracked convictions.`,
    `Status mix: ${statusMix.intact} intact, ${statusMix.atRisk} at risk, ${statusMix.broken} broken${statusMix.other > 0 ? `, ${statusMix.other} other` : ""}.`,
    `Open alert pressure: ${input.alerts.length} unresolved alert${input.alerts.length === 1 ? "" : "s"}.`,
  ]
  if (topAlerts.length > 0) {
    summaryLines.push(
      `Highest-priority alert themes: ${topAlerts.map((alert) => `${alert.ticker} (${alert.eventType})`).join(", ")}.`,
    )
  }
  return summaryLines
}

function buildPortfolioTable(input: ExportBuildInput) {
  const headerRow = new TableRow({
    children: ["Ticker", "Company", "Status", "Last Updated"].map(
      (cell) =>
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: cell, bold: true })] })],
        }),
    ),
  })

  const rows =
    input.positions.length > 0
      ? input.positions.map(
          (position) =>
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph(position.ticker)] }),
                new TableCell({ children: [new Paragraph(position.companyName || "—")] }),
                new TableCell({ children: [new Paragraph(toTitleCaseStatus(position.status))] }),
                new TableCell({ children: [new Paragraph(formatIsoDate(position.updatedAt))] }),
              ],
            }),
        )
      : [
          new TableRow({
            children: [
              new TableCell({ children: [new Paragraph("No positions available")] }),
              new TableCell({ children: [new Paragraph("—")] }),
              new TableCell({ children: [new Paragraph("—")] }),
              new TableCell({ children: [new Paragraph("—")] }),
            ],
          }),
        ]

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [headerRow, ...rows],
  })
}

function buildAlertsTable(input: ExportBuildInput) {
  const headerRow = new TableRow({
    children: ["Ticker", "Event", "Detail", "Created"].map(
      (cell) =>
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: cell, bold: true })] })],
        }),
    ),
  })

  const rows =
    input.alerts.length > 0
      ? input.alerts.slice(0, 20).map(
          (alert) =>
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph(alert.ticker)] }),
                new TableCell({ children: [new Paragraph(alert.eventType || "—")] }),
                new TableCell({ children: [new Paragraph(alert.eventDetail || "—")] }),
                new TableCell({ children: [new Paragraph(formatIsoDate(alert.createdAt))] }),
              ],
            }),
        )
      : [
          new TableRow({
            children: [
              new TableCell({ children: [new Paragraph("No open alerts")] }),
              new TableCell({ children: [new Paragraph("—")] }),
              new TableCell({ children: [new Paragraph("—")] }),
              new TableCell({ children: [new Paragraph("—")] }),
            ],
          }),
        ]

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [headerRow, ...rows],
  })
}

async function buildDocxBuffer(input: ExportBuildInput) {
  const generatedAt = new Date().toISOString()
  const executiveSummaryLines = buildExecutiveSummaryLines(input)
  const actionPlan =
    input.followUpActions.length > 0
      ? input.followUpActions
      : [
          "Review convictions currently marked at risk and verify break conditions.",
          "Prioritize unresolved alerts with highest confidence and business impact.",
          "Refresh Sigma Monitor after thesis updates to validate risk drift.",
        ]

  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            children: [new TextRun({ text: "SYNESI Sigma Conviction Report", bold: true, size: 34 })],
            heading: HeadingLevel.TITLE,
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: `Generated: ${generatedAt.slice(0, 10)}   |   Scope: Portfolio convictions and alert pressure`,
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 320 },
          }),
          new Paragraph({
            children: [new TextRun({ text: "Executive Summary", bold: true })],
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 120, after: 120 },
          }),
          ...executiveSummaryLines.map((line) => new Paragraph({ text: `- ${line}` })),
          new Paragraph({
            children: [new TextRun({ text: "Portfolio Snapshot", bold: true })],
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 220, after: 120 },
          }),
          buildPortfolioTable(input),
          new Paragraph({
            children: [new TextRun({ text: "Open Alerts", bold: true })],
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 220, after: 120 },
          }),
          buildAlertsTable(input),
          new Paragraph({
            children: [new TextRun({ text: "Sigma Narrative", bold: true })],
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 220, after: 120 },
          }),
          ...wrapLine(input.answer, 120).map((line) => new Paragraph(line)),
          new Paragraph({
            children: [new TextRun({ text: "Action Plan (Next 7 Days)", bold: true })],
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 220, after: 120 },
          }),
          ...actionPlan.slice(0, 6).map((item, index) => new Paragraph({ text: `${index + 1}. ${item}` })),
          new Paragraph({
            children: [new TextRun({ text: "Evidence Anchors", bold: true })],
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 220, after: 120 },
          }),
          ...(input.retrievalEvidence.length > 0
            ? input.retrievalEvidence.map((item) => new Paragraph({ text: `- [${item.source}] ${item.snippet}` }))
            : [new Paragraph({ text: "- No supporting evidence snippets were available for this export." })]),
        ],
      },
    ],
  })
  return Buffer.from(await Packer.toBuffer(doc))
}

async function buildPdfBuffer(input: ExportBuildInput) {
  const pdfDoc = await PDFDocument.create()
  let page = pdfDoc.addPage([595, 842])
  const font = await pdfDoc.embedFont(StandardFonts.Courier)
  let y = 800
  const lineHeight = 13
  const footer = "SYNESI Sigma Conviction Report"
  const ensureSpace = (lines = 1) => {
    if (y - lines * lineHeight > 54) return
    page = pdfDoc.addPage([595, 842])
    y = 800
  }
  const writeLine = (line: string, bold = false) => {
    ensureSpace(1)
    page.drawText(line, {
      x: 40,
      y,
      size: bold ? 12 : 10,
      font,
      color: rgb(0.08, 0.08, 0.1),
    })
    y -= lineHeight
  }
  const writeSection = (title: string) => {
    y -= 6
    writeLine(title, true)
    writeLine("-".repeat(Math.max(20, title.length + 4)))
  }

  writeLine("SYNESI Sigma Conviction Report", true)
  writeLine(`Generated: ${new Date().toISOString().slice(0, 10)} | Scope: Portfolio convictions and alert pressure`)

  writeSection("Executive Summary")
  for (const row of toExecutiveSummaryRows(input)) {
    for (const line of wrapLine(`- ${row.metric}: ${row.value}`, 88)) writeLine(line)
  }

  writeSection("Portfolio Snapshot")
  if (toPortfolioRows(input).length === 0) {
    writeLine("- No positions available")
  } else {
    writeLine("Ticker | Status | Company | Updated")
    for (const row of toPortfolioRows(input).slice(0, 40)) {
      for (const line of wrapLine(`- ${row.ticker} | ${row.status} | ${row.companyName} | ${row.updatedAt}`, 88)) {
        writeLine(line)
      }
    }
  }

  writeSection("Open Alerts")
  if (toAlertRows(input).length === 0) {
    writeLine("- No open alerts")
  } else {
    for (const row of toAlertRows(input).slice(0, 40)) {
      for (const line of wrapLine(`- ${row.ticker} | ${row.eventType} | ${row.eventDetail} | ${row.createdAt}`, 88)) {
        writeLine(line)
      }
    }
  }

  writeSection("Action Plan (Next 7 Days)")
  for (const row of toActionPlanRows(input)) {
    for (const line of wrapLine(`${row.priority}. ${row.action}`, 88)) writeLine(line)
  }

  writeSection("Sigma Narrative")
  for (const line of wrapLine(input.answer || "No narrative provided.", 88)) writeLine(line)

  writeSection("Evidence Anchors")
  if (toEvidenceRows(input).length === 0) {
    writeLine("- No evidence snippets available")
  } else {
    for (const row of toEvidenceRows(input).slice(0, 30)) {
      for (const line of wrapLine(`- [${row.source}] ${row.snippet}`, 88)) writeLine(line)
    }
  }

  for (const p of pdfDoc.getPages()) {
    p.drawText(footer, {
      x: 40,
      y: 22,
      size: 9,
      font,
      color: rgb(0.35, 0.35, 0.4),
    })
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
  backend: ExportBackend,
  userId: string,
  exportId: string,
): Promise<ChatExportArtifact | null> {
  let row:
    | {
        id: string
        file_name: string
        format: ChatExportFormat
        mime_type: string
        size_bytes: number
        bucket: string
        storage_path: string
      }
    | null = null

  if (isFirestoreBackend(backend)) {
    const snapshot = await backend.collection("chat_exports").doc(exportId).get()
    if (snapshot.exists) {
      const data = (snapshot.data() ?? {}) as Record<string, unknown>
      if (data.user_id === userId) {
        row = {
          id: snapshot.id,
          file_name: typeof data.file_name === "string" ? data.file_name : "export",
          format:
            data.format === "csv" || data.format === "docx" || data.format === "pdf" || data.format === "xlsx"
              ? data.format
              : "pdf",
          mime_type: typeof data.mime_type === "string" ? data.mime_type : "application/octet-stream",
          size_bytes: typeof data.size_bytes === "number" ? data.size_bytes : 0,
          bucket: typeof data.bucket === "string" ? data.bucket : getExportBucketName(),
          storage_path: typeof data.storage_path === "string" ? data.storage_path : "",
        }
      }
    }
  } else {
    const result = await backend
      .from("chat_exports")
      .select("id,file_name,format,mime_type,size_bytes,bucket,storage_path")
      .eq("id", exportId)
      .eq("user_id", userId)
      .maybeSingle()
    row = (result.data as typeof row) ?? null
  }

  if (!row) return null

  const ttlSeconds = getExportSignedUrlTtlSeconds()
  const expiresAtDate = new Date(Date.now() + ttlSeconds * 1000)
  let signedUrl: string
  try {
    signedUrl = await createFirebaseSignedDownloadUrl({
      bucketName: row.bucket,
      storagePath: row.storage_path,
      expiresAt: expiresAtDate,
    })
  } catch {
    return null
  }

  const expiresAt = expiresAtDate.toISOString()
  if (isFirestoreBackend(backend)) {
    await backend
      .collection("chat_exports")
      .doc(row.id)
      .set(toFirestorePayload({ signed_url_expires_at: expiresAt }), { merge: true })
  } else {
    await backend
      .from("chat_exports")
      .update({ signed_url_expires_at: expiresAt })
      .eq("id", row.id)
      .eq("user_id", userId)
  }

  return {
    id: row.id,
    label: row.file_name.replace(/\.[a-z0-9]+$/i, ""),
    format: row.format,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    signedUrl,
    signedUrlExpiresAt: expiresAt,
  }
}

export async function createSigmaExportsForResponse(args: {
  backend: ExportBackend
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
    const storagePath = `exports/${args.userId}/${args.requestId}/${crypto.randomUUID()}-${fileName}`
    const mimeType = MIMES[format]
    const content = await buildExportBuffer(format, exportInput)

    try {
      await uploadBufferToFirebaseStorage({
        bucketName: bucket,
        storagePath,
        content,
        contentType: mimeType,
      })
    } catch {
      continue
    }

    const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString()
    let persisted: PersistedExportRow | null = null
    if (isFirestoreBackend(args.backend)) {
      const id = newDocumentId()
      const payload = {
        id,
        user_id: args.userId,
        bucket,
        storage_path: storagePath,
        file_name: fileName,
        format,
        mime_type: mimeType,
        size_bytes: content.byteLength,
        source_request_id: args.requestId,
        signed_url_expires_at: expiresAt,
        created_at: new Date().toISOString(),
      }
      await args.backend.collection("chat_exports").doc(id).set(payload)
      persisted = {
        id,
        file_name: fileName,
        format,
        mime_type: mimeType,
        size_bytes: content.byteLength,
        signed_url_expires_at: expiresAt,
      }
    } else {
      const { data: insertedRow } = await args.backend
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
      persisted = insertedRow as PersistedExportRow | null
    }

    if (!persisted) continue

    let signedUrl: string
    try {
      signedUrl = await createFirebaseSignedDownloadUrl({
        bucketName: bucket,
        storagePath,
        expiresAt: new Date(expiresAt),
      })
    } catch {
      continue
    }

    artifacts.push({
      id: persisted.id,
      label: safeLabel,
      format: persisted.format,
      mimeType: persisted.mime_type,
      sizeBytes: persisted.size_bytes,
      signedUrl,
      signedUrlExpiresAt: persisted.signed_url_expires_at,
    })
  }

  return artifacts
}

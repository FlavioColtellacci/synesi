import { NextResponse } from "next/server"
import { createSigmaExportsForResponse, createSignedUrlForStoredExport } from "@/lib/chat/exports"
import type { ChatAssistantResponse, ChatRequestedExport } from "@/lib/chat/types"
import { createClient } from "@/lib/supabase/server"

type ExportRequestBody = {
  answer?: string
  followUpActions?: string[]
  retrievalEvidence?: Array<{ source?: string; snippet?: string }>
  requestedExports?: ChatRequestedExport[]
  positions?: Array<{ ticker?: string; companyName?: string; status?: string; updatedAt?: string }>
  alerts?: Array<{ ticker?: string; eventType?: string; eventDetail?: string; createdAt?: string }>
}

function badRequest(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

function sanitizeEvidenceSource(input: unknown): "assumption" | "source_match" | "status_note" | "uploaded_document" {
  if (input === "assumption" || input === "source_match" || input === "status_note" || input === "uploaded_document") {
    return input
  }
  return "source_match"
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return badRequest("Unauthorized", 401)

    const url = new URL(request.url)
    const exportId = url.searchParams.get("id")?.trim()
    if (!exportId) return badRequest("Missing export id.")

    const artifact = await createSignedUrlForStoredExport(supabase, user.id, exportId)
    if (!artifact) return badRequest("Export not found.", 404)
    return NextResponse.json({ artifact })
  } catch {
    return badRequest("Failed to sign export link.", 500)
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return badRequest("Unauthorized", 401)

    const body = (await request.json()) as ExportRequestBody
    const answer = typeof body.answer === "string" ? body.answer.trim() : ""
    if (!answer) return badRequest("Missing answer text.")

    const requestedExports = Array.isArray(body.requestedExports) ? body.requestedExports.slice(0, 3) : []
    if (requestedExports.length === 0) {
      return badRequest("At least one requested export is required.")
    }

    const responseForExport: ChatAssistantResponse = {
      answer,
      sourceTags: ["WorkflowGuide"],
      confidence: "medium",
      escalation: "none",
      followUpActions: Array.isArray(body.followUpActions)
        ? body.followUpActions.filter((item): item is string => typeof item === "string").slice(0, 3)
        : [],
      retrievalEvidence: Array.isArray(body.retrievalEvidence)
        ? body.retrievalEvidence
            .map((item) => ({
              source: sanitizeEvidenceSource(item.source),
              snippet: typeof item.snippet === "string" ? item.snippet.slice(0, 220) : "",
            }))
            .filter((item) => item.snippet.trim().length > 0)
            .slice(0, 5)
        : [],
      requestedExports,
    }

    const requestId = crypto.randomUUID()
    const artifacts = await createSigmaExportsForResponse({
      supabase,
      userId: user.id,
      requestId,
      response: responseForExport,
      positions: Array.isArray(body.positions)
        ? body.positions
            .map((item) => ({
              ticker: typeof item.ticker === "string" ? item.ticker : "",
              companyName: typeof item.companyName === "string" ? item.companyName : "",
              status: typeof item.status === "string" ? item.status : "",
              updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : "",
            }))
            .filter((item) => item.ticker.length > 0)
        : [],
      alerts: Array.isArray(body.alerts)
        ? body.alerts
            .map((item) => ({
              ticker: typeof item.ticker === "string" ? item.ticker : "",
              eventType: typeof item.eventType === "string" ? item.eventType : "",
              eventDetail: typeof item.eventDetail === "string" ? item.eventDetail : "",
              createdAt: typeof item.createdAt === "string" ? item.createdAt : "",
            }))
            .filter((item) => item.ticker.length > 0)
        : [],
    })

    return NextResponse.json({ artifacts })
  } catch {
    return badRequest("Failed to generate export.", 500)
  }
}

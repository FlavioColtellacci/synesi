import { NextResponse } from "next/server"
import { isWebPushConfigured } from "@/lib/push/vapid"

/**
 * Public VAPID key for PushManager.subscribe (safe to expose).
 */
export async function GET() {
  if (!isWebPushConfigured()) {
    return NextResponse.json({ error: "Web Push is not configured on this deployment." }, { status: 503 })
  }

  return NextResponse.json({
    publicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!.trim(),
  })
}

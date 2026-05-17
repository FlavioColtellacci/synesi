import { NextResponse } from "next/server"
import { clearFirebaseSessionCookie } from "@/lib/firebase/session"

export async function POST() {
  await clearFirebaseSessionCookie()
  return NextResponse.json({ ok: true })
}

import { NextResponse } from "next/server"
import { getFirebaseSessionWithProfile } from "@/lib/firebase/session"

export async function GET() {
  const { token, profile } = await getFirebaseSessionWithProfile()
  if (!token) {
    return NextResponse.json({ authenticated: false }, { status: 401 })
  }

  return NextResponse.json({
    authenticated: true,
    uid: token.uid,
    profile,
  })
}

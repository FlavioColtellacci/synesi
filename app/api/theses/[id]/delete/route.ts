import { NextResponse } from "next/server"
import { getServerUserId } from "@/lib/data/auth"
import { isFirebaseBackend } from "@/lib/data/backend"
import { createRepositories } from "@/lib/data/repositories"
import { createClient } from "@/lib/supabase/server"

type DeleteRouteContext = {
  params: Promise<{
    id: string
  }>
}

export async function DELETE(_request: Request, { params }: DeleteRouteContext) {
  try {
    const { id } = await params
    const userId = await getServerUserId()

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const supabase = isFirebaseBackend() ? null : await createClient()
    const repositories = createRepositories({ supabase: supabase ?? undefined })

    const deleted = await repositories.theses.delete(userId, id)
    if (!deleted) {
      return NextResponse.json({ error: "Thesis not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Delete thesis failed:", error)
    return NextResponse.json({ error: "Delete failed" }, { status: 500 })
  }
}

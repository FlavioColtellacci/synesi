import type { ImageBlockParam } from "@anthropic-ai/sdk/resources/messages/messages.js"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Firestore } from "firebase-admin/firestore"
import { downloadFromFirebaseStorage } from "@/lib/firebase/storage"

const IMAGE_EXT = new Set(["png", "jpg", "jpeg"])
const MAX_IMAGE_BYTES = 4 * 1024 * 1024

type VisionBackend = SupabaseClient | Firestore

function isFirestoreBackend(backend: VisionBackend): backend is Firestore {
  return "collection" in backend
}

export function isChatVisionEnabled() {
  const raw = process.env.SIGMA_CHAT_VISION_ENABLED?.trim().toLowerCase()
  if (raw === "0" || raw === "false" || raw === "off") return false
  return true
}

/**
 * Load image bytes from storage for chat attachments and build vision content blocks.
 * Order matches attachmentIds so the model sees images in user selection order.
 */
export async function buildVisionContentBlocksForAttachments(
  backend: VisionBackend,
  userId: string,
  attachmentIds: string[],
): Promise<{ blocks: ImageBlockParam[]; loadedIds: string[] }> {
  if (!isChatVisionEnabled() || attachmentIds.length === 0) {
    return { blocks: [], loadedIds: [] }
  }

  const deduped = [...new Set(attachmentIds)]
  let rows: Array<{
    id: string
    bucket: string
    storage_path: string
    mime_type: string
    file_extension: string
    size_bytes: number
  }> = []
  if (isFirestoreBackend(backend)) {
    const snapshots = await Promise.all(
      deduped.map((id) => backend.collection("chat_uploaded_documents").doc(id).get()),
    )
    rows = snapshots
      .filter((snapshot) => snapshot.exists)
      .map((snapshot) => {
        const row = (snapshot.data() ?? {}) as Record<string, unknown>
        return {
          id: snapshot.id,
          user_id: typeof row.user_id === "string" ? row.user_id : "",
          bucket: typeof row.bucket === "string" ? row.bucket : "",
          storage_path: typeof row.storage_path === "string" ? row.storage_path : "",
          mime_type: typeof row.mime_type === "string" ? row.mime_type : "",
          file_extension: typeof row.file_extension === "string" ? row.file_extension : "",
          size_bytes: typeof row.size_bytes === "number" ? row.size_bytes : 0,
        }
      })
      .filter((row) => row.user_id === userId)
      .map((row) => ({
        id: row.id,
        bucket: row.bucket,
        storage_path: row.storage_path,
        mime_type: row.mime_type,
        file_extension: row.file_extension,
        size_bytes: row.size_bytes,
      }))
  } else {
    const { data, error } = await backend
      .from("chat_uploaded_documents")
      .select("id,bucket,storage_path,mime_type,file_extension,size_bytes")
      .eq("user_id", userId)
      .in("id", deduped)
    if (error || !data?.length) {
      return { blocks: [], loadedIds: [] }
    }
    rows = data as typeof rows
  }

  if (!rows.length) {
    return { blocks: [], loadedIds: [] }
  }

  const byId = new Map(rows.map((r) => [r.id, r]))
  const blocks: ImageBlockParam[] = []
  const loadedIds: string[] = []

  for (const id of deduped) {
    const row = byId.get(id)
    if (!row) continue
    const ext = String(row.file_extension ?? "").toLowerCase()
    if (!IMAGE_EXT.has(ext)) continue
    const size = typeof row.size_bytes === "number" ? row.size_bytes : 0
    if (size > MAX_IMAGE_BYTES) continue

    let buf: Buffer
    try {
      buf = await downloadFromFirebaseStorage({
        bucketName: row.bucket,
        storagePath: row.storage_path,
      })
    } catch {
      continue
    }
    if (buf.byteLength > MAX_IMAGE_BYTES) continue

    let mediaType = (row.mime_type ?? "").toLowerCase().trim()
    if (!mediaType.startsWith("image/")) {
      mediaType = ext === "png" ? "image/png" : "image/jpeg"
    }

    const media =
      mediaType === "image/png" || mediaType === "image/jpeg" || mediaType === "image/gif" || mediaType === "image/webp"
        ? mediaType
        : mediaType === "image/jpg"
          ? ("image/jpeg" as const)
          : ("image/png" as const)

    blocks.push({
      type: "image",
      source: {
        type: "base64",
        media_type: media,
        data: buf.toString("base64"),
      },
    })
    loadedIds.push(row.id)
  }

  return { blocks, loadedIds }
}

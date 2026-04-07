import type { ImageBlockParam } from "@anthropic-ai/sdk/resources/messages/messages.js"
import type { SupabaseClient } from "@supabase/supabase-js"

const IMAGE_EXT = new Set(["png", "jpg", "jpeg"])
const MAX_IMAGE_BYTES = 4 * 1024 * 1024

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
  supabase: SupabaseClient,
  userId: string,
  attachmentIds: string[],
): Promise<{ blocks: ImageBlockParam[]; loadedIds: string[] }> {
  if (!isChatVisionEnabled() || attachmentIds.length === 0) {
    return { blocks: [], loadedIds: [] }
  }

  const deduped = [...new Set(attachmentIds)]
  const { data: rows, error } = await supabase
    .from("chat_uploaded_documents")
    .select("id,bucket,storage_path,mime_type,file_extension,size_bytes")
    .eq("user_id", userId)
    .in("id", deduped)

  if (error || !rows?.length) {
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

    const { data: blob, error: dlError } = await supabase.storage.from(row.bucket).download(row.storage_path)
    if (dlError || !blob) continue

    const buf = Buffer.from(await blob.arrayBuffer())
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

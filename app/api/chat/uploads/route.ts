import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  extractDocumentText,
  getExtensionFromFileName,
  getUploadBucketName,
  getUploadMaxBytes,
  getUploadMaxBytesPerUser,
  getUploadMaxFilesPerUser,
  isAllowedMimeForExtension,
  isAllowedUploadExtension,
  runMalwareScanHook,
  sha256Hex,
  validateMagicBytes,
} from "@/lib/chat/uploads"

function badRequest(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return badRequest("Unauthorized", 401)

    const formData = await request.formData()
    const fileValue = formData.get("file")
    if (!(fileValue instanceof File)) {
      return badRequest("Missing file.")
    }

    const file = fileValue
    const maxBytes = getUploadMaxBytes()
    if (file.size <= 0) return badRequest("Empty file.")
    if (file.size > maxBytes) {
      return badRequest(`File too large. Maximum ${(maxBytes / (1024 * 1024)).toFixed(0)} MB.`)
    }

    const extension = getExtensionFromFileName(file.name)
    if (!isAllowedUploadExtension(extension)) {
      return badRequest("Unsupported file type. Allowed: PDF, DOCX, CSV, XLSX.")
    }
    if (!isAllowedMimeForExtension(extension, file.type)) {
      return badRequest("File MIME type does not match extension.")
    }

    const arrayBuffer = await file.arrayBuffer()
    const bytes = new Uint8Array(arrayBuffer)
    const magicError = validateMagicBytes(extension, bytes)
    if (magicError) {
      return badRequest(magicError)
    }

    const { data: existingRows, error: existingError } = await supabase
      .from("chat_uploaded_documents")
      .select("size_bytes")
      .eq("user_id", user.id)

    if (existingError) {
      return badRequest("Failed to check upload quota.", 500)
    }

    const existingCount = existingRows?.length ?? 0
    const existingTotalBytes = (existingRows ?? []).reduce((total, row) => total + (row.size_bytes ?? 0), 0)
    const maxFiles = getUploadMaxFilesPerUser()
    const maxTotalBytes = getUploadMaxBytesPerUser()
    if (existingCount >= maxFiles) {
      return badRequest("Upload quota exceeded (file count). Remove older documents and try again.", 429)
    }
    if (existingTotalBytes + file.size > maxTotalBytes) {
      return badRequest("Upload quota exceeded (storage bytes). Remove older documents and try again.", 429)
    }

    const sha256 = sha256Hex(bytes)
    const malwareStatus = await runMalwareScanHook({
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      sizeBytes: file.size,
      sha256,
    })

    if (malwareStatus === "blocked") {
      return badRequest("Upload blocked by security policy.", 400)
    }

    const bucket = getUploadBucketName()
    const uploadId = crypto.randomUUID()
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 100)
    const storagePath = `${user.id}/${uploadId}-${safeName}`
    const binary = Buffer.from(arrayBuffer)

    const storageUpload = await supabase.storage.from(bucket).upload(storagePath, binary, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    })
    if (storageUpload.error) {
      return badRequest(`Storage upload failed: ${storageUpload.error.message}`, 500)
    }

    const extracted = await extractDocumentText(extension, binary)
    const insertPayload = {
      id: uploadId,
      user_id: user.id,
      bucket,
      storage_path: storagePath,
      file_name: file.name,
      file_extension: extension,
      mime_type: file.type || "application/octet-stream",
      size_bytes: file.size,
      sha256,
      status: extracted.status,
      malware_scan_status: malwareStatus,
      extracted_text: extracted.extractedText || null,
      extracted_chars: extracted.extractedText.length,
      extraction_error: extracted.extractionError,
      metadata: {
        originalName: file.name,
      },
    }

    const { error: insertError } = await supabase.from("chat_uploaded_documents").insert(insertPayload)
    if (insertError) {
      await supabase.storage.from(bucket).remove([storagePath])
      return badRequest(`Failed to persist uploaded file metadata: ${insertError.message}`, 500)
    }

    return NextResponse.json({
      document: {
        id: uploadId,
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        sizeBytes: file.size,
        status: extracted.status,
        extractionError: extracted.extractionError,
      },
    })
  } catch {
    return badRequest("Upload failed.", 500)
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return badRequest("Unauthorized", 401)

    const url = new URL(request.url)
    const id = url.searchParams.get("id")?.trim()
    if (!id) return badRequest("Missing upload id.")

    const { data: row, error: rowError } = await supabase
      .from("chat_uploaded_documents")
      .select("id,bucket,storage_path")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle()

    if (rowError) return badRequest("Failed to load upload record.", 500)
    if (!row) return badRequest("Upload not found.", 404)

    const storageResult = await supabase.storage.from(row.bucket).remove([row.storage_path])
    if (storageResult.error) {
      return badRequest(`Failed to remove uploaded file: ${storageResult.error.message}`, 500)
    }

    const { error: deleteError } = await supabase
      .from("chat_uploaded_documents")
      .delete()
      .eq("id", row.id)
      .eq("user_id", user.id)
    if (deleteError) {
      return badRequest(`Failed to remove upload metadata: ${deleteError.message}`, 500)
    }

    return NextResponse.json({ ok: true })
  } catch {
    return badRequest("Delete failed.", 500)
  }
}

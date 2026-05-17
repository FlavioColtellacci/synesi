import { NextResponse } from "next/server"
import { removeFromFirebaseStorage, uploadBufferToFirebaseStorage } from "@/lib/firebase/storage"
import { getServerUserId } from "@/lib/data/auth"
import { isFirebaseBackend } from "@/lib/data/backend"
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin"
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
    const userId = await getServerUserId()
    if (!userId) return badRequest("Unauthorized", 401)
    const usingFirestore = isFirebaseBackend()
    const firestore = usingFirestore ? getFirebaseAdminFirestore() : null
    const supabase = usingFirestore ? null : await createClient()

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
      return badRequest("Unsupported file type. Allowed: PDF, DOCX, CSV, XLSX, PNG, JPEG.")
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

    let existingRows: Array<{ size_bytes: number }> = []
    if (usingFirestore && firestore) {
      const snapshot = await firestore
        .collection("chat_uploaded_documents")
        .where("user_id", "==", userId)
        .get()
      existingRows = snapshot.docs.map((doc) => {
        const row = (doc.data() ?? {}) as Record<string, unknown>
        return { size_bytes: typeof row.size_bytes === "number" ? row.size_bytes : 0 }
      })
    } else if (supabase) {
      const { data, error: existingError } = await supabase
        .from("chat_uploaded_documents")
        .select("size_bytes")
        .eq("user_id", userId)
      if (existingError) {
        return badRequest("Failed to check upload quota.", 500)
      }
      existingRows = (data ?? []) as Array<{ size_bytes: number }>
    }

    const existingCount = existingRows.length
    const existingTotalBytes = existingRows.reduce((total, row) => total + (row.size_bytes ?? 0), 0)
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
    const storagePath = `uploads/${userId}/${uploadId}-${safeName}`
    const binary = Buffer.from(arrayBuffer)

    try {
      await uploadBufferToFirebaseStorage({
        bucketName: bucket,
        storagePath,
        content: binary,
        contentType: file.type || "application/octet-stream",
      })
    } catch (error) {
      return badRequest(
        `Storage upload failed: ${error instanceof Error ? error.message : "unknown error"}`,
        500
      )
    }

    const extracted = await extractDocumentText(extension, binary)
    const insertPayload = {
      id: uploadId,
      user_id: userId,
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

    if (usingFirestore && firestore) {
      try {
        await firestore.collection("chat_uploaded_documents").doc(uploadId).set({
          ...insertPayload,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
      } catch (error) {
        await removeFromFirebaseStorage({ bucketName: bucket, storagePath })
        return badRequest(
          `Failed to persist uploaded file metadata: ${error instanceof Error ? error.message : "unknown error"}`,
          500,
        )
      }
    } else if (supabase) {
      const { error: insertError } = await supabase.from("chat_uploaded_documents").insert(insertPayload)
      if (insertError) {
        await removeFromFirebaseStorage({ bucketName: bucket, storagePath })
        return badRequest(`Failed to persist uploaded file metadata: ${insertError.message}`, 500)
      }
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
    const userId = await getServerUserId()
    if (!userId) return badRequest("Unauthorized", 401)
    const usingFirestore = isFirebaseBackend()
    const firestore = usingFirestore ? getFirebaseAdminFirestore() : null
    const supabase = usingFirestore ? null : await createClient()

    const url = new URL(request.url)
    const id = url.searchParams.get("id")?.trim()
    if (!id) return badRequest("Missing upload id.")

    let row: { id: string; bucket: string; storage_path: string } | null = null
    if (usingFirestore && firestore) {
      const snapshot = await firestore.collection("chat_uploaded_documents").doc(id).get()
      if (snapshot.exists) {
        const data = (snapshot.data() ?? {}) as Record<string, unknown>
        if (data.user_id === userId) {
          row = {
            id: snapshot.id,
            bucket: typeof data.bucket === "string" ? data.bucket : "",
            storage_path: typeof data.storage_path === "string" ? data.storage_path : "",
          }
        }
      }
    } else if (supabase) {
      const { data, error: rowError } = await supabase
        .from("chat_uploaded_documents")
        .select("id,bucket,storage_path")
        .eq("id", id)
        .eq("user_id", userId)
        .maybeSingle()
      if (rowError) return badRequest("Failed to load upload record.", 500)
      row = (data as typeof row) ?? null
    }

    if (!row) return badRequest("Upload not found.", 404)

    try {
      await removeFromFirebaseStorage({ bucketName: row.bucket, storagePath: row.storage_path })
    } catch (error) {
      return badRequest(
        `Failed to remove uploaded file: ${error instanceof Error ? error.message : "unknown error"}`,
        500
      )
    }

    if (usingFirestore && firestore) {
      try {
        await firestore.collection("chat_uploaded_documents").doc(row.id).delete()
      } catch (error) {
        return badRequest(
          `Failed to remove upload metadata: ${error instanceof Error ? error.message : "unknown error"}`,
          500,
        )
      }
    } else if (supabase) {
      const { error: deleteError } = await supabase
        .from("chat_uploaded_documents")
        .delete()
        .eq("id", row.id)
        .eq("user_id", userId)
      if (deleteError) {
        return badRequest(`Failed to remove upload metadata: ${deleteError.message}`, 500)
      }
    }

    return NextResponse.json({ ok: true })
  } catch {
    return badRequest("Delete failed.", 500)
  }
}

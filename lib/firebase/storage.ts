import { getFirebaseAdminStorage } from "@/lib/firebase/admin"

function getBucket(bucketName: string) {
  const explicit = bucketName.trim()
  if (explicit.length > 0) {
    return getFirebaseAdminStorage().bucket(explicit)
  }
  return getFirebaseAdminStorage().bucket()
}

export async function uploadBufferToFirebaseStorage(args: {
  bucketName: string
  storagePath: string
  content: Buffer
  contentType: string
}) {
  const file = getBucket(args.bucketName).file(args.storagePath)
  await file.save(args.content, {
    metadata: { contentType: args.contentType },
    resumable: false,
    validation: "crc32c",
    preconditionOpts: { ifGenerationMatch: 0 },
  })
}

export async function removeFromFirebaseStorage(args: { bucketName: string; storagePath: string }) {
  const file = getBucket(args.bucketName).file(args.storagePath)
  try {
    await file.delete({ ignoreNotFound: true })
  } catch {
    // Ignore cleanup failures so metadata delete can still proceed.
  }
}

export async function downloadFromFirebaseStorage(args: { bucketName: string; storagePath: string }) {
  const file = getBucket(args.bucketName).file(args.storagePath)
  const [buffer] = await file.download()
  return buffer
}

export async function createFirebaseSignedDownloadUrl(args: {
  bucketName: string
  storagePath: string
  expiresAt: Date
}) {
  const file = getBucket(args.bucketName).file(args.storagePath)
  const [signedUrl] = await file.getSignedUrl({
    version: "v4",
    action: "read",
    expires: args.expiresAt,
  })
  return signedUrl
}

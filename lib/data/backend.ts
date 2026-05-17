export type DataBackend = "supabase" | "firebase"

export function getDataBackend(): DataBackend {
  const raw = process.env.DATA_BACKEND?.trim().toLowerCase()
  if (raw === "supabase") return "supabase"
  return "firebase"
}

export function isFirebaseBackend() {
  return getDataBackend() === "firebase"
}

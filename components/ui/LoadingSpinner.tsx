export function LoadingSpinner({ size = "sm" }: { size?: "sm" | "md" }) {
  const dim = size === "sm" ? "h-4 w-4" : "h-6 w-6"
  return (
    <div
      className={`${dim} animate-spin rounded-full border-2 border-[#2A2A32] border-t-[#F0F0F0]`}
    />
  )
}

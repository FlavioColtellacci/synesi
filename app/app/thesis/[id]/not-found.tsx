import Link from "next/link"

export default function ThesisNotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0A0A0C] px-6">
      <div className="max-w-md text-center">
        <p className="mb-8 font-mono text-6xl text-[#2A2A32]">Σ</p>
        <h1 className="mb-3 font-mono text-sm uppercase tracking-widest text-[#6B6B7B]">
          THESIS NOT FOUND
        </h1>
        <p className="mb-8 text-sm leading-relaxed text-[#6B6B7B]">
          This thesis doesn&apos;t exist or you don&apos;t have access to it.
        </p>
        <Link
          href="/app/dashboard"
          className="inline-block rounded-lg bg-[#FFFFFF] px-6 py-3 font-mono text-xs uppercase tracking-widest text-[#0A0A0C] transition-colors hover:bg-[#E8E8E8]"
        >
          GO TO DASHBOARD
        </Link>
      </div>
    </main>
  )
}

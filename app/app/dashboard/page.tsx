import Link from "next/link"

export default function Page() {
  return (
    <main className="min-h-screen bg-synesi-bg">
      <div className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-6 text-center">
        <p className="font-[var(--font-mono)] text-2xl text-white">Σ</p>
        <h1 className="mt-3 font-[var(--font-mono)] text-xl tracking-widest text-synesi-text">
          DASHBOARD
        </h1>
        <p className="mt-2 font-[var(--font-sans)] text-sm text-synesi-muted">
          Phase 1 complete. Coming soon.
        </p>
        <Link
          href="/app/new"
          className="mt-6 rounded-full bg-[#F0F0F0] px-6 py-2.5 font-[var(--font-mono)] text-sm font-medium tracking-widest text-[#0A0A0C] transition-colors hover:bg-[#E8E8E8]"
        >
          + ADD NEW THESIS
        </Link>
      </div>
    </main>
  )
}

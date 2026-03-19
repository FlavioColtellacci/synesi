export default function Loading() {
  return (
    <main className="mx-auto min-h-screen max-w-3xl bg-[#0A0A0C] px-6 py-8 md:px-10">
      <div className="mb-8 h-6 w-32 animate-pulse rounded bg-[#1C1C22]" />

      <section className="rounded-xl border border-[#2A2A32] bg-[#141418] p-6">
        <div className="mb-4 flex items-center justify-between gap-8">
          <div className="h-3 w-24 animate-pulse rounded bg-[#1C1C22]" />
          <div className="h-4 w-36 animate-pulse rounded bg-[#1C1C22]" />
        </div>
        <div className="mb-4 flex items-center justify-between gap-8">
          <div className="h-3 w-24 animate-pulse rounded bg-[#1C1C22]" />
          <div className="h-4 w-36 animate-pulse rounded bg-[#1C1C22]" />
        </div>
        <div className="mb-4 flex items-center justify-between gap-8">
          <div className="h-3 w-24 animate-pulse rounded bg-[#1C1C22]" />
          <div className="h-4 w-36 animate-pulse rounded bg-[#1C1C22]" />
        </div>

        <div className="mt-6 h-10 w-48 animate-pulse rounded-lg bg-[#1C1C22]" />
      </section>
    </main>
  )
}

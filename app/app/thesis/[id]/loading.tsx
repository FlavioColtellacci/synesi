export default function Loading() {
  return (
    <main className="mx-auto min-h-screen max-w-3xl bg-[#0A0A0C] px-6 py-8 md:px-10">
      <section>
        <div className="flex items-start justify-between">
          <div className="h-8 w-24 animate-pulse rounded-lg bg-[#1C1C22]" />
          <div className="h-6 w-20 animate-pulse rounded-full bg-[#1C1C22]" />
        </div>
        <div className="mt-3 h-5 w-48 animate-pulse rounded bg-[#1C1C22]" />
      </section>

      <div className="mb-6 mt-6 border-t border-[#2A2A32]" />

      <section>
        <div className="mb-3 h-4 w-full animate-pulse rounded bg-[#1C1C22]" />
        <div className="mb-3 h-4 w-5/6 animate-pulse rounded bg-[#1C1C22]" />
        <div className="mb-3 h-4 w-3/4 animate-pulse rounded bg-[#1C1C22]" />
      </section>

      <div className="mb-6 mt-6 border-t border-[#2A2A32]" />

      <section>
        <div className="mb-4 h-3 w-32 animate-pulse rounded bg-[#1C1C22]" />
        {Array.from({ length: 4 }).map((_, index) => (
          <article
            key={index}
            className="mb-3 rounded-xl border border-[#2A2A32] bg-[#141418] p-4"
          >
            <div className="mb-3 h-4 w-full animate-pulse rounded bg-[#1C1C22]" />
            <div className="h-4 w-2/3 animate-pulse rounded bg-[#1C1C22]" />
          </article>
        ))}
      </section>

      <div className="mb-6 mt-6 border-t border-[#2A2A32]" />

      <section>
        <div className="mb-4 h-3 w-24 animate-pulse rounded bg-[#1C1C22]" />
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="mb-4 flex items-center gap-4">
            <div className="h-2.5 w-2.5 animate-pulse rounded-full bg-[#1C1C22]" />
            <div className="h-4 w-40 animate-pulse rounded bg-[#1C1C22]" />
            <div className="h-4 w-28 animate-pulse rounded bg-[#1C1C22]" />
          </div>
        ))}
      </section>
    </main>
  )
}

import { marketingTestimonials } from "@/lib/marketing/testimonials"

export default function TestimonialsSection() {
  if (marketingTestimonials.length === 0) return null

  return (
    <section id="testimonials" className="px-6 py-24 md:px-10 md:py-28">
      <div className="mx-auto max-w-6xl">
        <p className="mb-10 text-center font-mono text-xs uppercase tracking-widest text-[#6B6B7B]">
          What Users Say
        </p>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {marketingTestimonials.map((testimonial) => (
            <article
              key={`${testimonial.author}-${testimonial.quote}`}
              className="rounded-xl border border-[#2A2A32] bg-[#141418] p-6 shadow-[0_20px_50px_rgba(0,0,0,0.4)]"
            >
              <p className="font-sans text-sm leading-relaxed text-[#A0A0A8]">&ldquo;{testimonial.quote}&rdquo;</p>
              <p className="mt-4 font-mono text-xs uppercase tracking-[0.12em] text-[#F0F0F0]">{testimonial.author}</p>
              {testimonial.role ? (
                <p className="mt-1 font-sans text-xs text-[#6B6B7B]">{testimonial.role}</p>
              ) : null}
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

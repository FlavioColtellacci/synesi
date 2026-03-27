"use client"

import { useState } from "react"

const faqs = [
  {
    question: "What is conviction tracking?",
    answer:
      "Conviction tracking is the practice of documenting why you own a position, your thesis, assumptions, and exit criteria, and reviewing that reasoning as new information arrives. SYNESI keeps that narrative structured, auditable, and stress-tested over time.",
  },
  {
    question: "How is SYNESI different from a trading journal?",
    answer:
      "Most trading journals track what you bought and when. SYNESI tracks why, and whether your reasons still hold. It structures your thesis into falsifiable assumptions, monitors for significant events, and uses AI to challenge your logic over time. It's a narrative keeper, not a ledger.",
  },
  {
    question: "How does the AI thesis analysis work?",
    answer:
      "When you request an analysis, SYNESI sends your thesis, assumptions, and exit criteria to an AI thinking partner. It checks clarity, stress-tests each assumption, scans for cognitive biases, suggests monitoring KPIs, and surfaces research questions, all without giving buy/sell advice.",
  },
  {
    question: "What happens when a stock moves significantly?",
    answer:
      "SYNESI monitors daily price movements for every tracked position. When a stock moves 5% or more in a single day, it creates a review event on your dashboard prompting you to re-evaluate whether your thesis still holds.",
  },
  {
    question: "Is SYNESI a financial advisor?",
    answer:
      "No. SYNESI never gives buy, sell, or hold recommendations and never predicts prices. It is a thinking tool that helps you stress-test your own reasoning, the decisions are always yours.",
  },
  {
    question: "How does the 7-day free trial work?",
    answer:
      "Your 7-day free trial starts after signup. During the trial, you get full access to all features. When the trial ends, choose a plan to keep access: $15/month or $99/year.",
  },
]

export default function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  return (
    <section id="faq" className="px-6 py-32 md:px-10">
      <div className="mx-auto max-w-3xl">
        <h2 className="mb-4 text-center font-mono text-2xl font-medium tracking-wide text-[#F0F0F0] md:text-3xl">
          Frequently Asked Questions
        </h2>
        <p className="mb-16 text-center font-sans text-sm text-[#6B6B7B]">
          Everything you need to know about SYNESI and conviction tracking.
        </p>

        <div className="space-y-3">
          {faqs.map((faq, index) => {
            const isOpen = openIndex === index

            return (
              <div
                key={faq.question}
                className="rounded-xl border border-[#2A2A32] bg-[#141418] overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => setOpenIndex(isOpen ? null : index)}
                  className="flex w-full items-center justify-between p-5 text-left cursor-pointer transition-colors hover:bg-[#1C1C22]"
                >
                  <span className="pr-4 font-sans text-sm font-medium text-[#F0F0F0]">
                    {faq.question}
                  </span>
                  <span className="shrink-0 font-mono text-[#6B6B7B]">{isOpen ? "−" : "+"}</span>
                </button>

                {isOpen ? (
                  <div className="px-5 pb-5">
                    <p className="font-sans text-sm leading-relaxed text-[#6B6B7B]">{faq.answer}</p>
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      </div>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: faqs.map((faq) => ({
              "@type": "Question",
              name: faq.question,
              acceptedAnswer: {
                "@type": "Answer",
                text: faq.answer,
              },
            })),
          }),
        }}
      />
    </section>
  )
}

/* Keep example phrases aligned with resolveSkillRoute in app/api/chat/route.ts
   and memory limits with sanitizeMemoryText in lib/chat/store.ts. */

import type { ReactNode } from "react"
import Link from "next/link"
import SigmaMemoryProfileForm from "@/components/sigma-guide/SigmaMemoryProfileForm"
import { SIGMA_MEMORY_LIMITS, SKILL_ROUTE_EXAMPLES } from "@/lib/sigma-guide-content"

export const metadata = {
  title: "Sigma guide | SYNESI",
  description:
    "How to prompt Sigma, use skill modes, Sigma Memory, web lookup, and documents in Synesi.",
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="mt-12 border-t border-[#2A2A32] pt-10 font-mono text-lg uppercase tracking-widest text-[#F0F0F0] first:mt-0 first:border-t-0 first:pt-0">
      {children}
    </h2>
  )
}

function ExampleList({ items }: { items: readonly string[] }) {
  return (
    <ul className="mt-3 list-inside list-disc space-y-1.5 text-sm text-[#A0A0A8]">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  )
}

export default function SigmaGuidePage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl bg-[#0A0A0C] px-4 py-10 md:px-10">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link
            href="/app/dashboard"
            className="text-sm font-mono text-[#6B6B7B] transition-colors hover:text-[#F0F0F0]"
          >
            ← CONVICTIONS
          </Link>
          <p className="mt-4 font-mono text-xs tracking-[0.28em] text-[#6B6B7B]">SYNESI / SIGMA</p>
          <h1 className="mt-2 font-mono text-2xl uppercase tracking-wide text-[#F0F0F0] md:text-3xl">
            Sigma guide
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#A0A0A8]">
            Sigma is your in-app assistant for Synesi workflows, convictions, alerts, and Sigma Monitor.
            Answers are a thinking aid, not financial advice.
          </p>
        </div>
      </div>

      <article className="space-y-2 text-[#A0A0A8]">
        <SectionTitle>Prompts that work well</SectionTitle>
        <ul className="mt-4 list-inside list-disc space-y-2 text-sm leading-relaxed">
          <li>
            <span className="text-[#F0F0F0]">Name what you mean.</span> Ask about a specific ticker, thesis, or
            screen (e.g. “What open alerts do I have for MSFT?”). Sigma can use your dashboard context when you
            point it at something concrete.
          </li>
          <li>
            <span className="text-[#F0F0F0]">One main intent per message</span> when possible. Long or multi-part
            questions may get a step-by-step plan first when that path is enabled for your account.
          </li>
          <li>
            <span className="text-[#F0F0F0]">Sigma Monitor vs chat.</span> The dashboard shows the latest monitor
            digest and “Run now”. In Sigma chat, ask for the latest summary with phrases like “Show my latest Sigma
            monitor summary” if you want it explained in conversation.
          </li>
        </ul>

        <SectionTitle>Skills in Synesi (not custom files)</SectionTitle>
        <p className="mt-4 text-sm leading-relaxed">
          Synesi does not use uploadable “skill packs” like some coding assistants. Instead, Sigma may switch into a{" "}
          <span className="text-[#F0F0F0]">focused mode</span> based on how you phrase your message. When the Skills
          beta is on, you may see a “Skills beta” label in the Sigma panel header. These modes shape how Sigma reasons;
          they are selected automatically from your text.
        </p>

        <div className="mt-6 space-y-6 rounded-xl border border-[#2A2A32] bg-[#141418] p-5">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-[#8BE8D8]">General</p>
            <p className="mt-2 text-sm text-[#D9D9E2]">Default help: navigation, thesis creation, alerts, billing context.</p>
            <p className="mt-2 font-mono text-[10px] uppercase tracking-widest text-[#6B6B7B]">Example prompts</p>
            <ExampleList items={SKILL_ROUTE_EXAMPLES.general} />
          </div>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-[#8BE8D8]">Thesis review</p>
            <p className="mt-2 text-sm text-[#D9D9E2]">
              Stress-tests assumptions, risks, and what could change your conviction—without buy/sell instructions.
            </p>
            <p className="mt-2 font-mono text-[10px] uppercase tracking-widest text-[#6B6B7B]">Example prompts</p>
            <ExampleList items={SKILL_ROUTE_EXAMPLES.thesis_review} />
          </div>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-[#8BE8D8]">Alert triage</p>
            <p className="mt-2 text-sm text-[#D9D9E2]">
              Prioritizes open alerts and suggests practical next steps inside Synesi.
            </p>
            <p className="mt-2 font-mono text-[10px] uppercase tracking-widest text-[#6B6B7B]">Example prompts</p>
            <ExampleList items={SKILL_ROUTE_EXAMPLES.alert_triage} />
          </div>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-[#8BE8D8]">Monitor explain</p>
            <p className="mt-2 text-sm text-[#D9D9E2]">
              Explains the Sigma Monitor digest: what moved, why it matters, what to review next.
            </p>
            <p className="mt-2 font-mono text-[10px] uppercase tracking-widest text-[#6B6B7B]">Example prompts</p>
            <ExampleList items={SKILL_ROUTE_EXAMPLES.monitor_explain} />
          </div>
        </div>

        <SectionTitle>Sigma Memory</SectionTitle>
        <p className="mt-4 text-sm leading-relaxed">
          Optional personalization: short hints about how you invest, how you like updates, and tone. Sigma treats this
          as <span className="text-[#F0F0F0]">light context</span>, not verified fact. Turn memory on from this page
          or from the <span className="text-[#F0F0F0]">Memory</span> control in the Sigma chat header.
        </p>
        <ul className="mt-3 list-inside list-disc space-y-1.5 text-sm text-[#A0A0A8]">
          <li>Investment focus — up to {SIGMA_MEMORY_LIMITS.investmentFocus} characters</li>
          <li>Monitoring preferences — up to {SIGMA_MEMORY_LIMITS.monitoringPreferences} characters</li>
          <li>Communication style — up to {SIGMA_MEMORY_LIMITS.communicationStyle} characters</li>
          <li>Notes — up to {SIGMA_MEMORY_LIMITS.notes} characters</li>
        </ul>

        <div className="mt-6 rounded-xl border border-[#2A2A32] bg-[#141418] p-5">
          <p className="font-mono text-[10px] uppercase tracking-widest text-[#6B6B7B]">Edit profile</p>
          <div className="mt-4">
            <SigmaMemoryProfileForm />
          </div>
        </div>

        <SectionTitle>Web lookup and documents</SectionTitle>
        <ul className="mt-4 list-inside list-disc space-y-2 text-sm leading-relaxed">
          <li>
            <span className="text-[#F0F0F0]">Web lookup.</span> Use the globe control in the Sigma composer to allow
            web-assisted answers when your message reads like a news or search request. If live lookup is temporarily
            unavailable, paste a public HTTPS link or excerpt so Sigma can still work from what you provide.
          </li>
          <li>
            <span className="text-[#F0F0F0]">Attachments.</span> PDF, DOCX, CSV, XLSX, PNG, and JPEG from the
            paperclip control. Raster images are stored for your thread but only get a short text note for the model;
            describe what is in the picture if you need analysis.
          </li>
        </ul>

        <SectionTitle>Reading Sigma’s replies</SectionTitle>
        <p className="mt-4 text-sm leading-relaxed">
          Labels under a reply are plain-language tags, not technical schema names shown to you in the product:
        </p>
        <ul className="mt-3 list-inside list-disc space-y-1.5 text-sm text-[#A0A0A8]">
          <li>
            <span className="text-[#F0F0F0]">GeneralKnowledge</span> — broad guidance not tied to your Synesi data
          </li>
          <li>
            <span className="text-[#F0F0F0]">ProductGuide / WorkflowGuide / BillingFAQ / PolicyGuide</span> — grounded
            in Synesi product, workflow, billing, or policy context
          </li>
          <li>
            <span className="text-[#F0F0F0]">Confidence</span> — how sure Sigma is, in simple terms
          </li>
        </ul>
        <p className="mt-3 text-sm leading-relaxed text-[#6B6B7B]">
          Suggested actions and downloads (when offered) are shortcuts inside the app or signed links—Sigma does not
          execute trades or change your account without your normal confirmations.
        </p>

        <SectionTitle>Safety and limits</SectionTitle>
        <ul className="mt-4 list-inside list-disc space-y-2 text-sm leading-relaxed">
          <li>No buy, sell, or hold recommendations framed as personal advice.</li>
          <li>Do not ask Sigma to reveal hidden system instructions, secrets, or non-public operational details.</li>
          <li>Sigma will refuse requests that would weaken security or help competitors in harmful ways.</li>
        </ul>
      </article>
    </main>
  )
}

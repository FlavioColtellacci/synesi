import { SITE_ORIGIN } from "@/lib/marketing/site-origin"

export default function HomeJsonLd() {
  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        name: "SYNESI",
        url: SITE_ORIGIN,
        description:
          "SYNESI is an investment and trading journal for thesis-driven investors that helps track conviction over time.",
      },
      {
        "@type": "Organization",
        name: "SYNESI",
        url: SITE_ORIGIN,
        description:
          "SYNESI builds tools for thesis tracking, conviction journaling, and AI-assisted investment reasoning support.",
      },
    ],
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
}

import type { MetadataRoute } from "next"
import { SITE_ORIGIN } from "@/lib/marketing/site-origin"

/** Public marketing and auth entry URLs only (no app shell, no unpublished product surfaces). */
const routes = [
  "/",
  "/pricing",
  "/manifesto",
  "/privacy",
  "/terms",
  "/login",
  "/signup",
  "/use-cases/investment-journal",
  "/use-cases/thesis-validation",
  "/learn/confirmation-bias-investing",
]

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date()
  return routes.map((route) => ({
    url: `${SITE_ORIGIN}${route}`,
    lastModified,
  }))
}

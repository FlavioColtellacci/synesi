/**
 * next-env.d.ts is gitignored and normally created by `next dev` / `next build`.
 * Without it, TypeScript can report "No inputs were found" in fresh or partial checkouts.
 * Next.js will replace this stub when the dev server or build runs.
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const root = path.resolve(__dirname, "..")
const target = path.join(root, "next-env.d.ts")

if (fs.existsSync(target)) {
  process.exit(0)
}

const stub = `/// <reference types="next" />
/// <reference types="next/image-types/global" />

// NOTE: This file is auto-updated when you run \`next dev\` or \`next build\`.
`

fs.writeFileSync(target, stub, "utf8")

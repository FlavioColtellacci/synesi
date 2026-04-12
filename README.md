# SYNESI

Proprietary software. Source may be visible in this repository; that does not grant any right to use, copy, or modify it.

See [LICENSE](LICENSE). All rights reserved.

No public support or issue tracking is offered here.

## Internal layout

| Area | Path |
| --- | --- |
| App Router (pages, layouts, metadata) | `app/` — route groups `(marketing)`, `(auth)`, product under `app/app/` |
| UI | `components/` — `landing`, `thesis`, `chat`, `layout`, `sigma`, shadcn primitives in `components/ui/` |
| Server logic & integrations | `lib/` — e.g. `lib/chat/`, `lib/financial/`, `lib/supabase/` |
| DB migrations | `supabase/migrations/` |
| Product / rollout notes | `docs/` |

## Scripts

- `npm run dev` — Next dev server
- `npm run typecheck` — `tsc --noEmit` (app + tests)
- `npm run lint` — ESLint (source only; build output ignored)
- `npm run test` — Vitest
- `npm run test:e2e` — Playwright
- `npm run check` — typecheck, then lint, then unit tests

If `npm run typecheck` fails on duplicate symbols under `.next/types/`, delete any accidental copies such as `routes.d 2.ts` (macOS Finder duplicates) and run `next dev` or `next build` once to regenerate types.

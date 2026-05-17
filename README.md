# SYNESI

Proprietary software. Source may be visible in this repository; that does not grant any right to use, copy, or modify it.

See [LICENSE](LICENSE). All rights reserved.

No public support or issue tracking is offered here.

## Project layout

```
synesi/
├── app/                 # Next.js App Router (pages, API routes, layouts)
├── components/          # React UI (landing, thesis, chat, layout, ui/)
├── content/             # Static marketing / learn content
├── lib/                 # Server logic, data layer, integrations
├── public/              # Static assets
├── scripts/             # Maintenance & setup scripts
├── types/               # Shared TypeScript types
│
├── config/              # Tooling & platform configuration
│   ├── firebase/        # Firestore rules, indexes, Storage rules, firebase.json
│   ├── playwright.config.ts
│   └── vitest.config.ts
│
├── infra/               # Infrastructure-as-code & DB history
│   └── supabase/        # Legacy Postgres migrations (rollback reference)
│
├── tests/
│   └── e2e/             # Playwright end-to-end specs
│
└── docs/                # Internal notes
    └── migration/       # Firebase cutover runbooks
```

Root-level files (`next.config.ts`, `package.json`, `tsconfig.json`, `.env.example`) stay at the repo root because Next.js and Vercel expect them there.

## Scripts

- `npm run dev` — Next dev server
- `npm run typecheck` — `tsc --noEmit` (app + tests)
- `npm run lint` — ESLint (source only; build output ignored)
- `npm run test` — Vitest (unit tests)
- `npm run test:e2e` — Playwright
- `npm run check` — typecheck, then lint, then unit tests
- `npm run firebase:deploy` — Deploy Firestore rules, Storage rules, and Auth config

If `npm run typecheck` fails on duplicate symbols under `.next/types/`, delete any accidental copies such as `routes.d 2.ts` (macOS Finder duplicates) and run `next dev` or `next build` once to regenerate types.

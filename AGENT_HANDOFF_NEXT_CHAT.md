# SYNESI Agent Handoff (Next Chat)

This file is a detailed handoff for continuing the current implementation in a new chat.

## Project Context

- App: `synesi.app` (Next.js + Supabase + Stripe)
- Core product: investment thesis tracking with conviction history and AI analysis
- Current priority stack from validation feedback:
  1. Marketing copy repositioning
  2. 7-day free trial with full access
  3. Broader language for thesis-driven investors/traders
  4. Trusted Sources storage feature
  5. Financial Context panel (planning + implementation)

---

## What Has Been Completed

### Recommendation 1: Marketing copy repositioning (DONE)

Positioning updated from "answers why you own a stock" to narrative keeper framing.

Edited files:
- `app/layout.tsx`
- `components/landing/HeroSection.tsx`
- `app/opengraph-image.tsx`
- `app/(marketing)/manifesto/page.tsx`
- `components/landing/FAQSection.tsx`

### Recommendation 2: 7-day free trial (DONE)

Implemented trial flow and entitlement checks.

#### Database
- Added to `profiles` table:
  - `trial_started_at`
  - `trial_ends_at`

#### App/Auth logic
- `app/auth/callback/route.ts`
  - After email confirmation, starts trial for non-active users without trial
  - Redirects to `/app/dashboard` (not `/pricing`)
- `proxy.ts`
  - Allows `/app/*` if:
    - subscription is active, OR
    - trial is still active (`trial_ends_at > now`)
  - Else redirects to `/pricing`
- `app/app/layout.tsx`
  - Added in-app trial banner with days left + CTA to `/pricing`

### Trial AI provider routing (DONE)

Trial users now use MiniMax, paid users use Anthropic.

Edited files:
- `lib/llm.ts`
  - Added per-request provider support with `createLlm(provider)` and `getTextModel(provider)`
  - Added provider-specific model env handling:
    - `ANTHROPIC_TEXT_MODEL`
    - `MINIMAX_TEXT_MODEL`
- `app/api/ai/analyse/route.ts`
- `app/api/theses/analyse-input/route.ts`
  - Both routes now resolve provider from profile entitlement.

### Recommendation 3: broader audience language (DONE)

Removed value-investor-only framing; now includes thesis-driven traders/investors.

Edited files:
- `components/landing/PersonasSection.tsx`
- `app/(marketing)/manifesto/page.tsx`
- `app/(marketing)/use-cases/investment-journal/page.tsx`
- `app/layout.tsx`

### Recommendation 4: Trusted Sources per thesis (STORAGE ONLY) (DONE)

Implemented add/list/remove trusted sources on thesis detail page.

#### Database
- Created table `trusted_sources` with:
  - `id`, `thesis_id`, `user_id`, `name`, `url`, `source_type`, `created_at`
- Constraints:
  - non-empty name
  - source type check: `analyst | news_outlet | newsletter | sec_filing | other`
- Indexes:
  - `(user_id, thesis_id)`
  - unique `(thesis_id, lower(name), source_type)`
- RLS enabled:
  - owner-only select/insert/delete policies

#### Backend/API
- Added:
  - `app/api/theses/[id]/trusted-sources/route.ts` (`POST`)
  - `app/api/theses/[id]/trusted-sources/[sourceId]/route.ts` (`DELETE`)

#### UI
- Added:
  - `components/thesis/TrustedSourcesSection.tsx`
- Integrated into:
  - `app/app/thesis/[id]/page.tsx`

User confirmed manual sanity checks passed (add/remove/validation/persistence).

---

## Recommendation 5 Status

### Planning completed

API research done; recommendation selected:
- Preferred provider: **EODHD** for broad coverage and cost fit for <500 users

Design + architecture agreed:
- Build cached ticker-level `Financial Context` panel
- Avoid live provider calls in page-render path

### Step 1 implementation completed

Created database cache table:
- `financial_snapshots`
  - `id`
  - `ticker` (unique, non-empty)
  - `provider` default `'eodhd'`
  - `as_of`
  - `fetched_at`
  - `stale_after` default `now() + 24h`
  - `payload` jsonb
  - `coverage` jsonb nullable

Indexes:
- `financial_snapshots_stale_after_idx`
- `financial_snapshots_fetched_at_idx`

Types updated:
- `types/database.ts`
  - added `financial_snapshots` table types
  - exported `FinancialSnapshot`

### Step 2 implementation completed

Added EODHD provider adapter + normalization layer (server-only):
- `lib/financial/providers/eodhd.ts`
  - EODHD config + symbol normalization (`AAPL` -> `AAPL.US`)
  - Endpoints implemented:
    - real-time quote: `/real-time/{symbol}`
    - fundamentals: `/fundamentals/{symbol}`
    - RSI14 (last value): `/technical/{symbol}?function=rsi&period=14&filter=last_rsi`
    - insider transactions: `/insider-transactions?code={symbol}&from&to&limit`
    - earnings calendar: `/calendar/earnings?symbols=...`
  - Requires env: `EODHD_API_KEY`
- `lib/financial/types.ts`
  - Internal normalized payload/coverage types (`FinancialSnapshotPayload`, `FinancialSnapshotCoverage`)
- `lib/financial/normalize.ts`
  - Maps EODHD data -> snapshot `payload` + `coverage`
  - Computes:
    - `fcfPerShare` (direct or derived from FCF/shares if available)
    - `marginOfSafety` when both price and consensus target are available
  - Builds a 30-day insider activity summary from Form 4 P/S transactions
  - Picks next earnings date from earnings calendar
- `lib/financial/refresh.ts`
  - `buildEodhdSnapshotPayload(ticker)` orchestrator (quote + fundamentals + RSI + insider + earnings)
  - Returns `{ ok: true, payload, coverage }` or `{ ok: false, error }`
  - Note: recent target-change history and index changes are still `unsupported`.
  - `consensusTarget` is now mapped from fundamentals (`Highlights.WallStreetTargetPrice` with fallbacks).

---

## Recommendation 5 Implementation Progress (Current Truth)

### Step 3: Refresh endpoint/service route (DONE)

Implemented:
- `lib/financial/refresh.ts`
  - Added `refreshFinancialSnapshot({ ticker, staleAfterHours? })`
  - Upserts into `financial_snapshots` by unique `ticker`
  - Sets `as_of`, `fetched_at`, `stale_after`
  - Returns safe success/failure result shape
- `app/api/financial/refresh/route.ts` (`POST`)
  - Input: `{ ticker }`
  - Allows:
    - internal auth via `Authorization: Bearer ${CRON_SECRET}`
    - or logged-in app user
  - Safe JSON responses for success/failure

### Step 4: Daily cron refresh (DONE)

Implemented:
- `app/api/cron/refresh-financial/route.ts` (`GET`)
  - Auth: `CRON_SECRET`
  - Gathers distinct thesis tickers (`theses` excluding broken)
  - Refreshes in batches via `refreshFinancialSnapshot`
  - Returns run stats and per-ticker errors
- `vercel.json`
  - Added cron:
    - `/api/cron/refresh-financial` at `30 18 * * 1-5`

### Step 4.1: Quota-aware cron behavior for low EODHD limits (DONE)

Cron now refreshes only:
- missing snapshots, or
- stale snapshots

And skips already-fresh tickers to conserve daily API budget.

Default controls:
- `CRON_MAX_FINANCIAL_TICKERS_PER_RUN=5`
- `CRON_FINANCIAL_BATCH_SIZE=5`
- `CRON_FINANCIAL_BATCH_DELAY_MS=1200`

### Step 5: Financial Context UI panel (DONE)

Implemented in:
- `app/app/thesis/[id]/page.tsx`

Panel reads cached `financial_snapshots` and displays:
- price, consensus target, margin of safety
- P/E, forward P/E, PEG, ROIC, EPS, FCF/share, RSI, insider activity
- collapsible secondary metrics (next earnings, target/index change counts)
- freshness labels (`fresh`, `stale`, `no snapshot`)
- missing-data-safe `N/A` rendering
- partial coverage hint when provider data is unavailable
- "price-only mode" hint when only quote data is available via fallback

### Step 6: Stale refresh behavior (DONE)

On thesis page load:
- still renders immediately from cached/available data
- non-blocking auto-refresh now runs only when snapshot exists, is stale, and the user has daily refresh budget remaining
- missing snapshot requires manual refresh (prevents silent API quota drain on page navigation)

### Manual refresh UX + tester guardrails (DONE)

Implemented:
- `components/thesis/FinancialRefreshButton.tsx`
  - "Refresh now" button in Financial Context
  - shows remaining daily manual refreshes for current user
  - refreshes page data after successful call
- `app/api/financial/refresh/route.ts`
  - per-user daily cap for manual refresh calls
  - default: `FINANCIAL_REFRESH_DAILY_LIMIT_PER_USER=8`
  - limit tracking via `thesis_updates` entries with `update_type = financial_refresh`

### Provider resilience: EODHD + Alpha Vantage hybrid (DONE)

Implemented:
- `lib/financial/refresh.ts`
  - switched provider fetch flow to `Promise.allSettled` (partial failure tolerant)
  - refresh succeeds with partial data when possible
  - fails only when no useful signal exists
  - if EODHD quote unavailable, falls back to Alpha Vantage price
- `lib/alpha-vantage.ts`
  - added `getGlobalQuotePrice(ticker)` helper for quote fallback

### Trial analysis fallback hardening (DONE)

Implemented:
- `app/api/theses/analyse-input/route.ts`
- `app/api/ai/analyse/route.ts`

Behavior:
- if trial provider (MiniMax route) returns model-not-found for configured model, route retries once with Anthropic model
- avoids user-facing "Failed to analyse thesis input" for provider/model mismatch edge cases

Additional fix:
- `lib/llm.ts` model resolution was adjusted to avoid cross-provider fallback through `LLM_TEXT_MODEL`.
  - MiniMax path now resolves from `MINIMAX_TEXT_MODEL` only (or MiniMax default)
  - Anthropic path now resolves from `ANTHROPIC_TEXT_MODEL` only (or Anthropic default)
  - This fixed a bug where Anthropic retry accidentally reused MiniMax model id and still failed.

### Middleware fix (DONE)

Updated `proxy.ts` so `/api/financial/refresh` is excluded from app-route auth redirects (same pattern as cron/webhook bypass).

### Validation status snapshot (latest)

Confirmed working:
- New thesis analysis flow works again after model fallback fix.
- Manual financial refresh button now shows loading state when quota remains.
- Daily limit disabling behavior works (button disabled at 0 remaining).
- Cron refresh endpoint works and refreshes eligible stale/missing tickers.
- Manual web-refresh flow works and writes `financial_snapshots.provider = ai_web`.
- Financial Context now renders fetched values correctly (fixed snapshot read path issue).
- Financial metric signal colors now render (green/neutral/red thresholds).
- Hydration mismatch in app layout was mitigated by removing time-volatile trial banner calculations.

Current expected limitations:
- On current EODHD plan, provider snapshots are often sparse.
- Web refresh quality depends on web-model extraction quality (can return partial fields).
- Cost optimization: financial web refresh currently uses Perplexity `sonar` (not `sonar-pro`).
- `recentTargetChanges` remains `unsupported` on free plan.
- Localhost vs live UI/content can differ until latest code is deployed and data state is aligned.

---

## Environment Variables Notes

Already relevant:
- `ANTHROPIC_API_KEY`
- `MINIMAX_API_KEY`
- `MINIMAX_ANTHROPIC_BASE_URL` (optional)
- `ANTHROPIC_TEXT_MODEL` (recommended)
- `MINIMAX_TEXT_MODEL` (recommended)

To add for recommendation 5 when implementing:
- `EODHD_API_KEY`

If needed later:
- `EODHD_BASE_URL` (optional default)

Now used by implementation:
- `EODHD_API_KEY`
- `ALPHA_VANTAGE_API_KEY`
- `PERPLEXITY_API_KEY`
- `FINANCIAL_REFRESH_DAILY_LIMIT_PER_USER` (now set to `2` to control costs)
- `CRON_MAX_FINANCIAL_TICKERS_PER_RUN` (default `5`)
- `CRON_FINANCIAL_BATCH_SIZE` (default `5`)
- `CRON_FINANCIAL_BATCH_DELAY_MS` (default `1200`)

### Financial Context updates completed after initial handoff

Implemented:
- `app/api/financial/refresh/route.ts`
  - supports `source` input (`provider` | `web`)
  - preserves auth + quota limits
  - user-path now enforces ticker ownership (`403` if ticker not in user theses)
- `lib/financial/refresh.ts`
  - added web snapshot mode via Perplexity research
  - parses strict JSON metric payload and maps to existing snapshot schema
  - persists web snapshots as `provider = ai_web`
  - web refresh now merges with existing snapshot to avoid wiping known values (e.g. price)
  - financial web refresh model set to `sonar` for lower cost
- `components/thesis/FinancialRefreshButton.tsx`
  - CTA behavior:
    - large: `GENERATE FINANCIAL SNAPSHOT` when no data
    - compact: `UPDATE FINANCIALS` after data exists
  - bug fix: syncs state across ticker/page changes
  - clearer limit message: `Daily limit reached. Resets at 00:00 UTC.`
- `app/app/thesis/[id]/page.tsx`
  - reads snapshot through admin client after ownership check
  - final UI decision: hide `N/A` metrics and show only currently available values
  - optional history polish: `FINANCIAL REFRESH` badge label
  - source label shown in panel (`AI WEB SNAPSHOT` vs `PROVIDER API (EODHD)`)
  - color-coded metric values (green favorable / red caution / white neutral)
  - added legend + caution disclaimer text
- `app/app/layout.tsx`
  - hydration hardening: removed render-time `Date.now()` trial math from layout rendering path

---

## Important Behavior/Constraints to Preserve

- Keep changes small and focused: one step per response.
- Read files before editing.
- No broad refactors.
- Recommendation 5 currently requested as planning then incremental implementation.
- Trusted Sources alerting is explicitly **not** implemented yet (storage only).
- Financial refresh should remain quota-aware due to low-tier API limits.

---

## Quick Validation Checklist (for next agent after each step)

- Lint on edited files (`ReadLints`)
- Basic API route success/failure path checks
- For UI additions:
  - empty state
  - partial missing data (`N/A`)
  - load state and stale/fresh timestamp display

---

## What Is Left (Priority Order)

1. Production deploy + smoke test:
   - confirm Financial Context source label, colors, and hide-`N/A` behavior on live site
   - verify quota cap (`2/day`) and reset messaging
2. Data quality hardening (small):
   - add per-metric confidence in web extraction payload (optional field)
   - add stricter parsing guards for malformed web JSON responses
3. Usage instrumentation:
   - log refresh source + success/failure + fields-populated count for pricing decisions
4. Future plan (deferred):
   - keep `recentTargetChanges` unsupported unless reliable provider data is available
   - evaluate paid provider tier after observing user engagement

## Starting Prompt For New Chat

Use this exact prompt:

> Continue from `AGENT_HANDOFF_NEXT_CHAT.md` exactly.  
> Current status: Recommendation 1-5 implemented, including web-based Financial Snapshot refresh (`source: web`) with `ai_web` provider persistence, quota cap set to `2/day`, Perplexity model for financial refresh set to `sonar`, source badge + color-coded metrics + disclaimer, and `N/A` metrics hidden by design.  
> First task: run a production-focused validation checklist for Financial Context (CTA state, refresh behavior, source label, quota behavior, and error handling).  

---

## Latest Validation Addendum (Most Recent)

Final validation pass completed on current local state:

- Refresh behavior: PASS
  - Internal authenticated `POST /api/financial/refresh` with `source: web` updates snapshots.
  - `financial_snapshots.provider` persists as `ai_web`.
- Data render behavior: PASS
  - UI now intentionally hides `N/A` and shows only available metric values.
  - Source label, signal colors, and disclaimer text are visible as designed.
- Quota behavior: PASS
  - Per-user daily cap remains `2/day` by config.
  - Button disable + reset messaging behavior works.
- Cron stale-only behavior: PASS
  - `GET /api/cron/refresh-financial` correctly reports zero eligible refreshes when snapshots are fresh.
- Error handling hardening: PASS
  - `app/api/financial/refresh/route.ts` now returns `400` with `Invalid JSON body` for malformed JSON payloads (was `500` before fix).

Notes:
- Web financial extraction quality remains source/model dependent and can be partial by ticker.
- `recentTargetChanges` remains intentionally unsupported.
- Trusted Sources alerting pipeline blueprint remains in this handoff for the next major feature.

---

## Big Feature Blueprint: Trusted Sources Alerting Pipeline

This section is the implementation blueprint for the next major feature after Financial Context validation.

### Goal

Generate **thesis challenge events** from user-defined trusted sources (people + publications), filtered to user holdings and tied to thesis relevance.

### Scope boundaries

In scope (MVP):
- Ingestion + normalization + relevance scoring
- Deduplication and event creation
- Event surfacing through existing `events` system

Out of scope (later phases):
- Full notification center redesign
- Complex multi-channel delivery (email/push/SMS)
- Rich source management UX beyond existing trusted source CRUD

---

### Data model additions (proposed)

1. `source_documents` (normalized fetched content)
- `id uuid pk`
- `source_name text`
- `source_type text` (`analyst | news_outlet | newsletter | sec_filing | other`)
- `url text`
- `title text`
- `published_at timestamptz`
- `content_excerpt text`
- `content_hash text` (dedupe key)
- `metadata jsonb`
- `created_at timestamptz`

2. `thesis_source_matches` (matching decisions per thesis)
- `id uuid pk`
- `user_id uuid`
- `thesis_id uuid`
- `trusted_source_id uuid` (FK to `trusted_sources.id`)
- `source_document_id uuid` (FK to `source_documents.id`)
- `relevance_score numeric`
- `match_reason text`
- `confidence text` (`high | medium | low`)
- `created_at timestamptz`
- unique index on (`thesis_id`, `source_document_id`) to prevent duplicates

3. `alert_runs` (optional run observability)
- `id uuid pk`
- `status text`
- `started_at timestamptz`
- `finished_at timestamptz`
- `stats jsonb`
- `error text`

---

### Processing architecture

1. **Ingest**
- Pull latest documents from selected feeds/providers.
- Normalize into `source_documents`.
- Compute deterministic `content_hash`.

2. **Map sources to users/theses**
- Use existing `trusted_sources` entries per thesis.
- For each new document, select candidate theses where trusted source name/type matches.

3. **Relevance scoring**
- Inputs:
  - thesis ticker/company name
  - thesis statement + assumptions + break conditions
  - document title/excerpt
- Score tiers:
  - High: explicit ticker/company + thesis assumption overlap
  - Medium: sector/theme overlap without explicit assumption hit
  - Low: weak lexical overlap
- Only emit challenge events for `high` (MVP default) and optionally `medium` behind flag.

4. **Deduplication**
- Hard dedupe:
  - same `content_hash` + same thesis
- Soft dedupe:
  - near-identical title within 24h for same thesis/source

5. **Write events**
- Insert into existing `events` table with:
  - `event_type = 'trusted_source_challenge'`
  - `event_detail` containing concise why + source URL
  - `is_reviewed = false`

---

### MVP rollout phases

#### Phase 1 (recommended first ship)
- Publications/news outlets only
- Poll-based ingestion via cron (hourly or every 2-4h)
- High-confidence relevance only
- Events on dashboard via existing event surfaces

#### Phase 2
- Trusted people adapters (newsletter + X + YouTube metadata where practical)
- Medium-confidence matches behind feature flag
- Better explainability string in `event_detail`

#### Phase 3
- Delivery options (email digest / instant)
- User-level noise controls:
  - minimum relevance
  - quiet hours
  - digest frequency

---

### Cost and risk guardrails

- Cap ingestion volume per run (`MAX_DOCS_PER_RUN`).
- Restrict matching to active user thesis universe.
- Skip expensive model calls unless lexical prefilter passes.
- Keep first version mostly rule-based + lightweight heuristics.
- Add run stats logging (matched/inserted/deduped/errors) for rapid tuning.

---

### Suggested first implementation step (next chat)

Step A (small, focused):
1. Add schema for `source_documents` + `thesis_source_matches`.
2. Add a minimal cron endpoint scaffold:
   - fetch placeholder/mock source items
   - normalize + dedupe insert into `source_documents`
3. Stop and verify table writes before any relevance or event generation.

Then proceed to Step B:
- add relevance matching to theses and write `trusted_source_challenge` events.

---

### Starter prompt for a dedicated big-feature chat

```text
Implement the Trusted Sources alerting pipeline using `AGENT_HANDOFF_NEXT_CHAT.md` as source of truth.

First read the handoff fully, then focus on the section:
"Big Feature Blueprint: Trusted Sources Alerting Pipeline".

Rules:
- Do not touch already completed Recommendations 1-5 except where strictly needed.
- Keep changes incremental: one step per response.
- Read files before editing.
- No broad refactors.

Start with Step A only:
1) add DB schema for `source_documents` and `thesis_source_matches`
2) add a minimal ingestion cron scaffold that writes normalized docs with dedupe
3) stop and report exactly what changed + validation results.
```
> If any issue is found, apply only small focused fixes (no broad refactor), then report: pass/fail, files changed, why, and remaining risks.


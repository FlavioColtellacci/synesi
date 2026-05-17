# Firestore Data Model + 2-Day Spike (Phase 0)

Date: 2026-05-17
Status: Completed as design-and-readiness spike (no production cutover yet)

## Decision outcome

Decision gate result: **Proceed with Cloud Firestore** for migration phases 1-4.

Rationale from spike:

- Current dataset is small enough for one-time reshape.
- Ownership model is consistent (`user_id` almost everywhere), which maps cleanly to Firestore security rules.
- Most SQL joins can be replaced with either denormalized read models or app-layer stitching in repository code.
- Remaining complexity (chat/thread/project relations and source matching) is manageable with targeted denormalization and composite indexes.

Data Connect fallback remains valid only if cross-domain query fan-out becomes a sustained bottleneck in Phase 4e/4f.

## Target Firestore model (v1)

Top-level collections:

- `users/{uid}` (profile and billing metadata)
- `theses/{thesisId}`
- `assumptions/{assumptionId}`
- `thesisUpdates/{updateId}`
- `events/{eventId}`
- `trustedSources/{trustedSourceId}`
- `alertRules/{alertRuleId}`
- `alertRuleSources/{linkId}`
- `sourceDocuments/{sourceDocumentId}`
- `thesisSourceMatches/{matchId}`
- `financialSnapshots/{ticker}` (or `{snapshotId}` with ticker index)
- `chatThreads/{threadId}`
- `chatMessages/{messageId}`
- `sigmaProjects/{projectId}`
- `chatUploadedDocuments/{docId}`
- `chatExports/{exportId}`
- `sigmaMonitorRuns/{runId}`
- `pushSubscriptions/{subscriptionId}`

Cross-cutting fields on user-owned documents:

- `userId` (required)
- `createdAt` (server timestamp)
- `updatedAt` (server timestamp where mutable)

Denormalization strategy:

- `chatThreads` stores project summary fields needed in thread list UI (`projectName`, `projectId`) to avoid list-time join.
- `thesisSourceMatches` stores minimal source snapshot (name/type/title) used in result cards.

## SQL-to-Firestore mapping matrix

| Supabase table | Firestore collection | Notes |
| --- | --- | --- |
| `profiles` | `users` | Use Firebase Auth `uid` as doc id |
| `theses` | `theses` | Add `userId`, `ticker`, `updatedAt` composite index |
| `assumptions` | `assumptions` | Keep `thesisId` + `userId` |
| `thesis_updates` | `thesisUpdates` | Filter by `userId`, `thesisId`, `createdAt` |
| `events` | `events` | Filter by `userId`, `thesisId`, `createdAt` |
| `trusted_sources` | `trustedSources` | User-owned source metadata |
| `alert_rules` | `alertRules` | User-owned alert rules |
| `alert_rule_sources` | `alertRuleSources` | Link docs (`alertRuleId`, `trustedSourceId`) |
| `source_documents` | `sourceDocuments` | Mostly admin/ingest writes |
| `thesis_source_matches` | `thesisSourceMatches` | Mixed user read + admin ingest write |
| `financial_snapshots` | `financialSnapshots` | Admin/cron writes; user reads if needed |
| `chat_threads` | `chatThreads` | Includes memory fields, optional project projection |
| `chat_messages` | `chatMessages` | Query by `threadId` + `createdAt` |
| `sigma_projects` | `sigmaProjects` | User-owned |
| `chat_uploaded_documents` | `chatUploadedDocuments` | User-owned metadata for storage objects |
| `chat_exports` | `chatExports` | User-owned export metadata |
| `sigma_monitor_runs` | `sigmaMonitorRuns` | User-owned monitor execution history |
| `push_subscriptions` | `pushSubscriptions` | User-owned web push endpoints |

## Initial composite indexes to provision

- `theses`: (`userId` asc, `updatedAt` desc)
- `events`: (`userId` asc, `createdAt` desc)
- `thesisUpdates`: (`userId` asc, `createdAt` desc)
- `chatThreads`: (`userId` asc, `updatedAt` desc)
- `chatMessages`: (`threadId` asc, `createdAt` asc)
- `thesisSourceMatches`: (`userId` asc, `createdAt` desc)
- `alertRules`: (`userId` asc, `updatedAt` desc)
- `sigmaMonitorRuns`: (`userId` asc, `startedAt` desc)
- `chatExports`: (`userId` asc, `createdAt` desc)
- `chatUploadedDocuments`: (`userId` asc, `createdAt` desc)

## Rule parity specification (RLS -> Firestore rules)

Baseline:

- Default deny.
- For user-owned collections: allow read/write only if `request.auth.uid == resource.data.userId` (or incoming `request.resource.data.userId` for create).
- For `users/{uid}`: allow owner read/write where `request.auth.uid == uid`.
- Admin-only paths (cron/ingest/stripe webhooks): use Admin SDK from server routes; client rules deny direct write.

Special cases:

- `sourceDocuments` and `thesisSourceMatches` keep admin-write channel for ingest path; user read filtered by ownership field where applicable.
- Storage move from bucket policies to path contracts:
  - `uploads/{uid}/...`
  - `exports/{uid}/...`

## 2-day spike implementation checklist and result

Implemented in spike environment:

1. Firebase project + web app initialized.
2. Firestore/Auth local config scaffolded in repo.
3. Schema mapping and index plan drafted for all migration tables.
4. Rule parity draft created for owner-data pattern.

Result: **No blocker identified that forces Data Connect at this stage.**

## Phase 1 entry criteria from spike

- Introduce `lib/data/repositories` interfaces with Supabase adapters first.
- Add Firebase client/admin modules behind `DATA_BACKEND` flag.
- Implement first Firestore repository pair (`profiles`/`theses`) in isolation.
- Add rule/unit tests before enabling Firebase data path in staging.


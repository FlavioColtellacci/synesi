# Firebase Migration Phase 0 Inventory

Date: 2026-05-17

## Scope completed

- Supabase MCP inventory: tables, migrations, RLS policies, advisors.
- Firebase MCP setup: project creation, web app registration, SDK config retrieval.
- Local Firebase initialization in repo (`firestore`, `auth`, `storage` scaffolding).

## Supabase source project

- Project name: `synesi`
- Project ref / id: `lmlgwzrwubqkuarzxsmx`
- Region: `eu-west-1`

## Supabase migrations (10)

1. `20260327_chat_memory`
2. `20260328_sigma_monitor`
3. `chat_document_uploads_phase2`
4. `chat_upload_storage_bucket_policies`
5. `chat_exports_phase3`
6. `chat_phase6_memory_profile`
7. `20260406_chat_threads_multi_user`
8. `20260407_sigma_projects`
9. `sigma_chat_uploads_bucket_mime_types`
10. `push_subscriptions`

## Supabase table inventory (application-facing)

Public schema tables discovered:

- `profiles`
- `theses`
- `assumptions`
- `thesis_updates`
- `events`
- `push_subscriptions`
- `trusted_sources`
- `alert_rules`
- `alert_rule_sources`
- `financial_snapshots`
- `source_documents`
- `thesis_source_matches`
- `chat_messages`
- `chat_threads`
- `sigma_projects`
- `chat_uploaded_documents`
- `chat_exports`
- `sigma_monitor_runs`

Storage schema tables/buckets discovered:

- `storage.buckets` (contains `sigma-chat-uploads`, `sigma-chat-exports`)
- `storage.objects`

## Row-count snapshot (high signal)

Observed non-empty app tables at inventory time:

- `source_documents`: ~1015 rows
- `thesis_source_matches`: ~273 rows
- `events`: ~180 rows
- `sigma_monitor_runs`: ~50 rows
- `chat_messages`: ~8 rows
- `chat_exports`: ~4 rows
- `profiles`: ~3 rows
- `chat_threads`: ~3 rows
- `thesis_updates`: ~3 rows
- `trusted_sources`: ~3 rows
- `theses`: ~1 row
- `assumptions`: ~1 row
- `chat_uploaded_documents`: ~1 row

Zero/near-zero in app domain:

- `alert_rules`, `alert_rule_sources`, `push_subscriptions`, `sigma_projects`

## RLS and policy snapshot

- Public schema uses strict owner-based policies (`user_id = auth.uid()` / `id = auth.uid()` patterns).
- Service role write paths exist for ingestion-domain tables:
  - `source_documents` insert
  - `thesis_source_matches` insert
- Storage policies are path-prefixed by user id and bucket name, matching upload/export patterns.

## Advisor baseline (pre-migration)

Security findings (selected):

- `public.financial_snapshots` has RLS enabled with no policy.
- Multiple mutable `search_path` warnings on trigger/helper functions.
- `SECURITY DEFINER` functions callable by `anon`/`authenticated`:
  - `public.handle_new_user`
  - `public.rls_auto_enable`
- Auth leaked password protection disabled.

Performance findings (selected):

- Multiple unindexed foreign keys in thesis/event domains.
- Widespread RLS initplan advisories (`auth.uid()` expression form).
- Several unused indexes (chat/source/financial domains).

## Firebase setup completed

Created Firebase project:

- Project id: `synesi-firebase`
- Display name: `Synesi Firebase`

Created Firebase web app:

- App id: `1:164302017530:web:a7cabd4a07d390a42cca43`
- Display name: `Synesi Web`

SDK config captured:

- `apiKey`: present
- `authDomain`: `synesi-firebase.firebaseapp.com`
- `projectId`: `synesi-firebase`
- `storageBucket`: `synesi-firebase.firebasestorage.app`
- `messagingSenderId`: `164302017530`
- `appId`: `1:164302017530:web:a7cabd4a07d390a42cca43`

## Local repo bootstrap completed

Initialized/updated:

- `firebase.json`
- `.firebaserc`
- `firestore.rules`
- `firestore.indexes.json`
- `storage.rules`

Current default stance is deny-by-default rules for Firestore and Storage until Phase 2/3 rule rollout.

## Environment template for Vercel

Public vars:

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`

Server-only vars:

- `FIREBASE_SERVICE_ACCOUNT` (JSON string) or `GOOGLE_APPLICATION_CREDENTIALS` (mounted secret path)


# Firebase Cutover (Phase 5) Checklist

This checklist tracks production cutover and the required 14-day stabilization window.

## Completed in this changeset

- Default backend switched to Firebase (`DATA_BACKEND=firebase`).
- Chat persistence domain migrated for Firebase:
  - chat threads/messages/memory storage
  - sigma projects
  - chat exports metadata
  - sigma monitor runs
  - upload metadata and push subscriptions
- Supabase project paused via MCP:
  - Project: `synesi`
  - Project ID: `lmlgwzrwubqkuarzxsmx`
  - Pause result: success

## Remaining operational checks (production)

- Confirm production Vercel env vars are Firebase-first:
  - `DATA_BACKEND=firebase`
  - `NEXT_PUBLIC_FIREBASE_*`
  - `FIREBASE_SERVICE_ACCOUNT`
- Verify no production traffic relies on Supabase keys.
- Run production smoke tests:
  - Auth session and sign-out
  - Sigma chat thread CRUD
  - Upload/delete documents
  - Export artifact creation/download
  - Sigma monitor manual + cron execution
  - Push subscribe/unsubscribe + notification delivery

## 14-day stability window

Track daily and keep this section updated before permanent decommission:

- Day 1-14: no critical errors in chat/monitor/export/upload/push flows.
- Day 1-14: no fallbacks to Supabase in production logs.
- Day 1-14: no data integrity regressions reported by users.

When all checks are green for 14 consecutive days, proceed with:

- Final Supabase credential removal from Vercel.
- Supabase archive/deletion decision per ops policy.

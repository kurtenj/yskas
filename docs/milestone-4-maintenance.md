# Milestone 4: queries and maintenance

Scope: KUR-262 and KUR-273, revised after milestone 3 merged as `971819f`. Branch: `milestone-4-maintenance`. No visual redesign, new infrastructure, provider changes, or retention changes.

## Query changes

`meals.forDateRange` now reads each requested date through the existing `by_user_date` index instead of collecting the profile's entire history and filtering in JavaScript. Dates are validated, deduplicated, and restricted to at most 14 supplied entries spanning at most 14 calendar dates. Empty lists return no candidates. Arbitrary gaps remain supported.

The query returns at most 100 candidate meals, visiting dates newest first and records within each date by descending Convex creation order. The client retains its nutrition/provenance-aware deduplication and fuzzy matching. The cap is on candidate rows, not unique food names; older candidates can fall outside it on unusually busy histories. No cap was added to `forDate`, so complete daily calories/protein/fiber totals remain unchanged.

Read-path evidence: the new code requests at most 100 documents across at most 14 indexed date lookups, independent of cleanup backlog size. Tests seed 500 backlog meals plus date gaps and unrelated profiles; only the requested profile/dates appear. A separate 125-meal day returns 100 suggestion candidates while all 125 contribute to daily totals. These are code/test bounds, not measurements of billed Convex reads or production latency. Normal two-week retention already limits the practical savings.

Suggestion queries skip empty/one-character input and pause during recording, provider work, saving and retained-estimate retry states. Home-only mounting was already implemented in milestone 2 and is preserved. Browser coverage verifies the active query lifecycle, not production WebSocket traffic.

The shell now uses `users.get` for only the selected profile. That query accepts a stored string, normalizes it as a users ID server-side, and returns null for malformed, wrong-table or deleted selections. It still requires household authentication. The shell redirects before mounting children when selection is absent or invalid. The profile selection page still lists all household profiles; no per-profile privacy boundary was introduced.

## Cleanup and documentation

Removed the unreferenced `ShimmerText` component, its `cn` utility, direct `clsx` and `tailwind-merge` dependencies, five unreferenced starter SVGs, and the now-unused client-side profile-list validation helper. Searches found no remaining application/package references. The lockfile diff removes only the two dependencies. Existing favicon/PWA assets remain.

The README now describes actual routes, separate Next/Convex startup, local versus live targets, shared auth configuration names, both providers, nutrient semantics, retention, operation records, telemetry, tests and backend-first rollout. No secret values were added. No bundle-size savings are claimed: the removed branch was already unreferenced.

Milestone 3's operation records and cleanup logic are untouched. They remain necessary after deleting a meal to prevent delayed retries from recreating it.

## Verification and rollout

- 106 unit/backend tests and 12 browser tests pass.
- TypeScript, production build and local Convex push pass.
- Lint passes with the four existing generated-file warnings; npm audit reports zero vulnerabilities after dependency removal.
- Verification used no live meal writes or paid provider calls. Production backend rollout is recorded below.

No new table, index, backfill or migration is required. Deploy the compatible backend before the frontend: the shell now relies on safe string normalization for stored profile IDs. Existing clients with valid IDs remain compatible. Keep milestone 3's widened schema and operation records on rollback.

Merge cleanup: PR #3 is confirmed merged; local main is updated and the old feature branch is removed locally/remotely. KUR-266–269 are Done, with representative production usage measurements carried into KUR-274. Read-only rollout inspection found Vercel had published milestone 3 while the live Convex save arguments still lacked `operationId`; deploying merged milestone 3 to `agreeable-stork-227` was requested separately for approval. This is distinct from the unmerged milestone 4 work.


## Authorized backend rollout ? September 21, 2026

Deployed the combined milestone 3 and milestone 4 Convex backend to `agreeable-stork-227` at 18:19 CDT after explicit user authorization. The isolated rollout checkout used merged commit `971819f` plus the tested milestone 4 `convex/meals.ts` and `convex/users.ts` changes. Both save mutations now advertise `operationId`, and the selected-profile query accepts a safely normalized string. Authenticated profile/daily/recent-meal reads passed for both household profiles; malformed selection returned null; anonymous reads were denied. No live meal writes or provider calls were used for verification. The temporary checkout was removed and local dev configuration preserved.

Milestone 4 frontend changes remain uncommitted and unreleased; its client subscription savings take effect after that release. Production usage measurement remains tracked in KUR-274.

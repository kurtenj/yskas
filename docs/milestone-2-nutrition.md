# Milestone 2: nutrition contracts and basic visibility

Scope: KUR-261, KUR-263, KUR-264, KUR-265, and KUR-275. No model/provider change or live judge.

## Behavior

- Calories use kcal; protein, fiber, carbs and fat use grams. Shared validation rejects negative/nonfinite values and blank or oversized text. Decimals are retained; display rounds to one decimal.
- Daily protein and fiber goals are optional positive gram values, editable in Settings. No target is invented for existing profiles. Clearing a gram goal removes it.
- The shared protein-share calculation remains `sum(protein grams) * 4 / sum(consumed kcal)` with unknown/zero-denominator handling, but the summary no longer displays the percentage line. The summary shows only the right-aligned cal remaining figure and protein/fiber gram totals/goals; no nutrient rings or duplicate consumed-calorie figure.
- Fiber has the Phosphor Plant icon in meal rows and emerald-500 dots in the main chart. Filled dots track calorie progress; protein uses its approximate calorie contribution, while fiber highlights a portion of the remaining filled dots based on its daily gram-goal progress (at least one when known positive fiber and room are available). These are approximate visual highlights, not a precise calorie partition. No fiber calorie conversion is asserted.
- Missing nutrients remain unknown. Partial daily amounts show known grams and the number of meals missing that nutrient. An empty day has zero consumed grams. The chart caps at the calorie goal; nutrient text retains over-goal amounts.
- Text entry and suggestion selection calculate/copy and save immediately, matching voice entry. There is no confirmation preview or saved-meal editor; users delete and re-enter meals to change them. Failed saves keep the estimate for retry without another provider call. The underlying correction/scaling domain rules remain distinct, with no editor exposed in the UI.
- Suggestion identity includes description, nutrition and source/serving context. Selecting a suggestion replaces typed text with its source description; the backend copies that source. A deleted source fails explicitly rather than silently becoming a fresh estimate.
- Original nutrition snapshots, model/prompt/schema metadata when available, source meal ID and cumulative serving multiplier survive source deletion. Changed nutrients are derived from the original snapshot and multiplier instead of duplicating a change list. Metadata is descriptive, not a cryptographic attestation. Old-client writes without source metadata have unknown origin; editing legacy data snapshots the values that existed at correction time, not a fabricated original LLM response.
- Logging uses America/Chicago regardless of browser timezone. Typed requests capture their date before estimation; voice captures it at the microphone tap; reuse captures it at selection. Save/retry keeps that timestamp/date. The active day refreshes at Chicago midnight and on focus/visibility restoration, including DST changes. Existing historical date keys stay unchanged.
- The layout validates a selected profile against the accessible profile list before mounting child queries. Invalid/deleted selections return to selection. Storage failures leave in-memory selection usable. Navigating away unmounts meal entry and cancels pending estimation/recording.

## Compatibility and rollout

This is an additive schema change: optional fiber, provenance and loggedAt on meals; optional protein/fiber goals on profiles. No migration runner, historical backfill, deletion, re-estimation, or required-field tightening is needed. Existing protein/carbs/fat and two-week retention remain. The shared date helper is now also used by retention.

Compatibility tests insert a legacy row and a new row together, verify both remain readable and the old fiber/provenance remain absent, and verify source deletion does not remove a reused meal's snapshot. No live export or database mutation was performed for development or tests.

Deploy the compatible Convex backend **before merging/releasing the frontend**. The app currently uses `agreeable-stork-227` (a development-named deployment) in Vercel Production, not the project's nominal production deployment. Confirm that mapping at rollout time. The new frontend requires the new mutations; old clients can continue using the widened backend. Auth configuration from milestone 1 is unchanged.

If rollback is needed, roll back the frontend while retaining the widened backend/schema. Do not deploy the old strict schema once records contain the new fields. A backend rollback should retain the additive validators and fields while reverting behavior. Export/snapshot first if any later destructive migration is proposed. There are no destructive steps in this milestone.

## Verification

- `npm test`: 86 tests (5 voice tests plus 81 Vitest tests), including Convex, validation, nutrition, profile-storage and calendar behavior.
- `npm run test:browser`: 6 Chromium tests at a mobile viewport. They bundle the actual components with in-memory Convex/navigation adapters and mocked estimation. Coverage includes goal editing, simplified summary, immediate text/reuse saving, failed-save retry without re-estimation, midnight-crossing requests and background restoration. These are component integration tests, not live authentication/deployment tests.
- First-time browser setup: `npx playwright install chromium --only-shell`.
- TypeScript, production build and lint pass; lint retains four existing generated-file warnings.
- Browser screenshots are generated under ignored `test-results/`.
- No paid provider calls or live database writes.

Broader strict estimator extraction, output failure classification, telemetry, idempotent save operations, query optimization and LLM-as-a-judge stay in their later tickets. This change adds validated fiber to the current estimator; it does not claim measured improvement in nutritional accuracy or token cost.

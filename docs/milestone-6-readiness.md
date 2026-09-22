# Foundation readiness — September 21, 2026

Scope: KUR-272 and KUR-274, after Luna merged as `8f77335`. This milestone automates verification and records the limits of the evidence. It adds no product feature, backend migration, provider call or deployment.

## Repeatable verification

Local verification passes: 110 unit/backend tests and 14 browser regressions, production build, TypeScript, and zero lint warnings. Production dependency audit reports zero vulnerabilities. Clean GitHub runner verification is pending the first PR workflow run.

`npm run verify` runs Node tests, Vitest, ESLint with zero permitted warnings, Next production build, explicit TypeScript and Chromium regressions. Node 24, `npm ci`, and Playwright Chromium are the only clean-checkout prerequisites. No environment files or production credentials are needed. The verification build uses a loopback Convex URL and must not be deployed; normal Vercel builds use configured production environment values.

The GitHub Verify workflow runs on PRs and main with read-only repository permission, a 15-minute timeout, lockfile install and stale-run cancellation. It has no secrets, paid evaluation commands, live Convex commands or deployment step. Generated Convex files are excluded from ESLint rather than edited. GitHub branch protection is an independent repository setting: this workflow runs checks but does not itself enforce that merges wait for them.

Browser tests bundle real components with in-memory data/navigation adapters and mocked API responses. The new cases exercise independent goal updates, optional goal removal, profile-switch navigation and selection intent. Actual localStorage semantics are separately covered by unit tests. These tests do not reproduce Next routing, live token refresh, browser microphone hardware or provider integration. Existing browser cases cover stale requests, save retry without another estimate, midnight/background behavior, chart scrolling and inactive suggestions.

## Findings disposition

| Original finding | Disposition and evidence |
| --- | --- |
| F1 authorization | Implemented verified household sessions and service-only quota access. `convex/security.test.ts`, session and request tests. Shared profile access is an explicit household decision. |
| F2 retention/cleanup | Intentional 14 Chicago dates; eligible indexed batches terminate. `convex/crons.test.ts` covers retained and expired boundaries/batches; operation cleanup tests prevent expired replay. |
| F3 dependencies | Patched during M1; current production dependency audit reports zero vulnerabilities. Audit is point-in-time, not an enduring guarantee. |
| F4 validation | Shared finite nonnegative validation, bounded inputs and strict provider responses. Nutrition, provider-input and estimator tests reject malformed values. |
| F5 nutrient semantics | Known totals and missing nutrients remain distinct; protein/fiber goals and approximate chart implemented. No invented fiber-calorie equivalence. |
| F6 reuse/correction | Source snapshots and scaling survive source deletion; per-item editing UI removed by owner decision. `convex/nutrition.test.ts`. |
| F7 accuracy | Strict output and bounded Luna pilot shipped; broad nutritional accuracy remains unproven. KUR-276 owns further reference/held-out coverage. Jev deferred. |
| F8 observability | Versioned, privacy-limited stage/usage events and model-aware cost summary exist. Production end-to-end/voice measurements remain insufficient (below). |
| F9 request/save lifecycle | No SDK retries; bounded deadlines/cancellation; operation IDs prevent duplicate/replayed saves. `mealOperations`, estimator and browser reliability tests. |
| F10 reads | Indexed date lookups, 100 suggestion candidates, paused subscriptions; full daily totals remain uncapped. `recentMeals` and subscription browser tests. No billed-read savings claim. |
| F11 date/profile recovery | Chicago/DST date rules, captured request dates, malformed/deleted profile normalization and storage-failure tests. |
| F12 verification | Automated verification workflow plus existing and focused new regressions. Physical-device checks remain manual. |
| F13 cleanup | Unused helpers/assets/dependencies removed in M4. No rewrite or new caching infrastructure. |
| F14 UI decisions | Owner-approved simplified summary, fiber chart highlighting, delete/re-enter corrections and automatic text saving. Broader accessibility/device audit remains outside this foundation change. |

The code-level P0 fixes are covered by regression tests. F7/F8 retain explicitly documented evidence gaps, owned by Jonathan through the follow-up backlog; neither is silently represented as a complete accuracy/performance certification.

## Compatibility and rollback

No schema migration or backfill is needed. Existing compatibility tests insert legacy and new meals together, check absent fiber/provenance stays absent, and verify saved/reused snapshots survive source deletion. Operation tests verify a deleted meal cannot be recreated by a delayed retry. These tests run with the widened schema in memory; they do not prove a deployed database restore or historical client binary rollback.

For a release: identify the exact commit and Vercel environment; verify the configured Convex mapping; run verification; inspect the PR/CI results; deploy through the existing approval flow. Vercel production currently uses `agreeable-stork-227` despite its development classification. Do not assume the nominal `reliable-giraffe-43` backend is live. Future backend-dependent changes require a compatible additive backend before frontend rollout.

For an M6 regression, revert the verification/test/config changes and restore the last known passing workflow. No runtime data is changed. For an estimator regression, revert Luna's model/request settings and redeploy the normal Vercel build, preserving both models' historical pricing. Keep the widened backend fields, validators and operation ledger; do not roll the database back to a pre-auth or strict old schema. Validate login, profile selection, legacy/new meal reads and a synthetic isolated save/retry after rollback. A destructive future migration needs its own snapshot/restore rehearsal; none was performed or needed here.

## Production evidence and limits

PR #5 is merged and Vercel reported a successful deployment. Earlier live verification exercised signed token exchange and profile/daily/recent reads against the actual backend. Those checks did not write meals. This milestone does not claim a fresh full live save/login-device test or a production deployment.

A read-only Vercel log query on September 21, around 19:40 Chicago time, requested the preceding hour of production logs (all branches, limit 200). Four parseable meal events were extracted without copying raw meal text/audio into this report. Two observed estimate attempts had usage totaling 370 input and 67 output tokens, calculated cost $0.0000957 and durations 893/913 ms. No successful client save or end-to-end operation event was observed in this sample. Missing observations are not evidence of failed or abandoned meals. This is neither representative production p95 nor evidence of Luna's production speed; cost per accepted meal and voice cost remain unavailable. The raw diagnostic extract is ignored, access-limited by the local workspace, and subject to the existing 14-day export retention policy.

The temporary diagnostic extract was deleted after aggregation. The independent Luna pilot contains 64 paid requests from the previous milestone and separate source/synthetic/indeterminate results. M6 made no paid calls. See [the pilot](milestone-5-luna-pilot.md) for the 195 ms median latency increase, 1.76x sample token cost and accuracy limitations.

## Manual release checks and follow-up

Before claiming physical-device voice readiness, use a supported phone/browser to check microphone denial/recovery, silence, screen lock/backgrounding, interrupted network, and successful text/voice saves. Existing mocked capture tests cannot substitute for these checks. Use an isolated development profile/deployment for deliberate duplicate/retry and deletion exercises.

Collect enough normal production traffic to assess end-to-end p50/p95 and provider calls per observed save, separated by text/voice/reuse and model. Obtain ElevenLabs billing data before reporting voice cost. Production measurement and physical-device checks are tracked in KUR-277, assigned to Jonathan; broader nutrition coverage remains KUR-276. These are recorded follow-ups, not newly required infrastructure or automatic paid CI jobs.

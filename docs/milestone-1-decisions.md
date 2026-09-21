# Milestone 1 decisions and implementation status

Date: 2026-09-21. Product decision owner: Jonathan. Implementation: Codex.

Jonathan confirmed the product decisions below on 2026-09-21. Numerical nutrient goals will be configurable per profile in the later nutrition milestone; no default gram targets were chosen here.

| Decision | Confirmed outcome | Rationale and affected tickets |
| --- | --- | --- |
| Access | Keep shared household profiles and the existing PIN experience, with verified sessions | Every authenticated household member can access every profile. KUR-258, KUR-259, KUR-265 |
| Nutrition | Calories remain the primary budget. Protein share = protein grams × 4 / consumed calories × 100; also track total protein grams against a daily gram goal | Avoid mixing denominators. Zero consumed calories means share unavailable; missing nutrients remain unknown, not zero. KUR-261 |
| Fiber | Track total fiber grams against a daily gram goal | Total fiber alone is insufficient to infer its calorie contribution. KUR-261, KUR-270 |
| Retention | Continue deletion, extending retention to two weeks | User's stated reason: reduce data costs. Implemented as today plus 13 preceding Chicago calendar days. KUR-260, KUR-263 |
| Logging day | America/Chicago | A stable explicit day boundary avoids device/server disagreement. Cleanup uses this now; remaining client logging-day work is KUR-265 |
| Corrections | Calorie-only corrections are distinct from serving changes | Rescaling nutrients requires an explicit serving change; provenance should distinguish corrections. KUR-264 |
| Judge | LLM-as-a-judge to improve accuracy | Offline calibration and reference-backed evaluation precede any live judging. KUR-270, KUR-271 |
| Rollout | Implementation remains local; deployment is a separate operational step | Signing keys and coordinated frontend/backend configuration are required; see auth-rollout.md |

## Implemented locally

- KUR-260: indexed eligible-meal batches, fixed cutoff across continuations; retained-only batches terminate. Additive `by_date` index; no backfill or live deletion performed. Deploy schema/index and function together through Convex after review. Existing scheduled calls without a cutoff remain compatible.
- KUR-257: Next.js and eslint-config-next aligned at 16.3.5; Convex 1.46.0; affected transitive dependencies updated within supported ranges. Added current Convex test dependencies and Node 22 types (required by Vitest 5; local runtime is Node 24).
- KUR-258: RS256 sessions with separate session/Convex audiences, authenticated Convex provider, guards on every public data function, expiry and household-wide session invalidation. No legacy ownership migration is needed because all existing profiles belong to this one shared household.
- KUR-259: bounded streamed bodies, JSON/media-type checks, nonempty descriptions up to 2,000 characters (16 KiB JSON), audio up to 4 MiB (16 KiB multipart overhead), supported audio MIME types. PIN JSON capped at 1 KiB. Durable global PIN throttle, household-wide provider minute/day quotas and concurrency leases. Provider execution capped at 45 seconds; no automatic OpenAI retries. Configuration and tradeoffs are in auth-rollout.md.

## Dependency evidence

Before: production audit reported seven affected packages (one critical, four high, two moderate): Next.js, Convex/ws, sharp, PostCSS, nanoid, baseline-browser-mapping. After targeted direct/transitive updates: full and production audits report zero known vulnerabilities.

Upstream confirms the Windows-hosted Next.js issue and AVIF image optimization issue are patched in 16.3.3; installed 16.3.5 exceeds that minimum:

- https://github.com/vercel/next.js/security/advisories/GHSA-p293-qw3h-jr36
- https://github.com/vercel/next.js/security/advisories/GHSA-2xp9-vwfh-vxw4

The development machine uses Windows. Production host OS is unconfirmed. Repository config does not enable AVIF output, a custom server, rewrites, or single-locale routing; no handwritten Server Actions were found. These observations narrow exposure but do not establish production exploitability. All reported dependencies were patched irrespective of those prerequisites. No residual audit exception is required.

## Open acceptance checks

Local verification: production build and TypeScript passed; all 51 security, quota, request-validation, cleanup, provider-route and existing voice tests pass. Lint reported zero errors and four existing generated-file warnings. Full npm audit reports zero vulnerabilities. A built Next.js server with ephemeral test keys passed seven HTTP smoke checks: PIN page, anonymous redirect, valid signed-session navigation/token exchange, rejection of the old cookie, and unauthenticated denial for both paid routes. No paid provider requests were made. Tests include real JWT signatures plus isolated Convex function execution; they do not substitute for the deployed token-exchange/WebSocket smoke test.

Signing-key provisioning, coordinated deployment and real browser/Convex/provider integration smoke tests remain outstanding. Production host OS is unconfirmed. The implementation is ready for review, not represented as deployed. See [rollout instructions](auth-rollout.md).

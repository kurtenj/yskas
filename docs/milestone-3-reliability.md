# Milestone 3: reliable and measurable meal entry

Scope: KUR-266–269. Branch: `milestone-3-reliability`. No visual UI changes. Text, voice and suggestions still save immediately; failed saves retain the result for the existing retry control. No live judge or provider/model migration.

## Contracts

- A UUID identifies one logging operation. The same ID, profile, logging timestamp, source and nutrition travel through retries. Separate deliberate entries get separate IDs even when their content is identical.
- Convex checks a globally indexed operation ID inside the same transaction as the meal insert. Cross-profile or changed-payload replay fails. The operation stores a SHA-256 fingerprint and original meal ID; it does not duplicate meal descriptions or nutrients. Concurrent retries return one result.
- Deleting a meal retains its operation record until retention cleanup. A delayed retry returns the original ID without resurrecting the meal. Reuse retries also survive deletion of the source after the original save committed.
- Records expire with the meal's Chicago date under the existing today-plus-13-days policy, in batches of 100. New keyed submissions outside that date window are refused. Idempotency is bounded to this window, not forever. Older clients without operation IDs remain compatible but do not gain duplicate protection.
- Provenance remains descriptive metadata, not proof that a provider verified nutrition. The payload fingerprint prevents changing an accepted operation; it does not authenticate the origin of client-supplied numbers.
- One entry hook coordinates capture, transcription, estimation, save and failed states. A synchronous operation reference closes the rapid-tap gap before React renders. Route/profile unmounts abort requests and ignore stale results. An already submitted database mutation cannot be cancelled, but its completion cannot update the next entry's UI.
- Backgrounding stops microphone capture. Submitted requests may finish while hidden. A failed save retains its estimate in memory; refresh/closing the page loses that retry state. This is not an offline queue.

## Estimator and limits

`lib/estimator.ts` is server-only. It keeps `gpt-4o-mini` and Chat Completions, uses a strict six-field JSON schema, and applies shared nutrition validation after parsing. Nullable nutrients remain unknown; decimals remain intact. Refusal, truncation, invalid output, provider failure, timeout and cancellation are separately recorded. Invalid outputs never reach the save path.

The prompt preserves explicit portions/units and label facts; unspecified portions use typical US servings. Ambiguity is bounded by nullable nutrients and the portion convention; no verbose explanations or invented confidence scores are requested. This does not resolve all nutritional ambiguity or prove accuracy—that is milestone 5's evaluation work.

Provider execution has a 45-second deadline, zero SDK retries, and a 256-token output ceiling. The ceiling gives the six-field object headroom; it does not require the model to use all 256 tokens. The existing request size, rate and concurrency controls remain. Prompt/schema version is now `nutrition-3`/3. The old configuration is frozen in `scripts/estimator-baseline.json` for reproducible comparison.

Strict-output reference: [OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs).

## Measurement and privacy

Server logs contain versioned `meal_entry` JSON events with an operation ID, input mode, stage, duration, outcome and attempt count. Provider events include model/prompt/schema versions and actual usage. Missing usage is null, not zero. Client events use an authenticated, 4 KiB capped endpoint (at most eight events per batch, normally one request per meal) and an explicit field allowlist. Delivery is best effort without retries; telemetry failure cannot prevent a meal save.

Capture, transcription round-trip, server transcription, estimation round-trip, server estimation, save and total operation are observable. Client transcription round-trip includes upload/network overhead; it cannot isolate pure upload time. Server timing excludes client upload. Correlation supports investigating that difference without claiming an exact upload measurement.

Do not log food descriptions, names, transcripts, audio, provider response bodies, credentials or user/profile identifiers. Client observations are untrusted and can be dropped or duplicated; deduplicate successful saves by operation ID. A missing completion is not automatically an abandoned meal. Database mutation completion can race navigation. Metrics are diagnostic, not billing/accounting authority.

Use existing Vercel logs; no analytics subscription or high-churn profile fields. Do not increase provider log retention for this work. Any exported diagnostic JSONL should stay in ignored `.convex/` and be deleted within 14 days; keep only aggregate reports longer. Platform log retention follows the existing Vercel plan/settings and has not been changed by this branch. Operation rows are deleted by the existing retention job.

Summarize exported JSONL (raw event lines or Vercel records with JSON `message`):

```powershell
node scripts/meal-metrics.mjs .convex/events.jsonl
```

Text cost uses dated public pricing and provider usage. Transcription is counted separately; dollar cost remains unavailable until matched to ElevenLabs billing. No new paid observability service is needed.

## Initial benchmark

Measured September 21, 2026: six synthetic text meals per version, alternating legacy/strict ordering, twelve actual provider calls, no meal writes. [Raw aggregate report](milestone-3-benchmark.json).

| Metric | Milestone 2 | Milestone 3 |
| --- | ---: | ---: |
| Valid estimates | 6/6 | 6/6 |
| Provider latency median | 1,119 ms | 986 ms |
| Sample p95 (maximum of six) | 3,236 ms | 1,546 ms |
| Total text token cost | $0.0003549 | $0.0002787 |

Observed token cost fell 21.5%. Total comparison cost was about $0.000634. These are provider-only measurements on a tiny synthetic sample, with no claim of statistical significance or improved nutritional accuracy. No historical production baseline exists. Production calls per accepted meal, end-to-end p50/p95 and voice cost remain unmeasured until the instrumentation sees representative use. KUR-266's production baseline acceptance criterion remains a rollout follow-up.

Prices checked September 21, 2026: $0.15/M input, $0.075/M cached input, $0.60/M output at [OpenAI's GPT-4o Mini model page](https://developers.openai.com/api/docs/models/gpt-4o-mini). Excludes hosting and transcription.

To explicitly repeat the bounded paid benchmark:

```powershell
npx esbuild scripts/benchmark-estimator.ts --bundle --platform=node --packages=external --outfile=.convex/benchmark-estimator.cjs
node --conditions=react-server .convex/benchmark-estimator.cjs --run
```

Uses the local API key without printing it. Writes only safe usage/timing events to `.convex/estimator-benchmark.jsonl`. It stops on provider errors rather than retrying. Six fixtures per version are for runtime/cost comparison, not a substitute for milestone 5 reference nutrition fixtures.

## Rollout and verification

Deploy the additive Convex table/functions before releasing the frontend. No historical backfill or re-estimation is necessary. Production is actually connected to `agreeable-stork-227`; do not accidentally deploy to the nominal unused production deployment. This branch has only been pushed to the isolated local backend.

Rollback the frontend while keeping the widened backend/schema. Do not remove operation records or deploy the old strict schema while records exist. Existing meal/profile data and auth configuration are unchanged.

Verification covers provider refusal/truncation/invalid output and usage redaction; concurrent, changed-payload and cross-profile retries; intentional repeated meals; deleted sources/meals; operation retention; text/voice/reuse autosave; retries without re-estimation; rapid submissions; stale responses after navigation; background behavior; existing mobile chart and midnight behavior. Browser tests use real components with in-memory services and mocked providers; the separate provider benchmark uses actual OpenAI calls.

Final checks: 103 unit/backend tests plus 11 browser tests pass; TypeScript and the production build pass. Lint passes with four pre-existing generated-file warnings. The additive backend compiles and pushes to the isolated local deployment. No development servers were left running.

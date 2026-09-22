# Yskas

A shared-household calorie tracker. Log a meal with text, voice, or a recent-meal suggestion. Text and voice estimates save immediately; a failed save can retry without another estimate. To correct a saved meal, delete it and re-enter it.

The dashboard shows calories remaining plus protein and fiber gram totals. Its 50-dot chart is an approximate guide: white for other consumed calories, cyan for protein, emerald for fiber progress. Fiber dots are a goal-based highlight, not a conversion of fiber grams into calories. Daily calorie, protein and fiber goals are editable in Settings. Displayed values round to whole numbers; stored values keep their precision. Missing nutrients display a dash and are not invented as zero.

## Stack and routes

Next.js 16 / React 19, Convex, Tailwind CSS 4, Motion, Phosphor icons and Base UI. OpenAI `gpt-5.6-luna` estimates nutrition with reasoning disabled; ElevenLabs `scribe_v1` transcribes voice input. See [the Luna comparison](docs/milestone-5-luna-pilot.md) for evaluation results and reproduction commands.

| Route | Purpose |
| --- | --- |
| `/` | Today's chart, totals, meal list and entry controls |
| `/settings` | Selected profile and daily goals |
| `/select` | Household profile selection |
| `/pin` | Household sign-in |
| `/api/verify-pin` | Verify PIN and issue signed session cookie |
| `/api/auth/token` | Exchange session for a short-lived Convex JWT |
| `/api/estimate` | Strict, validated nutrition estimation |
| `/api/transcribe` | Audio transcription |
| `/api/meal-events` | Authenticated, bounded diagnostic event batches |

There are no separate add-meal or history pages. PWA assets and the manifest live in `public/`.

## Development

Install dependencies with `npm ci` (Node 24 matches the current hosting runtime). Start the backend and frontend in **separate terminals**:

```powershell
npx convex dev
```

```powershell
npm run dev
```

`npm run dev` starts only Next.js, normally at `http://localhost:3000`. It does not start Convex. Use this command for local Next development; `vercel dev` can inject a different environment.

This workspace is configured for an isolated local Convex backend:

- `CONVEX_DEPLOYMENT`: `local:local-kurtenj-yskas`
- `NEXT_PUBLIC_CONVEX_URL`: `http://127.0.0.1:3210`
- Next auth issuer: `http://localhost:3000`

On a fresh checkout, configure an isolated local deployment before running a watcher:

```powershell
npx convex dev --configure existing --team kurtenj --project yskas --dev-deployment local
```

Confirm the CLI's printed target. A watcher aimed at the cloud deployment used by production changes the live backend. Keep local and production auth keys separate. Local database/storage files live in ignored `.convex/`.

## Environment and authentication

All authenticated household members share access to every profile. A selected profile ID is a navigation preference, not an authorization boundary. The PIN creates a signed 14-day HttpOnly session; Convex receives short-lived signed JWTs.

| Variable | Next server (`.env.local` locally, Vercel for hosting) | Matching Convex deployment |
| --- | --- | --- |
| `SITE_PIN` | Required | No |
| `OPENAI_API_KEY` | Required for estimation | No |
| `ELEVENLABS_API_KEY` | Required for voice transcription | No |
| `NEXT_PUBLIC_CONVEX_URL` | Required; browser-visible backend URL | No |
| `CONVEX_DEPLOYMENT` | Local CLI target selector | No |
| `AUTH_ISSUER` | Required; exact app origin | Same value |
| `AUTH_SESSION_VERSION` | Required | Same value |
| `AUTH_JWKS` | Required public key set | Same value |
| `AUTH_PRIVATE_JWK` | Required secret signing key | **Never copy here** |

Follow [auth configuration and rollout](docs/auth-rollout.md) for key generation, public Convex variables, limits and rotation. The key generator refuses to overwrite an existing `.env.auth`; that file is not automatically loaded by Next.js. Existing workspaces should retain their configured keys. Do not replace production keys to fix local login.

An “Authentication unavailable” message usually requires checking the Next server's auth environment; merely running Convex is not enough. Missing or mismatched issuer/JWKS/session-version settings fail closed. Restart Next.js after changing its environment. Never commit `.env*`, tokens, PINs or signing keys.

## Data, dates and retention

- `users`: profile name, calorie goal and optional protein/fiber gram goals.
- `meals`: description/name, calories, optional nutrients, Chicago date, timestamps and optional original estimate/reuse provenance.
- `mealOperations`: compact duplicate-save records (operation ID, payload fingerprint, profile/date and original meal ID).
- `requestLimits`: fixed household PIN/provider rate-limit records.

Dates use `America/Chicago`, including DST. A logging operation captures its date before provider work; retrying keeps that date. Retention keeps today and the previous 13 Chicago calendar dates. Scheduled cleanup deletes expired meals and operation records in bounded batches; rows may remain until the next cleanup run. Deleting a meal does not immediately remove its operation record, so a delayed retry cannot recreate it.

Daily totals include every meal for the selected day. Suggestions use the latest 100 candidate rows across the requested dates (normally seven days, maximum 14-day span), then deduplicate by nutrition/source context and fuzzy-match locally. This candidate limit never limits daily totals. Subscriptions pause for short input and while recording, estimating, saving or holding a retry estimate. The shell validates only the selected profile; profile selection still lists household profiles.

## Verification

```powershell
npm test
npx playwright install chromium --only-shell   # first browser-test setup
npm run test:browser
npx tsc --noEmit
npm run lint
npm run build
```

Unit/backend tests use mocked providers and `convex-test`; browser tests bundle real components with in-memory service adapters. These commands do not spend provider tokens or access live meals. `npm start` runs an already built Next app and still needs a reachable, correctly configured Convex deployment.

## Diagnostics and deployment

Provider diagnostics record token usage, outcome and timing, not meal text/audio. Client stage events are best effort and batched. See [milestone 3 contracts and measurement](docs/milestone-3-reliability.md) for the event format, 14-day diagnostic-export policy and explicitly paid benchmark command. Summarize an ignored JSONL export with:

```powershell
node scripts/meal-metrics.mjs .convex/events.jsonl
```

Production is `https://yskas.vercel.app` and currently uses the development-named Convex deployment **`agreeable-stork-227`**. The nominal `reliable-giraffe-43` production deployment is not the app's live backend. Confirm the mapping before every rollout; do not use plain `convex deploy` assuming it targets the live app.

Vercel publishes frontend changes merged to `main`; Convex updates are separate. Deploy a compatible additive backend before releasing frontend code that requires it. Keep the widened backend/schema when rolling back a frontend; do not remove populated additive tables. Production deployments require explicit authorization. See [milestone 4 notes](docs/milestone-4-maintenance.md) for this branch's scope and verification.

Visual/accessibility redesign, additional caching/aggregate infrastructure, and LLM-as-a-judge evaluation are outside this maintenance milestone.

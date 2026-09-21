# Shared-household authentication and rollout

The existing PIN is the household credential. Every signed-in household member can read and modify every profile in this deployment. There are no individual private profiles. This is a single-household deployment, not a multi-tenant system.

The Next.js server verifies the PIN under a durable global throttle and issues a 14-day HttpOnly session cookie, Secure in production and SameSite=Lax. The previous `pin_verified=true` cookie is not accepted. Browser Convex tokens expire after five minutes; server-only limiter tokens expire after one minute. All tokens use RS256 via `jose`, with distinct session and Convex audiences. Convex verifies signatures and audience; every data function also checks issuer, canonical token identity and session version. The browser uses `ConvexProviderWithAuth` and mounts protected subscriptions after Convex confirms authentication.

See the [Convex custom JWT documentation](https://docs.convex.dev/auth/advanced/custom-jwt). The custom JWT adapter preserves the existing PIN experience without introducing an account-provider UI or migrating profile ownership.

## Configuration

1. Run `node scripts/create-auth-config.mjs https://your-app.example` with the app's exact origin (no trailing slash). For local Next.js, use `http://localhost:3000`. This writes a gitignored `.env.auth` and refuses to overwrite it. It does not print keys or alter deployment settings. Generate separate keys for each environment.
2. Copy all four values into the **Next.js server** environment: `AUTH_ISSUER`, `AUTH_PRIVATE_JWK`, `AUTH_JWKS`, `AUTH_SESSION_VERSION`. For local development, merge into `.env.local`; Next does not automatically load `.env.auth`.
3. Copy only `AUTH_ISSUER`, `AUTH_JWKS`, `AUTH_SESSION_VERSION` into the matching **Convex** deployment environment. Never put the private key in Convex or in a `NEXT_PUBLIC_` variable. `AUTH_JWKS` is the public-key set, embedded in the auth configuration as a data URI so Convex does not need access to a localhost JWKS endpoint.
4. Keep existing `SITE_PIN`, `NEXT_PUBLIC_CONVEX_URL`, `OPENAI_API_KEY`, and `ELEVENLABS_API_KEY` in Next. Use the same exact issuer and session version on both services. Auth fails closed when required settings are missing.

## Limits

Limits use a fixed pair of small Convex records, not per-IP records or an in-memory map. This bounds storage and applies across app instances and selected profiles.

| Setting | Default | Environment |
| --- | --- | --- |
| `PIN_ATTEMPTS_PER_WINDOW` | 10 attempts per 15 minutes across the household; max configurable 30 | Convex |
| `PROVIDER_REQUESTS_PER_MINUTE` | 10 across both paid routes | Convex |
| `PROVIDER_REQUESTS_PER_DAY` | 100, resetting at UTC midnight | Convex |
| `PROVIDER_CONCURRENCY` | 2 across both paid routes | Convex |
| `MAX_DESCRIPTION_CHARS` | 2,000 | Next |
| `MAX_DESCRIPTION_BODY_BYTES` | 16,384 | Next |
| `MAX_AUDIO_BYTES` | 4,194,304 plus 16,384 bytes multipart overhead | Next |

Quota limits accept positive integers with upper safety caps (100/minute, 1,000/day, concurrency 10). Input limits have caps of 8,000 characters, 64 KiB description JSON and 16 MiB audio. PIN JSON is always capped at 1 KiB. Supported audio declarations: audio/webm, audio/mp4, audio/ogg, audio/wav, audio/mpeg. MIME validation is not content inspection; the provider still validates the codec.

All PIN attempts that reach credential comparison count, including successful attempts; switching IPs cannot bypass the global budget. Someone deliberately exhausting it can temporarily block household login. This is a deliberate availability tradeoff for a shared four-digit PIN; an identity provider would be the next step if stronger login protection is needed.

Invalid provider inputs spend no provider quota. Admitted attempts count even on provider failure or cancellation; automatic OpenAI retries are disabled. A voice entry normally uses two requests (transcribe, estimate). Provider work has a 45-second abort deadline, and abandoned concurrency leases expire after 120 seconds. Failed quota reads deny admission with 503; exhausted limits return 429 and Retry-After. Releasing a lease never refunds the request budget. No per-attempt data is retained in the quota table.

## Deployment order and verification

Deployment is not performed by this change. Review and configure both environments first. The first rollout requires a short maintenance window because the old frontend cannot authenticate against the protected backend.

1. Keep users out during rollout. Take a backup if required before enabling the new cleanup function. Existing records remain in the same household; no ownership backfill is necessary.
2. Set Convex auth environment values, regenerate API definitions with `npx convex codegen`, then deploy Convex schema/functions/auth. The `by_date` index and `requestLimits` table are additive. Confirm the index is ready. CLI codegen performs a server-side dry run but does not deploy; before auth settings exist it fails validation. Local types can be generated with `npx convex codegen --system-udfs --typecheck disable` using the installed CLI's offline generation path.
3. Deploy Next.js with matching auth values. Every existing browser must enter the PIN once; old unsigned cookies do not grant access.
4. Verify real PIN login, both profile selections, logging, settings and token refresh after five minutes. Test direct anonymous Convex reads and writes are denied. Test forged cookies, wrong PIN and quota 429 responses in an isolated environment. Confirm typed and supported voice input with actual providers only when paid smoke tests are intended.
5. Check the scheduled cleanup. Retention is today plus the preceding 13 **America/Chicago calendar days**; older meal-date keys are deleted in bounded batches. A nightly job may leave expired rows until its next run. Historical records already deleted by the former seven-day policy cannot be recovered by this change. Stop any old purge continuations before rollout: a continuation from the former code could carry the earlier cutoff.

## Invalidation and rollback

To revoke all household sessions, increment `AUTH_SESSION_VERSION` in Convex first, then Next.js. Old browser JWTs lose backend access immediately when functions check the new version, and old cookies cannot mint new tokens once Next is updated. A brief mismatch denies access; perform rotation during maintenance. When changing `SITE_PIN` because it was exposed, rotate the session version too. Individual-device revocation is not implemented; the principal is the shared household.

For key rotation, distribute a public JWKS containing the new and old public keys first, switch the Next signing key, then remove the old public key after the intended token grace period. For emergency revocation also change the session version. Keep the old key material protected until rollback is no longer needed.

If rollout fails, keep maintenance enabled and fix or revert to a **protected** backend/frontend pair. Do not roll back to the anonymous Convex functions or unsigned-cookie gate. The added table/index may remain unused safely. Cleanup deletions are irreversible without a backup. Increasing retention does not itself backfill data. No live records or configuration were changed during local verification.

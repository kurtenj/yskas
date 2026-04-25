# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

<!-- convex-ai-start -->
This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read `convex/_generated/ai/guidelines.md` first** for important guidelines on how to correctly use Convex APIs and patterns. The file contains rules that override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running `npx convex ai-files install`.
<!-- convex-ai-end -->

## Commands

```bash
npm run dev      # Start Next.js dev server (run `npx convex dev` separately for backend)
npm run build    # Production build
npm run lint     # ESLint
```

There are no tests.

## Architecture

### Auth & User Identity

There is no traditional auth. Users are selected from a list on first visit (`/select`), optionally protected by a PIN (`/pin`). The selected user's Convex `Id<"users">` is stored in `localStorage` and surfaced app-wide via `UserContext` (`lib/user-context.tsx`). All data queries take `userId` as an explicit argument — there is no session on the server.

### AI Estimation

`/api/estimate` (Next.js Route Handler) calls OpenAI `gpt-4o-mini` with a meal description and returns structured nutrition data (`name`, `calories`, `protein`, `carbs`, `fat`). Requires `OPENAI_API_KEY` env var.

### Data Flow

The frontend calls Convex queries/mutations directly from React components using the Convex React client. `convex/meals.ts` and `convex/users.ts` contain all backend logic. Dates are stored as `YYYY-MM-DD` strings in local time — never use UTC date methods when constructing date keys.

### Data Retention

Meals older than 7 days are purged nightly by a Convex cron job (`convex/crons.ts`). The entire app is intentionally scoped to a 7-day window — the history page shows last 7 days, the meal suggestion index covers last 7 days, and no feature should rely on data beyond that.

### Meal Suggestions (Re-log)

The add page (`app/(app)/add/page.tsx`) loads the last 7 days of meals and deduplicates them by `name` (most recent entry wins). A Fuse.js index is built from this unique set and searched on each keystroke after 2 characters. Matching meals appear as "Log again" cards that set `estimate` state directly, bypassing the `/api/estimate` AI call entirely. The Fuse index is memoized separately from the search so it only rebuilds when meal data changes, not on every keystroke.

### Styling

Tailwind CSS v4 with a custom `mist` color palette (dark neutral, base color `#090b0c` = `mist-950`). Dark mode is the only mode. Theme color for PWA/browser chrome is `#090b0c`. Fonts: Geist (body, `--font-geist`) and Agdasima (display, `--font-agdasima`).

Do not use `theme()` in `globals.css` — Tailwind v4 silently drops rules that use it. Use hardcoded hex values or CSS custom properties (`var(--color-mist-*)`) instead.

### UI Components

Interactive elements use [Base UI](https://base-ui.com) (`@base-ui/react`). Use `Button`, `Field`, `Input`, `Field.Root`, `Field.Label` etc. from Base UI rather than plain HTML where possible. Base UI has no textarea component — use a plain `<textarea>` inside `Field.Root` for accessibility context. `Field.Control` is typed as `input` only and will cause type errors if used with a textarea.

`lib/utils.ts` exports `cn()` (clsx + tailwind-merge) for className composition.

### Voice Transcription

`/api/transcribe` (Next.js Route Handler) accepts a `multipart/form-data` POST with an `audio` field and calls the ElevenLabs `scribe_v1` speech-to-text model. Returns `{ transcript: string }`. Requires `ELEVENLABS_API_KEY` env var. The browser records with `MediaRecorder`, preferring `audio/webm` and falling back to `audio/mp4` for Safari.

### Animation

`motion/react` (the `motion` package) is installed. The add page uses a `ShimmerText` component (`app/(app)/add/shimmer-text.tsx`) for AI/transcription loading state. The inner `ShimmeringText` is sourced from the official ElevenLabs UI registry (`https://ui.elevenlabs.io/r/shimmering-text.json`) and uses `motion` `backgroundPosition` animation with CSS custom properties.

When using `ShimmeringText` inside a conditionally rendered subtree, always pass `startOnView={false}` — otherwise `useInView` returns `false` on mount and the animation never starts. The `ShimmerText` wrapper already does this.

The ElevenLabs UI CLI (`@elevenlabs/cli`) does not work on Windows (open issue #65 — it calls `which npx` internally). Workaround: use WSL or Git Bash, or copy the component JSON directly from `https://ui.elevenlabs.io/r/<component-name>.json`.

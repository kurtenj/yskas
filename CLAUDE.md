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

### Styling

Tailwind CSS v4 with a custom `mist` color palette (dark neutral, base color `#090b0c` = `mist-950`). Dark mode is the only mode. Theme color for PWA/browser chrome is `#090b0c`. Fonts: Geist (body, `--font-geist`) and Agdasima (display, `--font-agdasima`).

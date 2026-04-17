# Yskas

AI-powered calorie tracker. Log meals by description, get instant calorie estimates via OpenAI, and track daily intake against a personal goal.

## Stack

- **Next.js 16** (App Router)
- **Convex** — backend, database, real-time queries
- **OpenAI** — meal calorie estimation
- **Tailwind CSS v4** — dark-first design using `mist` color palette
- **Motion** — animations
- **Phosphor Icons** — icon set
- **Base UI** — headless UI primitives

## App Structure

```
app/
  (app)/          # Authenticated app shell
    page.tsx      # Dashboard — today's meals + calorie graph
    add/          # Log a new meal
    history/      # Past meals by date
    settings/     # User profile & calorie goal
  api/
    estimate/     # POST — OpenAI meal calorie estimation
    verify-pin/   # POST — PIN authentication
  pin/            # PIN entry screen
  select/         # User selection screen
```

## Data Model

**users** — `name`, `dailyCalorieGoal`

**meals** — `userId`, `name`, `description`, `calories`, `protein?`, `carbs?`, `fat?`, `date` (YYYY-MM-DD), `createdAt`

## PWA

Installable PWA with icons at 32×32 (favicon), 192×192, and 512×512. Theme color: `#090b0c`.

## Dev

```bash
npm run dev       # Next.js + Convex dev server
```

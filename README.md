# WP Command Center — Dashboard

The React frontend for **WP Command Center**: an AI-powered operations platform for teams running multiple WordPress marketing sites. It gives a single-pane view across 2–5 sites, surfacing what three backend agents — Watchdog, Optimizer, and Autopilot — find, and letting you trigger, configure, and review their work.

The backend this talks to lives in the sibling [`wp-command-center-api`](https://github.com/NiroshReddySL/wp-command-center-api) repo — the two are designed to run together locally, with this app proxying `/api/*` to the API server.

## Contents

- [What's in the dashboard](#whats-in-the-dashboard)
- [Tech stack](#tech-stack)
- [Getting started](#getting-started)
- [Scripts](#scripts)
- [Project structure](#project-structure)
- [Design system](#design-system)
- [Testing](#testing)
- [Related repos](#related-repos)

## What's in the dashboard

- **Dashboard** — cross-site health overview: active alerts, agent status, quick trends
- **Watchdog** — broken links, plugin vulnerabilities, performance regressions, config drift, per site
- **Optimizer** — Content Health (per-page scoring with advanced sort/filter by health status, content type, and 8 specific issue categories), SEO opportunities, internal linking suggestions
- **Autopilot** — content repurposing suggestions, A/B test tracking, automated report history
- **Traffic** — GA4 + Search Console trends and AI-generated forecasts
- **Live Visitors** — real-time and historical GA4 active-user tracking for a curated URL list, with CSV import and day-wise export
- **Flow Categories** — define ordered page-pattern journeys (e.g. "Pricing → Signup") and track GA4 funnel conversion against them, with drop-rate alerts
- **Settings** — connected sites, per-agent schedule toggles, notification channels (email/Teams), user management

Every page is built against real backend data via typed React Query hooks — there's no mock-data mode, so the API must be running (see that repo's README) for the app to be useful beyond the login screen.

## Tech stack

React 18 · TypeScript · Vite · TailwindCSS · React Router v6 · TanStack Query · Recharts · Lucide React · Framer Motion

## Getting started

**Prerequisites:** Node.js 18+, and a running [`wp-command-center-api`](https://github.com/NiroshReddySL/wp-command-center-api) instance (defaults to `http://localhost:8000`).

```bash
npm install
npm run dev       # Vite dev server on http://localhost:5173
```

`vite.config.ts` proxies `/api/*` requests to `http://localhost:8000` in dev, so no `.env` is required to get started locally as long as the API is running on its default port. Log in with the admin credentials configured in the API's `.env` (`ADMIN_EMAIL` / `ADMIN_PASSWORD`).

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | start the Vite dev server |
| `npm run build` | typecheck + production build |
| `npm run lint` | ESLint |
| `npm test` | Vitest + React Testing Library |

## Project structure

```
src/
├── pages/           # one file per route (Dashboard, Watchdog, Optimizer, Autopilot, Traffic, Flows, Settings, ...)
├── components/
│   ├── ui/           # design-system primitives — Card, Button, Table, Skeleton, Badge, ...
│   ├── domain/        # feature-specific components (AlertCard, ContentHealthTable, FunnelBar, ...)
│   └── layout/        # AppLayout, Sidebar, TopBar — the app shell
├── hooks/            # React Query hooks — ALL data fetching goes through these, never fetch() in a component
├── lib/              # API client (with the axios params serializer), auth, formatting utilities
├── contexts/         # site-selection and other cross-page context providers
└── constants.ts      # enums and user-facing string constants
```

## Design system

The visual language (Linear/Vercel/Raycast-inspired, not a generic admin panel) is defined in `tailwind.config.ts` and `src/styles/globals.css` — brand colors, spacing, and dark-mode variables all live there rather than being hardcoded in components. See [`CLAUDE.md`](./CLAUDE.md) for the full token table and UI conventions (skeleton loaders instead of spinners, card treatment, number formatting rules, etc.) if you're contributing.

## Testing

Component tests with Vitest + React Testing Library, colocated with the code they test (`*.test.ts` / `*.test.tsx`).

```bash
npm test
```

## Related repos

- [`wp-command-center-api`](https://github.com/NiroshReddySL/wp-command-center-api) — the FastAPI backend this dashboard talks to

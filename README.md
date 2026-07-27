# WP Command Center — Dashboard

React frontend for **WP Command Center**, an AI-powered WordPress multi-site operations platform. This is the UI half of a two-repo split — the backend API lives in the sibling [`wp-command-center-api`](https://github.com/) repo.

## Tech Stack

React 18 + TypeScript + Vite + TailwindCSS + React Router v6 + TanStack Query + Recharts + Lucide React + Framer Motion

## Getting Started

```bash
npm install
npm run dev       # starts the Vite dev server on http://localhost:5173
```

The dev server proxies `/api/*` requests to `http://localhost:8000`, so a `wp-command-center-api` instance must be running locally alongside this app (see that repo's README).

## Scripts

- `npm run dev` — start the dev server
- `npm run build` — typecheck + production build
- `npm run lint` — ESLint
- `npm test` — Vitest

## Project Structure

- `src/pages/` — one file per route
- `src/components/ui/` — design-system primitives (Card, Button, Table, ...)
- `src/components/domain/` — feature-specific components
- `src/hooks/` — all data fetching goes through React Query hooks here; no fetch calls directly in components
- `src/lib/` — API client, auth, formatting utilities
- `src/contexts/` — React context providers (site selection, etc.)

See `CLAUDE.md` for detailed conventions (brand tokens, design north stars, common pitfalls).

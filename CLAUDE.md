# CLAUDE.md — WP Command Center Dashboard

## What is this project?
The React frontend for WP Command Center, an AI-powered WordPress multi-site operations platform. It talks to the `wp-command-center-api` backend (a sibling repo, run separately) via `/api/*`, proxied to `http://localhost:8000` in dev. The user is a senior software engineer on a marketing team.

## Tech Stack
React 18 + TypeScript + Vite + TailwindCSS + React Router v6 + TanStack Query + Recharts + Lucide React + Framer Motion

## Brand Colors
| Token | Hex | Usage |
|-------|-----|-------|
| Primary | #0129AC | Actions, nav active, key headings |
| Secondary | #809EFC | Hover, secondary buttons, charts |
| Surface | #E1ECFF | Card highlights, selected states |
| Text Primary | #2E2E2E | Body text, headings |
| Text Muted | #707070 | Labels, timestamps, captions |
| Background | #FAFBFE | Page background |
| Border | #E2E8F0 | Card borders, dividers |
| Success | #059669 | Healthy, positive |
| Warning | #D97706 | Degraded, attention |
| Danger | #DC2626 | Critical, errors |

## Design North Stars
- Looks like Linear/Vercel/Raycast — not a generic admin panel
- Whitespace is a feature, not wasted space
- Information density through hierarchy, never clutter
- Every card has 1px border, 12px radius, card shadow, 24px padding
- Skeleton loaders, never spinners
- Dark mode works perfectly from day one
- Subtle Framer Motion transitions (200ms, ease-out)

## Architecture Decisions
- All data fetching goes through custom hooks in `src/hooks/`
- No fetch calls directly in components
- UI primitives in `components/ui/` — domain-specific in `components/domain/`
- One file per component, max 120 lines
- cn() utility = clsx + tailwind-merge for conditional classes

## Commands
- `npm run dev` — start the dev server (proxies `/api` to `http://localhost:8000`)
- `npm run build` — typecheck + production build
- `npm run lint` — ESLint
- `npm test` — Vitest

## Key Files to Understand First
1. `tailwind.config.ts` — the brand theme source of truth
2. `src/styles/globals.css` — CSS variables, dark mode
3. `src/components/ui/` — all design primitives
4. `src/components/layout/AppLayout.tsx` — the main shell
5. `src/pages/Dashboard.tsx` — the hero page

## When Making UI Changes
1. Always check `tailwind.config.ts` for existing design tokens — don't hardcode colors
2. Use the `cn()` utility for all conditional classnames
3. Use `<Skeleton />` for loading states, never spinner divs
4. Cards always get: `bg-white dark:bg-card-dark border border-border rounded-xl p-6 shadow-card`
5. Check dark mode by toggling — if something is invisible, you forgot `dark:` variants
6. Numbers displayed to users must always be formatted (commas for thousands, 1 decimal for %)
7. Tables use the `<Table>` component — don't build raw HTML tables

## Testing Conventions
- Component tests with Vitest + React Testing Library
- Test files live next to the code they test (*.test.ts / *.test.tsx)

## Common Pitfalls
- Don't use `any` type — always define interfaces
- Don't import from `../../../` — use `@/` path alias configured in vite and tsconfig
- Don't put business logic in components — extract to hooks or utils
- Don't create components over 120 lines — split them
- Don't forget `key` props on mapped elements
- Don't use inline styles — everything goes through Tailwind
- Don't hardcode strings — use constants.ts for enums and labels

## Related Repos
- `wp-command-center-api` — the FastAPI backend this dashboard talks to

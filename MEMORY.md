# MEMORY.md — Task by Task
Cross-session project memory. Max ~50 lines: summarize or prune outdated info that no longer adds value.
*Note for AI Agent: The sections below are an initial baseline; feel free to add, merge, or remove sections as the project evolves.*

## Current State
- v0.0.0: bare Vite + React + TS scaffold (`src/` has only `App.tsx`, `main.tsx`, `index.css`). No feature code yet.
- Requirements done: SRS and SVD v1.0 (13/10/2026) in `docs/`, in Spanish. `docs/constitution.md` and `AGENTS.md` defined. No specs in `docs/specs/` yet.
- Installed: React 19.2, Vite 8, TS 6, ESLint 10, React Compiler. Not installed yet: TanStack Router, Zustand, RHF, Zod, Bootstrap/react-bootstrap, Vitest/RTL, Playwright.
- Scripts present: `dev`, `build`, `lint`, `preview`. Missing: `typecheck`, `test`, `e2e`.
- Persistence: none yet. MVP will use `localStorage` (`tbt:v1:*`) behind repositories; backend lives in a separate future repo.

## Learnings & Pitfalls to Avoid
- Browser notifications are best-effort (no guarantee on iOS without home-screen install or with browser closed); every alert must also land in the notification center.
- Verify that `tsc -b --noEmit` works with the Vite `tsconfig.*` setup when adding the `typecheck` script.
- (Add new learnings here.)

## Decisions (and Why)
- Frontend-only MVP on `localStorage` behind repository interfaces: backend is a separate repo, so swapping to an API must not touch features.
- TanStack Router from the start: typed routes and search params (useful for filters) and no router migration later (RNF-20).
- Feature-based folders (`src/features/*`, `src/shared`, `src/data`): isolates domains and eases adding shared groups later.
- Zustand + React Hook Form + Zod: Zod is the single source of SRS Appendix B limits and validates `localStorage` reads.
- Bootstrap 5.3 + react-bootstrap for the MVP: Mobile-First and fast. Tailwind + shadcn/ui or Mantine are candidates later.
- `tests/` at repo root, outside `src/`: keeps tests out of the production `tsc -b` build.
- Group = `creatorId` + `members[]`, task has optional `assigneeId`: MVP stays compatible with shared groups (RNF-20).
- `src/features/tasks/` is the first feature and becomes the golden reference.

## Next Steps
- Ask owner, then install missing dependencies and add `typecheck`, `test`, `e2e` scripts; set up Vitest + RTL and the `tests/` layout.
- Create `docs/specs/001-tasks/` (`spec.md` -> `plan.md` -> `tasks.md`) from RF-12 to RF-16 and implement it as the golden reference.
- Define the simulated auth approach (password hashing, session, recovery codes; RF-01 to RF-03) before the auth spec.

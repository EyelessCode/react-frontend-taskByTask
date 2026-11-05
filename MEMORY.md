# MEMORY.md — Task by Task
Cross-session project memory. Max ~50 lines: summarize or prune outdated info that no longer adds value.
*Note for AI Agent: The sections below are an initial baseline; feel free to add, merge, or remove sections as the project evolves.*

## Current State
- `000-foundation` & `001-tasks` (Golden Reference) fully implemented & verified. Spec status: `implemented`.
- Installed: React 19.2, Vite 8, TS 6, ESLint 10, React Compiler, TanStack Router, Zustand, RHF, Zod, Bootstrap/react-bootstrap, Vitest/RTL, Playwright.
- Scripts active: `dev`, `build`, `lint`, `preview`, `typecheck`, `test`, `test:watch`, `e2e`.
- Verification stats: 193 Vitest unit/integration tests (17 files) + 3 Playwright E2E tests passing; 0 TS/ESLint errors; production build clean.
- Tasks feature delivered: `TaskRepository`, `tasks-store`, deterministic sorting (`compareTasks`), RHF+Zod modals (`TaskFormModal`, `TaskMoveCopyModal`, `TaskDeleteConfirmModal`, `TaskTagRemovalModal`, `TaskTagInput`), `TaskCard`, `TaskList`, `TaskFilterTabs`, `TasksView`.

## Learnings & Pitfalls to Avoid
- Browser notifications are best-effort (no guarantee on iOS without home-screen install or with browser closed); every alert must also land in the notification center.
- Verified: `tsc -b --noEmit` works cleanly with Vite solution tsconfig setup (`tsconfig.app.json`, `tsconfig.node.json`, `tsconfig.test.json`). In TS 6+, omit deprecated `baseUrl` when configuring `paths` under `bundler` resolution.
- TypeScript `erasableSyntaxOnly` mode forbids constructor parameter properties (`constructor(public readonly x: string)`); declare class fields explicitly.
- Playwright: `toBeVisible()` fails on `<option>` text inside `<select>` since options are hidden until opened. Also, `locator.check()` asserts the checkbox remains checked; if state change unmounts the item (e.g. filtered list), use `locator.click()`.

## Decisions (and Why)
- Frontend-only MVP on `localStorage` behind repository interfaces: backend is a separate repo, so swapping to an API must not touch features.
- TanStack Router from the start: typed routes and search params (useful for filters) and no router migration later (RNF-20).
- Feature-based folders (`src/features/*`, `src/shared`, `src/data`): isolates domains and eases adding shared groups later.
- Zustand + React Hook Form + Zod: Zod is the single source of SRS Appendix B limits and validates `localStorage` reads.
- Bootstrap 5.3 + react-bootstrap for the MVP: Mobile-First and fast. Tailwind + shadcn/ui or Mantine are candidates later.
- `tests/` at repo root, outside `src/`: keeps tests out of the production `tsc -b` build.
- Group = `creatorId` + `members[]`, task has optional `assigneeId`: MVP stays compatible with shared groups (RNF-20).
- `src/features/tasks/` is the golden reference for subsequent feature implementations.

## Next Steps
- Implement `002-groups` (Group creation, renaming, deletion with task cascade, seed group rules RF-07 to RF-11).
- Implement `003-tags` (Tag management, auto-cleanup RF-21 to RF-24).
- Define the simulated auth approach (password hashing, session, recovery codes; RF-01 to RF-03) before the auth spec.

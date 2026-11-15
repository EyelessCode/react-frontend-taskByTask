# MEMORY.md — Task by Task
Cross-session project memory. Max ~50 lines: summarize or prune outdated info that no longer adds value.
*Note for AI Agent: The sections below are an initial baseline; feel free to add, merge, or remove sections as the project evolves.*

## Current State
- `000-foundation`, `001-tasks` (Golden Reference), `002-groups`, and `003-tags` fully implemented & verified. Spec statuses: `implemented`.
- Installed: React 19.2, Vite 8, TS 6, ESLint 10, React Compiler, TanStack Router, Zustand, RHF, Zod, Bootstrap/react-bootstrap, Vitest/RTL, Playwright.
- Scripts active: `dev`, `build`, `lint`, `preview`, `typecheck`, `test`, `test:watch`, `e2e`.
- Verification stats: 311 Vitest unit/integration tests (28 files) + 5 Playwright E2E tests passing; 0 TS/ESLint errors/warnings; production build clean.
- Tags feature delivered: `src/shared/i18n/es.ts` (`es.tags` + accessibility/UI-06 copy), `src/features/tags/` (`tag-operations.ts`, `useTagInput`, `TaskTagInput` with inline editing & composite blur, `TaskTagRemovalModal`), multi-group `allTags` hydration in `useTasksStore`, non-destructive `useTaskForm`, and full `TaskCard`/`TaskFormModal`/`GroupsGridView` integration.

## Learnings & Pitfalls to Avoid
- Browser notifications are best-effort (no guarantee on iOS without home-screen install or with browser closed); every alert must also land in the notification center.
- Verified: `tsc -b --noEmit` works cleanly with Vite solution tsconfig setup (`tsconfig.app.json`, `tsconfig.node.json`, `tsconfig.test.json`). In TS 6+, omit deprecated `baseUrl` when configuring `paths` under `bundler` resolution.
- TypeScript `erasableSyntaxOnly` mode forbids constructor parameter properties (`constructor(public readonly x: string)`); declare class fields explicitly.
- Playwright: `toBeVisible()` fails on `<option>` text inside `<select>` since options are hidden until opened. Also, `locator.check()` asserts the checkbox remains checked; if state change unmounts the item (e.g. filtered list), use `locator.click()`.
- React Hook Form + React Compiler: prefer `useWatch({ control: form.control, name })` over `form.watch(name)` so React Compiler does not memoize away reactive field updates in production builds. Also do not depend on store arrays in edit-mode reset effects (`lastResetKeyRef` prevents background updates from wiping user input).

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
- Define the simulated auth approach (password hashing, session, recovery codes; RF-01 to RF-03) before the `004-auth` spec.
- Implement `005-notifications` (Browser notifications + notification center; RF-25 to RF-27).
# MEMORY.md — Task by Task
Cross-session project memory. Max ~50 lines: summarize or prune outdated info that no longer adds value.

## Current State
- `000-foundation`, `001-tasks` (Golden Reference), `002-groups`, `003-tags`, and `004-auth` fully implemented & verified. Spec statuses: `implemented`.
- Installed: React 19.2, Vite 8, TS 6, ESLint 10, React Compiler, TanStack Router, Zustand, RHF, Zod, Bootstrap/react-bootstrap, Vitest/RTL, Playwright.
- Scripts active: `dev`, `build`, `lint`, `preview`, `typecheck`, `test`, `test:watch`, `e2e`.
- Verification stats: 371 Vitest unit/integration tests (37 files) + 8 Playwright E2E tests passing; 0 TS/ESLint errors/warnings; production build clean.
- Auth feature delivered (`004-auth`): WebCrypto PBKDF2-SHA-256 hashing (`100k` iterations + 16-byte salt), 8 single-use one-time recovery codes, `tbt:v1:login_lockouts` 5-attempt/5-min cooldown, 7-day sessions with mid-session expiry/orphan checks & `subscribeAuthSessionEnd` teardown hook, per-user Personal provisioning & workspace isolation, `12h`/`24h` time capture (`to12HourParts`/`from12HourParts`) & display propagation, TanStack Router `beforeLoad` guards (`/`, `/profile`, `/login`, `/register`, `/recover`, `$` catch-all), and cascade account deletion.

## Learnings & Pitfalls to Avoid
- Browser notifications are best-effort (no guarantee on iOS without home-screen install or with browser closed); every alert must also land in the notification center.
- `tsc -b --noEmit` with TS 6+: omit deprecated `baseUrl` when configuring `paths` under `bundler` resolution. `erasableSyntaxOnly` forbids constructor parameter properties (`public readonly`).
- Windows case-insensitive imports: importing `./app` from `src/App.tsx` collides with `src/App.tsx`; import `./app/router` explicitly.
- ESLint `react-refresh/only-export-components`: keep route components in `src/app/route-components.tsx` separate from non-component exports in `src/app/router.tsx`.
- Playwright: `toBeVisible()` fails on `<option>` inside `<select>`; use `locator.click()` instead of `check()` if state change unmounts the item.
- React Hook Form + React Compiler: prefer `useWatch` over `form.watch`, use `<Controller>` for `<Form.Select>` (`ProfilePage` `timeFormat`) to avoid stale uncontrolled refs, and stabilize `reset` deps (`resetProfileForm` / `lastResetKeyRef`).

## Decisions (and Why)
- Frontend-only MVP on `localStorage` behind repository interfaces: backend is a separate repo, so swapping to an API must not touch features.
- TanStack Router code-based router (`createAppRouter(history?)`): supports `beforeLoad` auth guards and `createMemoryHistory` integration tests cleanly.
- Feature-based folders (`src/features/*`, `src/shared`, `src/data`): isolates domains (`src/features/tasks/` is golden reference).
- `subscribeAuthSessionEnd` event hook in `useAuthStore`: decouples `004-auth` session teardown (logout, expiry, orphan, account deletion) from `005-notifications` cleanup.
- Group = `creatorId` + `members[]`, task has optional `assigneeId`: MVP stays compatible with shared groups (RNF-20).

## Next Steps
- Implement `005-notifications` (Browser notifications + notification center + `subscribeAuthSessionEnd` cleanup; RF-25 to RF-27).

# MEMORY.md — Task by Task
Cross-session project memory. Max ~50 lines: summarize or prune outdated info that no longer adds value.

## Current State
- Complete frontend MVP (`000-foundation`, `001-tasks` Golden Reference, `002-groups`, `003-tags`, `004-auth`, `005-notifications`) fully implemented & verified. All spec statuses: `implemented`.
- Installed: React 19.2, Vite 8, TS 6, ESLint 10, React Compiler, TanStack Router, Zustand, RHF, Zod, Bootstrap/react-bootstrap, Vitest/RTL, Playwright.
- Scripts active: `dev`, `build`, `lint`, `preview`, `typecheck`, `test`, `test:watch`, `e2e`.
- Verification stats: 420 Vitest unit/integration tests (42 files) + 10 Playwright E2E tests passing; 0 TS/ESLint errors/warnings; production build clean.
- Notifications feature delivered (`005-notifications`): per-user 8-hour browser permission reminder cooldown & `'notified' | 'suppressed'` occurrence deduplication under `tbt:v1:notification_state`, pure timezone due-alert scheduler (`dueTime` vs `09:00` date-only, today post-`09:00` immediate trigger, past-created suppression, missed `< 30d` catch-up, `MAX_SAFE_TIMEOUT_MS` recursive timers), best-effort `BrowserNotificationAdapter` + guaranteed Notification Center persistence, 30-day automatic pruning, `subscribeAuthSessionEnd` timer teardown, cross-store lifecycle hooks (`useAuthStore`, `useTasksStore`, `useGroupsStore`), and responsive `<NotificationCenterButton />`, `<NotificationPermissionBanner />`, `<NotificationCenterPanel />` (`Modal fullscreen="sm-down"`).

## Learnings & Pitfalls to Avoid
- Browser notifications are best-effort (no guarantee on iOS without home-screen install or with browser closed); every alert must also land in the Notification Center first.
- `tsc -b --noEmit` with TS 6+: omit deprecated `baseUrl` when configuring `paths` under `bundler` resolution. `erasableSyntaxOnly` forbids constructor parameter properties (`public readonly`).
- Windows case-insensitive imports: importing `./app` from `src/App.tsx` collides with `src/App.tsx`; import `./app/router` explicitly.
- ESLint `react-refresh/only-export-components`: keep route components in `src/app/route-components.tsx` separate from non-component exports in `src/app/router.tsx`.
- Playwright: `toBeVisible()` fails on `<option>` inside `<select>`; use `locator.click()` instead of `check()` if state change unmounts the item; persist mock `Notification` overrides in `localStorage` if a test runs `page.reload()` after `addInitScript`.
- React Hook Form + React Compiler: prefer `useWatch` over `form.watch`, use `<Controller>` for `<Form.Select>` (`ProfilePage` `timeFormat`) to avoid stale uncontrolled refs, and stabilize `reset` deps (`resetProfileForm` / `lastResetKeyRef`).

## Decisions (and Why)
- Frontend-only MVP on `localStorage` behind repository interfaces: backend is a separate repo, so swapping to an API must not touch features.
- TanStack Router code-based router (`createAppRouter(history?)`): supports `beforeLoad` auth guards and `createMemoryHistory` integration tests cleanly.
- Additive `tbt:v1:notification_state` key with `'notified' | 'suppressed'` markers: keeps `tbt:v1:notifications` purely user-facing, suppresses past-created task spam across reloads, and prevents deleted Notification Center items from resurrecting on reload.
- `subscribeAuthSessionEnd` event hook in `useAuthStore`: decouples session teardown (logout, expiry, orphan, account deletion) so `useNotificationsStore` immediately cancels active timers.
- Group = `creatorId` + `members[]`, task has optional `assigneeId`: MVP stays compatible with shared groups (RNF-20).

## Next Steps
- All frontend MVP specifications (`000`–`005`) are complete. Future milestones: backend API repository adapter swap or `Posterior` features (pre-due reminders `RF-20`, shared groups & collaborative notifications `RF-08`–`RF-10` / `RF-30`).

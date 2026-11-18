# Task Checklist: `005-notifications` (Browser Notifications & In-App Notification Center)

- **Feature Name:** `005-notifications`
- **Spec Reference:** [docs/specs/005-notifications/spec.md](./spec.md) (`Status: approved`)
- **Plan Reference:** [docs/specs/005-notifications/plan.md](./plan.md) (`Status: approved`)

---

## Task List

- [x] **T1: Spanish Notification Localization, Notification State Schema & Storage Key (`RNF-14`, `RNF-19`)**
  - **Associated Requirements:** `REQ-NT-02`, `REQ-NT-03`, `REQ-NT-04`, `REQ-NT-05`, `REQ-NT-13`, `REQ-NT-14`, `REQ-NT-18`, Section 4.1, Section 4.3
  - **Files Touched:**
    - `tests/unit/shared/i18n/es.test.ts` (modified — assertions for `NotificationsLocalization` & every `es.notifications` key and template)
    - `tests/unit/shared/schemas/limits.test.ts` (modified — assertions for `handledDueOccurrenceSchema`, `userNotificationStateSchema`, and `LIMITS.NOTIFICATION_RETENTION_DAYS === 30`)
    - `src/shared/i18n/es.ts` (modified — add `NotificationsLocalization` interface and `es.notifications` dictionary entries per `spec.md` Section 4.3)
    - `src/shared/schemas/notification.ts` (modified — add `handledDueOccurrenceSchema`, `HandledDueOccurrence`, `userNotificationStateSchema`, `UserNotificationState`)
    - `src/data/storage/keys.ts` (modified — add additive `NOTIFICATION_STATE: 'tbt:v1:notification_state'`)
  - **TDD Test First:** Add failing unit tests in `es.test.ts` and `limits.test.ts` verifying every `es.notifications` key/interpolation and Zod rejection/defaults on `userNotificationStateSchema` before modifying implementation files.
  - **Done when:** `es.notifications` compiles under `LocalizationDictionary`, schemas validate cleanly, and unit tests + typecheck + lint pass.
  - **Verification Command:** `npm test && npm run typecheck && npm run lint`

- [x] **T2: Timezone Date/Time Formatting Helpers (`UI-07`, `RNF-14`, `RF-28`)**
  - **Associated Requirements:** `REQ-NT-07`, `REQ-NT-11`, `REQ-NT-14(2)`, `REQ-NT-18`
  - **Files Touched:**
    - `tests/unit/shared/utils/date-time.test.ts` (modified — unit tests for `getZonedCalendarDate`, `isPastLocalNineAm`, and `formatZonedDateTime` across `America/Bogota`, `UTC`, DST boundaries, `'24h'`, and `'12h'`)
    - `src/shared/utils/date-time.ts` (modified — export `getZonedCalendarDate`, `isPastLocalNineAm`, and `formatZonedDateTime` reusing internal `getTzParts`)
  - **TDD Test First:** Write failing tests covering cross-midnight IANA day rollovers (`UTC` vs `America/Bogota`), exact `08:59:59` vs `09:00:00` local cutoff, and `'24h'`/`'12h'` formatting (`dd/mm/aaaa, HH:mm` vs `dd/mm/aaaa, hh:mm a. m./p. m.`) before implementing helpers.
  - **Done when:** All new and existing `date-time.test.ts` cases pass with zero type or lint errors.
  - **Verification Command:** `npm test && npm run typecheck && npm run lint`

- [x] **T3: Notification & Device Notification State Repositories (`RF-27`, `RF-29`, `RNF-07`, `RNF-10`, `Appendix B`)**
  - **Associated Requirements:** `REQ-NT-02`, `REQ-NT-10`, `REQ-NT-12`, `REQ-NT-13`, `REQ-NT-15`, `REQ-NT-16`, `REQ-NT-17`
  - **Files Touched:**
    - `tests/unit/data/local-storage-notification-repositories.test.ts` (created — unit tests for `save`, newest-first ordering, `markAsRead`, `markAllAsRead`, `delete`, `pruneExpired` `< 30` days vs `>= 30` days, strict `userId` isolation on `LocalStorageNotificationRepository`, plus `getByUserId`, `save`, `deleteByUserId`, and Zod validation on `LocalStorageNotificationStateRepository`)
    - `src/data/contracts/notification-repository.ts` (modified — add `save`, `markAsRead`, `markAllAsRead`, `delete`, `pruneExpired`)
    - `src/data/contracts/notification-state-repository.ts` (created — `NotificationStateRepository` interface)
    - `src/data/contracts/index.ts` (modified — export `notification-state-repository`)
    - `src/data/repositories/local-storage-notification-repository.ts` (modified — implement extended methods using explicit `private readonly storageAdapter`, strict Zod parsing, and `LIMITS.NOTIFICATION_RETENTION_DAYS`)
    - `src/data/repositories/local-storage-notification-state-repository.ts` (created — implement `NotificationStateRepository` under `STORAGE_KEYS.NOTIFICATION_STATE`)
    - `src/data/repositories/index.ts` (modified — export `local-storage-notification-state-repository`)
  - **TDD Test First:** Write failing unit tests in `local-storage-notification-repositories.test.ts` verifying per-user isolation, exact 30-day pruning boundary, mark-all-read scoping, and state repository CRUD before implementing repositories.
  - **Done when:** New notification repository tests and existing `local-storage-auth-repositories.test.ts` pass cleanly.
  - **Verification Command:** `npm test && npm run typecheck && npm run lint`

- [x] **T4: Pure Browser Notification Adapter, 8-Hour Cooldown & Due-Alert Scheduler (`RF-27`, `RF-28`, `RNF-03`, `RNF-18`, `RNF-20`)**
  - **Associated Requirements:** `REQ-NT-01`..`REQ-NT-11`, Section 4.2
  - **Files Touched:**
    - `tests/unit/features/notifications/permission-cooldown.test.ts` (created — tests for `isPermissionBannerDue` at `< 8h` / `=== 8h` / `> 8h` / `null` / corrupted ISO, `'granted'` / `'unsupported'` omission, and `BrowserNotificationAdapter` error handling)
    - `tests/unit/features/notifications/due-alert-scheduler.test.ts` (created — tests for exact `dueTime` vs `09:00:00` date-only in `user.timeZone`, undated exclusion, today post-09:00 immediate trigger on `save`, past-created `suppress` vs missed `< 30d` catch-up on `sync` vs `>= 30d` expiration, `uncheck` future reschedule vs past suppression, `handledOccurrences` dedupe, `assigneeId` eligibility `RNF-20`, `formatDueAlertContent` in `24h`/`12h`, and `scheduleCappedTimeout` chaining across `> 2^31 - 1` ms delays)
    - `src/features/notifications/utils/{notification-constants.ts,browser-notifications.ts,permission-cooldown.ts,due-alert-scheduler.ts,index.ts}` (created)
  - **TDD Test First:** Write failing unit tests with fake timers and deterministic injected clocks (`now`) covering every row of `spec.md` Section 4.2 and multi-week `> 24.85` day timer capping before implementing utilities.
  - **Done when:** All scheduler, cooldown, capped timer, and browser adapter unit tests pass with zero warnings.
  - **Verification Command:** `npm test && npm run typecheck && npm run lint`

- [x] **T5: Notifications Zustand Store (`useNotificationsStore`), Hook & Session Teardown (`RF-02`, `RF-27`–`RF-29`)**
  - **Associated Requirements:** `REQ-NT-01`..`REQ-NT-17`
  - **Files Touched:**
    - `tests/unit/features/notifications/notifications-store.test.ts` (created — full store tests: `init` permission inspection & 8h per-`userId` banner, `openCenter` 30-day pruning, `requestPermission` & `dismissPermissionBanner` cooldown preservation, catch-up & reload dedupe, `handleTaskSaved` / `handleTaskToggled` / `handleTaskDeleted` / `handleTasksDeleted`, non-schedule edit title update without refire, best-effort native popup dispatch catching throws, `markAsRead` / `markAllAsRead` / `deleteNotification`, multi-user isolation, and `subscribeAuthSessionEnd` immediate timer cancellation for `'logout'` / `'expired'` / `'orphan'` / `'deleted'`)
    - `src/features/notifications/store/{notifications-store.ts,index.ts}` (created — serialized state queue, module-level `Map<string, () => void>` timer registry, `configureNotificationsStore`, `resetNotificationsStore`, `subscribeAuthSessionEnd` teardown)
    - `src/features/notifications/hooks/{use-notifications.ts,index.ts}` (created)
  - **TDD Test First:** Write failing store unit tests covering the entire notification lifecycle with fake timers (`vi.useFakeTimers()`) and mock browser `Notification` adapter before implementing the store.
  - **Done when:** `notifications-store.test.ts` passes cleanly and active timers never leak after `clearActiveRuntime()` / `resetNotificationsStore()`.
  - **Verification Command:** `npm test && npm run typecheck && npm run lint`

- [x] **T6: Cross-Feature Store Lifecycle Wiring (`useAuthStore`, `useTasksStore`, `useGroupsStore`) (`RF-05`, `RF-07`, `RF-13`, `RF-14`, `RF-16`, `RF-28`)**
  - **Associated Requirements:** `REQ-NT-09`, `REQ-NT-12`, `REQ-NT-17`, `REQ-AU-19`
  - **Files Touched:**
    - `tests/unit/features/auth/auth-store.test.ts` (modified — assert `deleteAccount` deletes `tbt:v1:notification_state` for deleted user while preserving other users' state)
    - `tests/unit/features/tasks/tasks-store.test.ts` (modified — assert `createTask`, `updateTask`, `toggleTaskComplete`, `copyTask`, and `deleteTask` invoke injectable notification lifecycle hooks accurately while preserving existing tests)
    - `tests/unit/features/groups/groups-store.test.ts` (modified — assert `deleteGroup` passes deleted group task IDs to `onTasksDeleted` before removal)
    - `src/features/auth/store/auth-store.ts` (modified — add `notificationStateRepository` dependency & cascade deletion in `deleteAccount`)
    - `src/features/tasks/store/tasks-store.ts` (modified — add `notificationHooks` dependency & invoke across create/update/toggle/copy/delete)
    - `src/features/groups/store/groups-store.ts` (modified — capture group task IDs prior to task deletion and invoke `onTasksDeleted` in `deleteGroup`)
  - **TDD Test First:** Add failing unit assertions in `auth-store.test.ts`, `tasks-store.test.ts`, and `groups-store.test.ts` before adding cross-store hooks.
  - **Done when:** All unit tests for auth, tasks, groups, and notifications pass cleanly together.
  - **Verification Command:** `npm test && npm run typecheck && npm run lint`

- [x] **T7: Notification UI Components & Workspace Header Integration (`RF-27`, `RF-29`, `UI-01`, `UI-07`, `RNF-12`, `RNF-14`)**
  - **Associated Requirements:** `REQ-NT-01`..`REQ-NT-05`, `REQ-NT-13`..`REQ-NT-18`
  - **Files Touched:**
    - `tests/integration/features/notifications/notifications-flow.test.tsx` (created — RTL + `MockStorage` integration tests inside `GroupsGridView`: header unread badge & accessible label, banner `'default'` -> `"Ahora no"` 8h cooldown -> second user independent cooldown, `'denied'` guidance on both banner & panel, `"Activar avisos"` grant transition, `"Marcar como leída"`, `"Marcar todas como leídas"` disabled when `unreadCount === 0`, individual `"Eliminar"`, `'Sin leer'` non-color badge, `'12h'`/`'24h'` + `dd/mm/aaaa` formatting in `user.timeZone`, 30-day pruning on open, `Escape` panel close, task create/edit/complete/uncheck/delete & group delete integration, and unsupported browser graceful degradation)
    - `src/features/notifications/components/{NotificationCenterButton.tsx,NotificationPermissionBanner.tsx,NotificationCenterPanel.tsx,index.ts}` (created)
    - `src/features/notifications/index.ts` (modified — public feature exports)
    - `src/features/groups/components/GroupsGridView.tsx` (modified — integrate `useNotifications`, render `<NotificationCenterButton />` inside `<nav aria-label="Cuenta">`, `<NotificationPermissionBanner />`, and `<NotificationCenterPanel />`, call `refresh()` on workspace refresh)
    - `src/features/tasks/components/TasksView.tsx` (modified — render `<NotificationCenterButton />`, `<NotificationPermissionBanner />`, and `<NotificationCenterPanel />` symmetrically when authenticated)
  - **TDD Test First:** Author `notifications-flow.test.tsx` integration scenarios covering banner, Notification Center interactions, permissions, `24h`/`12h`, pruning, and task/group mutations before finalizing components and wiring views.
  - **Done when:** All existing and new RTL unit/integration tests pass with zero warnings or console errors.
  - **Verification Command:** `npm test && npm run typecheck && npm run lint`

- [ ] **T8: Playwright End-to-End Tests (`AC-NT-01`..`AC-NT-10`)**
  - **Associated Requirements:** `AC-NT-01`..`AC-NT-10`, `UI-01`, `RNF-12`, `RNF-14`, `RNF-15`
  - **Files Touched:**
    - `tests/e2e/notifications.spec.ts` (created — comprehensive Playwright E2E suite testing `'default'` banner & 8-hour per-user cooldown across reload, `'denied'` instructions in banner & panel, `"Activar avisos"` permission grant + best-effort native notification trigger, date-only today `>= 09:00` immediate trigger & exact timed trigger & no-spam past creation across reload, task edit/complete/uncheck/delete & group delete cancellation, reload deduplication, logout cessation, Notification Center unread badge + `"Marcar como leída"` + `"Marcar todas como leídas"` + `"Eliminar"` + `12h` format + 30-day retention pruning + account deletion cleanup, verified at desktop `1280x720` and mobile `375x812` with zero console/page errors)
    - Existing `tests/e2e/{smoke,auth,tasks,groups,tags}.spec.ts` (verified unmodified or adjusted strictly if needed — expected zero regressions)
  - **TDD Test First:** Write `tests/e2e/notifications.spec.ts` against `AC-NT-01`..`AC-NT-10`, run full Playwright suite, and verify desktop + mobile layouts and zero console errors.
  - **Done when:** All Playwright E2E specs (`notifications.spec.ts` + all existing E2E specs) pass cleanly.
  - **Verification Command:** `npm run e2e`

- [ ] **T9: Final Verification, Spec Closure & Memory Sync**
  - **Associated Requirements:** `Constitution Principle 6`, `AGENTS.md`
  - **Files Touched:**
    - `docs/specs/005-notifications/spec.md` (modified — update `Status: implemented`)
    - `docs/specs/005-notifications/plan.md` (modified — update `Status: implemented`)
    - `docs/specs/005-notifications/tasks.md` (modified — mark `[x]` on `T1`–`T9`)
    - `MEMORY.md` (modified — record `005-notifications` architecture decisions, patterns, and final Vitest + Playwright counts)
  - **Done when:** Full verification suite (`npm test && npm run typecheck && npm run lint && npm run build && npm run e2e`) passes with zero errors, and SDD documentation + `MEMORY.md` accurately reflect the implemented state.
  - **Verification Command:** `npm test && npm run typecheck && npm run lint && npm run build && npm run e2e`

# Implementation Plan: `005-notifications` (Browser Notifications & In-App Notification Center)

- **Feature Name:** `005-notifications`
- **Status:** implemented
- **Approved Spec:** [docs/specs/005-notifications/spec.md](./spec.md) (`Status: implemented`)
- **Constitution:** [docs/constitution.md](../../constitution.md)
- **Reference Patterns:** `src/features/tasks/` (golden reference), `src/features/groups/`, `src/features/auth/`

---

## 1. Architecture Overview & Design Goals

`005-notifications` delivers MVP requirements `RF-27` (browser notification permissions, 8-hour per-user cooldown reminder, blocked reactivation guidance, best-effort native delivery), `RF-28` (local timezone due-date alert scheduling, date-only `09:00:00` local rule, today post-`09:00` immediate trigger, offline catch-up `< 30` days, past-created suppression, task/group lifecycle recalculation, reload deduplication), and `RF-29` (in-app Notification Center on `/`, unread badge, mark as read, mark all as read, individual delete, automatic 30-day pruning, strict per-user isolation).

Key architectural principles applied:
1. **Isolated Data Layer (`RNF-07`, Constitution Principle 3):** All notification persistence flows exclusively through `NotificationRepository` (`tbt:v1:notifications`) and `NotificationStateRepository` (`tbt:v1:notification_state`) backed by `LocalStorageAdapter` and strict Zod schemas. No UI component reads or writes `localStorage` directly.
2. **Deterministic Pure Domain Logic (`RNF-03`, `RNF-14`, `RNF-20`):** Due-alert timing, IANA timezone conversions (`getZonedCalendarDate`, `isPastLocalNineAm`, existing `getDueNotificationTriggerMs`), decision classification (`save` vs `uncheck` vs `sync`), occurrence key generation, recipient evaluation (`assigneeId` first with accessible-group fallback per `RNF-20`), 8-hour per-`userId` permission banner cooldown, and `MAX_SAFE_TIMEOUT_MS` (`2_147_483_647` ms) chained timers are implemented as pure, clock-injectable functions.
3. **Once-Per-Occurrence Deduplication & Past-Due Suppression (`REQ-NT-08`, `REQ-NT-10`):** Every `(taskId, dueDate, dueTime ?? 'date-only')` transition saved or triggered records a `HandledDueOccurrence` marker (`'notified'` or `'suppressed'`) scoped per `userId` in `tbt:v1:notification_state`. Tasks created/edited already in the past receive `'suppressed'` at save time so they render visually overdue (`RF-14`) without firing on save or on subsequent reloads, while tasks saved in the future whose trigger elapses while the browser is closed (`< 30` days) remain unhandled until catch-up fires once on workspace entry and records `'notified'`.
4. **Safe Multi-Week Timers & Clean Session Teardown (`RF-02`, `REQ-NT-12`):** JS `setTimeout` silently overflows signed 32-bit delays above `2^31 - 1` ms (~24.85 days), which would fire future tasks (e.g. > 25 days out) immediately. A capped timer scheduler chains `MAX_SAFE_TIMEOUT_MS` intervals and verifies `now() >= targetMs` before triggering. `useNotificationsStore` subscribes to `subscribeAuthSessionEnd` from `auth-store.ts` to cancel every active timer handle and reset in-memory notification state immediately on logout, expiration, orphan cleanup, or account deletion.
5. **Best-Effort Native Popups + Guaranteed Inbox (`RF-27`, `RF-29`, `RNF-18`):** Whenever a due alert fires, `useNotificationsStore` serializes persistence of the unread `Notification` record and `'notified'` occurrence marker first, updates UI state immediately, and then invokes `BrowserNotificationAdapter.dispatch(...)` inside a `try/catch` boundary so unsupported browsers or throwing environments never disrupt workspace usage.
6. **Strict TypeScript (`erasableSyntaxOnly`) & React Compiler:** No `any`, no `@ts-ignore`, explicit `private readonly` constructor fields in repository classes, `useWatch` if reactive form state is ever needed, no manual `useMemo`/`useCallback` unless structurally required, centralized Spanish copy in `src/shared/i18n/es.ts`, and Mobile-First (~375px+) Bootstrap UI components with full keyboard/ARIA accessibility (`RNF-12`).

### Governance & Scope Check (`AGENTS.md`)
- **Packages:** Zero new npm packages required (already using React 19.2, Zustand, Zod, React Bootstrap 5.3, Bootstrap, Vitest, Playwright).
- **Config Files (`vite.config.ts`, `tsconfig*.json`, `eslint.config.js`):** Zero edits.
- **Ask-First Items (pre-resolved in `#134` for this plan):**
  1. **Additive Storage Key (`tbt:v1:notification_state`):** Add `STORAGE_KEYS.NOTIFICATION_STATE = 'tbt:v1:notification_state'` alongside existing `tbt:v1:*` keys to persist per-`userId` 8-hour permission prompt cooldown timestamps and occurrence deduplication/suppression markers without altering `tbt:v1:notifications` or existing `notificationSchema` shape.
  2. **Cross-Feature Store & UI Wiring:** Extend `NotificationRepository`, add `NotificationStateRepository`, invoke `notificationStateRepository.deleteByUserId(user.id)` in `useAuthStore.deleteAccount()`, wire lifecycle hooks into `useTasksStore` (`createTask`, `updateTask`, `toggleTaskComplete`, `copyTask`, `deleteTask`) and `useGroupsStore` (`init`, `refresh`, `deleteGroup`), and integrate `<NotificationCenterButton />`, `<NotificationPermissionBanner />`, and `<NotificationCenterPanel />` into `GroupsGridView` (and symmetrically in `TasksView`).
- **Explicit Exclusions (`Posterior` Scope Guard):** No pre-due reminders (`RF-20`), no collaborative group notifications (`RF-30`), no email alerts (`RF-11`), no real-time server push (`RF-33`), and no Service Worker / backend Web Push.

---

## 2. File & Module Inventory

### 2.1 Shared Layer (`src/shared/`)
- **`src/shared/schemas/notification.ts`** *(update)*:
  - Keep existing `notificationSchema` (`id`, `userId`, `eventType`, `content`, `read`, `createdAt`) and `Notification` unchanged for compatibility with `000-foundation` and `004-auth`.
  - Add:
    - `handledDueOccurrenceStatusSchema = z.enum(['notified', 'suppressed'])`
    - `handledDueOccurrenceSchema = z.object({ taskId: idSchema, occurrenceKey: z.string().min(1), status: handledDueOccurrenceStatusSchema, recordedAt: isoDateTimeSchema })`
    - `userNotificationStateSchema = z.object({ userId: idSchema, permissionPromptLastShownAt: isoDateTimeSchema.nullable().default(null), handledOccurrences: z.array(handledDueOccurrenceSchema).default([]) })`
    - Matching TypeScript interfaces `HandledDueOccurrence` and `UserNotificationState`.
- **`src/shared/schemas/index.ts`** *(keep)*: Already re-exports `export * from './notification'`.
- **`src/shared/utils/date-time.ts`** *(update)*:
  - Keep `detectBrowserTimeZone`, `formatIsoTimestamp`, `nowIsoUtc`, `formatDisplayDate`, `formatDisplayTime`, `parseZonedDate`, `isTaskOverdue`, `getReminderTriggerDate`, `getDueNotificationTriggerMs`.
  - Add pure timezone-aware helpers reusing the internal `getTzParts(date, timeZone)` routine:
    - `getZonedCalendarDate(date: Date, timeZone: string): string` — returns canonical `'YYYY-MM-DD'` in `timeZone`.
    - `isPastLocalNineAm(date: Date, timeZone: string): boolean` — returns `true` when `parts.hour >= 9` in `timeZone` (`09:00:00` or later on that local calendar day).
    - `formatZonedDateTime(isoTimestamp: string, timeZone: string, timeFormat: '24h' | '12h'): string` — formats an ISO-8601 UTC timestamp in `timeZone` as `dd/mm/aaaa, HH:mm` (`24h`) or `dd/mm/aaaa, hh:mm a. m.` / `p. m.` (`12h`) consistently with `formatDisplayDate` + `formatDisplayTime`.
- **`src/shared/i18n/es.ts`** *(update)*:
  - Add `NotificationsLocalization` interface, add `notifications: NotificationsLocalization` to `LocalizationDictionary`, and populate `es.notifications` per `spec.md` Section 4.3:
    - `centerButtonLabel`: `'Notificaciones'`
    - `centerButtonAria`: `(count: number) => \`Abrir centro de notificaciones (${count} sin leer)\``
    - `centerTitle`: `'Centro de notificaciones'`
    - `emptyState`: `'No tienes notificaciones en este momento.'`
    - `unreadBadge`: `'Sin leer'`
    - `markAsReadButton`: `'Marcar como leída'`
    - `markAsReadAria`: `'Marcar notificación como leída'`
    - `markAllAsReadButton`: `'Marcar todas como leídas'`
    - `markAllAsReadAria`: `'Marcar todas las notificaciones como leídas'`
    - `deleteButton`: `'Eliminar'`
    - `deleteAria`: `'Eliminar notificación'`
    - `closeCenterAria`: `'Cerrar centro de notificaciones'`
    - `permissionPromptTitle`: `'Activa los avisos del navegador'`
    - `permissionPromptBody`: `'Recibe alertas cuando tus tareas alcancen su fecha de caducidad, incluso si cambias de pestaña.'`
    - `enableNotificationsButton`: `'Activar avisos'`
    - `dismissReminderButton`: `'Ahora no'`
    - `permissionDefaultStatus`: `'Avisos del navegador pendientes de activar'`
    - `permissionDeniedStatus`: `'Avisos del navegador bloqueados'`
    - `permissionBlockedTitle`: `'Notificaciones bloqueadas en este navegador'`
    - `permissionBlockedInstructions`: `'Has bloqueado los avisos para este sitio. Para reactivarlos, abre el ícono de candado o configuración junto a la barra de direcciones del navegador, cambia Notificaciones a "Permitir" y recarga la página.'`
    - `permissionGrantedStatus`: `'Avisos del navegador activados'`
    - `permissionUnsupportedNote`: `'Este navegador no admite avisos emergentes; seguirás viendo todas tus alertas aquí.'`
    - `dueAlertTitle`: `'Aviso de vencimiento'`
    - `dueAlertWithTime`: `(title: string, date: string, time: string) => \`La tarea "${title}" vence el ${date} a las ${time}.\``
    - `dueAlertDateOnly`: `(title: string, date: string) => \`La tarea "${title}" vence el ${date}.\``

### 2.2 Data Layer (`src/data/`)
- **`src/data/storage/keys.ts`** *(update)*:
  - Keep all existing `STORAGE_KEYS` entries untouched; add `NOTIFICATION_STATE: 'tbt:v1:notification_state'`.
- **`src/data/contracts/notification-repository.ts`** *(update)*:
  - Keep `getByUserId(userId: string): Promise<Notification[]>` and `deleteByUserId(userId: string): Promise<void>`.
  - Add:
    - `save(notification: Notification): Promise<void>`
    - `markAsRead(userId: string, notificationId: string): Promise<Notification | null>`
    - `markAllAsRead(userId: string): Promise<number>`
    - `delete(userId: string, notificationId: string): Promise<boolean>`
    - `pruneExpired(userId: string, nowIso?: string): Promise<number>`
- **`src/data/contracts/notification-state-repository.ts`** *(create)* & **`src/data/contracts/index.ts`** *(update)*:
  - Define `NotificationStateRepository`:
    - `getByUserId(userId: string): Promise<UserNotificationState>` (returns `{ userId, permissionPromptLastShownAt: null, handledOccurrences: [] }` when absent).
    - `save(state: UserNotificationState): Promise<void>`
    - `deleteByUserId(userId: string): Promise<void>`
- **`src/data/repositories/local-storage-notification-repository.ts`** *(update)*:
  - Use explicit `private readonly storageAdapter: StorageAdapter` (no constructor parameter properties).
  - Validate payloads using `notificationSchema` and `z.array(notificationSchema)`.
  - Return notifications in `getByUserId` sorted newest first (`Date.parse(b.createdAt) - Date.parse(a.createdAt) || b.id.localeCompare(a.id)`).
  - Implement `save` (upsert by `id`), `markAsRead` (scoped strictly to `n.userId === userId && n.id === notificationId`), `markAllAsRead` (scoped strictly to `n.userId === userId && !n.read`, returning count updated), `delete` (scoped strictly to `n.userId === userId && n.id === notificationId`), and `pruneExpired` (deletes records where `n.userId === userId` and `nowMs - Date.parse(n.createdAt) >= LIMITS.NOTIFICATION_RETENTION_DAYS * 24 * 60 * 60 * 1000`, leaving other users and `< 30` day records untouched).
- **`src/data/repositories/local-storage-notification-state-repository.ts`** *(create)* & **`src/data/repositories/index.ts`** *(update)*:
  - Implement `NotificationStateRepository` backed by `STORAGE_KEYS.NOTIFICATION_STATE` and `z.array(userNotificationStateSchema)` validation, strictly scoped by `userId`.

### 2.3 Notifications Feature (`src/features/notifications/`)
- **`src/features/notifications/utils/`**:
  - `notification-constants.ts` — `PERMISSION_COOLDOWN_MS` (`8 * 60 * 60 * 1000`), `RETENTION_WINDOW_MS` (`LIMITS.NOTIFICATION_RETENTION_DAYS * 24 * 60 * 60 * 1000`), `MAX_SAFE_TIMEOUT_MS` (`2_147_483_647`).
  - `browser-notifications.ts` — `BrowserNotificationPermissionState = 'granted' | 'default' | 'denied' | 'unsupported'`, `BrowserNotificationAdapter` interface, `createBrowserNotificationAdapter()` safely probing `globalThis.Notification` and catching exceptions on `requestPermission` and `new Notification(...)`.
  - `permission-cooldown.ts` — Pure `isPermissionBannerDue(permission, lastShownAt, nowMs)` checking `permission === 'default' || permission === 'denied'` and `lastShownAt === null || Number.isNaN(parsed) || nowMs - parsed >= PERMISSION_COOLDOWN_MS`.
  - `due-alert-scheduler.ts` — Pure scheduling & formatting engine:
    - `DueAlertEvaluationMode = 'save' | 'uncheck' | 'sync'`
    - `buildOccurrenceKey(dueDate: string, dueTime?: string | null): string`
    - `isTaskDueAlertRecipient(task: Task, accessibleGroupIds: Set<string>, userId: string): boolean` (respects `task.assigneeId` if non-null/defined, otherwise checks accessible group membership — `RNF-20`)
    - `classifyDueTaskAlert(...)`: returns `'none' | 'already-handled' | 'trigger-now' | 'schedule' | 'suppress'`
    - `formatDueAlertContent(task: Task, timeFormat: '24h' | '12h'): string`
    - `scheduleCappedTimeout(targetMs: number, now: () => number, onDue: () => void, setTimer?, clearTimer?): () => void`
  - `index.ts` — Barrel exports.
- **`src/features/notifications/store/`**:
  - `notifications-store.ts` — `useNotificationsStore`, `configureNotificationsStore`, `resetNotificationsStore`:
    - State: `notifications: Notification[]`, `unreadCount: number`, `permissionState: BrowserNotificationPermissionState`, `isPermissionBannerVisible: boolean`, `isCenterOpen: boolean`, `isLoading: boolean`, `error: string | null`.
    - Actions: `init()`, `refresh()`, `openCenter()`, `closeCenter()`, `requestPermission()`, `dismissPermissionBanner()`, `markAsRead(notificationId)`, `markAllAsRead()`, `deleteNotification(notificationId)`, `handleTaskSaved(task, userId, scheduleChanged)`, `handleTaskToggled(task, userId)`, `handleTaskDeleted(taskId, userId)`, `handleTasksDeleted(taskIds, userId)`, `clearActiveRuntime()`.
    - Dependencies (`NotificationsStoreDependencies`): `notificationRepository`, `notificationStateRepository`, `taskRepository`, `groupRepository`, `getCurrentUser`, `browserNotifications`, `now`, `createId`, `setTimer`, `clearTimer`.
    - Subscribes to `subscribeAuthSessionEnd` to invoke `clearActiveRuntime()` immediately on session end (`RF-02`).
  - `index.ts` — Barrel exports.
- **`src/features/notifications/hooks/`**:
  - `use-notifications.ts` — `useNotifications()` exposing state and actions cleanly for UI components without leaking repository or store wiring.
  - `index.ts` — Barrel exports.
- **`src/features/notifications/components/`**:
  - `NotificationCenterButton.tsx` — Header trigger button (`es.notifications.centerButtonLabel`) with accessible unread counter badge (`unreadCount > 0`) and `aria-label={es.notifications.centerButtonAria(unreadCount)}`.
  - `NotificationPermissionBanner.tsx` — Discrete non-blocking banner (`role="region"` / `aria-label`) rendered below account navigation when `isPermissionBannerVisible` is true: displays `'default'` prompt + `"Activar avisos"` + `"Ahora no"`, or `'denied'` `permissionBlockedTitle` + `permissionBlockedInstructions` + `"Ahora no"`.
  - `NotificationCenterPanel.tsx` — Responsive Bootstrap `<Modal show={isCenterOpen} onHide={closeCenter} scrollable fullscreen="sm-down" aria-labelledby="notification-center-title">` with `closeLabel={es.notifications.closeCenterAria}`, discrete permission status section (`granted` / `default` + `"Activar avisos"` / `denied` + instructions / `unsupported`), `"Marcar todas como leídas"` (`disabled={unreadCount === 0}`), newest-first notification cards with non-color `'Sin leer'` badge, `formatZonedDateTime(createdAt, timeZone, timeFormat)` timestamp, `"Marcar como leída"`, `"Eliminar"`, and `emptyState`.
  - `index.ts` — Barrel exports.
- **`src/features/notifications/index.ts`** *(update)*: Public feature barrel.

### 2.4 Cross-Feature Integration (`src/features/{auth,tasks,groups}/`)
- **`src/features/auth/store/auth-store.ts`** *(update)*:
  - Add `notificationStateRepository: NotificationStateRepository` to `AuthStoreDependencies` (default `new LocalStorageNotificationStateRepository()`).
  - Inside `deleteAccount()`, invoke `await deps.notificationStateRepository.deleteByUserId(user.id)` right alongside `await deps.notificationRepository.deleteByUserId(user.id)` (`REQ-NT-12`).
- **`src/features/tasks/store/tasks-store.ts`** *(update)*:
  - Add optional `notificationHooks?: TaskNotificationHooks` (`onTaskSaved`, `onTaskToggled`, `onTaskDeleted`) to `TasksStoreDependencies`, defaulting to calling `useNotificationsStore.getState()` delegates (`handleTaskSaved`, `handleTaskToggled`, `handleTaskDeleted`).
  - Invoke `notificationHooks.onTaskSaved(newTask, activeUserId, true)` in `createTask`, `notificationHooks.onTaskSaved(updatedTask, activeUserId, scheduleChanged)` in `updateTask`, `notificationHooks.onTaskSaved(copiedTask, activeUserId, true)` in `copyTask`, `notificationHooks.onTaskToggled(updated, activeUserId)` in `toggleTaskComplete`, and `notificationHooks.onTaskDeleted(taskId, activeUserId)` in `deleteTask`.
- **`src/features/groups/store/groups-store.ts`** *(update)*:
  - Add optional `onTasksDeleted?: (taskIds: string[], userId: string) => Promise<void>` and `onWorkspaceSynced?: () => Promise<void>` in `GroupsStoreDependencies` (defaulting to `useNotificationsStore.getState()`).
  - Inside `deleteGroup()`, read `const groupTasks = await deps.taskRepository.getByGroupId(groupId)` before deleting group tasks, then invoke `await deps.onTasksDeleted?.(groupTasks.map((t) => t.id), activeUserId)`.
  - Inside `init()` and `refresh()` after loading authenticated workspace data, invoke `await deps.onWorkspaceSynced?.()` (or call via `<GroupsGridView />` cleanly — keeping one single deterministic init/sync trigger so catch-up/banner evaluation never double-fires; see Section 3.4).
- **`src/features/groups/components/GroupsGridView.tsx`** *(update)* & **`src/features/tasks/components/TasksView.tsx`** *(update)*:
  - Place `<NotificationCenterButton />` inside `<nav aria-label="Cuenta">` next to `"Mi perfil"` and `"Cerrar sesión"`.
  - Render `<NotificationPermissionBanner />` below the account nav and mount `<NotificationCenterPanel />`.
  - Call `notifications.init()` on authenticated mount (`GroupsGridView` / `TasksView`) and `notifications.refresh()` on workspace manual refresh (`GroupsGridView`).

### 2.5 Test Files (`tests/`)
- **New Unit Tests:**
  - `tests/unit/data/local-storage-notification-repositories.test.ts`
  - `tests/unit/features/notifications/due-alert-scheduler.test.ts`
  - `tests/unit/features/notifications/permission-cooldown.test.ts`
  - `tests/unit/features/notifications/notifications-store.test.ts`
- **Updated Unit & Integration Tests:**
  - `tests/unit/shared/i18n/es.test.ts` (`es.notifications` keys and interpolations)
  - `tests/unit/shared/schemas/limits.test.ts` (`handledDueOccurrenceSchema`, `userNotificationStateSchema`, `NOTIFICATION_RETENTION_DAYS = 30`)
  - `tests/unit/shared/utils/date-time.test.ts` (`getZonedCalendarDate`, `isPastLocalNineAm`, `formatZonedDateTime`)
  - `tests/unit/features/auth/auth-store.test.ts` (`deleteAccount` cleans `notificationStateRepository`)
  - `tests/unit/features/tasks/tasks-store.test.ts` & `tests/unit/features/groups/groups-store.test.ts` (verify notification lifecycle hooks without breaking unauthenticated-user store unit stubs)
  - `tests/integration/features/notifications/notifications-flow.test.tsx` (permission banner, 8h per-user cooldown, Notification Center panel interactions, `12h`/`24h`, 30-day pruning, task/group mutations inside `GroupsGridView`)
- **Playwright E2E Tests (`tests/e2e/`):**
  - `tests/e2e/notifications.spec.ts` (`AC-NT-01`..`AC-NT-10` across desktop `1280x720` and mobile `375x812` with zero console/page errors).
  - Verify `tests/e2e/{smoke,auth,tasks,groups,tags}.spec.ts` remain green with zero selector collisions.

---

## 3. Detailed Technical Design

### 3.1 Due-Alert Classification Matrix (`src/features/notifications/utils/due-alert-scheduler.ts`)

```
buildOccurrenceKey(dueDate, dueTime) = `${dueDate}|${dueTime?.trim() || 'date-only'}`

classifyDueTaskAlert({ task, userId, timeZone, nowMs, mode, handledOccurrences, isEligibleRecipient }):
1. Eligibility Guard (`REQ-NT-06`, `RNF-20`):
   - If !isEligibleRecipient || task.completed || !task.dueDate -> return { action: 'none' }
2. Deduplication Guard (`REQ-NT-10`):
   - occurrenceKey = buildOccurrenceKey(task.dueDate, task.dueTime)
   - If handledOccurrences has item matching (task.id, occurrenceKey) ->
     - Note: if item.status === 'notified' OR (item.status === 'suppressed' && mode !== 'uncheck')
       return { action: 'already-handled' }
3. Instant Calculation (`REQ-NT-07`):
   - triggerAtMs = getDueNotificationTriggerMs({ dueDate: task.dueDate, dueTime: task.dueTime, timeZone })
   - Note: date-only defaults to 09:00:00.000 in `timeZone`; timed defaults to HH:mm:00.000 in `timeZone`.
4. Mode Evaluation (`REQ-NT-07(3)`, `REQ-NT-08`, `REQ-NT-09(3)`):
   - If mode === 'save':
     - todayStr = getZonedCalendarDate(new Date(nowMs), timeZone)
     - If !task.dueTime && task.dueDate === todayStr && isPastLocalNineAm(new Date(nowMs), timeZone):
       return { action: 'trigger-now', occurrenceKey, triggerAtMs }
     - If triggerAtMs <= nowMs:
       return { action: 'suppress', occurrenceKey, triggerAtMs }   // past-created/edited -> visually overdue only
     - return { action: 'schedule', occurrenceKey, triggerAtMs, delayMs: triggerAtMs - nowMs }
   - If mode === 'uncheck':
     - If triggerAtMs > nowMs:
       return { action: 'schedule', occurrenceKey, triggerAtMs, delayMs: triggerAtMs - nowMs }
     - return { action: 'suppress', occurrenceKey, triggerAtMs }     // REQ-NT-09(3): do not fire past alert
   - If mode === 'sync':
     - If handledOccurrences already contains (task.id, occurrenceKey): return { action: 'already-handled' }
     - If triggerAtMs <= nowMs:
       - If nowMs - triggerAtMs < RETENTION_WINDOW_MS (30 days):
         return { action: 'trigger-now', occurrenceKey, triggerAtMs }  // missed while closed catch-up
       - return { action: 'suppress', occurrenceKey, triggerAtMs }
     - return { action: 'schedule', occurrenceKey, triggerAtMs, delayMs: triggerAtMs - nowMs }
```

### 3.2 Timer Registry, Multi-Week Delay Capping & Race Prevention
- Active runtime timers live in a module-scoped `Map<string, () => void>` keyed by `taskId` outside serializable Zustand state so timer cleanup functions are never stored in React/Zustand snapshots.
- Whenever a timer for `taskId` is replaced or cancelled (due edit, completion, deletion, group deletion, or `subscribeAuthSessionEnd`), its `cancel()` function is invoked synchronously and removed from the `Map`.
- **Safe Multi-Week Scheduling (`scheduleCappedTimeout`):**
  ```ts
  function scheduleNextChunk() {
    const remaining = targetMs - now();
    if (remaining <= 0) {
      onDue();
      return;
    }
    const chunkMs = Math.min(remaining, MAX_SAFE_TIMEOUT_MS);
    handle = setTimer(() => {
      if (!cancelled) scheduleNextChunk();
    }, chunkMs);
  }
  ```
- **Serialized State Mutation Queue:** `useNotificationsStore` queues asynchronous read-modify-write updates on `tbt:v1:notification_state` per user using an internal promise chain (`stateQueue = stateQueue.then(...)`). If multiple missed catch-up tasks trigger sequentially during `init()`, or if two timer callbacks fire at the exact same minute, no `handledOccurrences` entry or `permissionPromptLastShownAt` timestamp can ever be overwritten by stale concurrent reads.

### 3.3 Legacy Store-Test Safety (`tasks-store.test.ts`, `groups-store.test.ts`, `tasks-view.test.tsx`)
- Legacy unit/component tests for `tasks-store` and `groups-store` configure `getActiveUserId: () => Promise.resolve('local-user')` without logging a `User` into `useAuthStore`.
- `useNotificationsStore` resolves the active `User` via `deps.getCurrentUser()` (defaulting to `useAuthStore.getState().currentUser`). When `getCurrentUser()` returns `null` or `user.id !== userId`, lifecycle callbacks cleanly fall back to no-op without throwing, mutating `window.localStorage`, or spawning orphan Node `setTimeout`s during unrelated tests.
- Simultaneously, `TasksStoreDependencies` and `GroupsStoreDependencies` accept optional spyable notification hooks so dedicated unit tests can verify exact call contracts without touching `window.Notification`.

### 3.4 Single Deterministic Workspace Sync (`GroupsGridView` & `TasksView`)
- Workspace notification initialization (`notifications.init()`) runs cleanly on `<GroupsGridView />` mount (paired with `<NotificationPermissionBanner />` + `<NotificationCenterButton />` + `<NotificationCenterPanel />`) and refreshes on manual workspace `refresh()`, preventing double-evaluation races during initial load.
- `<TasksView />` symmetrically invokes `notifications.init()` when `isAuthenticated && currentUser` and renders `<NotificationCenterButton />`, `<NotificationPermissionBanner />`, and `<NotificationCenterPanel />` using the shared components.
- Opening `<NotificationCenterPanel />` invokes `openCenter()`, which runs `pruneExpired(userId, nowIso)` + `getByUserId(userId)` before displaying entries (`REQ-NT-16`), ensuring notifications that cross the 30-day threshold while the workspace stayed open disappear cleanly upon opening the center.

---

## 4. Design Decisions & Discarded Alternatives

1. **Additive `tbt:v1:notification_state` Key vs. Storing Metadata Inside `Notification[]` (`tbt:v1:notifications`):**
   - *Chosen:* New `STORAGE_KEYS.NOTIFICATION_STATE = 'tbt:v1:notification_state'` storing `{ userId, permissionPromptLastShownAt, handledOccurrences[] }`.
   - *Discarded:* Piggybacking hidden system/metadata entries into `tbt:v1:notifications` (pollutes the user-facing notification schema, breaks `NotificationRepository.getByUserId` semantics, and breaks `REQ-NT-15` deletion if deleting an inbox entry wiped occurrence deduplication!). Wait — **important consequence of this choice:** deleting a Notification entry from the Notification Center (`"Eliminar"`) does **NOT** erase its `(taskId, occurrenceKey)` deduplication marker, preventing deleted notifications from resurrecting on the next page reload!
2. **Storing Explicit `'suppressed'` Markers vs. Heuristic Date Comparisons at Reload:**
   - *Chosen:* Persist `{ taskId, occurrenceKey, status: 'suppressed' }` when a task is created/edited strictly in the past (or unchecked past-due).
   - *Discarded:* Inferring catch-up vs past-creation from `task.createdAt > triggerAt` alone (breaks when an existing task's `dueDate` is *edited* to the past while `createdAt` stayed older, and would incorrectly resurrect alerts after schedule edits).
3. **`react-bootstrap/Modal` (`fullscreen="sm-down"`, `scrollable`) vs. `Offcanvas` for Notification Center:**
   - *Chosen:* Standard `react-bootstrap/Modal` matching `TaskDeleteConfirmModal`, `TaskFormModal`, and `DeleteAccountConfirmModal`.
   - *Discarded:* `react-bootstrap/Offcanvas` (Bootstrap offcanvas relies on viewport media queries that require extra `window.matchMedia` mocks in Vitest `jsdom` tests). `Modal` with `fullscreen="sm-down"` delivers clean ~375px mobile full-screen sheets and desktop dialogs with native `Escape`, focus management, and `closeLabel`.
4. **Capped Recursive Timers (`MAX_SAFE_TIMEOUT_MS`) vs. Global Polling Interval:**
   - *Chosen:* Per-task capped `setTimeout` scheduling (`Math.min(remaining, 2_147_483_647)`).
   - *Discarded:* Background `setInterval` polling every N seconds (drains battery/CPU needlessly on mobile devices and blurs exact `RNF-03` firing timing).

---

## 5. Verification & Traceability Matrix

| Spec / Acceptance Criteria | Planned Verification |
| :--- | :--- |
| `REQ-NT-01`..`REQ-NT-05`, `AC-NT-01`, `AC-NT-02` | `permission-cooldown.test.ts`, `notifications-store.test.ts`, `notifications-flow.test.tsx`, `notifications.spec.ts` |
| `REQ-NT-06`..`REQ-NT-10`, `AC-NT-03`, `AC-NT-05`, `AC-NT-06` | `due-alert-scheduler.test.ts`, `notifications-store.test.ts`, `tasks-store.test.ts`, `groups-store.test.ts`, `notifications-flow.test.tsx`, `notifications.spec.ts` |
| `REQ-NT-11`, `AC-NT-04` | `permission-cooldown.test.ts`, `notifications-store.test.ts`, `notifications-flow.test.tsx`, `notifications.spec.ts` |
| `REQ-NT-12`, `AC-NT-07` | `notifications-store.test.ts`, `auth-store.test.ts`, `notifications.spec.ts` |
| `REQ-NT-13`..`REQ-NT-17`, `AC-NT-08`, `AC-NT-09` | `local-storage-notification-repositories.test.ts`, `notifications-store.test.ts`, `notifications-flow.test.tsx`, `notifications.spec.ts` |
| `REQ-NT-18`, `AC-NT-10` | `es.test.ts`, `date-time.test.ts`, `notifications-flow.test.tsx`, `notifications.spec.ts` (`1280x720` + `375x812` + keyboard/ARIA + 0 console errors) |

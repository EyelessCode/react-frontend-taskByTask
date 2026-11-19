# Spec 005: Browser Notifications & In-App Notification Center

- **Feature Name:** `005-notifications`
- **Status:** implemented
- **Created Date:** 2026-11-15
- **Authors:** SDD Planner Agent
- **SRS / SVD References:** `RF-27`, `RF-28`, `RF-29`, `RF-13`, `RF-14`, `RF-02`, `RF-05`, `RF-07`, `UI-01`, `UI-02`, `UI-07`, `RNF-01`, `RNF-03`, `RNF-07`, `RNF-10`, `RNF-12`, `RNF-14`, `RNF-15`, `RNF-18`, `RNF-19`, `RNF-20`, `Appendix A`, `Appendix B`, `Constitution Principles 1–6`

---

## 1. Purpose & Background

### 1.1 Purpose
Define the functional requirements, permission rules, local timezone due-date alert scheduling, deduplication, session-end teardown, 30-day retention pruning, per-user isolation, accessibility requirements, and Spanish localization contracts for Browser Notifications and the In-App Notification Center in Task by Task. This specification implements MVP SRS requirements `RF-27` (Browser notifications), `RF-28` (Task due-date alerts), and `RF-29` (In-app notification center), together with cross-feature task/group/auth lifecycle hooks (`RF-02`, `RF-05`, `RF-07`, `RF-13`, `RF-14`, `UI-01`, `UI-07`, `RNF-03`, `RNF-10`, `RNF-12`, `RNF-14`, `RNF-18`, `RNF-20`).

### 1.2 Background
In earlier milestones (`001-tasks` through `004-auth`), Task by Task established user accounts with timezone and `24h`/`12h` preferences, task due dates and times evaluated strictly in the user's local timezone, isolated per-user workspaces, and a clean session-termination lifecycle signal alongside per-user notification storage cleanup on account deletion.

To complete the MVP experience for users juggling deadlines across personal, academic, and coding tasks:
1. Users need timely browser alerts when a task reaches its due date/time (`RF-28`)—using exact local time when `dueTime` is present, `09:00` local time when only `dueDate` is set, and never alerting for undated tasks.
2. Because browser notifications depend on browser permissions, OS settings, and open/supported browser contexts (`RF-27`), delivery is strictly **best-effort**, permission prompting must stay discrete (at most once every **8 hours** when not granted, with browser reactivation instructions when blocked), and **every fired alert must always be recorded inside the in-app Notification Center** (`RF-29`).
3. Task edits, completions, unchecks, task/group deletions, and user logout/session expiration/account deletion must deterministically recalculate or cancel active scheduled alerts without duplicate alerts across page reloads or ghost notifications after logout (`RF-02`, `RF-13`, `RF-28`).
4. Inside the platform, users need a clear Notification Center (`RF-29`) to view unread indicators, read notification details in Spanish with their preferred `24h`/`12h` format, mark notifications as read, and delete notifications, with automatic cleanup of notifications older than **30 days** (`Appendix B`).

---

## 2. Scope

### 2.1 In Scope
1. **Browser Notification Permission Management (`RF-27`, `UI-01`, `RNF-12`, `RNF-14`, `RNF-15`):**
   - Inspect current browser notification permission (`default`, `granted`, `denied`, or unsupported environment) upon authenticated workspace entry.
   - Display a discrete, non-blocking Spanish reminder banner when permission is not granted (`default` or `denied`), enforced by an **8-hour cooldown scoped per authenticated user (`userId`) in this browser** between automatic displays across reloads.
   - Provide an explicit `"Activar avisos"` action in `'default'` state to invoke the browser's native permission request, and clear Spanish browser-settings reactivation guidance when `'denied'`—both on the discrete automatic banner and inside the permission-status section of the Notification Center panel.
   - Degrade gracefully when the browser or environment does not support the browser notification mechanism without interrupting in-app Notification Center recording.
2. **Due-Date Alert Scheduling, Catch-Up & Recalculation (`RF-28`, `RF-13`, `RF-14`, `RNF-03`, `RNF-14`, `RNF-20`):**
   - Schedule due-date notifications exclusively for **incomplete** tasks accessible to the authenticated user that specify a `dueDate`. Undated tasks never schedule or trigger alerts.
   - Evaluate target alert instants in the authenticated user's configured IANA `timeZone`:
     - With `dueDate` and `dueTime`: exact calendar date and `dueTime`.
     - With `dueDate` only (no `dueTime`): **`09:00:00` local time** on `dueDate`; if created or edited for **today** after `09:00:00` local time, fire immediately upon saving (`RF-28`).
   - Recalculate scheduled alerts when a task's `dueDate` or `dueTime` changes or when a task is copied (`RF-16`).
   - Cancel pending scheduled alerts when a task is marked complete, deleted, or cascade-deleted via group deletion (`RF-07`, `RF-13`, `RF-14`).
   - Reschedule an alert when a completed task is unchecked (`completed: true -> false`) and its evaluated target alert instant remains in the future (`RF-28`).
   - Prevent duplicate alerts across page reloads, manual workspace refreshes, and non-schedule edits (`title`, `description`, `tags`).
   - Deliver due alerts reliably to the in-app Notification Center and, on a best-effort basis, via native browser notification when permitted.
3. **Session Teardown & Multi-Account Isolation (`RF-02`, `RF-05`, `RNF-10`, `004-auth` Integration):**
   - Cancel all pending runtime notification timers and clear in-memory notification state immediately upon logout, session expiration, orphaned session detection, or account deletion so the signed-out device stops receiving browser alerts (`RF-02`).
   - Restrict notification storage queries, read/delete mutations, unread counts, and due-alert evaluation strictly to `currentUser.id`.
4. **In-App Notification Center & Retention Pruning (`RF-29`, `UI-01`, `UI-07`, `RNF-12`, `RNF-14`, `Appendix B`):**
   - Workspace header notification button displaying an accessible unread-count badge and opening a Mobile-First Notification Center panel directly on the workspace (`/`) listing the user's notifications ordered newest first.
   - Support marking individual notifications as read (`read: true`), marking all unread notifications for the current user as read (`"Marcar todas como leídas"`), and deleting individual notifications permanently.
   - Display browser notification permission status and manual `"Activar avisos"` / blocked reactivation guidance inside the Notification Center panel (`RF-27`).
   - Format notification timestamps and task due times using the authenticated user's active `timeZone` and `timeFormat` (`24h` default or `12h`).
   - Automatically prune persisted notifications whose age reaches or exceeds **30 days** (`Appendix B`) for the active user on workspace initialization and notification center access.
5. **Accessibility, Mobile-First Layout & Spanish Localization (`UI-01`, `RNF-12`, `RNF-14`):**
   - Responsive Mobile-First UI (~375px to desktop), full keyboard navigation (`Tab`, `Enter`, `Space`, `Escape`), visible focus outlines, descriptive Spanish `aria-label`s, accessible badges/alerts, and 100% centralized Spanish copy.

### 2.2 Out of Scope
- Pre-due reminders (`RF-20`: 15 minutes, 30 minutes, 1 hour, 6 hours, 1 day before due time — **Posterior**).
- Collaborative group notifications (`RF-30`: invitations, group joins/leaves, role changes, task assignment/unassignment, collaborator edits, group/creator account deletion broadcast to members — **Posterior**).
- Email notifications (`RF-11` — **Posterior**).
- Multi-device server-side Web Push / Service Worker push synchronization and recurring tasks (`RF-21`, `RF-27` cross-device server guarantee — client-side MVP best-effort only; backend push rests outside the client-only MVP boundary).
- Real-time notifications pushed by other collaborators without refresh (`RF-33`).

### 2.3 Cross-Spec Integration Boundaries
1. **Task Lifecycle (`001-tasks`, `002-groups`):** Creating, editing, completing, unchecking, copying, and deleting tasks—as well as deleting non-Personal groups—trigger deterministic alert rescheduling or cancellation (`RF-13`, `RF-14`, `RF-28`).
2. **Authentication, Timezone & Time Format (`004-auth`):** `005-notifications` consumes `currentUser.id`, `currentUser.timeZone`, `currentUser.timeFormat` (`'24h'` | `'12h'`), and the session-termination lifecycle signal (`REQ-AU-08`, `REQ-AU-09`, `REQ-AU-19`) to cancel scheduled browser timers on logout, expiration, orphan cleanup, or account deletion, while leaving per-user account deletion cascade cleanup of notifications (`REQ-AU-19(3)`) intact.
3. **Future-Proof Extensibility (`RNF-20`):** Notification event types and recipient resolution are structured cleanly (`eventType: 'due_date'` in MVP, recipient derived via owner/assignee resolution) so `RF-20` reminders and `RF-30` collaborative events extend the Notification Center without migrating existing records.

---

## 3. Requirements (EARS Format)

### 3.1 Browser Notification Permission & 8-Hour Reminder (`RF-27`, `UI-01`, `RNF-12`, `RNF-14`, `RNF-15`)

- **REQ-NT-01 (Event-Driven - Permission Status Inspection on Workspace Entry):**  
  When an authenticated user enters or initializes the main workspace (`/`), the system shall inspect browser notification support and current permission state (`'granted'`, `'default'`, `'denied'`, or unsupported).

- **REQ-NT-02 (State-Driven - Discrete Per-User 8-Hour Cooldown Reminder Banner):**  
  While the browser supports notifications and the permission state is `'default'` or `'denied'`, if at least **8 hours** have elapsed since the permission reminder was last automatically shown to the current authenticated user (`currentUser.id`) in this browser (or if it has never been shown for that `userId`), then the system shall display a discrete, non-blocking Spanish banner inside the workspace header/top area and record the current timestamp for `currentUser.id` so automatic reminders do not reappear to that user for the next **8 hours** across page reloads (`RF-27`). Dismissing the banner manually shall hide it immediately without breaking the 8-hour cooldown for that `userId`, while other distinct accounts signing in on the same browser evaluate their own `userId`-scoped cooldown independently.

- **REQ-NT-03 (Event-Driven - Permission Request Trigger):**  
  While the browser supports notifications and permission is `'default'`, the system shall offer `"Activar avisos"` both on the discrete permission banner (when visible) and inside the Notification Center panel's permission-status section (even while the automatic banner is within its 8-hour cooldown). When the user activates `"Activar avisos"`, the system shall invoke the browser's permission prompt. If the user grants permission (`'granted'`), the system shall hide the reminder banner immediately, update the Notification Center status to granted, and enable best-effort browser notification dispatch for active/subsequent alerts; if the user denies or closes the prompt without granting, the system shall update the displayed state appropriately while preserving the 8-hour automatic display cooldown (`RF-27`).

- **REQ-NT-04 (State-Driven - Blocked Permission Reactivation Guidance):**  
  While the browser permission state is `'denied'`, both the discrete permission reminder banner (when shown) and the Notification Center panel's permission-status section shall display clear localized Spanish instructions explaining that the browser blocked notifications and how the user can re-enable site notifications from the browser's address bar / site settings (`RF-27`, `RNF-15`), without offering a broken native prompt button.

- **REQ-NT-05 (Unwanted Behavior / Graceful Degradation - Unsupported Browser Environment):**  
  If the user's browser or runtime environment does not expose browser notification APIs, then the system shall not throw unhandled errors, shall omit browser permission request prompts, shall show the unsupported-browser notice inside the Notification Center permission-status section, and shall continue recording and presenting all due-date alerts inside the in-app Notification Center (`RF-27`, `RF-29`, `RNF-18`).

### 3.2 Due-Date Alert Scheduling, Catch-Up & Recalculation (`RF-28`, `RF-27`, `RF-13`, `RF-14`, `RNF-03`, `RNF-14`, `RNF-20`)

- **REQ-NT-06 (Ubiquitous - Due-Alert Eligibility & Undated Exclusion):**  
  The system shall evaluate due-date alerts exclusively for incomplete tasks (`completed === false`) belonging to groups owned by or accessible to the authenticated user (`MVP`: owner of the individual group; structured to respect optional `assigneeId` per `RNF-20`) that have a non-empty `dueDate`. Tasks without a `dueDate` (`dueDate == null`) shall **never** schedule or trigger due alerts (`RF-28`).

- **REQ-NT-07 (Event-Driven & State-Driven - Trigger Instant Evaluation in User Timezone):**  
  For each eligible incomplete task with a `dueDate`, the system shall compute the due-alert trigger instant in the authenticated user's configured IANA `timeZone` (`RF-28`, `RNF-14`):
  1. **Task with `dueDate` and `dueTime`:** Target trigger instant equals the exact `dueDate` at `dueTime` (`HH:mm:00.000`) evaluated in `user.timeZone`.
  2. **Task with `dueDate` only (`dueTime == null`):** Target trigger instant equals **`09:00:00.000`** local time on `dueDate` in `user.timeZone`.
  3. **Today Date-Only Post-09:00 Immediate Trigger (`RF-28`):** When a task without `dueTime` is created or edited with `dueDate` equal to the **current calendar date** in `user.timeZone` and the current local time in `user.timeZone` is already `>= 09:00:00`, the system shall trigger the due-date alert immediately upon saving (subject to occurrence deduplication).

- **REQ-NT-08 (Event-Driven & State-Driven - Active Scheduling, Missed-Due Catch-Up & Past-Date Creation Rule):**  
  While an authenticated user has the workspace open:
  1. **Future Trigger (`triggerAt > now`):** The system shall schedule an active runtime timer to fire the alert at `triggerAt` (`RNF-03`: minimal acceptable delay).
  2. **Missed While Away / Catch-Up (`triggerAt <= now`):** On workspace load, login, or manual refresh, for any incomplete task whose `triggerAt <= now` and whose alert occurrence has not yet been notified (within the active 30-day retention window), the system shall fire a catch-up alert once—**except** for tasks that were originally created or edited with an already-past trigger instant other than today's post-09:00 date-only rule (`REQ-NT-07(3)`), which render visually overdue (`RF-14`) without firing retroactive spam.
  3. **Immediate Past-Timed / Past-Day Creation Boundary:** Creating or editing a task with a `dueDate` strictly earlier than today in `user.timeZone`, or with `dueDate = today` and a `dueTime` already earlier than `now` in `user.timeZone`, shall immediately mark the task visually overdue (`RF-14`) without firing an unsolicited immediate notification (`REQ-NT-07(3)` applies specifically to date-only tasks for today after `09:00`).

- **REQ-NT-09 (Event-Driven - Task & Group Lifecycle Recalculation):**  
  The system shall synchronize due-alert schedules across task and group mutations (`RF-13`, `RF-14`, `RF-28`):
  1. **Task Edited:** When `dueDate` or `dueTime` changes on an incomplete task, cancel any pending timer for the prior schedule and re-evaluate `REQ-NT-07`/`REQ-NT-08` for the new schedule.
  2. **Task Completed:** When a task is marked completed (`completed: false -> true`), immediately cancel any pending timer for that task.
  3. **Task Unchecked:** When a completed task is unchecked (`completed: true -> false`), re-evaluate its schedule; if `triggerAt > now`, reschedule the alert (`RF-28`); if `triggerAt <= now`, do not fire a past alert.
  4. **Task Copied (`RF-16`):** When a task is copied to a group as a new incomplete task with a due date, evaluate `REQ-NT-07`/`REQ-NT-08` for the newly created task's `id`.
  5. **Task or Group Deleted:** When a task is deleted or a non-Personal group is cascade-deleted (`RF-07`), immediately cancel any pending timers for the affected task(s) and remove their deduplication tracking entries.

- **REQ-NT-10 (Ubiquitous - Occurrence Deduplication):**  
  The system shall persist notified-occurrence markers per user so that a due-date alert for a specific task schedule `(taskId, dueDate, dueTime ?? 'date-only')` fires **at most once** across browser reloads, manual refreshes, re-logins, and non-schedule edits (such as renaming a task or modifying its tags/description) (`RF-28`). Only changing the task's `dueDate` or `dueTime` establishes a fresh alertable occurrence for that task.

- **REQ-NT-11 (Event-Driven - Dual Delivery: Notification Center Record + Best-Effort Browser Alert):**  
  When a due-date alert triggers for an eligible task, the system shall:
  1. Always create and persist an unread `Notification` record for `currentUser.id` with `eventType: 'due_date'`, Spanish descriptive content referencing the task title (and formatted due date/time per the user's `timeFormat`), `read: false`, and `createdAt` equal to the current ISO-8601 UTC timestamp (`RF-27`, `RF-29`).
  2. Update the active Notification Center list and unread counter immediately (`RNF-01`).
  3. If browser notification support is available and permission is `'granted'`, dispatch a native browser notification on a **best-effort** basis with the localized Spanish heading and task message, catching any platform dispatch exception gracefully without interrupting application flow (`RF-27`, `RNF-18`).

- **REQ-NT-12 (Event-Driven - Session Teardown & Device Notification Cessation):**  
  When the authenticated session terminates via explicit logout (`REQ-AU-08`), session expiration (`REQ-AU-09`), orphaned session detection (`REQ-AU-09`), or account deletion (`REQ-AU-19`), the system shall immediately cancel all scheduled runtime due-alert timers and clear in-memory notification state so no browser notifications are emitted on that device for the signed-out user (`RF-02`). On account deletion, persisted notification records and user-scoped device notification tracking state (8-hour permission cooldown timestamp and occurrence deduplication records) for that `user.id` shall also be permanently removed (`REQ-AU-19(3)`).

### 3.3 In-App Notification Center, Read/Delete Actions & 30-Day Retention (`RF-29`, `UI-01`, `UI-07`, `RNF-10`, `RNF-12`, `RNF-14`, `Appendix B`)

- **REQ-NT-13 (Ubiquitous - Header Trigger, Unread Indicator & Panel Ordering):**  
  While authenticated in the workspace (`/`), the system shall display a Notification Center trigger in the account/navigation header showing the active user's unread notification count (`notifications.filter(n => !n.read).length`) whenever `unreadCount > 0` (and an accessible label reflecting 0 or N unread notifications). Opening the Notification Center panel displays the authenticated user's notifications ordered newest first (`createdAt` descending, `id` descending tie-breaker), together with a `"Marcar todas como leídas"` action disabled whenever `unreadCount === 0` and enabled whenever `unreadCount > 0`.

- **REQ-NT-14 (Ubiquitous - Notification Entry Details, Permission Status & Empty State):**  
  Each notification item in the Notification Center shall display:
  1. Localized Spanish message content identifying the task due alert.
  2. Timestamp/date evaluated in the user's `timeZone` and formatted with `dd/mm/aaaa` and the user's preferred `timeFormat` (`'24h'` or `'12h'`) (`UI-07`, `RNF-14`).
  3. Distinct visual and non-color unread indicator (`'Sin leer'` badge/status label + styling on unread items, `RNF-12`).
  4. An accessible `"Marcar como leída"` control on unread items and an accessible `"Eliminar"` control on every item.
  When the user has zero retained notifications, the Notification Center shall display `notifications.emptyState` (`RF-29`). In addition, the Notification Center panel shall render a discrete browser notification permission status section displaying `permissionGrantedStatus` when `'granted'`, `permissionDefaultStatus` with `"Activar avisos"` when `'default'`, `permissionDeniedStatus` with `permissionBlockedInstructions` when `'denied'`, or `permissionUnsupportedNote` when unsupported (`RF-27`).

- **REQ-NT-15 (Event-Driven - Mark as Read, Mark All as Read & Individual Delete):**  
  When the user activates `"Marcar como leída"` on an unread notification belonging to `currentUser.id`, the system shall immediately update `read: true` in persistent storage and decrement the unread badge count. When the user activates `"Marcar todas como leídas"` while `unreadCount > 0`, the system shall immediately update `read: true` in persistent storage for every unread notification belonging strictly to `currentUser.id` and reset the unread badge count to `0` without modifying any other user's records. When the user activates `"Eliminar"` on a notification belonging to `currentUser.id`, the system shall immediately remove that notification from persistent storage and the Notification Center list (`RF-29`).

- **REQ-NT-16 (State-Driven - Automatic 30-Day Retention Pruning):**  
  Upon authenticated workspace initialization, notification hydration, and opening the Notification Center, the system shall permanently delete any notification belonging to `currentUser.id` whose age satisfies `now - createdAt >= 30 days` (`Appendix B` 1-month retention = 30 days), keeping all notifications younger than 30 days and leaving other users' notifications untouched (`RF-29`).

- **REQ-NT-17 (Ubiquitous - Strict Per-User Notification Isolation):**  
  Every read, unread-count, mark-read, mark-all-read, delete, cooldown, deduplication, and retention-pruning operation shall scope strictly to records matching `currentUser.id`. Notifications and permission reminder state belonging to other local accounts shall never be exposed, modified, or deleted by another user (`RF-29`, `RNF-10`).

### 3.4 Accessibility, Mobile-First Responsiveness & Spanish Localization (`UI-01`, `RNF-12`, `RNF-14`)

- **REQ-NT-18 (Ubiquitous - Accessible Mobile-First Presentation & Spanish Copy):**  
  The Notification Center trigger, panel/drawer/modal, permission reminder banner, Notification Center permission-status section, read/unread badges, empty state, and action controls shall adapt cleanly from ~375px mobile viewports to desktop (`UI-01`), support full keyboard navigation (`Tab`, `Enter`, `Space`, `Escape` to close the Notification Center), maintain visible focus rings, use descriptive Spanish `aria-label` attributes, announce unread count and permission alerts accessibly (`RNF-12`), and source 100% of user-facing strings from the centralized Spanish localization dictionary (`RNF-14`).

---

## 4. Domain Models & Specifications

### 4.1 Notification Domain Contracts (`Appendix B`)

```
Notification Contract (Existing Foundation Entity):
- id: string (unique identifier)
- userId: string (recipient User.id)
- eventType: string ('due_date' in MVP; structured cleanly for future RF-20 / RF-30 event types)
- content: string (localized Spanish message content, non-empty)
- read: boolean (false on creation, true once marked read)
- createdAt: ISO-8601 UTC timestamp (evicted after 30 days)

DeviceNotificationState Contract (Per-User Permission Cooldown & Occurrence Deduplication):
- userId: string (owner User.id scoping cooldown and deduplication on this browser/device)
- permissionPromptLastShownAt: ISO-8601 UTC timestamp | null (enforces 8-hour automatic reminder cooldown for userId)
- deliveredOccurrences: Record<taskId, occurrenceKey> (or per-user entries { userId, taskId, occurrenceKey, notifiedAt })
  where occurrenceKey uniquely identifies (dueDate, dueTime ?? 'date-only')

Core Invariants:
1. Best-Effort + Guaranteed Inbox Recording: Browser popups are never guaranteed; every due alert ALWAYS lands in the Notification Center first.
2. Timezone & Format Fidelity: Date-only due alerts evaluate 09:00:00 in user.timeZone; rendered times obey user.timeFormat ('24h' vs '12h') and dd/mm/aaaa dates.
3. No Undated Alerts: A task with dueDate == null never produces a due alert.
4. Once-Per-Occurrence Deduplication: Unchanged (dueDate, dueTime) on the same task never refires across page reloads or refreshes.
5. Logout Cessation & 30-Day Eviction: Session termination immediately cancels all active timers on that device; records >= 30 days old are pruned automatically.
6. Strict Per-User Isolation & Cleanup: Notification records, 8-hour permission cooldowns, and occurrence tracking are strictly isolated by userId and removed on account deletion.
```

### 4.2 Due-Date Alert Trigger Decision Matrix (`RF-28`)

| Task Properties | Save / Load Timing (`user.timeZone`) | Trigger Instant | Action |
| :--- | :--- | :--- | :--- |
| `completed: true` | Any | N/A | Cancel pending timer; do not fire |
| `dueDate: null` | Any | None | Never schedule or fire |
| `dueDate + dueTime` (future) | `triggerAt > now` | Exact `dueDate` + `dueTime` in `user.timeZone` | Schedule active timer |
| `dueDate + dueTime` (created/edited already past) | `triggerAt <= now` at creation/edit | Past instant | Mark visually overdue (`RF-14`); do not fire immediate notification |
| `dueDate + dueTime` or `dueDate` only (missed while closed) | `triggerAt` became `<= now` after task saved & unnotified | Past instant (< 30 days) | Fire catch-up notification once on workspace entry |
| `dueDate` only (future day) | `dueDate > today` in `user.timeZone` | `09:00:00` local on `dueDate` | Schedule active timer |
| `dueDate` only (`today`, before 09:00) | `now < today 09:00:00` local | `09:00:00` local today | Schedule active timer |
| `dueDate` only (`today`, `>= 09:00`) | Created or edited today with `now >= today 09:00:00` | Immediate (`now`) | Fire immediately once (and mark notified) |
| `dueDate` only (strictly past day at save) | `dueDate < today` in `user.timeZone` at creation/edit | Past day | Mark visually overdue (`RF-14`); do not fire unsolicited alert |

### 4.3 Spanish Localization Contract (`RNF-14`)

All user-facing copy is centralized in the Spanish localization dictionary under a `notifications` namespace:

- **Header & Notification Center (`RF-29`):**
  - `centerButtonLabel`: `'Notificaciones'`
  - `centerButtonAria`: `'Abrir centro de notificaciones ({count} sin leer)'`
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
- **Permission Reminder & Blocked Guidance (`RF-27`):**
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
- **Alert Content Templates (`RF-28`):**
  - `dueAlertTitle`: `'Aviso de vencimiento'`
  - `dueAlertWithTime`: `'La tarea "{title}" vence el {date} a las {time}.'`
  - `dueAlertDateOnly`: `'La tarea "{title}" vence el {date}.'`

---

## 5. Acceptance Criteria

1. **AC-NT-01 (Discrete Per-User Permission Reminder, 8-Hour Cooldown & Manual Control):** Opening `/` with `'default'` permission displays the discrete Spanish permission banner for that `userId`; clicking `"Ahora no"` (or reloading immediately after) suppresses automatic banner re-display for that `userId` until **8 hours** have elapsed, while another user on the same browser evaluates their own cooldown independently and the Notification Center panel still exposes permission status and a manual `"Activar avisos"` trigger.
2. **AC-NT-02 (Blocked Permission Instructions):** When browser notification permission is `'denied'`, both the reminder banner (when eligible) and the Notification Center panel permission-status section display clear Spanish instructions explaining how to re-enable site notifications via browser settings without offering a dead prompt action.
3. **AC-NT-03 (Exact Time & Date-Only 09:00 Scheduling in User Timezone):** A task with `dueDate` + `dueTime` schedules its alert for that exact instant in `user.timeZone`; a future date-only task schedules for `09:00` local time in `user.timeZone`; a date-only task created/edited for today after `09:00` fires immediately; tasks created/edited strictly in the past or without `dueDate` never trigger unsolicited alerts—neither on save nor across subsequent reloads (`REQ-NT-08(2)`).
4. **AC-NT-04 (Dual Delivery & Best-Effort Browser Dispatch):** When an alert triggers, a `Notification` entry (`read: false`) is always created in the user's Notification Center, and if permission is `'granted'`, a native browser `Notification` is dispatched gracefully without failing when browser APIs are unavailable or throw.
5. **AC-NT-05 (Recalculation, Cancellation & Uncheck Rescheduling):** Editing a task's due date/time reschedules its alert; completing or deleting a task (or deleting its parent group) cancels its pending alert; unchecking a completed task whose due trigger remains in the future reschedules its alert.
6. **AC-NT-06 (Reload Deduplication):** Triggering a task due alert, reloading the page, or editing non-schedule fields (title/tags) does not produce duplicate Notification Center items or duplicate browser popups for the same `(taskId, dueDate, dueTime)` occurrence.
7. **AC-NT-07 (Session Teardown on Logout / Expiry / Account Deletion):** Logging out, expiring a session, or deleting an account immediately cancels active alert timers so zero browser alerts fire on that device afterward.
8. **AC-NT-08 (Notification Center Read, Mark All Read, Delete & Unread Count):** Unread badge count tracks unread notifications for `currentUser.id` accurately; marking an item read updates it & decrements the unread count; `"Marcar todas como leídas"` (disabled when `unreadCount === 0`) marks all unread items for `currentUser.id` read and sets the unread count to `0`; deleting removes the item permanently without affecting other users.
9. **AC-NT-09 (30-Day Retention Pruning & Multi-User Isolation):** Notifications 30 days or older are pruned automatically on workspace/center load while keeping younger items intact; switching accounts isolates notifications, cooldowns, and deduplication records per `userId`, and account deletion removes all persisted notification state for that user.
10. **AC-NT-10 (Accessibility, Formatting & Mobile-First UI):** Notification triggers, badges, banners, and Notification Center render cleanly at ~375px width, format dates as `dd/mm/aaaa` and times in `24h`/`12h` per user preference, operate fully by keyboard (`Tab`, `Enter`, `Space`, `Escape`), and use 100% Spanish copy.

---

## 6. Traceability Matrix

| SRS Requirement | Feature Requirement | Coverage Details |
| :--- | :--- | :--- |
| **RF-27** | REQ-NT-01..REQ-NT-05, REQ-NT-11, REQ-NT-12 | Browser permission state, per-user 8-hour cooldown banner, Notification Center manual status/control, blocked instructions, best-effort native delivery, Notification Center mirroring, session-end cessation |
| **RF-28** | REQ-NT-06..REQ-NT-11 | Timed exact local alerts, date-only 09:00 local alerts, immediate today post-09:00, undated exclusion, recalculation/cancel/uncheck, dedupe |
| **RF-29** | REQ-NT-13..REQ-NT-17 | Notification Center panel & unread badge, mark as read, mark all as read, delete, 30-day automatic pruning, per-user isolation |
| **RF-02** | REQ-NT-12 | Stop browser alerts on device upon logout / session expiration |
| **RF-05** | REQ-NT-12, REQ-NT-17 | Notification timer cancellation and per-user notification + device-state cleanup boundary on account deletion |
| **RF-07 / RF-13 / RF-14 / RF-16** | REQ-NT-09 | Task edits, completions, unchecks, task copies, task deletion, and group deletion update alert schedules |
| **UI-01 / UI-07** | REQ-NT-13, REQ-NT-14, REQ-NT-18 | Mobile-First responsive Spanish UI with user `24h`/`12h` preference |
| **RNF-03** | REQ-NT-08 | Timely firing of active due-date alerts |
| **RNF-10 / RNF-18** | REQ-NT-05, REQ-NT-16, REQ-NT-17 | Per-user privacy isolation, graceful unsupported/denied degradation |
| **RNF-12 / RNF-14** | REQ-NT-14, REQ-NT-18, Section 4.3 | Keyboard & ARIA accessibility, non-color `'Sin leer'` status badges, `dd/mm/aaaa`, `timeZone`, Spanish localization |
| **RNF-19 / Appendix B** | REQ-NT-16, Section 4.1 | `Notification` structure and 30-day (1-month) retention rule |
| **RNF-20** | REQ-NT-06, Section 2.3, Section 4.1 | Extensible `eventType` and recipient resolution ready for `RF-20` reminders & `RF-30` shared-group notifications |

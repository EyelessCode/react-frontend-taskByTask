# Implementation Plan: `006-backend-integration` (Backend REST API Integration, Keyset Pagination & Web Push)

- **Feature Name:** `006-backend-integration`
- **Status:** implemented
- **Approved Spec:** [docs/specs/006-backend-integration/spec.md](./spec.md) (`Status: implemented`)
- **OpenAPI Reference Snapshot:** `Task by Task API 1.0.0-mvp` (`27` paths / `37` operations)
- **Constitution:** [docs/constitution.md](../../constitution.md)
- **Reference Patterns:** `src/features/tasks/` (golden reference), `src/features/groups/`, `src/features/auth/`, `src/features/notifications/`

---

## 1. Architecture Overview & Design Goals

`006-backend-integration` connects the completed Task by Task MVP frontend (`000-foundation` through `005-notifications`) to the live **Task by Task REST API (`v1.0.0-mvp`)** while preserving `localStorage` offline/demo mode as the default mode with zero regression (`REQ-BI-01`, `REQ-BI-23`).

Key architectural principles applied:
1. **Dual Persistence Mode Behind Isolated Data Contracts (`Constitution Principle 3`, `REQ-BI-01`, `REQ-BI-23`):**
   - Environment configuration (`VITE_PERSISTENCE_MODE`) defaults to `'localStorage'` when unset/empty, activates `'api'` when explicitly configured, and fails deterministically with `ConfigurationError` on unrecognized values.
   - All existing `LocalStorage*Repository` classes and `tbt:v1:*` storage keys remain untouched so offline development, CI, and existing unit/integration/E2E suites stay 100% green.
   - All HTTP transport, CSRF management, RFC 7807 error parsing, Zod DTO validation, and domain mapping live strictly inside `src/data/api/`. UI components never call `fetch` or read `localStorage` directly.
2. **Native Credentialed Transport & Deterministic CSRF / `401` Handling (`RNF-07`, `RNF-08`, `RNF-09`, `REQ-BI-02`..`08`):**
   - Zero new npm packages: uses native `fetch` with `credentials: "include"` on every request.
   - Local development proxies `/api -> http://localhost:8080` in `vite.config.ts` (explicitly authorized by user) so `HttpOnly` `SameSite=Lax` `SESSION` and `XSRF-TOKEN` cookies operate on same-origin; optional `VITE_API_BASE_URL` prefixes requests in non-proxied deployments.
   - `ApiHttpClient` bootstraps CSRF via `GET /api/v1/auth/csrf` (deduplicating concurrent bootstrap calls), attaches `X-XSRF-TOKEN` on every `POST`/`PATCH`/`PUT`/`DELETE` (including `register`, `login`, `recover-password`, `logout`), invalidates the cached token on auth state transitions, and retries any first-attempt mutation `403` **at most once** after refreshing CSRF (`REQ-BI-04(2)`).
   - `401` handling is strictly context-aware (`'session-probe'` silent redirect on cold start, `'login'` generic invalid credentials, `'authenticated'` mid-session teardown with best-effort local push unsubscribe and `auth.sessionExpired` notice, `'logout'` silent local cleanup).
3. **Runtime Zod Validation & `RNF-20` Forward-Compatible Domain Mapping (`Constitution Principle 4`, `REQ-BI-03`, `REQ-BI-15`..`19`):**
   - Every non-empty 2xx response across all 37 OpenAPI operations is validated against strict Zod DTO schemas before mapping into domain models (`int64 <-> string` IDs, `timezone <-> timeZone`, `24H/12H <-> 24h/12h`, `assignedUserId <-> assigneeId`, `HH:mm[:ss] -> HH:mm`, `TaskResponse.overdue`, `GroupResponse` synthesized single-creator `members[]`, `email` up to 255 inbound, open non-empty `NotificationResponse.eventType`, and 0..9 fractional-digit ISO timestamps).
4. **Per-Group Keyset Pagination & Server-Delegated Filtering (`RNF-04`, `RF-24`, `RF-25`, `REQ-BI-15`, `REQ-BI-16`):**
   - Strictly preserves the MVP **Groups Grid View** (`UI-02`; no `RF-26` separate filtered view).
   - Groups paginate via `GET /api/v1/groups` (`cursor`, `limit`), exposing `"Cargar más grupos"` in the grid footer, group filter toolbar, and Move/Copy modal, with deduplicated immediate insertion of newly created groups.
   - Each visible group card owns independent pagination state via `GET /api/v1/groups/{groupId}/tasks` (`status`, `search`, `cursor`, `limit`) and renders `"Cargar más tareas"`; `GET /api/v1/tasks` supports cross-group queries (including global search match checks across unloaded groups).
   - Count badges in `api` mode show `N` or `N+` per group card and show the loaded count only on the active status tab (`REQ-BI-16(3)`).
5. **Server-Driven Notifications & Web Push VAPID Lifecycle (`RF-27`..`RF-29`, `REQ-BI-19`..`22`):**
   - In `api` mode, client-side due-alert timers (`due-alert-scheduler.ts`) are completely disabled; the backend schedules due alerts and enforces 30-day retention.
   - `public/sw.js` handles incoming `push` events (JSON + plain text + empty Spanish fallbacks) and `notificationclick` focus/navigation to `/`.
   - `WebPushAdapter` handles Service Worker registration, VAPID Base64URL key decoding, `PushManager.subscribe`, `POST /api/v1/notifications/push/subscriptions`, atomic `endpoint` transmission on `POST /api/v1/auth/logout`, and local `unsubscribe()` on logout, account deletion, and mid-session `401` expiry — degrading safely when VAPID returns `enabled: false`, VAPID lookup fails (`5xx`/network), or browser APIs are unsupported.
6. **Strict TypeScript (`erasableSyntaxOnly`) & React Compiler Discipline:**
   - Zero `any`, zero `@ts-ignore`, explicit `private readonly` / `public readonly` fields on all classes (no constructor parameter properties), `useWatch` / `<Controller>` in RHF forms, no unnecessary manual `useMemo`/`useCallback`, Mobile-First (~375px+) Bootstrap UI, keyboard/ARIA accessibility (`RNF-12`), and 100% centralized Spanish copy (`RNF-14`).

### Governance & Scope Check (`AGENTS.md`)
- **Packages:** Zero new npm packages installed.
- **Authorized Config Edit:** `vite.config.ts` updated solely to add `server.proxy['/api'] -> http://localhost:8080` (explicitly authorized by user in `#9`). `tsconfig*.json` and `eslint.config.js` remain untouched.
- **Storage Schema:** Existing `tbt:v1:*` `localStorage` keys and schemas remain backward-compatible; `User.passwordHash` becomes optional in the in-memory `User` domain contract while `LocalStorageUserRepository` keeps enforcing `passwordHash` on local persisted records.
- **Explicit Exclusions (`Posterior` Scope Guard):** No shared groups (`RF-08`..`10`), email (`RF-11`), subtasks (`RF-18`), assignment UI (`RF-19`), pre-due reminders (`RF-20`), recurring tasks (`RF-21`), tag screen (`RF-23`), advanced filters / unified results view (`RF-26`), collaborative notifications (`RF-30`), analyst dashboard (`RF-31`..`32`), or drag & drop / real-time (`RF-33`).

---

## 2. File & Module Inventory

### 2.1 Build, Environment & Public Assets
- **`vite.config.ts`** *(modified — authorized)*: Add `server: { proxy: { '/api': { target: 'http://localhost:8080', changeOrigin: true } } }`.
- **`.env.example`** *(created)*: Document `VITE_PERSISTENCE_MODE=localStorage` (`localStorage` | `api`) and optional `# VITE_API_BASE_URL=http://localhost:8080`.
- **`public/sw.js`** *(created)*: Service Worker handling `push` (JSON `{ title?, body?, content?, message?, url? }` -> plain text -> Spanish fallbacks `'Task by Task — Aviso de vencimiento'` / `'Tienes una nueva notificación de tarea pendiente.'`, same-origin `url` validation defaulting to `'/'`) and `notificationclick` (close notification, focus existing same-origin client or `clients.openWindow(url)`).

### 2.2 Shared Layer (`src/shared/`)
- **`src/shared/config/persistence.ts`** *(created)* & **`src/shared/config/index.ts`** *(created)*:
  - `PersistenceMode = 'localStorage' | 'api'`
  - `PersistenceConfig = { mode: PersistenceMode; apiBaseUrl: string }`
  - Pure `resolvePersistenceConfig(env)` (`REQ-BI-01`, `REQ-BI-02`), `getPersistenceConfig()`, `isApiMode()`, `setPersistenceConfigForTests(config)`, `resetPersistenceConfigForTests()`.
- **`src/shared/errors/domain-errors.ts`** *(modified)*:
  - Add `ConfigurationError`, `ApiProblemError` (carrying `status`, `title`, `detail`, `instance`, `invalidParams: Array<{ name: string; reason: string }>`, `retryAfterSeconds`), `UnauthorizedError`, `RateLimitError`, `NetworkError` — all using explicit `public readonly` fields (`erasableSyntaxOnly`).
- **`src/shared/i18n/es.ts`** *(modified)*:
  - Add every additive key specified in `spec.md` Section 4.3 (`common.loadingMore`, `errors.{networkError,serverError,tooManyRequests,rateLimitedMinutes,rateLimitedSeconds,invalidResponse,forbidden}`, `auth.{recoveryCodePlaceholder,recoveryCodeLengthError,recoveryCodeFormatError,remainingRecoveryCodes}`, `groups.{loadMoreGroups,taskCountAtLeast}`, `tasks.loadMoreTasks`, `notifications.{loadMoreNotifications,pushDisabledByServer,pushUnavailableStatus,pushSubscriptionError,pushFallbackTitle,pushFallbackBody}`).
- **`src/shared/schemas/`** *(modified)*:
  - `limits.ts`: Add `API_EMAIL_MAX: 255`, `KEYSET_PAGE_LIMIT_DEFAULT: 20`, `KEYSET_PAGE_LIMIT_MAX: 50`.
  - `common.ts`: Broaden `isoDateTimeSchema` regex to `/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,9})?(Z|[+-]\d{2}:\d{2})?$/` to support backend `Instant` nanosecond/microsecond precision and timezone offsets.
  - `user.ts`: Allow `email` up to `LIMITS.API_EMAIL_MAX` (255) on inbound `userSchema` (forms retain `LIMITS.USER_EMAIL_MAX` = 254), make `passwordHash` optional on `User` / `userSchema` (`passwordHash?: string`), add `localUserSchema` (requiring `passwordHash`) for `LocalStorageUserRepository`, and add optional `remainingRecoveryCodes?: number` (`0..8`).
  - `task.ts`: Add optional `overdue?: boolean` to `taskSchema` and `Task` interface.

### 2.3 Data Layer — API Transport, Schemas, Mappers & Repositories (`src/data/`)
- **`src/data/contracts/api-contracts.ts`** *(created)* & **`src/data/contracts/index.ts`** *(modified)*:
  - `KeysetPage<T>` (`content`, `nextCursor`, `hasNext`, `size`), `ApiTaskStatus = 'PENDING' | 'COMPLETED' | 'ALL'`.
  - `AuthApiClient` interface (10 endpoints: `getMe`, `register`, `login`, `logout`, `recoverPassword`, `updateProfile`, `changePassword`, `regenerateRecoveryCodes`, `deleteAccount`, plus `invalidateCsrf`).
  - `GroupsApiRepository` interface (5 endpoints: `listGroups`, `getGroup`, `createGroup`, `renameGroup`, `deleteGroup`).
  - `TasksApiRepository` interface (10 endpoints: `listTasks`, `listGroupTasks`, `getTask`, `createTask`, `updateTask`, `deleteTask`, `updateCompletion`, `moveTask`, `copyTask`, `detachTagFromTask`).
  - `TagsApiRepository` interface (3 endpoints: `listGroupTags`, `createOrReuseTag`, `deleteGroupTag`).
  - `NotificationsApiRepository` interface (9 endpoints: `listNotifications`, `getUnreadCount`, `markAsRead`, `markAllAsRead`, `deleteNotification`, `getVapidPublicKey`, `registerPushSubscription`, `deletePushSubscriptionByEndpoint`, `deletePushSubscriptionById`).
- **`src/data/api/problem-detail.ts`** *(created)*:
  - `problemDetailDtoSchema`, pure `parseProblemDetailResponse(status, contentType, rawBody)`, `formatRateLimitMessage(retryAfterSeconds, detail, context)`, `extractFieldErrorMap(error)`.
- **`src/data/api/http-client.ts`** *(created)*:
  - `ApiHttpClient` class (`credentials: 'include'`, CSRF bootstrap + dedupe + invalidation + single-retry `403`, context-aware `401` callback, runtime Zod validation via `responseSchema`, `204` empty-body handling, network error wrapping).
- **`src/data/api/dto-schemas.ts`** *(created)*:
  - Complete Zod schemas for all `Task by Task API 1.0.0-mvp` DTOs and generic `createKeysetPageSchema(itemSchema)`.
- **`src/data/api/dto-mappers.ts`** *(created)*:
  - Pure mappers: `parseNumericId`, `normalizeBackendDueTime`, `mapTimeFormatFromDto`, `mapTimeFormatToDto`, `mapTaskFilterToApiStatus`, `mapUserFromDto`, `mapGroupFromDto`, `mapTagFromDto`, `mapTaskFromDto`, `mapNotificationFromDto`.
- **`src/data/api/auth-api-client.ts`** *(created)*: Implements `AuthApiClient`.
- **`src/data/api/groups-api-repository.ts`** *(created)*: Implements `GroupsApiRepository`.
- **`src/data/api/tasks-api-repository.ts`** *(created)*: Implements `TasksApiRepository`.
- **`src/data/api/tags-api-repository.ts`** *(created)*: Implements `TagsApiRepository`.
- **`src/data/api/notifications-api-repository.ts`** *(created)*: Implements `NotificationsApiRepository`.
- **`src/data/api/runtime.ts`** *(created)* & **`src/data/api/index.ts`** *(created)*:
  - `ApiServices` bundle + `getApiServices()`, `configureApiServicesForTests(...)`, `resetApiServicesForTests()`, `registerUnauthorizedHandler(handler)` so `useAuthStore` hooks mid-session `401` cleanly without circular imports.
- **`src/data/repositories/local-storage-user-repository.ts`** *(modified)*: Validate persisted local users against `localUserSchema` (preserving required `passwordHash` invariant in `localStorage` mode).

### 2.4 Auth Feature (`src/features/auth/`)
- **`src/features/auth/utils/recovery-codes.ts`** *(modified)*:
  - Add pure `validateRecoveryCodeFormat(raw: string): { ok: true; stripped8: string } | { ok: false; error: string }`, `normalizeRecoveryCodeForLocalStorage(code: string): string` (`XXXXXXXX`), and `normalizeRecoveryCodeForApi(code: string): string` (`XXXX-XXXX`), keeping `normalizeRecoveryCode` backward-compatible for `localStorage` (`REQ-BI-13`).
- **`src/features/auth/schemas/auth-form-schemas.ts`** *(modified)*:
  - Update `recoveryCodeFieldSchema` using `validateRecoveryCodeFormat` via `.superRefine(...)` so both `XXXX-XXXX` and `XXXXXXXX` pass while rejecting empty, invalid characters/misplaced hyphens, and wrong alphanumeric length with the exact reconciled Spanish messages (`REQ-BI-13`).
- **`src/features/auth/store/auth-store.ts`** *(modified)* & **`src/features/auth/hooks/use-auth.ts`** *(modified)*:
  - Add `fieldErrors: Record<string, string>` and `oneTimeRecoveryCodesNotice: string | null` to `AuthState`.
  - Add optional `mode`, `authApi`, `getPushEndpoint`, and `unsubscribeLocalPush` to `AuthStoreDependencies`.
  - Implement dual-mode branching in `validateSession`, `register`, `login`, `logout`, `recoverPassword`, `updateProfile`, `changePassword`, `regenerateRecoveryCodes`, `deleteAccount`, plus `handleMidSessionUnauthorized()` registered with `registerUnauthorizedHandler(...)`.
- **`src/features/auth/components/`** *(modified)*:
  - `LoginPage.tsx`, `RegisterPage.tsx`, `RecoverPasswordPage.tsx`, `ProfilePage.tsx`: Apply `fieldErrors` into RHF `form.setError(...)` (`REQ-BI-06`), pass `oneTimeRecoveryCodesNotice` into `OneTimeRecoveryCodesCard`, and render `es.auth.remainingRecoveryCodes(currentUser.remainingRecoveryCodes)` on `ProfilePage` when present (`REQ-BI-14(1)`).
  - `OneTimeRecoveryCodesCard.tsx`: Accept optional `warningMessage?: string` (default `es.auth.recoveryCodesWarning`).

### 2.5 Groups, Tasks & Tags Features (`src/features/{groups,tasks,tags}/`)
- **`src/features/groups/store/groups-store.ts`** *(modified)* & **`src/features/groups/hooks/use-groups.ts`** *(modified)*:
  - Add `groupsNextCursor`, `groupsHasNext`, `isLoadingMoreGroups`, `groupTaskPages: Record<string, GroupTaskPageState>`, `globalSearchHasMatches`, `loadMoreGroups()`, `loadMoreGroupTasks(groupId)`, and optional `mode` / `groupsApi` / `tasksApi` / `tagsApi` / `searchDebounceMs` dependencies.
  - In `api` mode: hydrate via `groupsApi.listGroups` + per-group `tasksApi.listGroupTasks` (plus `tasksApi.listTasks` cross-group search verification when `search` is non-empty and `groupsHasNext === true`); debounce search input with monotonic request sequence ID to ignore stale responses (`REQ-BI-16(2)`); append newly created groups immediately and deduplicate+sort when loading later pages (`REQ-BI-15(3)`); reconcile stale `403`/`404` errors gracefully (`REQ-BI-09(2)`).
  - In `localStorage` mode: preserve existing behavior identically (`REQ-BI-23`).
- **`src/features/tasks/store/tasks-store.ts`** *(modified)* & **`src/features/tasks/hooks/{use-tasks,use-task-move-copy,use-task-form}.ts`** *(modified)*:
  - Add optional `mode`, `tasksApi`, `groupsApi`, `tagsApi` dependencies and `loadGroupTags(groupId, query?)`, `getTaskById(taskId)` actions.
  - In `api` mode: execute all task & tag CRUD/move/copy/completion/detach/delete mutations against backend endpoints, skip local notification hooks (`REQ-BI-19(1)`), and keep group tag catalog synchronized from `TaskResponse.tags` and `GET /api/v1/groups/{groupId}/tags`.
  - `useTaskMoveCopy`: Accept `mode: 'move' | 'copy'`; include source group for `'copy'` in `api` mode (`REQ-BI-15(3)`) while excluding source group for `'move'` and for both modes in `localStorage` mode (`001-tasks` `REQ-TK-19` parity); expose `groupsHasNext`, `isLoadingMoreGroups`, `loadMoreGroups`.
  - `useTaskForm`: Fetch `loadGroupTags(targetGroupId)` when opening in `api` mode, and map `ApiProblemError.invalidParams` to RHF field errors + form error banner (`REQ-BI-06`).
- **`src/features/groups/hooks/use-group-form.ts`** *(modified)*:
  - Catch `ApiProblemError`, map `invalidParams` (`name`) to RHF field error, and return/expose general form error (`REQ-BI-06`).
- **UI Components (`src/features/{groups,tasks}/components/`)** *(modified)*:
  - `TaskCard.tsx`: Use `task.completed ? false : typeof task.overdue === 'boolean' ? task.overdue : isTaskOverdue(...)` (`REQ-BI-17(7)`).
  - `GroupCard.tsx`: Support `hasMoreTasks`, `isLoadingMoreTasks`, `onLoadMoreTasks`, `es.groups.taskCountAtLeast(n)` badge, and `"Cargar más tareas"` button.
  - `GroupsFilterToolbar.tsx`: Support `isApiMode`, `activeTabHasMore`, `groupsHasNext`, `isLoadingMoreGroups`, `onLoadMoreGroups`; active-tab-only count badge (`(N)` / `(N+)`) in `api` mode (`REQ-BI-16(3)`) and `"Cargar más grupos"` button in group filter row (`REQ-BI-15(3)`).
  - `GroupsGridView.tsx`: Wire pagination props, render grid-footer `"Cargar más grupos"` button, and handle `globalSearchHasMatches` accurately in `api` mode.
  - `TaskMoveCopyModal.tsx`: Pass `mode` to `useTaskMoveCopy`, render `"Cargar más grupos"` when `groupsHasNext === true`, and suppress `tasks.noOtherGroups` while additional group pages remain (`REQ-BI-15(3)`).
  - `GroupFormModal.tsx` & `TaskFormModal.tsx`: Render accessible `<Alert variant="danger" role="alert">` for general API errors while keeping modal open and user input intact (`REQ-BI-06`, `REQ-BI-09`).

### 2.6 Notifications & Web Push Feature (`src/features/notifications/`)
- **`src/features/notifications/utils/web-push.ts`** *(created)* & **`src/features/notifications/utils/index.ts`** *(modified)*:
  - Pure `urlBase64ToUint8Array(base64Url)`, `extractPushSubscriptionPayload(sub)`, `parsePushNotificationPayload(rawText)` (matching `public/sw.js` fallback logic), and `WebPushAdapter` interface + `createWebPushAdapter()`.
- **`src/features/notifications/store/notifications-store.ts`** *(modified)* & **`src/features/notifications/hooks/use-notifications.ts`** *(modified)*:
  - Add `hasNext`, `nextCursor`, `isLoadingMore`, `pushStatus` (`'idle' | 'enabled' | 'disabled-by-server' | 'unavailable' | 'unsupported' | 'subscription-error'`), `vapidPublicKey`, `loadMoreNotifications()`, and optional `mode` / `notificationsApi` / `webPush` dependencies.
  - In `api` mode:
    - Disable client-side due-alert timers (`handleTaskSaved`/`Toggled`/`Deleted` are no-ops; `syncWorkspaceTasksForUser` never runs) (`REQ-BI-19(1)`).
    - `init()` fetches `unreadCount` + `getVapidPublicKey()`, handles `enabled: false` / `5xx`/network / unsupported / granted subscription / default-or-denied 8h cooldown banner (`REQ-BI-20`, `REQ-BI-21`).
    - `openCenter()` & `refresh()` load paginated notifications (`GET /api/v1/notifications`) and `unreadCount` (re-attempting VAPID discovery on `refresh()` if `pushStatus === 'unavailable'`).
    - `requestPermission()` subscribes to Web Push when newly granted and VAPID is enabled.
    - `markAsRead`, `markAllAsRead`, `deleteNotification`, `loadMoreNotifications` execute backend endpoints and keep `notifications`, `unreadCount`, `nextCursor`, and `hasNext` synchronized.
- **`src/features/notifications/components/NotificationCenterPanel.tsx`** *(modified)*:
  - Display `pushDisabledByServer`, `pushUnavailableStatus`, or `pushSubscriptionError` in the status block when applicable (`REQ-BI-21`).
  - Render accessible `"Cargar más notificaciones"` button when `hasNext === true` (`REQ-BI-19(2)`).

### 2.7 Test Files (`tests/`)
- **New Unit Tests:**
  - `tests/unit/shared/config/persistence.test.ts` (`REQ-BI-01`, `REQ-BI-02`)
  - `tests/unit/data/api/http-client.test.ts` (`REQ-BI-03`..`09`: `credentials: "include"`, CSRF bootstrap/dedupe/invalidation/single-retry `403`, RFC 7807 `400`/`409`/`429` formatting, context-aware `401`, network/5xx/invalid-JSON errors)
  - `tests/unit/data/api/dto-mappers.test.ts` (all DTO schemas & mappers, `email` 255, `HH:mm[:ss]`, `overdue`, `RNF-20` group members, open `eventType`, nanosecond ISO dates)
  - `tests/unit/data/api/api-repositories.test.ts` (all 27 paths / 37 operations verified against exact URLs, HTTP methods, query params, request bodies, and response validation)
  - `tests/unit/features/auth/recovery-code-normalization.test.ts` (`REQ-BI-13` dual format validation & per-mode normalization)
  - `tests/unit/features/auth/auth-store-api.test.ts` (`REQ-BI-06`..`14`, `REQ-BI-22`)
  - `tests/unit/features/groups/groups-tasks-api-store.test.ts` (`REQ-BI-15`..`18`, per-group pagination, debounced search, stale-response guard, Move/Copy/new-group paginated edge cases, `403`/`404`/`409` recovery)
  - `tests/unit/features/notifications/web-push.test.ts` (`urlBase64ToUint8Array`, `parsePushNotificationPayload` JSON/plain/empty/malformed fallbacks, `WebPushAdapter`)
  - `tests/unit/features/notifications/notifications-store-api.test.ts` (`REQ-BI-19`..`22`: disabled local timers, paginated Notification Center, VAPID enabled/`false`/`5xx`/unsupported, subscription error)
- **Updated Existing Unit Tests:**
  - `tests/unit/shared/i18n/es.test.ts`, `tests/unit/shared/schemas/limits.test.ts`, `tests/unit/features/auth/auth-form-schemas.test.ts` (align recovery code format assertions with `REQ-BI-13`).
- **New Integration Tests:**
  - `tests/integration/features/backend-integration/api-mode-flow.test.tsx` (RTL integration tests in `api` mode with mocked `fetch`: login/register/profile/recovery with `invalidParams` & `429`, mid-session `401` redirect with `sessionExpired`, Groups Grid View with `"Cargar más grupos"` & per-group `"Cargar más tareas"`, `N+` & active-tab-only counts, Move/Copy modal `"Cargar más grupos"`, Notification Center `"Cargar más notificaciones"` & `pushDisabledByServer` notice).
- **Playwright E2E Tests (`tests/e2e/` & `playwright.config.ts`):**
  - `playwright.config.ts` *(modified)*: Configure dual Playwright `webServer` + `projects`:
    - `chromium` (`http://localhost:5173`, default `localStorage` mode, `testIgnore: '**/backend-integration.spec.ts'`) running all existing offline E2E specs with zero changes.
    - `chromium-api` (`http://localhost:5174`, `npx vite --port 5174 --strictPort` with `env: { VITE_PERSISTENCE_MODE: 'api' }`, `testMatch: '**/backend-integration.spec.ts'`) running the mocked-API E2E suite against real Vite `api`-mode bundling.
  - `tests/e2e/backend-integration.spec.ts` *(created)*: Mocked backend via Playwright `page.route('**/api/v1/**')` verifying `AC-BI-01`..`AC-BI-10` at desktop `1280x720` and mobile `375x812` with zero console/page errors.
  - All existing E2E specs (`smoke`, `auth`, `tasks`, `groups`, `tags`, `notifications`) verified green in default `localStorage` mode (`REQ-BI-23`).

---

## 3. Detailed Technical Design

### 3.1 HTTP Transport, CSRF & Error Pipeline (`src/data/api/http-client.ts`)

```
requestJson({ method, path, query, body, responseSchema, authContext = 'authenticated', allowEmpty = false }):
1. Build URL: `${apiBaseUrl}${path}${serializeQuery(query)}` (repeated keys for array params like `groupIds=1&groupIds=2`).
2. Prepare headers: `Accept: 'application/json, application/problem+json'`; if body !== undefined, `Content-Type: 'application/json'`.
3. If method in ['POST', 'PATCH', 'PUT', 'DELETE']:
   - await ensureCsrfToken()  // single-flight GET /api/v1/auth/csrf -> caches { token, headerName }
   - set header[csrfHeaderName] = csrfToken
4. Execute fetch(url, { method, credentials: 'include', headers, body: body !== undefined ? JSON.stringify(body) : undefined }).
   - Catch network reject -> throw new NetworkError(es.errors.networkError).
5. If response.status === 403 && isMutation && attempt === 0:
   - invalidateCsrfToken()
   - retry once (attempt = 1) with fresh GET /api/v1/auth/csrf token (`REQ-BI-04(2)`).
6. If response.status === 401:
   - Parse RFC 7807 body (if present).
   - If authContext === 'authenticated':
     - invalidateCsrfToken()
     - await onUnauthorizedSessionExpired?.()  // local push unsubscribe + clear stores + loginNotice = sessionExpired + emit('expired')
   - throw new UnauthorizedError(detail || es.auth.invalidCredentials, problem)
7. If !response.ok:
   - Parse ProblemDetailResponse via parseProblemDetailResponse(status, contentType, text):
     - 429 -> throw RateLimitError(retryAfterSeconds, detail)
     - 400 / 403 / 404 / 409 / 5xx -> throw ApiProblemError({ status, title, detail, invalidParams, retryAfterSeconds })
8. If response.status === 204 || allowEmpty && text.trim() === '':
   - return undefined
9. Parse JSON & validate with responseSchema.safeParse(json):
   - If invalid -> throw new AppError / ApiProblemError(es.errors.invalidResponse) (`REQ-BI-03`).
   - Return parsed data.
```

### 3.2 Pure Recovery-Code Validation & Normalization (`REQ-BI-13`)

```ts
// Input rules:
// 1. trimmed = raw.trim()
// 2. If trimmed.length === 0 -> error: es.auth.recoveryCodeRequired
// 3. If /[^A-Za-z0-9-]/.test(trimmed) -> error: es.auth.recoveryCodeFormatError
// 4. hyphenCount = (trimmed.match(/-/g) ?? []).length
//    If hyphenCount > 1 -> error: es.auth.recoveryCodeFormatError
//    If hyphenCount === 1 && !/^[A-Za-z0-9]{4}-[A-Za-z0-9]{4}$/.test(trimmed):
//      - If stripped length !== 8 -> error: es.auth.recoveryCodeLengthError
//      - Else (e.g., "AB-CDEFGH") -> error: es.auth.recoveryCodeFormatError
// 5. stripped = trimmed.replace(/-/g, '').toUpperCase()
//    If stripped.length !== 8 -> error: es.auth.recoveryCodeLengthError
// 6. Valid!
//    - localStorage normalization: stripped (e.g. "A1B2C3D4")
//    - api normalization: `${stripped.slice(0, 4)}-${stripped.slice(4, 8)}` (e.g. "A1B2-C3D4")
```

### 3.3 Per-Group Keyset Pagination, Search Debounce & Count Badges (`REQ-BI-15`, `REQ-BI-16`)
- **State Structure in `useGroupsStore`:**
  - `groups`: loaded groups (deduplicated by `id`, sorted via `sortGroups`: `isPersonal` first, `createdAt ASC`, `id ASC`).
  - `groupsNextCursor: string | null`, `groupsHasNext: boolean`, `isLoadingMoreGroups: boolean`.
  - `groupTaskPages: Record<string, { nextCursor: string | null; hasNext: boolean; isLoadingMore: boolean }>`.
  - `requestSeq` (module-scoped counter): incremented whenever `init`, `refresh`, `setActiveFilter`, `setSelectedGroupIds`, `toggleGroupId`, or debounced `setSearchQuery` dispatches a server query; responses whose captured `seq !== requestSeq` are discarded so fast typing or filter switching never renders stale tasks.
- **Count Badges (`useGroups` -> `GroupsFilterToolbar` & `GroupCard`):**
  - `localStorage` mode: exact counts on all 3 status tabs (`Pendientes (N)`, `Completadas (N)`, `Todas (N)`) and exact `taskCount(n)` on each `GroupCard`.
  - `api` mode:
    - Each `GroupCard` receives `hasMoreTasks = groupTaskPages[group.id]?.hasNext ?? false`; header badge renders `hasMoreTasks ? es.groups.taskCountAtLeast(groupTasks.length) : es.groups.taskCount(groupTasks.length)`.
    - `GroupsFilterToolbar` receives `isApiMode = true` and `activeTabHasMore = visibleGroups.some(g => groupTaskPages[g.id]?.hasNext)`: renders active tab label with `(${activeLoadedCount}${activeTabHasMore ? '+' : ''})` and inactive tab labels without counts (`Pendientes`, `Completadas`, `Todas`).

### 3.4 Web Push Service Worker & Lifecycle (`REQ-BI-19`..`22`)
- `public/sw.js` is plain static ES5/ES6 JS (served at `/sw.js` in both Vite dev and `dist/` build, zero bundler plugin needed) and implements the exact fallback logic tested via `parsePushNotificationPayload`:
  - `title = payload.title?.trim() || 'Task by Task — Aviso de vencimiento'`
  - `body = (payload.body ?? payload.content ?? payload.message)?.trim() || rawPlainText?.trim() || 'Tienes una nueva notificación de tarea pendiente.'`
  - `url = isSafeRelativePath(payload.url) ? payload.url : '/'`
- **Logout / Account Deletion / Mid-Session `401` Ordering:**
  - **Logout:** (1) `endpoint = await webPush.getActiveEndpoint()` -> (2) `await authApi.logout(endpoint)` (swallowing `401`) -> (3) `await webPush.unsubscribeLocal()` (best-effort) -> (4) `invalidateCsrf()` + clear stores + `emitSessionEnd('logout')`. Never calls `DELETE /api/v1/notifications/push/subscriptions` after logout.
  - **Account Deletion:** (1) `await authApi.deleteAccount({ password })` -> (2) `await webPush.unsubscribeLocal()` (best-effort) -> (3) `invalidateCsrf()` + clear stores + `emitSessionEnd('deleted')`.
  - **Mid-Session `401`:** (1) `await webPush.unsubscribeLocal()` (best-effort, zero authenticated backend calls) -> (2) `invalidateCsrf()` + clear stores + `loginNotice = es.auth.sessionExpired` + `emitSessionEnd('expired')`.

---

## 4. Design Decisions & Discarded Alternatives

1. **Dedicated Typed API Clients (`src/data/api/`) Alongside Existing `LocalStorage*Repository` Classes vs. Overloading `Repository<T>.save()`:**
   - *Chosen:* Keep all 9 `LocalStorage*Repository` implementations intact and introduce clean typed HTTP API repositories (`AuthApiClient`, `GroupsApiRepository`, `TasksApiRepository`, `TagsApiRepository`, `NotificationsApiRepository`) behind `src/data/contracts/api-contracts.ts`, selected at runtime via `getPersistenceConfig().mode`.
   - *Discarded:* Forcing `Repository<T>.save(fullEntity)` to guess whether an operation is `POST` vs partial `PATCH` vs `POST /move` vs `POST /copy`, which breaks explicit-`null` clearing, Keyset pagination, server filtering, and `localStorage` test stability.
2. **Per-Group `GET /api/v1/groups/{groupId}/tasks` for Grid Cards + `GET /api/v1/tasks` for Cross-Group Queries vs. Global `GET /api/v1/tasks` Only:**
   - *Chosen:* Each visible group card loads and paginates independently via `GET /api/v1/groups/{groupId}/tasks`, while `GET /api/v1/tasks` serves cross-group filtered queries (including global search match detection across unloaded groups).
   - *Discarded:* Using only a single global `GET /api/v1/tasks?limit=20` page for the Groups Grid View (a single busy group with 20+ upcoming tasks would starve all other visible group cards and make them look falsely empty).
3. **Deterministic First-Attempt `403` CSRF Refresh & Single Retry vs. Parsing Spanish `detail` Substrings:**
   - *Chosen:* On any first-attempt `403` for a state-changing request, invalidate CSRF, re-fetch `GET /api/v1/auth/csrf`, and retry **at most once**; if the retry still returns `403`, surface the RFC 7807 error immediately.
   - *Discarded:* Matching Spanish text like `"CSRF"` inside `ProblemDetailResponse.detail` (fragile against backend copy edits and unnecessary because an authorization-denied mutation is side-effect-free on retry).
4. **Static `public/sw.js` Service Worker vs. Adding `vite-plugin-pwa`:**
   - *Chosen:* Lean, dependency-free `public/sw.js` handling only `push` and `notificationclick`.
   - *Discarded:* Installing `vite-plugin-pwa` / Workbox (unrequested dependency prohibited by `AGENTS.md`, unnecessary caching complexity outside MVP scope).
5. **Playwright E2E Verification via `page.route` Mocked API + Default `localStorage` Regression vs. Requiring Live Backend in CI:**
   - *Chosen:* Keep all existing E2E specs running offline in default `localStorage` mode, and add `tests/e2e/backend-integration.spec.ts` using Playwright route interception against an `api`-mode server command (or dedicated Playwright project/env) so CI tests every API flow deterministically without external database flakiness, while still supporting manual live-backend verification against `http://localhost:8080`.
   - *Discarded:* Making `npm run e2e` depend on a running Postgres + Spring Boot instance (breaks isolated frontend CI).

---

## 5. Verification & Traceability Matrix

| Spec / Acceptance Criteria | SRS IDs | Planned Verification |
| :--- | :--- | :--- |
| `REQ-BI-01`, `REQ-BI-02`, `AC-BI-01` | `RNF-08`, `RNF-18` | `persistence.test.ts`, `vite.config.ts` build/dev check, existing full `localStorage` suite |
| `REQ-BI-03`, `REQ-BI-04`, `AC-BI-02` | `RF-01`, `RF-02`, `RNF-07`, `RNF-08`, `RNF-09` | `http-client.test.ts`, `api-repositories.test.ts`, `backend-integration.spec.ts` |
| `REQ-BI-05`..`REQ-BI-07`, `REQ-BI-09`, `AC-BI-03` | `RNF-06`, `RNF-07`, `RNF-14`, `RNF-18`, `RNF-19` | `http-client.test.ts`, `auth-store-api.test.ts`, `groups-tasks-api-store.test.ts`, `api-mode-flow.test.tsx`, `backend-integration.spec.ts` |
| `REQ-BI-08`, `AC-BI-04` | `RF-02`, `RNF-09`, `RNF-18` | `http-client.test.ts`, `auth-store-api.test.ts`, `api-mode-flow.test.tsx`, `backend-integration.spec.ts` |
| `REQ-BI-10`..`REQ-BI-14`, `AC-BI-05` | `RF-01`..`RF-05`, `UI-06`, `UI-07`, `RNF-05`, `RNF-09`, `RNF-10` | `recovery-code-normalization.test.ts`, `auth-form-schemas.test.ts`, `auth-store-api.test.ts`, `api-mode-flow.test.tsx`, `backend-integration.spec.ts` |
| `REQ-BI-15`..`REQ-BI-18`, `AC-BI-06`, `AC-BI-07` | `RF-06`, `RF-07`, `RF-12`..`RF-16`, `RF-22`, `RF-24`, `RF-25`, `RNF-04`, `RNF-16`, `RNF-20` | `dto-mappers.test.ts`, `api-repositories.test.ts`, `groups-tasks-api-store.test.ts`, `api-mode-flow.test.tsx`, `backend-integration.spec.ts` |
| `REQ-BI-19`..`REQ-BI-22`, `AC-BI-08`, `AC-BI-09` | `RF-02`, `RF-05`, `RF-27`..`RF-29`, `RNF-04`, `RNF-15`, `RNF-18` | `web-push.test.ts`, `notifications-store-api.test.ts`, `api-mode-flow.test.tsx`, `backend-integration.spec.ts` |
| `REQ-BI-23`, `REQ-BI-24`, `AC-BI-10` | `UI-01`, `RNF-12`, `RNF-14` | `es.test.ts`, all 420+ existing Vitest tests + existing Playwright specs + `backend-integration.spec.ts` (`1280x720` & `375x812`) |

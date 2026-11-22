# Task Checklist: `006-backend-integration` (Backend REST API Integration, Keyset Pagination & Web Push)

- **Feature Name:** `006-backend-integration`
- **Spec Reference:** [docs/specs/006-backend-integration/spec.md](./spec.md) (`Status: approved`)
- **Plan Reference:** [docs/specs/006-backend-integration/plan.md](./plan.md) (`Status: approved`)

---

## Task List

- [x] **T1: Persistence Config, Vite Dev Proxy, Error Hierarchy, Spanish Localization & Shared Schema Refinements (`RNF-08`, `RNF-14`, `RNF-19`, `RNF-20`)**
  - **Associated Requirements:** `REQ-BI-01`, `REQ-BI-02`, `REQ-BI-17(7)`, `REQ-BI-23`, `REQ-BI-24`, `AC-BI-01`, Section 4.1, Section 4.3
  - **Files Touched:**
    - `tests/unit/shared/config/persistence.test.ts` (created — unit tests for `'localStorage'` default when unset/empty, `'api'` selection, deterministic `ConfigurationError` on invalid mode, and `VITE_API_BASE_URL` trailing-slash normalization)
    - `tests/unit/shared/i18n/es.test.ts` (modified — assert all new Section 4.3 Spanish copy keys & templates)
    - `tests/unit/shared/schemas/limits.test.ts` (modified — assert `API_EMAIL_MAX = 255`, `KEYSET_PAGE_LIMIT_DEFAULT = 20`, `KEYSET_PAGE_LIMIT_MAX = 50`, nanosecond/offset `isoDateTimeSchema`, optional `Task.overdue`, optional `User.passwordHash` + `remainingRecoveryCodes`, and strict `localUserSchema`)
    - `vite.config.ts` (modified — add authorized `server.proxy['/api'] -> http://localhost:8080`)
    - `.env.example` (created — document `VITE_PERSISTENCE_MODE` and optional `VITE_API_BASE_URL`)
    - `src/shared/config/{persistence.ts,index.ts}` (created)
    - `src/shared/errors/domain-errors.ts` (modified — add `ConfigurationError`, `ApiProblemError`, `UnauthorizedError`, `RateLimitError`, `NetworkError` with explicit fields per `erasableSyntaxOnly`)
    - `src/shared/i18n/es.ts` (modified — add all Section 4.3 additive keys)
    - `src/shared/schemas/{limits.ts,common.ts,user.ts,task.ts}` (modified)
    - `src/data/repositories/local-storage-user-repository.ts` (modified — validate local stored users with `localUserSchema` preserving required `passwordHash`)
  - **TDD Test First:** Write failing tests in `persistence.test.ts`, `es.test.ts`, and `limits.test.ts` covering invalid mode errors, new localization templates, nanosecond ISO timestamps, and `User`/`Task` schema extensions before modifying implementation files.
  - **Done when:** Default mode resolves to `'localStorage'`, invalid mode throws `ConfigurationError`, Vite proxy is configured, and all unit tests + typecheck + lint pass with zero regressions.
  - **Verification Command:** `npm test && npm run typecheck && npm run lint`

- [x] **T2: Native HTTP Client (`credentials: "include"`), CSRF Manager & RFC 7807 Problem Detail Parser (`RNF-06`, `RNF-07`, `RNF-08`, `RNF-09`, `RNF-18`)**
  - **Associated Requirements:** `REQ-BI-02`, `REQ-BI-03`, `REQ-BI-04`, `REQ-BI-05`, `REQ-BI-06`, `REQ-BI-07`, `REQ-BI-08`, `REQ-BI-09`, `AC-BI-02`, `AC-BI-03`, `AC-BI-04`
  - **Files Touched:**
    - `tests/unit/data/api/http-client.test.ts` (created — unit tests for `credentials: "include"`, query serialization with repeated `groupIds`, single-flight `GET /api/v1/auth/csrf` bootstrap & `X-XSRF-TOKEN` injection on mutations, CSRF invalidation, deterministic single-retry on first-attempt `403` and stop on second `403`, RFC 7807 `400` `invalidParams` parsing, `429` positive/zero/missing `retryAfterSeconds` formatting for `'login'` vs `'generic'`, context-aware `401` (`session-probe`, `login`, `authenticated`, `logout`), `404`/`409`/`5xx`/network errors, and Zod inbound validation failure -> `errors.invalidResponse`)
    - `src/data/api/problem-detail.ts` (created — `problemDetailDtoSchema`, `parseProblemDetailResponse`, `formatRateLimitMessage`, `extractFieldErrorMap`)
    - `src/data/api/http-client.ts` (created — `ApiHttpClient` with injectable `fetchFn`, CSRF cache/dedupe/retry, and `onUnauthorizedSessionExpired`)
  - **TDD Test First:** Author `http-client.test.ts` asserting every CSRF, `403` single-retry, `401` context, `429` cooldown, RFC 7807 `invalidParams`, and invalid-JSON case before implementing `problem-detail.ts` and `http-client.ts`.
  - **Done when:** All HTTP transport, CSRF, and RFC 7807 unit tests pass cleanly with zero `any` or lint warnings.
  - **Verification Command:** `npm test && npm run typecheck && npm run lint`

- [ ] **T3: OpenAPI `1.0.0-mvp` Zod DTO Schemas & Bidirectional Domain Mappers (`RNF-07`, `RNF-19`, `RNF-20`)**
  - **Associated Requirements:** `REQ-BI-03`, `REQ-BI-10`, `REQ-BI-11`, `REQ-BI-14`, `REQ-BI-15`, `REQ-BI-17(7)`, `REQ-BI-19(2)`, `AC-BI-06`, `AC-BI-08`, Section 4.1
  - **Files Touched:**
    - `tests/unit/data/api/dto-mappers.test.ts` (created — unit tests validating every OpenAPI DTO schema and pure mapper: `int64 <-> string` IDs & invalid ID rejection, `UserResponse` `timezone`/`24H`/`12H`/`email` 255/`remainingRecoveryCodes`, `GroupResponse` -> `type: 'individual'` + single creator member `RNF-20`, `TaskResponse` `assignedUserId -> assigneeId`/`overdue`/`HH:mm[:ss] -> HH:mm`/embedded `tags`, `NotificationResponse` open non-empty `eventType`, `KeysetPage<T>`, and `VapidPublicKeyResponse`)
    - `src/data/contracts/api-contracts.ts` (created — `KeysetPage<T>`, `ApiTaskStatus`, and all 5 API repository/client interfaces)
    - `src/data/contracts/index.ts` (modified — export `api-contracts`)
    - `src/data/api/dto-schemas.ts` (created — strict Zod schemas matching `openapi.json`)
    - `src/data/api/dto-mappers.ts` (created — pure deterministic inbound/outbound mappers)
  - **TDD Test First:** Write failing DTO validation and mapper tests in `dto-mappers.test.ts` (including boundary and malformed payloads) before writing `dto-schemas.ts` and `dto-mappers.ts`.
  - **Done when:** All OpenAPI DTO schemas and domain mappers pass unit tests, typecheck, and lint.
  - **Verification Command:** `npm test && npm run typecheck && npm run lint`

- [ ] **T4: Typed HTTP API Repositories Covering All 27 Paths / 37 Operations (`RF-01`..`RF-07`, `RF-12`..`RF-16`, `RF-22`, `RF-24`, `RF-25`, `RF-27`..`RF-29`)**
  - **Associated Requirements:** `REQ-BI-10`..`REQ-BI-22`, `AC-BI-02`, `AC-BI-05`..`AC-BI-09`, Section 4.1 Endpoint Table
  - **Files Touched:**
    - `tests/unit/data/api/api-repositories.test.ts` (created — contract tests using mock `fetch` asserting exact HTTP method, path, query params, headers, request JSON body, and mapped output for all 37 OpenAPI operations across Auth, Users, Groups, Tasks, Tags, Notifications, and Web Push)
    - `src/data/api/auth-api-client.ts` (created — all 10 Auth + Users endpoints, including `{ password }` on `DELETE /api/v1/users/me` and optional `{ endpoint }` on `POST /api/v1/auth/logout`)
    - `src/data/api/groups-api-repository.ts` (created — all 5 Groups endpoints)
    - `src/data/api/tasks-api-repository.ts` (created — all 10 Tasks endpoints, including explicit `null` patch fields and `DELETE /api/v1/tasks/{taskId}/tags/{tagId}`)
    - `src/data/api/tags-api-repository.ts` (created — all 3 Tags endpoints, accepting `200` and `201` on `POST /api/v1/groups/{groupId}/tags`)
    - `src/data/api/notifications-api-repository.ts` (created — all 9 Notifications & Web Push endpoints, including both `DELETE .../subscriptions?endpoint=...` and `DELETE .../subscriptions/{subscriptionId}`)
    - `src/data/api/{runtime.ts,index.ts}` (created — shared `ApiServices` wiring + test override/reset + unauthorized callback registration)
  - **TDD Test First:** Write failing contract tests in `api-repositories.test.ts` verifying every single one of the 37 operations against `openapi.json` before implementing the 5 repository classes.
  - **Done when:** All 37 OpenAPI operations are covered by passing contract tests, typecheck, and lint.
  - **Verification Command:** `npm test && npm run typecheck && npm run lint`

- [ ] **T5: Dual Recovery-Code Normalization & Dual-Mode `useAuthStore` Integration (`RF-01`..`RF-05`, `RNF-05`, `RNF-06`, `RNF-09`, `RNF-10`)**
  - **Associated Requirements:** `REQ-BI-06`, `REQ-BI-07`, `REQ-BI-08`, `REQ-BI-10`, `REQ-BI-11`, `REQ-BI-12`, `REQ-BI-13`, `REQ-BI-14`, `REQ-BI-22`, `REQ-BI-23`, `AC-BI-03`, `AC-BI-04`, `AC-BI-05`
  - **Files Touched:**
    - `tests/unit/features/auth/recovery-code-normalization.test.ts` (created — tests for `XXXX-XXXX` and `XXXXXXXX` acceptance, misplaced-hyphen/bad-char/wrong-length errors, `localStorage` `XXXXXXXX` normalization, and `api` `XXXX-XXXX` normalization)
    - `tests/unit/features/auth/auth-form-schemas.test.ts` (modified — align recovery-code format test cases with `REQ-BI-13`)
    - `tests/unit/features/auth/auth-store-api.test.ts` (created — full `api` mode auth store tests: cold-start `401` silent vs mid-session `401` `sessionExpired` + local push unsubscribe, login `401`/`429` + timezone sync, register `201` one-time codes & notice, recover `XXXX-XXXX` normalization & `429` neutral cooldown, profile `PATCH` `24H`/`12H` + `409` + `invalidParams` fieldErrors, password change, regenerate codes updating `remainingRecoveryCodes`, logout with `{ endpoint }` + local push unsubscribe without post-logout DELETE, and `{ password }` account deletion + local push unsubscribe)
    - `src/features/auth/utils/recovery-codes.ts` (modified — add `validateRecoveryCodeFormat`, `normalizeRecoveryCodeForLocalStorage`, `normalizeRecoveryCodeForApi`)
    - `src/features/auth/schemas/auth-form-schemas.ts` (modified — update `recoveryCodeFieldSchema` for dual format)
    - `src/features/auth/store/auth-store.ts` (modified — add dual-mode `api` implementation, `fieldErrors`, `oneTimeRecoveryCodesNotice`, `handleMidSessionUnauthorized`, preserving `localStorage` mode identically)
    - `src/features/auth/hooks/use-auth.ts` (modified — expose `fieldErrors` and `oneTimeRecoveryCodesNotice`)
  - **TDD Test First:** Write failing unit tests in `recovery-code-normalization.test.ts` and `auth-store-api.test.ts` before updating auth utils, schemas, and `useAuthStore`.
  - **Done when:** All new API-mode auth tests AND all existing `localStorage` auth unit/integration tests pass cleanly.
  - **Verification Command:** `npm test && npm run typecheck && npm run lint`

- [ ] **T6: Auth & Profile UI Integration (`RF-01`..`RF-05`, `UI-06`, `UI-07`, `RNF-07`, `RNF-12`, `RNF-14`)**
  - **Associated Requirements:** `REQ-BI-06`, `REQ-BI-11`, `REQ-BI-13`, `REQ-BI-14`, `REQ-BI-24`, `AC-BI-03`, `AC-BI-05`, `AC-BI-10`
  - **Files Touched:**
    - `tests/unit/features/auth/auth-pages-api-errors.test.tsx` (created — RTL tests verifying `400` `invalidParams` field error mapping across `LoginPage`, `RegisterPage`, `RecoverPasswordPage`, and `ProfilePage`, `oneTimeRecoveryCodesNotice` display in `OneTimeRecoveryCodesCard`, and `remainingRecoveryCodes` display on `ProfilePage`)
    - `src/features/auth/components/OneTimeRecoveryCodesCard.tsx` (modified — accept optional `warningMessage`)
    - `src/features/auth/components/LoginPage.tsx` (modified — apply `fieldErrors` to RHF form)
    - `src/features/auth/components/RegisterPage.tsx` (modified — apply `fieldErrors` to RHF form and pass `oneTimeRecoveryCodesNotice`)
    - `src/features/auth/components/RecoverPasswordPage.tsx` (modified — apply `fieldErrors` to RHF form and accept hyphenated/unhyphenated codes)
    - `src/features/auth/components/ProfilePage.tsx` (modified — apply `fieldErrors` to profile/password/regenerate forms, pass `oneTimeRecoveryCodesNotice`, display `remainingRecoveryCodes` when present)
  - **TDD Test First:** Author `auth-pages-api-errors.test.tsx` asserting backend field-level error rendering, notice display, and remaining recovery codes count before modifying the auth components.
  - **Done when:** All auth UI tests (new and existing) pass with full keyboard/ARIA accessibility and zero console warnings.
  - **Verification Command:** `npm test && npm run typecheck && npm run lint`

- [ ] **T7: Dual-Mode `useGroupsStore`, `useTasksStore` & Hooks — Keyset Pagination, Server Filters & Task/Tag Mutations (`RF-06`, `RF-07`, `RF-12`..`RF-16`, `RF-22`, `RF-24`, `RF-25`, `RNF-04`, `RNF-16`, `RNF-18`, `RNF-20`)**
  - **Associated Requirements:** `REQ-BI-09`, `REQ-BI-15`, `REQ-BI-16`, `REQ-BI-17`, `REQ-BI-18`, `REQ-BI-23`, `AC-BI-06`, `AC-BI-07`
  - **Files Touched:**
    - `tests/unit/features/groups/groups-tasks-api-store.test.ts` (created — comprehensive `api`-mode store tests: paginated groups + `"Cargar más grupos"` deduplication & newly created group insertion, per-group `GET /api/v1/groups/{groupId}/tasks` pagination, cross-group `GET /api/v1/tasks` search verification, debounced search + stale-response discard, status/group filter delegation, task create/partial-PATCH-with-nulls/completion/move/copy/delete, tag list/search/detach/group-delete, `403`/`404`/`409` controlled reconciliation, and zero client-side Personal self-healing in `api` mode)
    - `src/features/groups/store/groups-store.ts` (modified — add dual-mode `api` implementation, Keyset pagination state, debounced search with sequence guard, `loadMoreGroups`, `loadMoreGroupTasks`)
    - `src/features/groups/hooks/use-groups.ts` (modified — expose pagination state/actions, `isApiMode`, `activeTabHasMore`, `globalSearchHasMatches`)
    - `src/features/tasks/store/tasks-store.ts` (modified — add dual-mode `api` implementation for all task & tag mutations, `loadGroupTags`, `getTaskById`, skipping local notification hooks in `api` mode)
    - `src/features/tasks/hooks/{use-tasks.ts,use-task-move-copy.ts,use-task-form.ts}` (modified — `mode`-aware Move/Copy targets + pagination controls, `loadGroupTags` on modal open, `ApiProblemError` field mapping)
    - `src/features/groups/hooks/use-group-form.ts` (modified — `ApiProblemError` `invalidParams` field mapping + general error capture)
  - **TDD Test First:** Write failing tests in `groups-tasks-api-store.test.ts` covering pagination, debouncing, stale responses, explicit-null `PATCH`, and error reconciliation before updating the stores and hooks.
  - **Done when:** All new API-mode group/task/tag store tests and all existing `localStorage` store tests pass cleanly.
  - **Verification Command:** `npm test && npm run typecheck && npm run lint`

- [ ] **T8: Workspace UI Integration — Progressive `"Cargar más"`, `N+`/Active-Tab Counts, Authoritative `overdue` & RFC 7807 Modal Errors (`RF-14`, `RF-16`, `RF-24`, `RF-25`, `UI-01`, `UI-02`, `RNF-04`, `RNF-12`, `RNF-14`)**
  - **Associated Requirements:** `REQ-BI-06`, `REQ-BI-09`, `REQ-BI-15(2)-(3)`, `REQ-BI-16(1)-(3)`, `REQ-BI-17(7)`, `REQ-BI-23`, `REQ-BI-24`, `AC-BI-06`, `AC-BI-07`, `AC-BI-10`
  - **Files Touched:**
    - `tests/unit/features/groups/workspace-pagination-ui.test.tsx` (created — RTL unit tests for `GroupCard` `"Cargar más tareas"` & `N+ tareas` badge, `GroupsFilterToolbar` active-tab-only counts & `"Cargar más grupos"`, `TaskCard` server-authoritative `overdue` for incomplete tasks & strikethrough-only for completed tasks, `TaskMoveCopyModal` `"Cargar más grupos"` suppressing `noOtherGroups` + same-group copy in `api` mode, and `GroupFormModal`/`TaskFormModal` RFC 7807 error display)
    - `src/features/tasks/components/TaskCard.tsx` (modified — prefer `task.overdue` when `completed === false` and boolean present)
    - `src/features/groups/components/GroupCard.tsx` (modified — `N+` count badge & `"Cargar más tareas"` button)
    - `src/features/groups/components/GroupsFilterToolbar.tsx` (modified — `api`-mode active-tab-only counts & `"Cargar más grupos"` button in filter row)
    - `src/features/groups/components/GroupsGridView.tsx` (modified — wire pagination props, grid-footer `"Cargar más grupos"`, `globalSearchHasMatches`)
    - `src/features/tasks/components/TaskMoveCopyModal.tsx` (modified — pass `mode` to `useTaskMoveCopy`, render `"Cargar más grupos"`, suppress `noOtherGroups` while `groupsHasNext`)
    - `src/features/groups/components/GroupFormModal.tsx` (modified — render API general/field errors without closing modal)
    - `src/features/tasks/components/TaskFormModal.tsx` (modified — render API general/field errors without closing modal)
  - **TDD Test First:** Write failing RTL tests in `workspace-pagination-ui.test.tsx` verifying every new UI state and `localStorage` mode unchanged rendering before editing components.
  - **Done when:** All new and existing workspace UI tests pass cleanly with full keyboard/ARIA accessibility.
  - **Verification Command:** `npm test && npm run typecheck && npm run lint`

- [ ] **T9: Web Push Service Worker (`public/sw.js`), `WebPushAdapter` & Dual-Mode `useNotificationsStore` (`RF-02`, `RF-05`, `RF-27`..`RF-29`, `RNF-04`, `RNF-15`, `RNF-18`)**
  - **Associated Requirements:** `REQ-BI-19`, `REQ-BI-20`, `REQ-BI-21`, `REQ-BI-22`, `REQ-BI-23`, `AC-BI-08`, `AC-BI-09`
  - **Files Touched:**
    - `tests/unit/features/notifications/web-push.test.ts` (created — unit tests for `urlBase64ToUint8Array`, `extractPushSubscriptionPayload`, `parsePushNotificationPayload` across JSON / plain text / empty / malformed JSON / unsafe URL rejection, and `WebPushAdapter` subscribe/unsubscribe/unsupported error safety)
    - `tests/unit/features/notifications/notifications-store-api.test.ts` (created — `api`-mode store tests: zero local due-alert timers scheduled on init/task mutations, `GET /unread-count` & paginated `GET /notifications` + `loadMoreNotifications`, `markAsRead` / `markAllAsRead` / `deleteNotification`, VAPID `enabled: true` SW registration & subscription on already-granted and newly-granted permission, VAPID `enabled: false` suppressing banner & setting `'disabled-by-server'`, VAPID `5xx`/network setting `'unavailable'` & retrying on refresh, unsupported browser / subscribe failure graceful degradation)
    - `public/sw.js` (created — Service Worker `push` with Spanish fallbacks & `notificationclick` window focus/open)
    - `src/features/notifications/utils/{web-push.ts,index.ts}` (created/modified)
    - `src/features/notifications/store/notifications-store.ts` (modified — add dual-mode `api` implementation, Keyset pagination state, `pushStatus`, VAPID & `WebPushAdapter` lifecycle, disabling local due-alert timers in `api` mode)
    - `src/features/notifications/hooks/use-notifications.ts` (modified — expose `hasNext`, `isLoadingMore`, `pushStatus`, `loadMoreNotifications`)
    - `src/features/auth/store/auth-store.ts` (modified — wire default `getPushEndpoint` and `unsubscribeLocalPush` delegates to `createWebPushAdapter()`)
  - **TDD Test First:** Write failing unit tests in `web-push.test.ts` and `notifications-store-api.test.ts` covering every VAPID state, push fallback payload, disabled local timers, and pagination before implementing `public/sw.js`, `web-push.ts`, and store updates.
  - **Done when:** All new API-mode notification & Web Push tests AND all existing `005-notifications` `localStorage` tests pass cleanly.
  - **Verification Command:** `npm test && npm run typecheck && npm run lint`

- [ ] **T10: Notification Center UI Pagination & Web Push Status + Full API-Mode RTL Integration Suite (`RF-27`, `RF-29`, `UI-01`, `RNF-04`, `RNF-12`, `RNF-14`)**
  - **Associated Requirements:** `REQ-BI-19`..`REQ-BI-24`, `AC-BI-01`..`AC-BI-10`
  - **Files Touched:**
    - `tests/integration/features/backend-integration/api-mode-flow.test.tsx` (created — end-to-end RTL integration suite in `api` mode with mocked `fetch`: cold-start `401` -> `/login`, login + CSRF bootstrap + timezone sync, register + 8 one-time codes, recover with `XXXX-XXXX` & `XXXXXXXX`, profile `12H`/`remainingRecoveryCodes`, Groups Grid View with `"Cargar más grupos"`, per-group `"Cargar más tareas"`, `N+`/active-tab counts, Move/Copy modal `"Cargar más grupos"`, Notification Center `"Cargar más notificaciones"`, `pushDisabledByServer` & `pushUnavailableStatus` notices, mid-session `401` redirect with `sessionExpired`, and explicit logout with `{ endpoint }`)
    - `src/features/notifications/components/NotificationCenterPanel.tsx` (modified — render `pushDisabledByServer`, `pushUnavailableStatus`, `pushSubscriptionError`, and `"Cargar más notificaciones"` button)
    - `src/features/notifications/components/NotificationPermissionBanner.tsx` (modified — ensure suppressed whenever `pushStatus` is `'disabled-by-server'` or `'unavailable'`)
  - **TDD Test First:** Author `api-mode-flow.test.tsx` asserting Notification Center pagination, Web Push status notices, and cross-feature API flows before updating the Notification UI components.
  - **Done when:** All unit and integration tests (existing + new) pass with zero errors or console warnings.
  - **Verification Command:** `npm test && npm run typecheck && npm run lint`

- [ ] **T11: Playwright End-to-End Tests (`AC-BI-01`..`AC-BI-10`) & Default `localStorage` Regression Suite**
  - **Associated Requirements:** `AC-BI-01`..`AC-BI-10`, `REQ-BI-23`, `REQ-BI-24`, `UI-01`, `RNF-12`, `RNF-14`, `RNF-15`
  - **Files Touched:**
    - `tests/e2e/backend-integration.spec.ts` (created — Playwright E2E suite verifying mocked-API mode flows via `page.route('**/api/v1/**')`: CSRF + `credentials: "include"`, registration one-time codes, login + `429` cooldown, RFC 7807 `400` field errors, Groups/Tasks CRUD + Keyset `"Cargar más"` + server filters, Notification Center pagination + Web Push VAPID enabled/disabled notices + logout `{ endpoint }` cleanup, mid-session `401` expiry redirect with `sessionExpired`, tested at desktop `1280x720` and mobile `375x812` with zero console/page errors)
    - `playwright.config.ts` (modified — configure dual `webServer` + projects: `chromium` on `:5173` default `localStorage` mode ignoring `backend-integration.spec.ts`, and `chromium-api` on `:5174` with `VITE_PERSISTENCE_MODE=api` matching `backend-integration.spec.ts`)
  - **TDD Test First:** Write `tests/e2e/backend-integration.spec.ts` covering `AC-BI-01`..`AC-BI-10`, then execute the full Playwright suite across both `localStorage` (existing 5 specs) and `api` mode (`backend-integration.spec.ts`).
  - **Done when:** All Playwright E2E specs (all existing `localStorage` specs + `backend-integration.spec.ts`) pass cleanly at desktop and ~375px mobile widths with zero console/page errors.
  - **Verification Command:** `npm run e2e`

- [ ] **T12: Final Verification, Spec/Plan/Tasks Closure & `MEMORY.md` Sync**
  - **Associated Requirements:** `Constitution Principle 6`, `AGENTS.md`
  - **Files Touched:**
    - `docs/specs/006-backend-integration/spec.md` (modified — update `Status: implemented`)
    - `docs/specs/006-backend-integration/plan.md` (modified — update `Status: implemented`)
    - `docs/specs/006-backend-integration/tasks.md` (modified — mark `[x]` on `T1`–`T12`)
    - `MEMORY.md` (modified — record `006-backend-integration` architecture decisions, dual-mode config, Vite proxy, Web Push SW, and final Vitest + Playwright counts)
  - **Done when:** Full verification suite (`npm test && npm run typecheck && npm run lint && npm run build && npm run e2e`) passes with zero errors, and SDD documentation + `MEMORY.md` accurately reflect the implemented state.
  - **Verification Command:** `npm test && npm run typecheck && npm run lint && npm run build && npm run e2e`

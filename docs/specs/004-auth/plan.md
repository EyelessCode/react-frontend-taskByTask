# Implementation Plan: `004-auth` (User Accounts, Authentication, Profile & Recovery)

- **Feature Name:** `004-auth`
- **Status:** implemented
- **Approved Spec:** [docs/specs/004-auth/spec.md](./spec.md) (`Status: implemented`)
- **Constitution:** [docs/constitution.md](../../constitution.md)
- **Reference Patterns:** `src/features/tasks/` (golden reference), `src/features/groups/`

---

## 1. Architecture Overview & Design Goals

`004-auth` transitions Task by Task from unauthenticated `'local-user'` workspace seeding to true client-side multi-account authentication, strict per-user workspace isolation, TanStack Router route guarding, profile & time-format management (`24h` / `12h` display and capture), single-use recovery codes, persistent login lockout throttling, and per-user cascade account deletion.

Key architectural principles applied:
1. **Isolated Data Layer (`RNF-07`, Constitution Principle 3):** All persistence goes strictly through typed repository contracts (`UserRepository`, `SessionRepository`, `RecoveryCodeRepository`, `LoginLockoutRepository`, `NotificationRepository`, plus updated `GroupRepository`) backed by `LocalStorageAdapter` and Zod validation under versioned `tbt:v1:*` keys. React components never read or write `localStorage` directly.
2. **Non-Reversible Security & Pure Domain Helpers (`RNF-05`, `RNF-06`):** Password hashing uses standard WebCrypto PBKDF2-HMAC-SHA-256 (`100,000` iterations + 16-byte random salt). Hashing, recovery code generation, lockout evaluation, and `12h <-> 24h` time conversion are implemented as pure, dependency-injected functions tested thoroughly with deterministic clocks and inputs.
3. **Ephemeral One-Time Recovery Codes (`RF-01`, `RF-04`):** Plaintext recovery codes exist strictly in transient React/Zustand memory (`oneTimeRecoveryCodes` + `postRegisterCodesPending`) immediately after registration or regeneration and are never persisted in plaintext. Navigating away or reloading permanently clears the transient view.
4. **Mid-Session Integrity & Clean Teardown (`REQ-AU-09`, `RF-02`):** Session expiry (`now >= session.expiresAt`) and orphan checks (`session.userId` missing) run on startup, on every route transition, and immediately before authenticated profile or workspace mutations. Logout, expiration, orphan cleanup, and account deletion emit a typed session-end signal so `005-notifications` can stop device notifications cleanly on that device (`RF-02`).
5. **Strict TypeScript (`erasableSyntaxOnly`) & React Compiler:** No `any`, no constructor parameter properties (explicit `private readonly` fields), `useWatch` instead of `form.watch`, no premature manual `useMemo`/`useCallback`.

### Governance & Scope Check (`AGENTS.md`)
- **Packages:** Zero new npm packages required (`@tanstack/react-router`, `zustand`, `react-hook-form`, `zod`, `react-bootstrap`, `bootstrap` are already installed).
- **Config files (`vite.config.ts`, `tsconfig*.json`, `eslint.config.js`):** Zero edits. (`tests/setup.ts` will include a test-environment WebCrypto `crypto.subtle` check/shim only if Vitest `jsdom` omits `SubtleCrypto`.)
- **Ask-First Items Flagged Clearly for Implementation Gate:**
  1. **Additive `tbt:v1:*` Storage Key (`RNF-06`):** `REQ-AU-06` requires failed login attempt throttling to persist across page reloads. This plan adds `STORAGE_KEYS.LOGIN_LOCKOUTS = 'tbt:v1:login_lockouts'` (alongside existing `tbt:v1:users`, `tbt:v1:session`, `tbt:v1:recovery_codes`, `tbt:v1:notifications`) without altering any existing key versions.
  2. **Cross-Feature Integration:** Enforcing `REQ-AU-21` (removing anonymous `'local-user'` fallback) and `REQ-AU-16` (`12h`/`24h` form capture) updates `useGroupsStore`, `useTasksStore`, `GroupsGridView`, `TasksView`, `TaskFormModal`, `use-task-form`, and the corresponding test files (`tests/unit/features/{groups,tasks}`, `tests/integration/features/{groups,tasks,tags}`, `tests/e2e/{smoke,tasks,groups,tags}.spec.ts`).

---

## 2. File & Module Inventory

### 2.1 Shared Layer (`src/shared/`)
- **`src/shared/schemas/session.ts`** *(update)*:
  - Keep `sessionSchema` (`Session`).
  - Add `loginLockoutSchema` and `LoginLockoutState` type (`normalizedEmail`, `failedAttempts: 0..5`, `lockedUntil: isoDateTimeSchema.nullable()`).
- **`src/shared/schemas/index.ts`** *(keep/re-export)*: Exports `LoginLockoutState`, `loginLockoutSchema` via `export * from './session'`.
- **`src/shared/utils/time-format.ts`** *(create)* & **`src/shared/utils/index.ts`** *(update)*:
  - Pure bijective `12h <-> 24h` conversion utilities shared by `tasks` and `auth`:
    - `TimePeriod12h = 'am' | 'pm'`
    - `TimeParts12h = { hour: string; minute: string; period: TimePeriod12h | '' }`
    - `to12HourParts(dueTime: string | null | undefined): TimeParts12h`
    - `from12HourParts(parts: TimeParts12h): { ok: true; dueTime: string } | { ok: false; reason: 'empty' | 'incomplete' }`
- **`src/shared/i18n/es.ts`** *(update)*:
  - Add centralized `auth` namespace implementing every key specified in `004-auth/spec.md` Section 4.4 (`profileLink`, `logoutButton`, `backToWorkspace`, `greetingPrefix`, login copy & `tooManyAttemptsMinutes(minutes)` / `tooManyAttemptsSeconds(seconds)` / `sessionExpired`, registration & shared uniqueness copy, recovery copy & `recoveryCodeRequired` / `recoveryCodeLengthError` / `recoveryCodeFormatError`, profile & `currentPasswordRequired` / `invalidCurrentPassword`, account deletion copy, and `12h` time-capture labels + `incompleteTimeError`).
  - Keep `LocalizationDictionary` interface in sync with `tests/unit/shared/i18n/es.test.ts`.

### 2.2 Data Layer (`src/data/`)
- **`src/data/storage/keys.ts`** *(update)*:
  - Keep all existing keys untouched; add `LOGIN_LOCKOUTS: 'tbt:v1:login_lockouts'`.
- **`src/data/contracts/`**:
  - **`user-repository.ts`** *(create)*: `UserRepository extends Repository<User>` + `getByEmail(normalizedEmail: string): Promise<User | null>`, `getByUsername(username: string): Promise<User | null>`.
  - **`session-repository.ts`** *(create)*: `SessionRepository` (`get(): Promise<Session | null>`, `save(session: Session): Promise<void>`, `clear(): Promise<void>`).
  - **`recovery-code-repository.ts`** *(create)*: `RecoveryCodeRepository` (`getByUserId(userId: string): Promise<RecoveryCode[]>`, `replaceForUser(userId: string, codes: RecoveryCode[]): Promise<void>`, `save(code: RecoveryCode): Promise<void>`, `deleteByUserId(userId: string): Promise<void>`).
  - **`login-lockout-repository.ts`** *(create)*: `LoginLockoutRepository` (`getByEmail(normalizedEmail: string): Promise<LoginLockoutState | null>`, `save(state: LoginLockoutState): Promise<void>`, `clearByEmail(normalizedEmail: string): Promise<void>`).
  - **`notification-repository.ts`** *(create)*: `NotificationRepository` (`getByUserId(userId: string): Promise<Notification[]>`, `deleteByUserId(userId: string): Promise<void>`) — storage isolation boundary for `RF-05` account deletion.
  - **`group-repository.ts`** *(update)*: Keep `getIndividualGroups()` and `ensureSeedGroup()` (for existing `local-storage-group-repository.test.ts`), add `getAccessibleByUserId(userId: string): Promise<Group[]>`, `ensurePersonalGroupForUser(userId: string, nowIso?: string): Promise<Group>`, and `deleteAllByOwnerId(userId: string): Promise<string[]>` (used strictly by cascade account deletion `REQ-AU-19` since `delete(id)` rejects `isPersonal: true` per `REQ-GRP-11`).
  - **`index.ts`** *(update)*: Export new repository contracts.
- **`src/data/repositories/`**:
  - **`local-storage-user-repository.ts`** *(create)*: Implements `UserRepository` with `userSchema` validation, trimmed+lowercased email lookup, case-insensitive username lookup, and repository-level case-insensitive `email`/`username` uniqueness enforcement excluding self `id` (`BusinessRuleViolationError`).
  - **`local-storage-session-repository.ts`** *(create)*: Implements `SessionRepository` using `STORAGE_KEYS.SESSION` with `sessionSchema.nullable()`.
  - **`local-storage-recovery-code-repository.ts`** *(create)*: Implements `RecoveryCodeRepository` using `STORAGE_KEYS.RECOVERY_CODES` with `z.array(recoveryCodeSchema)`.
  - **`local-storage-login-lockout-repository.ts`** *(create)*: Implements `LoginLockoutRepository` using `STORAGE_KEYS.LOGIN_LOCKOUTS` with `z.array(loginLockoutSchema)`.
  - **`local-storage-notification-repository.ts`** *(create)*: Implements `NotificationRepository` using `STORAGE_KEYS.NOTIFICATIONS` with `z.array(notificationSchema)`.
  - **`local-storage-group-repository.ts`** *(update)*: Implement `getAccessibleByUserId`, `ensurePersonalGroupForUser` (generates unique `crypto.randomUUID()` id when user has no accessible `isPersonal: true` group, never adopting `'group-personal'` / `'local-user'`), and `deleteAllByOwnerId`.
  - **`index.ts`** *(update)*: Export new repository implementations.

### 2.3 Auth Feature (`src/features/auth/`)
- **`src/features/auth/utils/`**:
  - `password-hash.ts` — WebCrypto PBKDF2-HMAC-SHA-256 (`hashPassword`, `verifyPassword`, constant-time hex compare, injectable WebCrypto provider).
  - `recovery-codes.ts` — CSPRNG uppercase `[A-Z0-9]{8}` batch generator (`generateRecoveryCodes`), `normalizeRecoveryCode`, `buildRecoveryCodeRecords`.
  - `lockout.ts` — Pure lockout evaluation & remaining-time Spanish formatter (`normalizeEmail`, `isLockedOut`, `getLockoutRemainingMs`, `formatLockoutMessage`, `evaluateNextLockoutState`).
  - `index.ts` — Barrel exports.
- **`src/features/auth/schemas/`**:
  - `auth-form-schemas.ts` — Zod schemas for `registerFormSchema`, `loginFormSchema`, `recoverFormSchema`, `profileFormSchema`, `changePasswordFormSchema`, `currentPasswordConfirmSchema`.
  - `index.ts` — Barrel exports.
- **`src/features/auth/store/`**:
  - `auth-store.ts` — `useAuthStore`, `configureAuthStore`, `resetAuthStore`, `subscribeAuthSessionEnd`, `AuthSessionEndReason`.
  - `index.ts` — Barrel exports.
- **`src/features/auth/hooks/`**:
  - `use-auth.ts` — Hook exposing auth state (`currentUser`, `isAuthenticated`, `isInitialized`, `isSubmitting`, `authError`, `loginNotice`, `oneTimeRecoveryCodes`, `postRegisterCodesPending`) and actions (`login`, `register`, `logout`, `recoverPassword`, `updateProfile`, `changePassword`, `regenerateRecoveryCodes`, `deleteAccount`, `acknowledgeRegistrationCodes`, `dismissOneTimeRecoveryCodes`, `clearAuthError`, `clearLoginNotice`).
  - `index.ts` — Barrel exports.
- **`src/features/auth/components/`**:
  - `AuthLayout.tsx` — Responsive Mobile-First (~375px+) centered shell displaying app title/tagline and clean `<main>` landmark.
  - `LoginPage.tsx` — `/login` view with React Hook Form + Zod, `loginNotice` banner (`sessionExpired`, `accountDeleted`, `passwordReset`), inline error alert (`invalidCredentials` or lockout countdown), links to `/register` and `/recover`.
  - `OneTimeRecoveryCodesCard.tsx` — Reusable one-time 8-code presentation panel with explicit warning (`es.auth.recoveryCodesWarning`), clipboard copy (`es.auth.copyRecoveryCodes` -> `es.auth.copiedRecoveryCodes` feedback), and confirm action.
  - `RegisterPage.tsx` — `/register` view; transitions smoothly into `<OneTimeRecoveryCodesCard />` when `postRegisterCodesPending` is true, then navigates to `/` on confirm.
  - `RecoverPasswordPage.tsx` — `/recover` view with `es.auth.recoverLimitationNote` info alert, email + 8-char recovery code + new password inputs, generic error feedback, redirect to `/login` on success.
  - `DeleteAccountConfirmModal.tsx` — Destructive confirmation modal (`UI-06`, `RF-05`) requiring `currentPassword` with empty vs incorrect validation feedback and Escape/backdrop accessibility.
  - `ProfilePage.tsx` — `/profile` view with workspace back link & logout button, account info + `timeFormat` (`24h`/`12h`) + read-only `timeZone` card, password change card, recovery code regeneration card (with `<OneTimeRecoveryCodesCard />` when regenerated), and danger zone (`DeleteAccountConfirmModal`).
  - `index.ts` — Barrel exports.
- **`src/features/auth/index.ts`** *(update)*: Public feature exports.

### 2.4 App Router & Cross-Feature Updates (`src/app/`, `src/features/{groups,tasks}/`)
- **`src/app/router.tsx`** *(create)* & **`src/app/index.ts`** *(update)*:
  - Defines TanStack Router tree (`/login`, `/register`, `/recover`, `/`, `/profile`, and catch-all/notFound fallback), `createAppRouter(history?: RouterHistory)`, `beforeLoad` auth/session guards, and reactive session-termination navigation listener.
- **`src/App.tsx`** *(update)*: Renders `<RouterProvider router={appRouter} />` cleanly after initializing/guarding routes.
- **`src/features/groups/store/groups-store.ts`** *(update)*:
  - Add `getActiveUserId?: () => Promise<string | null>` dependency (defaulting to `() => useAuthStore.getState().ensureActiveUserId()`).
  - On `init()` and `refresh()`: resolve `activeUserId`; if `null`, reset groups/tasks/tags to empty (`[]`) without calling `ensureSeedGroup()`. If authenticated, filter groups via `isGroupAccessibleToUser(group, activeUserId)`, call `ensurePersonalGroupForUser(activeUserId)` if no accessible `isPersonal: true` group exists (`RNF-18` self-healing), filter tasks & tags to `accessibleGroupIds`, and trigger `useTasksStore.getState().init()` cleanly.
  - On `createGroup`, `renameGroup`, `deleteGroup`: verify `activeUserId = await deps.getActiveUserId()` first (abort if `null`/expired); `createGroup` sets `creatorId: activeUserId` and creator member `userId: activeUserId`.
- **`src/features/tasks/store/tasks-store.ts`** *(update)*:
  - Add `getActiveUserId?: () => Promise<string | null>` dependency (defaulting to `() => useAuthStore.getState().ensureActiveUserId()`).
  - On `init()` and `setActiveGroup()`: filter strictly to `activeUserId`'s accessible groups (self-healing Personal group if missing when authenticated; returning empty `groups: [], tasks: [], tags: [], allTags: [], activeGroupId: ''` when `activeUserId === null`, never calling `ensureSeedGroup()`).
  - Verify `activeUserId = await deps.getActiveUserId()` before every persistence mutation (`createTask`, `updateTask`, `deleteTask`, `toggleTaskComplete`, `moveTask`, `copyTask`, `removeTagFromTask`, `deleteTagFromGroup`), aborting cleanly if session expired mid-screen (`REQ-AU-09`).
- **`src/features/groups/components/GroupsGridView.tsx`** *(update)*:
  - Subscribe to `currentUser = useAuthStore((s) => s.currentUser)` (and optional navigation callback / router-safe navigation links) to render the Spanish account bar (`Hola, {displayName}`, `"Mi perfil"`, `"Cerrar sesión"`) when authenticated, pass `timeFormat={currentUser?.timeFormat ?? '24h'}` and `timeZone={currentUser?.timeZone}` to every `<GroupCard />`, and pass `timeFormat={currentUser?.timeFormat ?? '24h'}` to `<TaskFormModal />`.
  - Keep `<GroupsGridView />` renderable cleanly without `<RouterProvider>` in component tests by accepting optional `onNavigateToProfile?: () => void` / `onLoggedOut?: () => void` or safe optional router navigation.
- **`src/features/tasks/components/TaskFormModal.tsx`** & **`src/features/tasks/hooks/use-task-form.ts`** *(update)*:
  - Support `timeFormat?: '24h' | '12h'` prop (defaulting to `useAuthStore((s) => s.currentUser?.timeFormat ?? '24h')`).
  - Render explicit `12h` controls (`01..12` hour, `00..59` minute, `a. m.` / `p. m.` period, + `"Limpiar hora"` button) when `'12h'` is active, bijectively converting via `to12HourParts` / `from12HourParts`, enforcing `REQ-AU-16(2)` partial-selection validation (`es.auth.incompleteTimeError`), and synchronizing `dueDate`-empty disabled/auto-clear behavior (`REQ-TK-04`).
- **`src/features/tasks/components/TasksView.tsx`** *(update)*: Pass `timeFormat={currentUser?.timeFormat ?? '24h'}` to `<TaskList />` and `<TaskFormModal />`.

### 2.5 Test Files (`tests/`)
- **New Unit Tests:**
  - `tests/unit/features/auth/password-hash.test.ts`
  - `tests/unit/features/auth/recovery-codes.test.ts`
  - `tests/unit/features/auth/lockout.test.ts`
  - `tests/unit/features/auth/auth-form-schemas.test.ts`
  - `tests/unit/shared/utils/time-format.test.ts`
  - `tests/unit/data/local-storage-auth-repositories.test.ts` (User, Session, RecoveryCode, LoginLockout, Notification + Group per-user methods)
  - `tests/unit/features/auth/auth-store.test.ts`
- **Updated Unit & Integration Tests:**
  - `tests/unit/shared/i18n/es.test.ts` (verify `es.auth` namespace keys & templates)
  - `tests/unit/features/groups/groups-store.test.ts`, `tests/unit/features/tasks/tasks-store.test.ts`, `tests/unit/features/groups/groups-hooks.test.tsx`, `tests/unit/features/tasks/tasks-hooks.test.tsx` (provide authenticated test user dependency / update empty-storage expectation from unauthenticated `'local-user'` to unauthenticated-empty + authenticated-user Personal provisioning)
  - `tests/integration/features/groups/{groups-grid-view,group-lifecycle}.test.tsx`, `tests/integration/features/tasks/{tasks-view,task-form-modal,task-move-copy-modal}.test.tsx`, `tests/integration/features/tags/tag-removal-flows.test.tsx` (authenticate test user in `beforeEach`; expand `task-form-modal.test.tsx` with `12h` capture, midnight/noon conversion, partial-time error, and `"Limpiar hora"`)
  - `tests/integration/features/auth/auth-routes.test.tsx` (full TanStack Router memory-history integration tests covering Section 4.2 route matrix, one-time codes reload/navigation dismissal, mid-session expiration aborting mutations, profile updates propagating `12h` mode, and multi-user isolation)
- **Playwright E2E Tests (`tests/e2e/`):**
  - `tests/e2e/helpers/auth-e2e.ts` — Shared E2E UI registration/login helper for workspace specs (`registerUserAndContinue`).
  - `tests/e2e/auth.spec.ts` — Comprehensive E2E suite for `AC-AU-01`..`AC-AU-12` at desktop and mobile (~375px) viewports.
  - `tests/e2e/{smoke,tasks,groups,tags}.spec.ts` — Update `beforeEach` / baseline assertions for authenticated routes and unique per-user Personal group ID.

---

## 3. Detailed Technical Design

### 3.1 WebCrypto PBKDF2 Hashing (`src/features/auth/utils/password-hash.ts`)
- Stored format: `pbkdf2_sha256$100000$<32-hex-salt>$<64-hex-hash>`.
- Always convert `TextEncoder().encode(password)` and salt bytes via `Uint8Array.from(...)` backed by a local realm `ArrayBuffer` so WebCrypto works identically in Chromium/Firefox/Edge and Vitest `jsdom`.
- `tests/setup.ts` check: if `typeof globalThis.crypto?.subtle?.importKey !== 'function'` in Vitest's `jsdom` environment, attach Node `node:crypto` `webcrypto.subtle` in `tests/setup.ts` so tests run real PBKDF2 end-to-end (zero weak fallback in `src/`).

### 3.2 Route Guards & Post-Registration One-Time State (`src/app/router.tsx`)
```
Route Guard Decision Flow (runs in beforeLoad on every navigation):
1. Check current target pathname vs '/register'.
   If navigating AWAY from '/register' while postRegisterCodesPending === true:
     -> authStore.acknowledgeRegistrationCodes() (wipes transient codes).
2. Validate persisted session: result = await authStore.validateSession().
   (Note: on a browser page reload of '/register', fresh store has postRegisterCodesPending === false.)
3. Apply Section 4.2 Matrix:
   - target in ['/login', '/recover'] && authenticated -> redirect({ to: '/' })
   - target === '/register' && authenticated && !postRegisterCodesPending -> redirect({ to: '/' })
   - target in ['/', '/profile'] && !authenticated -> redirect({ to: '/login' })
   - catch-all '*' -> redirect({ to: authenticated ? '/' : '/login' })
```
- **Session-End Listener (`subscribeAuthSessionEnd`):** Registered by `router.tsx` (with cleanup) and triggered by `logout()`, mid-screen session expiry (`REQ-AU-09(2)`), orphan detection (`REQ-AU-09(3)`), and `deleteAccount()` (`REQ-AU-19`). Navigates cleanly to `/login` and carries zero `sessionExpired` notice unless reason === `'expired'`. Future `005-notifications` subscribes to the exact same `subscribeAuthSessionEnd` hook to cancel browser notifications (`RF-02`).

### 3.3 `12h` Due-Time Form Integration (`TaskFormModal.tsx`)
- Inside `TaskFormModal`, keep canonical `dueTime` (`HH:mm` or `''`) as the React Hook Form field validated by `taskFormSchema`, and maintain local component state `timeParts12h: TimeParts12h` synchronized on modal open/reset via `to12HourParts(task?.dueTime)`.
- Watch `dueDate` with `useWatch`. When `dueDate` becomes empty (`!watchedDueDate?.trim()`), clear `dueTime` and reset `timeParts12h` back to `{ hour: '', minute: '', period: '' }`, keeping all controls and `"Limpiar hora"` disabled (`REQ-TK-04`, `REQ-AU-16(2)`).
- On `handleFormSubmit`: when `timeFormat === '12h'`, run `from12HourParts(timeParts12h)`:
  - `'incomplete'` -> `form.setError('dueTime', { type: 'manual', message: es.auth.incompleteTimeError })` and return early without submitting.
  - `'empty'` -> `form.setValue('dueTime', '')` and submit.
  - `'ok'` -> `form.setValue('dueTime', result.dueTime)` and submit.
- Reset `lastResetKeyRef` cleanly so reopening the modal in `'12h'` mode always syncs from the active task's `dueTime`.

---

## 4. Design Decisions & Discarded Alternatives

1. **WebCrypto PBKDF2-HMAC-SHA-256 vs. Plain SHA-256 or External Libraries (`RNF-05`):**
   - *Chosen:* Native WebCrypto `crypto.subtle` PBKDF2 (`100,000` iterations, 16-byte CSPRNG salt, constant-time hex comparison) with injectable crypto dependencies for deterministic unit tests and Node WebCrypto shim check in `tests/setup.ts` if omitted by `jsdom`.
   - *Discarded:* Unsalted/fast SHA-256 (weak against offline brute force) and external hashing libraries like `bcryptjs` (unrequested npm dependency violating `AGENTS.md`).
2. **Additive `tbt:v1:login_lockouts` Key vs. Embedding Lockout on `User` (`RNF-06`, `REQ-AU-06`):**
   - *Chosen:* New `STORAGE_KEYS.LOGIN_LOCKOUTS = 'tbt:v1:login_lockouts'` storing Zod-validated `LoginLockoutState[]` keyed by normalized email.
   - *Discarded:* Adding `failedAttempts`/`lockedUntil` fields onto `User` in `tbt:v1:users` (cannot persist lockouts for unregistered emails without leaking whether an email exists, violating anti-enumeration, and would alter `userSchema`).
3. **Code-Based TanStack Router (`src/app/router.tsx`) vs. File-Based Router Plugin:**
   - *Chosen:* Programmatic TanStack Router route tree (`createRootRoute`, `createRoute`, `createRouter`) accepting optional `RouterHistory` (`createMemoryHistory` for tests, `createBrowserHistory` by default).
   - *Discarded:* TanStack Router Vite file-generation plugin (would require adding a dev dependency and editing `vite.config.ts`).
4. **Canonical `HH:mm` Preservation with Explicit `12h` Selectors vs. Storing 12h Strings (`REQ-AU-16`):**
   - *Chosen:* Three accessible `<Form.Select>` controls (`01..12`, `00..59`, `a. m.`/`p. m.`) converted bijectively via pure `to12HourParts` / `from12HourParts` into canonical `24h` `HH:mm`.
   - *Discarded:* Relying on `<input type="time">` (follows OS locale rather than app user preference `timeFormat`) or changing `Task.dueTime` persistence format (would break `001-tasks` sorting/overdue/notification contracts).
5. **Dedicated `GroupRepository.deleteAllByOwnerId(userId)` vs. Weakening `GroupRepository.delete(id)` (`REQ-AU-19` vs. `REQ-GRP-11`):**
   - *Chosen:* Add `deleteAllByOwnerId(userId)` explicitly for cascade account deletion (`RF-05`) while preserving `BusinessRuleViolationError` on `delete(personalGroupId)` (`RF-07`).
   - *Discarded:* Adding an override boolean to `delete(id, force)` (risks accidentally exposing Personal deletion outside account deletion).
6. **Store Auth Injection (`getActiveUserId`) vs. Deleting `SEED_PERSONAL_GROUP` (`REQ-AU-21`):**
   - *Chosen:* Inject `getActiveUserId` (defaulting to `useAuthStore.getState().ensureActiveUserId()`) into `useGroupsStore` and `useTasksStore`, returning empty state when unauthenticated and auto-provisioning via `ensurePersonalGroupForUser(userId)` when authenticated without a Personal group, while leaving `SEED_PERSONAL_GROUP` / `ensureSeedGroup()` intact in schema/repo unit tests (`limits.test.ts`, `local-storage-group-repository.test.ts`).
   - *Discarded:* Deleting `SEED_PERSONAL_GROUP` outright (unnecessary breaking churn on `000-foundation` schema unit tests while zero production UI/store code ever invokes `ensureSeedGroup()`).

---

## 5. Verification & Traceability Matrix

| Spec / Acceptance Criteria | Planned Verification |
| :--- | :--- |
| `REQ-AU-01`, `REQ-AU-02`, `AC-AU-01`, `AC-AU-02` | `auth-form-schemas.test.ts`, `password-hash.test.ts`, `local-storage-auth-repositories.test.ts`, `auth-store.test.ts`, `auth-routes.test.tsx`, `auth.spec.ts` |
| `REQ-AU-03`, `REQ-AU-04`, `AC-AU-01`, `AC-AU-03` | `recovery-codes.test.ts`, `auth-store.test.ts`, `auth-routes.test.tsx`, `auth.spec.ts` |
| `REQ-AU-05`, `REQ-AU-06`, `AC-AU-04`, `AC-AU-05` | `lockout.test.ts`, `local-storage-auth-repositories.test.ts`, `auth-store.test.ts`, `auth-routes.test.tsx`, `auth.spec.ts` |
| `REQ-AU-07`, `REQ-AU-08`, `REQ-AU-09`, `AC-AU-04`, `AC-AU-06` | `auth-store.test.ts`, `groups-store.test.ts`, `tasks-store.test.ts`, `auth-routes.test.tsx`, `auth.spec.ts` |
| `REQ-AU-10`, `REQ-AU-11`, `REQ-AU-12`, `AC-AU-07` | `auth-form-schemas.test.ts`, `recovery-codes.test.ts`, `auth-store.test.ts`, `auth-routes.test.tsx`, `auth.spec.ts` |
| `REQ-AU-13`, `REQ-AU-14`, `REQ-AU-15`, `AC-AU-08`, `AC-AU-09` | `auth-form-schemas.test.ts`, `auth-store.test.ts`, `auth-routes.test.tsx`, `auth.spec.ts` |
| `REQ-AU-16`, `AC-AU-08` | `time-format.test.ts`, `task-form-modal.test.tsx`, `groups-grid-view.test.tsx`, `auth-routes.test.tsx`, `auth.spec.ts` |
| `REQ-AU-17`, `REQ-AU-18`, `REQ-AU-19`, `AC-AU-10` | `local-storage-auth-repositories.test.ts`, `auth-store.test.ts`, `auth-routes.test.tsx`, `auth.spec.ts` |
| `REQ-AU-20`, `REQ-AU-21`, `AC-AU-11` | `groups-store.test.ts`, `tasks-store.test.ts`, `auth-routes.test.tsx`, `auth.spec.ts`, `smoke.spec.ts` |
| `REQ-AU-22`, `REQ-AU-23`, `AC-AU-12` | `es.test.ts`, `auth-routes.test.tsx`, `auth.spec.ts` (mobile ~375px + desktop + keyboard/ARIA + 0 console errors) |

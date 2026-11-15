# Task Checklist: `004-auth` (User Accounts, Authentication, Profile & Recovery)

- **Feature Name:** `004-auth`
- **Spec Reference:** [docs/specs/004-auth/spec.md](./spec.md) (`Status: approved`)
- **Plan Reference:** [docs/specs/004-auth/plan.md](./plan.md)

---

## Task List

- [x] **T1: Spanish Auth Localization, Lockout Schema & Storage Key (`RNF-06`, `RNF-14`, `RNF-19`)**
  - **Associated Requirements:** `REQ-AU-06`, `REQ-AU-16`, `REQ-AU-23`, Section 4.1, Section 4.4
  - **Files Touched:**
    - `tests/unit/shared/i18n/es.test.ts` (modified — assertions for `es.auth` keys and cooldown interpolation templates)
    - `tests/unit/shared/schemas/limits.test.ts` (modified — assertions for `loginLockoutSchema` validation boundaries)
    - `tests/setup.ts` (modified if needed — verify `globalThis.crypto.subtle` in Vitest `jsdom` and attach Node WebCrypto subtle fallback only if undefined)
    - `src/shared/i18n/es.ts` (modified — add `AuthLocalization` & `es.auth` dictionary per `spec.md` Section 4.4)
    - `src/shared/schemas/session.ts` (modified — add `loginLockoutSchema` & `LoginLockoutState` type)
    - `src/data/storage/keys.ts` (modified — add additive `LOGIN_LOCKOUTS: 'tbt:v1:login_lockouts'`)
  - **TDD Test First:** Add failing unit tests for `es.auth` keys/templates and `loginLockoutSchema` before writing implementation code; verify WebCrypto subtle support under Vitest `jsdom`.
  - **Done when:** `es.auth` compiles under `LocalizationDictionary`, `loginLockoutSchema` validates `normalizedEmail`/`failedAttempts`/`lockedUntil`, `crypto.subtle` works in Vitest, and all tests pass.
  - **Verification Command:** `npm test && npm run typecheck && npm run lint`

- [x] **T2: Pure Bijective `12h <-> 24h` Time Conversion Utilities (`RF-04`, `UI-07`)**
  - **Associated Requirements:** `REQ-AU-16(2)`, Section 4.4
  - **Files Touched:**
    - `tests/unit/shared/utils/time-format.test.ts` (created — round-trip conversion, `00:mm <-> 12:mm a. m.`, `12:mm <-> 12:mm p. m.`, unset/partial selection tests)
    - `src/shared/utils/time-format.ts` (created — pure `to12HourParts` & `from12HourParts`)
    - `src/shared/utils/index.ts` (modified — export `time-format`)
  - **TDD Test First:** Write failing unit tests covering empty/null, `00:00`, `00:45`, `09:15`, `12:00`, `13:30`, `23:59`, and partial `12h` selection (`reason: 'incomplete'` vs `'empty'`).
  - **Done when:** All pure `12h <-> 24h` conversion and validation edge-case unit tests pass.
  - **Verification Command:** `npm test && npm run typecheck && npm run lint`

- [x] **T3: Pure Auth Security Utilities & Zod Form Schemas (`RF-01`–`RF-05`, `RNF-05`, `RNF-06`, `Appendix B`)**
  - **Associated Requirements:** `REQ-AU-01`, `REQ-AU-03`, `REQ-AU-05`, `REQ-AU-06`, `REQ-AU-10`, `REQ-AU-13`, `REQ-AU-14`, `REQ-AU-15`, `REQ-AU-18`
  - **Files Touched:**
    - `tests/unit/features/auth/password-hash.test.ts` (created)
    - `tests/unit/features/auth/recovery-codes.test.ts` (created)
    - `tests/unit/features/auth/lockout.test.ts` (created)
    - `tests/unit/features/auth/auth-form-schemas.test.ts` (created)
    - `src/features/auth/utils/{password-hash.ts,recovery-codes.ts,lockout.ts,index.ts}` (created)
    - `src/features/auth/schemas/{auth-form-schemas.ts,index.ts}` (created)
  - **TDD Test First:** Write failing tests covering salted PBKDF2-HMAC-SHA-256 non-reversible hashing/constant-time verification, 8-code unique `[A-Z0-9]{8}` generation & normalization, 5-attempt/5-min lockout transitions with injected `now` & minutes/seconds templates, untrimmed passwords across all schemas, `/login` validation without `6..30` length rejection, and `[A-Za-z0-9]{8}` recovery code validation.
  - **Done when:** All pure security, lockout, recovery-code, and form-schema unit tests pass with deterministic injected clocks/crypto.
  - **Verification Command:** `npm test && npm run typecheck && npm run lint`

- [x] **T4: Data Layer Contracts & LocalStorage Repositories (`RF-01`–`RF-06`, `RNF-07`, `RNF-10`, `RNF-19`)**
  - **Associated Requirements:** `REQ-AU-02`, `REQ-AU-03`, `REQ-AU-06`, `REQ-AU-09`, `REQ-AU-11`, `REQ-AU-13`, `REQ-AU-15`, `REQ-AU-19`, `REQ-AU-21`
  - **Files Touched:**
    - `tests/unit/data/local-storage-auth-repositories.test.ts` (created)
    - `src/data/contracts/{user-repository.ts,session-repository.ts,recovery-code-repository.ts,login-lockout-repository.ts,notification-repository.ts}` (created)
    - `src/data/contracts/{group-repository.ts,index.ts}` (modified — add `getAccessibleByUserId`, `ensurePersonalGroupForUser`, `deleteAllByOwnerId`)
    - `src/data/repositories/{local-storage-user-repository.ts,local-storage-session-repository.ts,local-storage-recovery-code-repository.ts,local-storage-login-lockout-repository.ts,local-storage-notification-repository.ts}` (created — explicit `private readonly`, strict Zod parsing)
    - `src/data/repositories/{local-storage-group-repository.ts,index.ts}` (modified — preserve `ensureSeedGroup()` & Personal delete guard while adding per-user methods)
  - **TDD Test First:** Write failing tests for case-insensitive email/username uniqueness (excluding self `id`), strict Zod validation rejecting plaintext `password`, recovery code replacement preserving other users, notification user-scoped deletion, user-owned Personal group provisioning ignoring `'local-user'`, and `deleteAllByOwnerId` cascade removal.
  - **Done when:** All auth repository unit tests and existing repository unit tests pass.
  - **Verification Command:** `npm test && npm run typecheck && npm run lint`

- [x] **T5: Auth Store (`useAuthStore`) & Session-End Hook (`RF-01`–`RF-06`, `RNF-06`, `RNF-09`, `RNF-10`, `RNF-18`)**
  - **Associated Requirements:** `REQ-AU-01`–`REQ-AU-15`, `REQ-AU-17`–`REQ-AU-20`
  - **Files Touched:**
    - `tests/unit/features/auth/auth-store.test.ts` (created)
    - `src/features/auth/store/{auth-store.ts,index.ts}` (created)
    - `src/features/auth/hooks/{use-auth.ts,index.ts}` (created)
  - **TDD Test First:** Write failing unit tests covering `register`, `acknowledgeRegistrationCodes`, `login` (timezone refresh + lockout + format errors don't increment lockout), `validateSession` / `ensureActiveUserId` (7-day expiry -> `sessionExpired` notice, orphan -> clean redirect without notice), `logout` (`subscribeAuthSessionEnd`), `recoverPassword` (single-use, lockout clear, password reuse allowed, anti-enumeration), `updateProfile` (self-excluded uniqueness + email change clears old lockout), `changePassword` (empty vs wrong `currentPassword`, token rotation preserving `expiresAt`, no `/login` lockout increment), `regenerateRecoveryCodes`, and `deleteAccount` (full per-user cascade preserving other users).
  - **Done when:** All `auth-store.test.ts` unit tests pass deterministically.
  - **Verification Command:** `npm test && npm run typecheck && npm run lint`

- [x] **T6: Per-User Workspace Store Isolation & Missing-Personal Self-Healing (`RF-06`, `RNF-18`, `RNF-20`)**
  - **Associated Requirements:** `REQ-AU-09`, `REQ-AU-21`, Section 2.3
  - **Files Touched:**
    - `tests/unit/features/groups/{groups-store.test.ts,groups-hooks.test.tsx}` (modified — test unauthenticated empty state, user-scoped hydration, missing Personal self-healing, `createGroup` sets `creatorId: activeUserId`, mid-session expiration abort)
    - `tests/unit/features/tasks/{tasks-store.test.ts,tasks-hooks.test.tsx}` (modified — same user-scoped isolation and mid-session expiration guard checks)
    - `src/features/groups/store/groups-store.ts` (modified — replace `ensureSeedGroup()` with `getActiveUserId` + `getAccessibleByUserId` + `ensurePersonalGroupForUser`)
    - `src/features/tasks/store/tasks-store.ts` (modified — replace `ensureSeedGroup()` with `getActiveUserId` + user-scoped group/task/tag hydration & pre-mutation session check)
  - **TDD Test First:** Update store/hook unit tests to fail under legacy `'local-user'` behavior and expect strict per-user scoping, zero unauthenticated fallback, `RNF-18` self-healing, and pre-mutation session check.
  - **Done when:** `useGroupsStore` and `useTasksStore` enforce strict per-user isolation and pass all store & hook unit tests.
  - **Verification Command:** `npm test && npm run typecheck && npm run lint`

- [x] **T7: `12h` / `24h` Time Capture & Workspace Account Header Integration (`RF-04`, `UI-07`, `REQ-TK-04`)**
  - **Associated Requirements:** `REQ-AU-16`, `REQ-AU-08`, `REQ-AU-22`, `REQ-AU-23`
  - **Files Touched:**
    - `tests/integration/features/tasks/{task-form-modal.test.tsx,tasks-view.test.tsx,task-move-copy-modal.test.tsx}` (modified — authenticate test user in `beforeEach`; add `12h` due-time capture, midnight/noon conversion, partial-time `incompleteTimeError`, `dueDate` empty disabled/auto-clear, `"Limpiar hora"` integration tests)
    - `tests/integration/features/groups/{groups-grid-view.test.tsx,group-lifecycle.test.tsx}` (modified — authenticate test user in `beforeEach`; verify greeting/`"Mi perfil"`/`"Cerrar sesión"` bar & `timeFormat`/`timeZone` propagation to `GroupCard` & `TaskFormModal`)
    - `tests/integration/features/tags/tag-removal-flows.test.tsx` (modified — authenticate test user in `beforeEach`)
    - `src/features/tasks/components/TaskFormModal.tsx` (modified — explicit `12h` selectors, `"Limpiar hora"`, partial-time error handling, `dueDate` clear sync)
    - `src/features/tasks/hooks/use-task-form.ts` (modified — clean reset sync for edit/create forms)
    - `src/features/tasks/components/TasksView.tsx` (modified — pass active user `timeFormat`/`timeZone`)
    - `src/features/groups/components/GroupsGridView.tsx` (modified — account navigation header + `timeFormat`/`timeZone` propagation)
  - **TDD Test First:** Add integration test cases for `12h` mode (`12:00 a. m. <-> 00:00`, `12:30 p. m. <-> 12:30`, partial selection rejection, `Limpiar hora`) and authenticated workspace header before editing UI components.
  - **Done when:** All task, group, and tag integration tests pass cleanly with both `'24h'` and `'12h'` modes.
  - **Verification Command:** `npm test && npm run typecheck && npm run lint`

- [x] **T8: Authentication, Recovery & Profile UI Views (`RF-01`–`RF-05`, `UI-01`, `UI-06`, `RNF-12`, `RNF-14`)**
  - **Associated Requirements:** `REQ-AU-01`–`REQ-AU-19`, `REQ-AU-22`, `REQ-AU-23`
  - **Files Touched:**
    - `src/features/auth/components/{AuthLayout.tsx,LoginPage.tsx,OneTimeRecoveryCodesCard.tsx,RegisterPage.tsx,RecoverPasswordPage.tsx,DeleteAccountConfirmModal.tsx,ProfilePage.tsx,index.ts}` (created)
    - `src/features/auth/index.ts` (modified — export public auth components, hooks, store, schemas, utils)
  - **Steps:**
    1. Build responsive Mobile-First (~375px+) Bootstrap 5.3 auth and profile views with 100% Spanish strings from `es.auth`/`es.validation`/`es.common`, accessible labels, `aria-invalid`, `role="alert"`, `useWatch` where reactive values are needed, and `DeleteAccountConfirmModal` (`Escape`, focus return, explicit password prompt).
    2. Clear sensitive password inputs after submit/dismissal and ensure `<OneTimeRecoveryCodesCard />` works both in post-signup and profile regeneration flows.
  - **Done when:** All auth views compile cleanly under strict TS and ESLint with zero errors.
  - **Verification Command:** `npm test && npm run typecheck && npm run lint`

- [x] **T9: TanStack Router Integration, Route Guards & App Bootstrap (`RF-01`–`RF-03`, `RNF-18`)**
  - **Associated Requirements:** `REQ-AU-04`, `REQ-AU-08`, `REQ-AU-09`, `REQ-AU-20`, Section 4.2
  - **Files Touched:**
    - `tests/integration/features/auth/auth-routes.test.tsx` (created — memory-history tests for Section 4.2 matrix, one-time codes reload/navigation exit, mid-session expiry abort + `sessionExpired`, explicit logout/orphan/deletion notices, profile `12h` propagation, multi-user isolation)
    - `src/app/router.tsx` (created — declarative TanStack Router routes `/login`, `/register`, `/recover`, `/`, `/profile`, `*` catch-all + `beforeLoad` guards + `subscribeAuthSessionEnd` navigation listener)
    - `src/app/index.ts` (modified — export router helpers)
    - `src/App.tsx` (modified — render `<RouterProvider />`)
  - **TDD Test First:** Write integration tests in `auth-routes.test.tsx` exercising every row/column of Section 4.2, mid-session expiry, logout, and multi-user isolation using `createAppRouter(createMemoryHistory(...))` before wiring `router.tsx` and `App.tsx`.
  - **Done when:** All router guard and end-to-end integration flow tests pass in Vitest.
  - **Verification Command:** `npm test && npm run typecheck && npm run lint`

- [x] **T10: Playwright End-to-End Tests (`AC-AU-01`..`AC-AU-12`)**
  - **Associated Requirements:** `AC-AU-01`..`AC-AU-12`, `UI-01`, `RNF-12`, `RNF-15`
  - **Files Touched:**
    - `tests/e2e/helpers/auth-e2e.ts` (created — UI registration + `"He guardado mis códigos, continuar"` helper for E2E suites)
    - `tests/e2e/auth.spec.ts` (created — full E2E auth, lockout across reload, recovery single-use, profile `12h` capture & display, password change, code regeneration, multi-user isolation, and account deletion flows at desktop & ~375px mobile widths)
    - `tests/e2e/smoke.spec.ts` (modified — verify `/` unauthenticated redirect to `/login` + authenticated entry with 0 console errors)
    - `tests/e2e/{tasks,groups,tags}.spec.ts` (modified — authenticate isolated user in `beforeEach`; update `tasks.spec.ts` Personal group check away from legacy `'group-personal'` constant)
  - **Done when:** All Playwright E2E specs pass at both desktop and mobile viewports with zero console errors.
  - **Verification Command:** `npm run e2e`

- [x] **T11: Final Verification, Spec Closure & Memory Sync**
  - **Associated Requirements:** `Constitution Principle 6`, `AGENTS.md`
  - **Files Touched:**
    - `docs/specs/004-auth/spec.md` (modified — update `Status: implemented`)
    - `docs/specs/004-auth/plan.md` (modified — update `Status: implemented`)
    - `docs/specs/004-auth/tasks.md` (modified — mark `[x]` on `T1`–`T11`)
    - `MEMORY.md` (modified — record `004-auth` decisions, learnings, and final Vitest + Playwright counts)
  - **Done when:** Full verification suite passes with zero errors and SDD docs + `MEMORY.md` match implemented state.
  - **Verification Command:** `npm test && npm run typecheck && npm run lint && npm run build && npm run e2e`

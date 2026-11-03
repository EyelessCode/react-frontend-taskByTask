# Tasks Checklist: 000-foundation

- **Feature Name:** `000-foundation`
- **Spec Reference:** [`docs/specs/000-foundation/spec.md`](file:///C:/Users/crist/Documentos/GitHub/PERSONAL/PROJECTS-FULLSTACK/TaskByTask/react-frontend-taskByTask/docs/specs/000-foundation/spec.md) (Status: `approved`)
- **Plan Reference:** [`docs/specs/000-foundation/plan.md`](file:///C:/Users/crist/Documentos/GitHub/PERSONAL/PROJECTS-FULLSTACK/TaskByTask/react-frontend-taskByTask/docs/specs/000-foundation/plan.md)

---

## Task List

- [x] **T1: [⚠️ Ask First] Runtime & Testing Dependencies Installation**
  - **Associated Requirements:** `REQ-FD-20`, `AC-FD-08`
  - **User Confirmation Flag:** `⚠️ Requires User Confirmation` (Package installation touches `package.json` and `package-lock.json`)
  - **Files Touched:**
    - `package.json` (modified)
    - `package-lock.json` (modified)
  - **TDD Test First:** N/A (Package dependency resolution)
  - **Action Items:**
    1. Prompt user for confirmation to install packages per `AGENTS.md`.
    2. Install production dependencies:
       `npm install @tanstack/react-router zustand react-hook-form @hookform/resolvers zod bootstrap react-bootstrap`
    3. Install dev dependencies:
       `npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom @playwright/test`
  - **Done when:** All specified packages appear in `package.json` under `dependencies` and `devDependencies`, and `npm ls` resolves without unmet peer dependencies.
  - **Verification Command:** `npm run lint`

- [x] **T2: [⚠️ Ask First] Test Harness Configuration & Tooling Scripts**
  - **Associated Requirements:** `REQ-FD-18`, `REQ-FD-19`, `REQ-FD-21`, `AC-FD-08`
  - **User Confirmation Flag:** `⚠️ Requires User Confirmation` (Modifies `package.json`, `eslint.config.js`, creates `vitest.config.ts`, `playwright.config.ts`)
  - **Files Touched:**
    - `vitest.config.ts` (created)
    - `playwright.config.ts` (created)
    - `tests/setup.ts` (created)
    - `tests/e2e/smoke.spec.ts` (created baseline test)
    - `package.json` (modified scripts)
    - `eslint.config.js` (modified ignore patterns)
  - **TDD Test First:** `tests/e2e/smoke.spec.ts` (verifies root `/` loads without console errors)
  - **Action Items:**
    1. Prompt user for confirmation to edit root configuration files.
    2. Create `vitest.config.ts` configuring `jsdom` environment, `globals: true`, setup file `./tests/setup.ts`, and path aliases.
    3. Create `tests/setup.ts` importing `@testing-library/jest-dom/vitest`.
    4. Create `playwright.config.ts` configuring test directory `tests/e2e/` and webServer on `http://localhost:5173`.
    5. Create baseline smoke test `tests/e2e/smoke.spec.ts`.
    6. Update `package.json` scripts:
       - `"typecheck": "tsc -b --noEmit"`
       - `"test": "vitest run"`
       - `"test:watch": "vitest"`
       - `"e2e": "playwright test"`
    7. Update `eslint.config.js` to add `playwright-report` and `test-results` to `globalIgnores`.
  - **Done when:** `npm test` executes Vitest and reports 0 errors; `npm run lint` executes ESLint without warnings.
  - **Verification Command:** `npm test && npm run lint`

- [x] **T3: [⚠️ Ask First] TypeScript Solution Configuration for Test Isolation**
  - **Associated Requirements:** `REQ-FD-18`, `REQ-FD-19`, `REQ-FD-21`, `AC-FD-08`
  - **User Confirmation Flag:** `⚠️ Requires User Confirmation` (Modifies `tsconfig.json`, creates `tsconfig.test.json`)
  - **Files Touched:**
    - `tsconfig.test.json` (created)
    - `tsconfig.json` (modified)
  - **TDD Test First:** N/A (TypeScript compiler verification)
  - **Action Items:**
    1. Prompt user for confirmation to edit `tsconfig.json` and create `tsconfig.test.json`.
    2. Create `tsconfig.test.json` including `tests/**/*`, `vite.config.ts`, and `vitest.config.ts` with types `["vitest/globals", "@testing-library/jest-dom", "node"]` and `"noEmit": true`.
    3. Update `tsconfig.json` references to include `tsconfig.test.json`.
    4. Verify that production `tsconfig.app.json` remains strictly limited to `src/` and does not inherit test types.
  - **Done when:** `npm run typecheck` (`tsc -b --noEmit`) succeeds across `tsconfig.app.json`, `tsconfig.node.json`, and `tsconfig.test.json` without type leakage.
  - **Verification Command:** `npm run typecheck`

- [x] **T4: Base Architecture Folder Layout Scaffolding**
  - **Associated Requirements:** `REQ-FD-17`, `REQ-FD-19`
  - **User Confirmation Flag:** Standard Task (no root config modification)
  - **Files Touched:**
    - `src/app/index.ts` (created)
    - `src/features/auth/index.ts` (created)
    - `src/features/tasks/index.ts` (created)
    - `src/features/groups/index.ts` (created)
    - `src/features/tags/index.ts` (created)
    - `src/features/notifications/index.ts` (created)
    - `src/shared/ui/index.ts` (created)
    - `src/shared/hooks/index.ts` (created)
    - `src/shared/utils/index.ts` (created)
    - `src/shared/schemas/index.ts` (created)
    - `src/shared/errors/index.ts` (created)
    - `src/shared/i18n/index.ts` (created)
    - `src/data/contracts/index.ts` (created)
    - `src/data/storage/index.ts` (created)
    - `tests/mocks/mock-storage.ts` (created)
  - **TDD Test First:** N/A (Structural barrel files)
  - **Action Items:**
    1. Create directories for all modules specified in `plan.md` Section 1.1.
    2. Add placeholder barrel `index.ts` files exporting empty objects or documentation comments.
    3. Create `tests/mocks/mock-storage.ts` providing an in-memory `Storage` mock for tests.
  - **Done when:** Folder structure matches `plan.md` Section 1.1 and all index files typecheck and pass linting.
  - **Verification Command:** `npm run typecheck && npm run lint`

- [x] **T5: Centralized Spanish Localization Baseline (`i18n/es.ts`)**
  - **Associated Requirements:** `REQ-FD-14`, `REQ-FD-17`, `UI-01`, `RNF-12`, `AC-FD-07`
  - **User Confirmation Flag:** Standard Task
  - **Files Touched:**
    - `tests/unit/shared/i18n/es.test.ts` (created)
    - `src/shared/i18n/es.ts` (created)
    - `src/shared/i18n/index.ts` (modified)
  - **TDD Test First:** Create `tests/unit/shared/i18n/es.test.ts` testing presence of `app`, `common`, `validation`, `errors`, and `dateTime` namespaces, and checking interpolation helper functions (`required`, `minLength`, `maxLength`, etc.).
  - **Action Items:**
    1. Write unit test in `tests/unit/shared/i18n/es.test.ts` (red phase).
    2. Implement `src/shared/i18n/es.ts` exporting `es` dictionary object and `LocalizationDictionary` type conforming to `spec.md` Section 4.5.
    3. Re-export `es` and types in `src/shared/i18n/index.ts`.
  - **Done when:** All tests in `es.test.ts` pass, all strings are in Spanish, and no hardcoded English strings exist.
  - **Verification Command:** `npm test && npm run typecheck && npm run lint`

- [x] **T6: Controlled Domain Error Classes & Taxonomy**
  - **Associated Requirements:** `REQ-FD-04`, `REQ-FD-05`, `REQ-FD-06`, `RNF-07`, `RNF-18`, `AC-FD-04`
  - **User Confirmation Flag:** Standard Task
  - **Files Touched:**
    - `tests/unit/shared/errors/domain-errors.test.ts` (created)
    - `src/shared/errors/domain-errors.ts` (created)
    - `src/shared/errors/index.ts` (modified)
  - **TDD Test First:** Create `tests/unit/shared/errors/domain-errors.test.ts` asserting error hierarchy, codes, messages, and prototype chain preservation (`instanceof`).
  - **Action Items:**
    1. Write unit tests for `AppError`, `ValidationError`, `NotFoundError`, `BusinessRuleViolationError`, `CorruptedDataError`, and `StorageQuotaError` (red phase).
    2. Implement error classes in `src/shared/errors/domain-errors.ts`.
    3. Re-export errors from `src/shared/errors/index.ts`.
  - **Done when:** All 6 domain error classes exist with appropriate error codes, messages, and inherit from `AppError` and native `Error`.
  - **Verification Command:** `npm test && npm run typecheck && npm run lint`

- [x] **T7: Canonical Zod Schemas & Appendix B Limits**
  - **Associated Requirements:** `REQ-FD-01`, `REQ-FD-02`, `REQ-FD-03`, `REQ-FD-10b`, `REQ-FD-11`, `REQ-FD-12`, `REQ-FD-13`, `RF-22`, `RNF-05`, `RNF-19`, `RNF-20`, `AC-FD-01`, `AC-FD-02`, `AC-FD-03`
  - **User Confirmation Flag:** Standard Task
  - **Files Touched:**
    - `tests/unit/shared/schemas/limits.test.ts` (created)
    - `src/shared/schemas/limits.ts` (created)
    - `src/shared/schemas/common.ts` (created)
    - `src/shared/schemas/user.ts` (created)
    - `src/shared/schemas/group.ts` (created)
    - `src/shared/schemas/task.ts` (created)
    - `src/shared/schemas/tag.ts` (created)
    - `src/shared/schemas/notification.ts` (created)
    - `src/shared/schemas/session.ts` (created)
    - `src/shared/schemas/invitation.ts` (created)
    - `src/shared/schemas/index.ts` (modified)
  - **TDD Test First:** Create `tests/unit/shared/schemas/limits.test.ts` testing every Appendix B limit boundary (min - 1, min, max, max + 1), tag `;`/`,` rejection, user email RFC format, raw password length (6..30) vs `passwordHash: string` persistence, recovery codes count (8), and future-proof group/task slots.
  - **Action Items:**
    1. Write comprehensive tests in `limits.test.ts` (red phase).
    2. Implement `limits.ts` with Appendix B numeric constants.
    3. Implement domain schemas and types for `User`, `RecoveryCode`, `Session`, `Group`, `GroupMember`, `Task`, `Tag`, `Subtask`, `Reminder`, `Notification`, and `Invitation`.
    4. Ensure User entity schema enforces `passwordHash` and forbids plaintext password properties.
    5. Ensure Tag schema forbids `;` and `,` and trims whitespace.
    6. Ensure Group entity schema enforces `creatorId` and `members` array.
    7. Ensure Task entity schema defines optional `assigneeId`, `subtasks`, and `reminders`.
    8. Re-export all schemas and inferred types in `src/shared/schemas/index.ts`.
  - **Done when:** All Zod schemas pass validation boundary tests, export TypeScript interfaces matching `spec.md` Section 4.2 with zero `any`, and emit localized Spanish validation error messages.
  - **Verification Command:** `npm test && npm run typecheck && npm run lint`

- [x] **T8: Pure Date & Time Utilities**
  - **Associated Requirements:** `REQ-FD-14`, `REQ-FD-15`, `REQ-FD-16`, `REQ-FD-18`, `RF-28`, `UI-07`, `RNF-14`, `AC-FD-06`
  - **User Confirmation Flag:** Standard Task
  - **Files Touched:**
    - `tests/unit/shared/utils/date-time.test.ts` (created)
    - `src/shared/utils/date-time.ts` (created)
    - `src/shared/utils/index.ts` (modified)
  - **TDD Test First:** Create `tests/unit/shared/utils/date-time.test.ts` testing:
    - Overdue calculations: past datetime -> overdue; future datetime -> not overdue; date without time -> not overdue before 23:59:59.999 local time, overdue after; task with no date -> never overdue.
    - Reminder trigger calculations: date-only task defaults to 09:00:00 local time (RF-28); offset subtraction (`15m`, `30m`, `1h`, `6h`, `1d`).
    - Date display formatting: `YYYY-MM-DD` -> `dd/mm/aaaa` without timezone shift.
    - Time display formatting: `HH:mm` -> 24h default and 12h option (`hh:mm a`).
    - ISO timestamp generator: standard UTC ISO-8601 string.
  - **Action Items:**
    1. Write unit tests in `date-time.test.ts` (red phase).
    2. Implement pure utilities in `src/shared/utils/date-time.ts` accepting `now` and `timeZone` parameters.
    3. Re-export utilities from `src/shared/utils/index.ts`.
  - **Done when:** All date/time tests pass across multiple timezones (e.g. `America/Bogota`, `UTC`, `America/New_York`) deterministically without mocking global `Date`.
  - **Verification Command:** `npm test && npm run typecheck && npm run lint`

- [x] **T9: Storage Adapter, Safe Parsing & Repository Contracts**
  - **Associated Requirements:** `REQ-FD-07`, `REQ-FD-08`, `REQ-FD-09`, `REQ-FD-10`, `RNF-07`, `RNF-18`, `AC-FD-05`
  - **User Confirmation Flag:** Standard Task
  - **Files Touched:**
    - `tests/unit/data/local-storage-adapter.test.ts` (created)
    - `tests/integration/storage-validation.test.ts` (created)
    - `src/data/contracts/storage-adapter.ts` (created)
    - `src/data/contracts/repository.ts` (created)
    - `src/data/contracts/index.ts` (modified)
    - `src/data/storage/keys.ts` (created)
    - `src/data/storage/local-storage-adapter.ts` (created)
    - `src/data/storage/index.ts` (modified)
  - **TDD Test First:** Create unit tests in `local-storage-adapter.test.ts` testing:
    - Normal getItem/setItem roundtrip.
    - JSON parse syntax failure raises `CorruptedDataError` and safely returns fallback.
    - Zod schema validation mismatch raises `CorruptedDataError` and safely returns fallback.
    - Browser `QuotaExceededError` throws `StorageQuotaError`.
    - Integration test in `storage-validation.test.ts` validating actual Task and Group schemas against `tbt:v1:*` keys.
  - **Action Items:**
    1. Write unit and integration tests (red phase).
    2. Define `StorageAdapter` and generic `Repository` contracts in `src/data/contracts/`.
    3. Define versioned storage keys (`tbt:v1:*`) in `src/data/storage/keys.ts`.
    4. Implement `LocalStorageAdapter` in `src/data/storage/local-storage-adapter.ts` with two-phase safe parse (`JSON.parse` + Zod `.safeParse()`).
    5. Re-export contracts and storage classes in barrel index files.
  - **Done when:** `LocalStorageAdapter` passes all tests, successfully shields domain features from raw `localStorage`, and handles corrupt data gracefully.
  - **Verification Command:** `npm test && npm run typecheck && npm run lint`

- [x] **T10: Complete Verification Gates Execution & Smoke Test**
  - **Associated Requirements:** `REQ-FD-21`, `AC-FD-08`, `Constitution Principles 1–6`
  - **User Confirmation Flag:** Standard Task
  - **Files Touched:**
    - `tests/e2e/smoke.spec.ts` (verified)
  - **TDD Test First:** N/A (Full pipeline verification)
  - **Action Items:**
    1. Execute `npm run typecheck` (`tsc -b --noEmit`) and verify 0 type errors.
    2. Execute `npm run lint` (`eslint .`) and verify 0 lint errors and 0 warnings.
    3. Execute `npm test` (`vitest run`) and verify 100% test pass rate.
    4. Execute `npm run build` (`tsc -b && vite build`) and verify production distribution generates without test code leakage.
    5. Execute `npm run e2e` (`playwright test`) and verify the smoke test passes cleanly against the build/preview server.
  - **Done when:** All five quality gates pass with zero errors, fulfilling all Acceptance Criteria `AC-FD-01` through `AC-FD-08`.
  - **Verification Command:** `npm run typecheck && npm run lint && npm test && npm run build && npm run e2e`

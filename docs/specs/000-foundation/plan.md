# Implementation Plan: 000-foundation

- **Feature Name:** `000-foundation`
- **Spec Reference:** [`docs/specs/000-foundation/spec.md`](file:///C:/Users/crist/Documentos/GitHub/PERSONAL/PROJECTS-FULLSTACK/TaskByTask/react-frontend-taskByTask/docs/specs/000-foundation/spec.md) (Status: `approved`)
- **Plan Status:** Draft

---

## 1. Architecture & Folder Structure Overview

This plan defines the foundational layer for Task by Task. No functional UI components are implemented in this phase; instead, it establishes the architectural contracts, runtime dependencies, testing infrastructure, canonical validation schemas, domain error hierarchy, storage adapters, pure date/time utilities, and the Spanish localization dictionary.

### 1.1 Target File Layout

```
react-frontend-taskByTask/
├── .gitignore
├── eslint.config.js                               # [Ask First: config edit] Linting rules
├── package.json                                   # [Ask First: config edit + package install]
├── playwright.config.ts                           # Playwright E2E configuration
├── tsconfig.json                                  # [Ask First: config edit] Solution tsconfig referencing app, node, test
├── tsconfig.app.json                              # App TypeScript config (src only)
├── tsconfig.node.json                             # Tooling TypeScript config (vite.config.ts)
├── tsconfig.test.json                             # [Ask First: new config] Test TypeScript config (tests + vitest/jest-dom types)
├── vite.config.ts                                 # [Ask First: config edit] Vite bundler config
├── vitest.config.ts                               # Vitest unit/integration test runner config
├── src/
│   ├── app/                                       # Application root, providers, routing placeholders
│   │   └── index.ts
│   ├── features/                                  # Domain feature modules (scaffolding)
│   │   ├── auth/
│   │   ├── groups/
│   │   ├── notifications/
│   │   ├── tags/
│   │   └── tasks/
│   ├── shared/
│   │   ├── errors/                                # Domain error classes & taxonomy
│   │   │   ├── domain-errors.ts
│   │   │   └── index.ts
│   │   ├── hooks/                                 # Reusable custom hooks (placeholder)
│   │   │   └── index.ts
│   │   ├── i18n/                                  # Centralized Spanish dictionary
│   │   │   ├── es.ts
│   │   │   └── index.ts
│   │   ├── schemas/                               # Canonical Zod schemas & types (Appendix B)
│   │   │   ├── common.ts
│   │   │   ├── user.ts
│   │   │   ├── group.ts
│   │   │   ├── task.ts
│   │   │   ├── tag.ts
│   │   │   ├── notification.ts
│   │   │   ├── session.ts
│   │   │   └── index.ts
│   │   ├── ui/                                    # Reusable UI primitives (placeholder)
│   │   │   └── index.ts
│   │   └── utils/                                 # Pure helper utilities
│   │       ├── date-time.ts
│   │       └── index.ts
│   └── data/                                      # Data access layer
│       ├── contracts/                             # Repository interfaces & storage contracts
│       │   ├── repository.ts
│       │   ├── storage-adapter.ts
│       │   └── index.ts
│       └── storage/                               # localStorage adapter implementation
│           ├── keys.ts
│           ├── local-storage-adapter.ts
│           └── index.ts
└── tests/                                         # Test suites isolated from src/
    ├── setup.ts                                   # RTL & jest-dom setup
    ├── mocks/                                     # Mock storage & fixtures
    │   └── mock-storage.ts
    ├── unit/                                      # Unit tests mirroring src/
    │   ├── shared/
    │   │   ├── errors/
    │   │   │   └── domain-errors.test.ts
    │   │   ├── i18n/
    │   │   │   └── es.test.ts
    │   │   ├── schemas/
    │   │   │   └── limits.test.ts
    │   │   └── utils/
    │   │       └── date-time.test.ts
    │   └── data/
    │       └── local-storage-adapter.test.ts
    ├── integration/                               # Integration tests
    │   └── storage-validation.test.ts
    └── e2e/                                       # Playwright E2E tests
        └── smoke.spec.ts
```

---

## 2. Design Decisions & Discarded Alternatives

### 2.1 Decision 1: Explicit "Ask First" Gate for Dependencies and Root Configs
- **Decision:** All modifications to `package.json`, installation of npm dependencies, creation/modification of `tsconfig*.json`, `vite.config.ts`, `eslint.config.js`, and `playwright.config.ts` are grouped into explicit tasks marked with `⚠️ Requires User Confirmation`. The coordinator agent will prompt the user before applying these tasks.
- **Why:** Complies strictly with `AGENTS.md` boundaries ("⚠️ Ask First: Installing/updating/removing packages; editing vite.config.ts, tsconfig*.json, eslint.config.js").
- **Discarded Alternative:** Automatically executing `npm install` without prior confirmation. Rejected as it breaches core agent rules.

### 2.2 Decision 2: Zod Schemas as Single Source of Truth for Appendix B
- **Decision:** Define all domain constraints (length limits, character restrictions, structure) using Zod schemas (`src/shared/schemas/`). TypeScript domain types are exported as inferred types (`z.infer<typeof ...>`) or explicit interfaces validated against them.
- **Why:** Guarantees zero divergence between compile-time TypeScript types and runtime validation rules. Appendix B limits live in one canonical location.
- **Discarded Alternative:** Writing separate TypeScript interfaces and manually written validator functions. Rejected due to code duplication and risk of subtle discrepancies.

### 2.3 Decision 3: Pure Functions for Date, Time, and Overdue Evaluation
- **Decision:** Build deterministic date/time utilities (`src/shared/utils/date-time.ts`) as pure functions accepting an optional `now: Date` (defaulting to system date when omitted in production) and the target IANA timezone string (`timeZone`). Calendar dates are strictly formatted as `YYYY-MM-DD` and due times as `HH:mm`.
- **Why:** Pure functions allow 100% deterministic unit testing across timezones, edge-of-day boundary cases (23:59:59.999), and scheduled 09:00 reminder checks (RF-28) without monkey-patching `Date`.
- **Discarded Alternative:** Using native `new Date()` directly inside helper functions or storing calendar dates as UTC ISO strings. Rejected because UTC timestamps shift calendar dates across negative timezone offsets (e.g., UTC-5: Colombia/Peru/Ecuador).

### 2.4 Decision 4: Safe-Parsing Storage Adapter with Controlled Error Taxonomy
- **Decision:** Implement a generic `LocalStorageAdapter` in `src/data/storage/local-storage-adapter.ts` that encapsulates `localStorage` access. Reading data uses a two-phase check: (1) `JSON.parse` inside a try/catch, (2) Zod schema `.safeParse()`. If either fails, it raises `CorruptedDataError` (RNF-07, RNF-18) and returns a safe fallback (e.g., empty array or null) while recording diagnostics.
- **Why:** Prevents runtime application crashes when stored data is malformed or tampered with. Ensures the UI layer remains cleanly separated from persistence.
- **Discarded Alternative:** Directly calling `localStorage.getItem()` and `localStorage.setItem()` inside features or UI components. Rejected by Constitution Principle 3.

### 2.5 Decision 5: Dedicated `tsconfig.test.json` with Solution Project References
- **Decision:** Maintain `tsconfig.app.json` for `src/` (production bundle), `tsconfig.node.json` for config files, and create `tsconfig.test.json` for `tests/` and setup scripts. `tsconfig.json` references all three. `package.json` script `typecheck` executes `tsc -b --noEmit`.
- **Why:** `tests/` requires test environment types (`vitest/globals`, `@testing-library/jest-dom`), while production code in `src/` must not leak test types. This satisfies `MEMORY.md`: "`tests/` at repo root, outside `src/`: keeps tests out of the production `tsc -b` build."
- **Discarded Alternative:** Adding `tests/` into `tsconfig.app.json`'s `include` array. Rejected because test types and mock imports would leak into the production application build.

### 2.6 Decision 6: Dedicated `vitest.config.ts`
- **Decision:** Place test configuration in a separate `vitest.config.ts` file rather than embedding test configuration into `vite.config.ts`.
- **Why:** Vite 8 and Rolldown plugins in `vite.config.ts` remain lean and focused solely on app building, while Vitest uses `vitest.config.ts` with `jsdom`, test setup references, and alias path resolutions.
- **Discarded Alternative:** Merging Vitest into `vite.config.ts` using `defineConfig` from `vitest/config`. While common, keeping it separated avoids type conflicts between Vite 8 and Vitest plugins.

---

## 3. Technical Implementation Details

### 3.1 Dependencies Specification (REQ-FD-20)

#### Production Dependencies (`dependencies`):
- `@tanstack/react-router` (^1.x): Type-safe client routing and search params.
- `zustand` (^5.x): Lightweight state management.
- `react-hook-form` (^7.x): Form state and validation controller.
- `@hookform/resolvers` (^3.x): Bridges React Hook Form with Zod schemas.
- `zod` (^3.x): Runtime schema validation and single source of truth for limits.
- `bootstrap` (^5.3.x): Core responsive CSS framework.
- `react-bootstrap` (^2.x): Bootstrap components for React.

#### Development Dependencies (`devDependencies`):
- `vitest` (^3.x): Fast Vite-native unit/integration test runner.
- `@testing-library/react` (^16.x): React component testing utilities.
- `@testing-library/jest-dom` (^6.x): Custom DOM element matchers (`toBeInTheDocument`, etc.).
- `@testing-library/user-event` (^14.x): Realistic browser event simulation.
- `jsdom` (^26.x): Headless DOM environment for Vitest.
- `@playwright/test` (^1.x): Cross-browser E2E testing framework.

### 3.2 Canonical Domain Schemas & Appendix B Constants (`src/shared/schemas/`)

#### 3.2.1 Appendix B Constants (`src/shared/schemas/limits.ts`)
```typescript
export const LIMITS = {
  USER_EMAIL_MAX: 254,
  USERNAME_MIN: 3,
  USERNAME_MAX: 30,
  DISPLAY_NAME_MIN: 2,
  DISPLAY_NAME_MAX: 50,
  PASSWORD_RAW_MIN: 6,
  PASSWORD_RAW_MAX: 30,
  RECOVERY_CODES_COUNT: 8,
  RECOVERY_CODE_LENGTH: 8,
  TASK_TITLE_MIN: 2,
  TASK_TITLE_MAX: 100,
  TASK_DESC_MAX: 750,
  SUBTASK_TITLE_MIN: 1,
  SUBTASK_TITLE_MAX: 50,
  SUBTASKS_MAX_PER_TASK: 25,
  TAG_NAME_MIN: 1,
  TAG_NAME_MAX: 30,
  GROUP_NAME_MIN: 3,
  GROUP_NAME_MAX: 30,
  GROUP_MEMBERS_MAX: 5,
  REMINDERS_MAX_PER_TASK: 5,
  INVITATION_EXPIRATION_HOURS: 24,
  NOTIFICATION_RETENTION_DAYS: 30,
  SESSION_DURATION_DAYS: 7,
} as const;

export const FORBIDDEN_TAG_CHARACTERS = [';', ','] as const;
export const REMINDER_OFFSETS = ['15m', '30m', '1h', '6h', '1d'] as const;
export const GROUP_ROLES = ['creator', 'gestor', 'visitante'] as const;
```

#### 3.2.2 Schema Definitions
- `src/shared/schemas/user.ts`:
  - `rawPasswordSchema`: `z.string().min(6).max(30)`
  - `userSchema`: Validates `id`, `email` (RFC format, lowercase), `username` (`^[A-Za-z0-9]+$`), `displayName`, `passwordHash` (string, min 1), `timeZone` (IANA string), `timeFormat` (`'24h' | '12h'`), `createdAt` (ISO-8601).
  - `recoveryCodeSchema`: Validates `id`, `userId`, `code` (8 chars), `used` (boolean), `usedAt` (optional ISO string).
- `src/shared/schemas/group.ts`:
  - `groupMemberSchema`: Validates `userId`, `role` (`'creator' | 'gestor' | 'visitante'`), `joinedAt` (ISO string).
  - `groupSchema`: Validates `id`, `name` (3..30 chars, trimmed), `creatorId`, `isPersonal` (boolean), `type` (`'individual' | 'compartido'`), `members` (1..5 array of `groupMemberSchema`), `createdAt` (ISO string).
- `src/shared/schemas/task.ts`:
  - `subtaskSchema`: Validates `id`, `taskId`, `title` (1..50 chars, trimmed), `completed` (boolean), `order` (optional number).
  - `reminderSchema`: Validates `id`, `taskId`, `offset` (`enum(['15m', '30m', '1h', '6h', '1d'])`).
  - `taskSchema`: Validates `id`, `title` (2..100 chars, trimmed), `description` (optional, max 750 chars), `groupId`, `completed`, `createdAt` (ISO string), `completedAt` (optional ISO string), `dueDate` (regex `/^\d{4}-\d{2}-\d{2}$/`), `dueTime` (regex `/^([01]\d|2[0-3]):[0-5]\d$/`), `assigneeId` (optional nullable string), `subtasks` (max 25 items), `reminders` (max 5 items).
- `src/shared/schemas/tag.ts`:
  - `tagNameSchema`: `z.string().trim().min(1).max(30).refine(val => !val.includes(';') && !val.includes(','))`
  - `tagSchema`: Validates `id`, `name` (`tagNameSchema`), `groupId`.
- `src/shared/schemas/notification.ts`:
  - `notificationSchema`: Validates `id`, `userId`, `eventType`, `content`, `read` (boolean), `createdAt` (ISO string).
- `src/shared/schemas/session.ts`:
  - `sessionSchema`: Validates `userId`, `token`, `expiresAt` (ISO string), `createdAt` (ISO string).

### 3.3 Controlled Domain Errors (`src/shared/errors/domain-errors.ts`)

```typescript
export abstract class AppError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, public readonly fieldPath?: string) {
    super(message, 'VALIDATION_ERROR');
  }
}

export class NotFoundError extends AppError {
  constructor(entityName: string, id?: string) {
    const msg = id ? `${entityName} with id ${id} not found` : `${entityName} not found`;
    super(msg, 'NOT_FOUND');
  }
}

export class BusinessRuleViolationError extends AppError {
  constructor(message: string, public readonly ruleCode?: string) {
    super(message, 'BUSINESS_RULE_VIOLATION');
  }
}

export class CorruptedDataError extends AppError {
  constructor(key: string, public readonly diagnostic: string) {
    super(`Stored data under key "${key}" is corrupted`, 'CORRUPTED_DATA');
  }
}

export class StorageQuotaError extends AppError {
  constructor(message: string = 'Browser storage quota exceeded') {
    super(message, 'STORAGE_QUOTA_EXCEEDED');
  }
}
```

### 3.4 Pure Date & Time Utilities (`src/shared/utils/date-time.ts`)

Pure functions accepting date/time parameters:

1. `isTaskOverdue(params: { dueDate?: string | null; dueTime?: string | null; timeZone: string; now?: Date }): boolean`
   - If `dueDate` is missing, returns `false`.
   - If `dueTime` is present (`HH:mm`), constructs the cutoff instant for that date + time in `timeZone`. Returns `now > cutoff`.
   - If `dueTime` is omitted, constructs cutoff at `23:59:59.999` on `dueDate` in `timeZone`. Returns `now > cutoff`.
2. `getReminderTriggerDate(params: { dueDate: string; dueTime?: string | null; offset?: ReminderOffset; timeZone: string }): Date`
   - If `dueTime` is omitted, due time defaults to `09:00:00` in `timeZone` (RF-28).
   - Subtracts `offset` duration if provided (`15m`, `30m`, `1h`, `6h`, `1d`). Returns the resulting trigger `Date`.
3. `formatDisplayDate(dateStr: string): string`
   - Parses `YYYY-MM-DD` and formats strictly as `dd/mm/aaaa` without timezone shifting.
4. `formatDisplayTime(timeStr: string, format: '24h' | '12h' = '24h'): string`
   - Converts `HH:mm` to `HH:mm` (24h) or `hh:mm a` (12h, e.g., "02:30 p. m.").
5. `formatIsoTimestamp(date: Date = new Date()): string`
   - Returns standard ISO-8601 UTC string (`YYYY-MM-DDTHH:mm:ss.sssZ`).

### 3.5 Storage Adapter & Repository Contracts (`src/data/`)

#### 3.5.1 Storage Keys (`src/data/storage/keys.ts`)
```typescript
export const STORAGE_PREFIX = 'tbt:v1:';

export const STORAGE_KEYS = {
  USERS: `${STORAGE_PREFIX}users`,
  GROUPS: `${STORAGE_PREFIX}groups`,
  TASKS: `${STORAGE_PREFIX}tasks`,
  TAGS: `${STORAGE_PREFIX}tags`,
  NOTIFICATIONS: `${STORAGE_PREFIX}notifications`,
  SESSION: `${STORAGE_PREFIX}session`,
  RECOVERY_CODES: `${STORAGE_PREFIX}recovery_codes`,
} as const;
```

#### 3.5.2 LocalStorage Adapter (`src/data/storage/local-storage-adapter.ts`)
```typescript
export interface StorageAdapter {
  getItem<T>(key: string, schema: z.ZodType<T>, fallback: T): T;
  setItem<T>(key: string, schema: z.ZodType<T>, value: T): void;
  removeItem(key: string): void;
  clear(): void;
}
```
Implementation specifics:
- `getItem`:
  1. Calls `window.localStorage.getItem(key)`. If `null`, returns `fallback`.
  2. Parses JSON string. If syntax error throws, catches it, raises/logs `CorruptedDataError`, and safely returns `fallback`.
  3. Executes `schema.safeParse(parsedJson)`. If invalid, raises/logs `CorruptedDataError` with diagnostic issue details, and safely returns `fallback`.
  4. Returns validated data `data as T`.
- `setItem`:
  1. Validates `value` with `schema.parse(value)`.
  2. Calls `window.localStorage.setItem(key, JSON.stringify(value))`.
  3. Catches DOMException `QuotaExceededError` and throws `StorageQuotaError`.

### 3.6 Spanish Localization Dictionary (`src/shared/i18n/es.ts`)

Organized into canonical namespaces (`app`, `common`, `validation`, `errors`, `dateTime`) as required by REQ-FD-17 and spec section 4.5.

```typescript
export const es = {
  app: {
    title: 'Task by Task',
    tagline: 'Gestiona tus tareas por grupos y etiquetas',
  },
  common: {
    save: 'Guardar',
    cancel: 'Cancelar',
    delete: 'Eliminar',
    confirm: 'Confirmar',
    back: 'Volver',
    close: 'Cerrar',
    loading: 'Cargando...',
  },
  validation: {
    required: (field: string) => `El campo ${field} es obligatorio`,
    minLength: (field: string, min: number) => `${field} debe tener al menos ${min} caracteres`,
    maxLength: (field: string, max: number) => `${field} no puede exceder ${max} caracteres`,
    invalidEmail: 'El correo electrónico no tiene un formato válido',
    invalidUsername: 'El nombre de usuario solo puede contener letras y números',
    invalidCharacters: (forbidden: string) => `No se permiten los siguientes caracteres: ${forbidden}`,
    uniqueConstraint: (entity: string) => `Ya existe un registro con este ${entity}`,
  },
  errors: {
    notFound: (entity: string) => `${entity} no encontrado/a`,
    businessRule: (rule: string) => `Acción no permitida: ${rule}`,
    corruptedData: 'Los datos almacenados están dañados o tienen un formato no válido',
    storageQuota: 'El almacenamiento del navegador está lleno',
    unexpected: 'Ocurrió un error inesperado. Por favor, intenta de nuevo.',
  },
  dateTime: {
    overdue: 'Vencida',
    today: 'Hoy',
    tomorrow: 'Mañana',
    dateFormat: 'dd/mm/aaaa',
  },
} as const;

export type LocalizationDictionary = typeof es;
```

---

## 4. Verification & Testing Strategy

### 4.1 Unit Tests (`tests/unit/`)
1. **`limits.test.ts`:**
   - Validates boundary values for every limit defined in Appendix B (boundary - 1, valid boundary, boundary + 1).
   - Validates tag rejection on `;` and `,`.
   - Validates username alphanumeric rejection on spaces or special symbols.
   - Validates User entity schema enforces `passwordHash: string` and rejects plaintext password structures.
   - Validates Group and Task future-proof structures (`creatorId`, `members`, `assigneeId`, `subtasks`, `reminders`).
2. **`domain-errors.test.ts`:**
   - Tests error instantiation, inheritance from `AppError`, codes, and message formatting.
3. **`date-time.test.ts`:**
   - Overdue calculation: task with date and time (past vs future), task with date only (23:59:59 cutoff), task without date (never overdue).
   - Timezone evaluations: evaluates timezone-aware boundaries with injected `now`.
   - Date-only reminder trigger calculation: verifies 09:00:00 local time trigger (RF-28).
   - Formatting: tests `YYYY-MM-DD` -> `dd/mm/aaaa` and `HH:mm` -> 24h/12h formatting.
4. **`local-storage-adapter.test.ts`:**
   - Normal get/set flow with mock `localStorage`.
   - JSON parse syntax failure raises `CorruptedDataError` and returns fallback.
   - Zod schema validation failure raises `CorruptedDataError` and returns fallback.
   - Quota exceeded exception throws `StorageQuotaError`.

### 4.2 Integration Tests (`tests/integration/`)
1. **`storage-validation.test.ts`:**
   - Verifies end-to-end read and write cycle through `LocalStorageAdapter` using real domain schemas (`taskSchema`, `groupSchema`, `tagSchema`) and prefixed keys (`tbt:v1:*`).

### 4.3 E2E Tests (`tests/e2e/`)
1. **`smoke.spec.ts`:**
   - Baseline smoke test launching Playwright, navigating to local dev server root, verifying initial page loads without unhandled runtime or console errors.

### 4.4 Verification Pipeline
Every task must pass:
1. `npm run typecheck` (`tsc -b --noEmit`)
2. `npm run lint` (`eslint .`)
3. `npm test` (`vitest run`)
Large / milestone tasks also run:
4. `npm run build`
5. `npm run e2e` (`playwright test`)

---

## 5. Requirement Traceability Matrix

| Requirement | Plan Section | Target Components |
| :--- | :--- | :--- |
| **REQ-FD-01, REQ-FD-02, REQ-FD-03** | 3.2 | `src/shared/schemas/limits.ts`, `src/shared/schemas/*.ts` |
| **REQ-FD-04, REQ-FD-05, REQ-FD-06** | 3.3 | `src/shared/errors/domain-errors.ts` |
| **REQ-FD-07, REQ-FD-08, REQ-FD-09** | 3.5 | `src/data/contracts/`, `src/data/storage/` |
| **REQ-FD-10, REQ-FD-10b** | 3.5, 3.2 | `src/data/storage/local-storage-adapter.ts`, `src/shared/schemas/user.ts` |
| **REQ-FD-11, REQ-FD-12, REQ-FD-13** | 3.2 | `src/shared/schemas/group.ts`, `src/shared/schemas/task.ts` |
| **REQ-FD-14, REQ-FD-15, REQ-FD-16** | 3.4 | `src/shared/utils/date-time.ts` |
| **REQ-FD-17, REQ-FD-18** | 3.6, 3.4 | `src/shared/i18n/es.ts`, `src/shared/utils/date-time.ts` |
| **REQ-FD-19** | 1.1 | Project directory layout (`src/app`, `features`, `shared`, `data`, `tests`) |
| **REQ-FD-20** | 3.1 | `package.json` dependencies & devDependencies |
| **REQ-FD-21** | 4.4 | Verification scripts (`typecheck`, `lint`, `test`, `e2e`) |
| **RNF-05** | 3.2 | User schema enforces `passwordHash`, forbids plaintext passwords |
| **RNF-07** | 3.3, 3.5 | Controlled errors, validation on repository access |
| **RNF-12, UI-01** | 3.6 | Centralized Spanish dictionary, Mobile-First structure |
| **RNF-14, UI-07** | 3.4 | `dd/mm/aaaa`, 24h default / 12h option, user timezone |
| **RNF-18** | 3.3 | `NotFoundError` and graceful fallback on missing entities |
| **RNF-19** | 3.2 | Strict Appendix B Zod limits |
| **RNF-20** | 3.2 | Group `creatorId` + `members[]`, Task `assigneeId`, Subtasks, Reminders |
| **RF-22** | 3.2 | Tag name validation: prohibition of `;` and `,` |
| **RF-28** | 3.4 | 09:00:00 local time reminder trigger for date-only tasks |
| **AC-FD-01 .. AC-FD-08** | 4.1 - 4.4 | Unit, integration, and E2E smoke tests |

---

## 6. "Ask First" Governance & Confirmation Checklist

Per `AGENTS.md`, the following actions require explicit user confirmation prior to execution in `tasks.md`:
- [ ] **Package Installation:** Installing runtime and dev packages via npm.
- [ ] **Config Modification (`package.json`):** Adding scripts (`typecheck`, `test`, `test:watch`, `e2e`).
- [ ] **Config Modification (`tsconfig*.json`):** Creating `tsconfig.test.json` and adding project reference to `tsconfig.json`.
- [ ] **Config Creation (`vitest.config.ts`, `playwright.config.ts`):** Adding test runner configurations.
- [ ] **Config Modification (`eslint.config.js`):** Adding test files and ignore rules.

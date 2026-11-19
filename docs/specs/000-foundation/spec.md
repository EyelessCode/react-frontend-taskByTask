# Spec 000: Foundation and Core Domain Contracts

- **Feature Name:** `000-foundation`
- **Status:** implemented
- **Created Date:** 2026-10-29
- **Authors:** SDD Planner Agent
- **SRS / SVD References:** `RNF-05`, `RNF-07`, `RNF-12`, `RNF-14`, `RNF-15`, `RNF-18`, `RNF-19`, `RNF-20`, `UI-01`, `UI-07`, `RF-22`, `RF-28`, `Appendix B`, `Constitution Principles 1–6`

---

## 1. Purpose & Background

### 1.1 Purpose
Establish the foundational infrastructure, shared domain contracts, validation limits, error classification, date/time handling rules, localization baseline, and quality verification gates required before implementing functional features (`001-tasks`, `002-auth`, etc.).

### 1.2 Background
Task by Task is a Mobile-First, Spanish-only web application for managing tasks organized in groups and tags with due-date browser notifications. The initial MVP operates entirely on the client using browser storage (`localStorage`), while future versions will introduce a dedicated backend, shared groups (up to 5 users), task assignment, subtasks, and reminders.

Per the project Constitution:
- UI and features must never access storage directly (isolated repository boundary).
- Domain rules and Appendix B limits must be defined once as canonical schemas (Zod).
- Data models must be future-proof from inception (`creatorId` + `members[]` on groups; optional `assigneeId` on tasks) to prevent breaking changes when collaborative features are introduced (RNF-20).
- All UI strings must be centralized in Spanish (`src/shared/i18n/es.ts`).
- Verification gates (`typecheck`, `lint`, `test`, `e2e`) must be strictly enforced before any task is considered complete.
- Plaintext passwords must never be stored anywhere in persistent storage (RNF-05).

---

## 2. Scope

### 2.1 In Scope
1. **Core Domain Limits & Validation Contracts:** Single-source Zod schemas enforcing exact length, format, character restrictions, and boundary rules defined in SRS Appendix B.
2. **Canonical Entity Type Contracts:** Formal TypeScript interfaces and schemas for all domain entities: `User`, `RecoveryCode`, `Group`, `GroupMember`, `Task`, `Tag`, `Subtask`, `Reminder`, `Notification`, `Session`, and `Invitation` (future-proof reference).
3. **Controlled Domain Error Taxonomy:** Standardized error classes and localized messages for validation failures, not-found entities, business rule violations, corrupted/unparseable data, and storage quota exceptions (RNF-07, RNF-18, RNF-19).
4. **Repository Contract & Storage Key Convention:** Interface definitions decoupling domain features from persistence, specifying the versioned key prefix `tbt:v1:*`, resilient parsing with safe fallback, and schema-validated reads/writes.
5. **Date & Time Storage and Evaluation Contract:** Explicit serialization representations (`YYYY-MM-DD` for calendar dates, `HH:mm` for times, ISO-8601 for system timestamps) and timezone-aware overdue/reminder evaluation rules.
6. **Centralized Spanish Localization Baseline:** Type-safe dictionary structure organized into canonical namespaces (`app`, `common`, `validation`, `errors`, `dateTime`) in `src/shared/i18n/es.ts`.
7. **Project Folder Layout Contracts:** Architectural folder structure enforcing boundaries across `app/`, `features/`, `shared/`, `data/`, and root `tests/`.
8. **Approved Dependencies Scope:** Explicit specification of required runtime and development packages in compliance with `AGENTS.md` (installation deferred to user-approved tasks).
9. **Verification & Testing Infrastructure:** Execution scripts and testing harness setup for TypeScript strict checking (`tsc -b --noEmit`), linting (`eslint`), unit/integration testing (`vitest`), and end-to-end smoke testing (`playwright`).

### 2.2 Out of Scope
- Implementation of functional UI screens, navigation routers, or components (deferred to feature specs).
- Task management workflows (creation, completion, editing, deletion, moving, copying) (handled in `001-tasks`).
- Authentication flows, hashing logic execution, session management UI, or recovery codes UI (handled in `002-auth`).
- Scheduling and emitting browser notifications (handled in `notifications` feature spec).
- Backend network communication or remote sync (future phase).

---

## 3. Requirements (EARS Format)

### 3.1 Domain Validation & Appendix B Constraints

- **REQ-FD-01 (Ubiquitous - Appendix B Limit Enforcement):**  
  The system shall enforce the canonical SRS Appendix B validation rules across all input processing and persistence layers:
  - `User.email`: Valid RFC 5322 email address format, maximum 254 characters, unique case-insensitively.
  - `User.username`: 3 to 30 characters, alphanumeric only (`[A-Za-z0-9]`), unique case-insensitively.
  - `User.displayName`: 2 to 50 characters, non-empty, trimmed.
  - `User.password` (raw input): 6 to 30 characters.
  - `User.recoveryCodes`: Exactly 8 single-use codes per user account.
  - `Task.title`: 2 to 100 characters, non-empty, trimmed.
  - `Task.description`: Optional, up to 750 characters.
  - `Subtask.title`: 1 to 50 characters, minimum 1 character (RNF-20 future-proof).
  - `Task.subtasks`: Maximum 25 subtasks per task, single-level (RNF-20 future-proof).
  - `Tag.name`: 1 to 30 characters, non-empty, trimmed; semicolon (`;`) and comma (`,`) characters are strictly prohibited; unique case-insensitively within the owning group (RF-22).
  - `Group.name`: 3 to 30 characters, non-empty, trimmed.
  - `Group.members`: Maximum 5 members per shared group (including creator) (RNF-20).
  - `Invitation.expiration`: Exactly 24 hours from creation.
  - `Task.reminders`: Maximum 5 fixed intervals per task (`15m`, `30m`, `1h`, `6h`, `1d`) (RNF-20).
  - `Notification.retention`: Maximum 1 month; records older than 30 days are eligible for auto-eviction.
  - `Session.duration`: Maximum 7 days before required re-authentication.
  - Unbounded collections: Tasks, groups, and tags shall have no arbitrary numerical limit.

- **REQ-FD-02 (Event-Driven - Input Validation):**  
  When an entity or attribute is submitted for creation or modification, the system shall validate the payload against the corresponding domain schema before executing any state changes.

- **REQ-FD-03 (Unwanted Behavior - Validation Failure):**  
  If any input violates an Appendix B limit, forbidden character rule, or format constraint, then the system shall reject the operation and return a structured validation error containing the affected field path, the constraint violated, and a localized Spanish message from `src/shared/i18n/es.ts`.

### 3.2 Controlled Error Handling

- **REQ-FD-04 (Ubiquitous - Standardized Error Taxonomy):**  
  The system shall categorize all domain, data, and storage failures into explicit, controlled error types:
  - `ValidationError`: Input violates boundary rules, required formats, or forbidden characters.
  - `NotFoundError`: Requested entity (`Task`, `Group`, `Tag`, `User`) does not exist or has been deleted (RNF-18).
  - `BusinessRuleViolationError`: Operation contradicts business invariants (e.g., attempting to delete or share the "Personal" group, exceeding group capacity, creating duplicate tags in a group).
  - `CorruptedDataError`: Stored payload fails either syntactic JSON parsing or Zod schema validation upon retrieval.
  - `StorageQuotaError`: Browser `localStorage` quota exceeded.

- **REQ-FD-05 (Unwanted Behavior - Missing Resource):**  
  If an operation targets a resource that does not exist or was deleted, then the system shall return a controlled `NotFoundError` and prevent cascading application crashes (RNF-18).

- **REQ-FD-06 (Unwanted Behavior - Invariant Violation):**  
  If an operation attempts to violate a domain invariant (such as deleting or sharing the default "Personal" group), then the system shall reject the action with a `BusinessRuleViolationError` and retain the existing state.

### 3.3 Storage Isolation & Versioning

- **REQ-FD-07 (Ubiquitous - Repository Boundary):**  
  The system shall access persistent storage solely through abstract repository interfaces, ensuring UI components and domain features remain completely decoupled from browser storage APIs.

- **REQ-FD-08 (Ubiquitous - Key Namespace Versioning):**  
  The system shall namespace all browser storage keys under the versioned prefix `tbt:v1:*` (`tbt:v1:users`, `tbt:v1:groups`, `tbt:v1:tasks`, `tbt:v1:tags`, `tbt:v1:notifications`, `tbt:v1:session`).

- **REQ-FD-09 (Event-Driven - Validated Storage Reads):**  
  When reading data from browser storage, the system shall parse the stored JSON string and validate the resulting structure against the corresponding domain entity schema before returning the data to the caller.

- **REQ-FD-10 (Unwanted Behavior - Corrupted Storage Payload):**  
  If data read from browser storage encounters a syntactic JSON parse error or fails Zod schema validation, then the system shall raise a `CorruptedDataError`, log a sanitized diagnostic failure without leaking user data, and return a safe fallback state (e.g., empty collection) to prevent system freeze.

- **REQ-FD-10b (Ubiquitous - Non-Reversible Password Storage):**  
  The system shall persist only non-reversible password hashes (`passwordHash: string`) on the User entity record; plaintext passwords shall never be persisted in browser storage under any circumstances (RNF-05).

### 3.4 Extensibility & Canonical Entity Contracts (RNF-20)

- **REQ-FD-11 (Ubiquitous - Group Extensibility Structure):**  
  The Group entity shall define a `creatorId` (`string`), `type` (`'individual' | 'compartido'`), and a `members` collection (`GroupMember[]`). MVP groups shall initialize with type `'individual'` containing solely the creator membership (`role: 'creator'`).

- **REQ-FD-12 (Ubiquitous - Task Extensibility Structure):**  
  The Task entity shall define a mandatory `groupId` (`string`), an optional `assigneeId` (`string | null`), an optional `subtasks` collection (`Subtask[]`), and an optional `reminders` collection (`Reminder[]`), preserving future compatibility with shared groups, task assignment, subtasks, and reminders.

- **REQ-FD-13 (Ubiquitous - Immutable Personal Group Identity):**  
  The system shall designate the default individual group generated at user registration with `isPersonal: true`. The Personal group may be renamed, but it shall never be deleted and shall never be converted to a shared group.

### 3.5 Date & Time Storage, Evaluation, and Localization (UI-01, UI-07, RNF-14)

- **REQ-FD-14 (Ubiquitous - Date and Time Storage Representation):**  
  The system shall enforce distinct storage representations for dates and times to prevent unintended timezone shifting:
  - Discrete calendar due dates (`Task.dueDate`): Stored as calendar date strings formatted strictly as `YYYY-MM-DD` (never as UTC millisecond timestamps or ISO datetimes).
  - Optional due times (`Task.dueTime`): Stored as 24-hour time strings formatted strictly as `HH:mm` (`00:00` to `23:59`).
  - System timestamps (`createdAt`, `completedAt`, `expiresAt`, `usedAt`, `joinedAt`): Stored as standard ISO-8601 strings with explicit UTC indicator (`YYYY-MM-DDTHH:mm:ss.sssZ`).

- **REQ-FD-15 (State-Driven - Due Date and Overdue Calculation):**  
  While evaluating overdue status for a task:
  - If the task has both `dueDate` (`YYYY-MM-DD`) and `dueTime` (`HH:mm`), the task is overdue when the current timestamp exceeds that calendar date and time in the user's configured IANA timezone (`User.timeZone`).
  - If the task has `dueDate` but no `dueTime`, the task is overdue only after `23:59:59.999` of that calendar date in the user's configured IANA timezone (`User.timeZone`).
  - If the task has no `dueDate`, it shall never be considered overdue and shall never generate reminders.

- **REQ-FD-16 (Ubiquitous - Default Reminder Trigger for Date-Only Tasks):**  
  When a task specifies a `dueDate` without a `dueTime`, the due-date notification shall be scheduled for `09:00:00` local time of that date in the user's configured IANA timezone (`User.timeZone`) (RF-28).

- **REQ-FD-17 (Ubiquitous - Centralized Spanish Localization Dictionary):**  
  The system shall maintain all user-facing strings, labels, placeholders, validation messages, and errors in `src/shared/i18n/es.ts`, structured into canonical top-level namespaces: `app`, `common`, `validation`, `errors`, and `dateTime`.

- **REQ-FD-18 (Ubiquitous - Localized Date and Time Formatting):**  
  The system shall provide pure formatting utilities that display dates as `dd/mm/aaaa` and times in 24-hour format (`HH:mm`) by default, or 12-hour format (`hh:mm a`) when configured in user preferences (`User.timeFormat`), evaluated in the user's local timezone.

### 3.6 Architecture, Dependencies & Verification Gates

- **REQ-FD-19 (Ubiquitous - Modular Folder Architecture):**  
  The system shall organize source code into designated directories:
  - `src/app/`: Application bootstrap, providers, routing root.
  - `src/features/`: Feature modules (`auth/`, `tasks/`, `groups/`, `tags/`, `notifications/`).
  - `src/shared/`: Shared UI components (`ui/`), hooks (`hooks/`), pure utilities (`utils/`), and Spanish localization (`i18n/`).
  - `src/data/`: Repository contracts and browser storage implementations.
  - `tests/`: Automated test suites separated from `src/` (`unit/`, `integration/`, `e2e/`, `mocks/`).

- **REQ-FD-20 (Ubiquitous - Approved Dependencies Scope):**  
  The system foundation shall incorporate the following libraries per `AGENTS.md` (subject to user confirmation prior to `npm install`):
  - Production: `@tanstack/react-router`, `zustand`, `react-hook-form`, `@hookform/resolvers`, `zod`, `bootstrap`, `react-bootstrap`.
  - Development / Testing: `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`, `jsdom`, `@playwright/test`.

- **REQ-FD-21 (Ubiquitous - Quality Verification Gates):**  
  The system shall provide automated scripts enforcing quality verification:
  - `npm run typecheck`: Strict TypeScript typechecking with no emit (`tsc -b --noEmit`).
  - `npm run lint`: ESLint verification matching project standards with zero errors and zero warnings.
  - `npm test`: Vitest unit and integration test execution.
  - `npm run e2e`: Playwright end-to-end smoke test execution.

---

## 4. Domain Models & Specifications

### 4.1 Canonical Schema Limits (Appendix B Reference)

| Entity / Field | Limit / Format Constraint | Validation / Invariant Rule |
| :--- | :--- | :--- |
| `User.email` | Max 254 chars, RFC 5322 format | Unique case-insensitively across registered users |
| `User.username` | 3 to 30 chars, `^[A-Za-z0-9]+$` | Unique case-insensitively across registered users |
| `User.displayName` | 2 to 50 chars | Non-empty, trimmed |
| `User.password` (raw input) | 6 to 30 chars | Validated prior to hashing; never stored in plaintext |
| `User.recoveryCodes` | Exactly 8 codes | Single-use 8-character tokens, generated at registration |
| `Group.name` | 3 to 30 chars | Non-empty, trimmed |
| `Group.members` | 1 to 5 members | MVP: 1 member (`role: 'creator'`); Shared: max 5 |
| `Task.title` | 2 to 100 chars | Non-empty, trimmed |
| `Task.description` | 0 to 750 chars | Optional string or null |
| `Tag.name` | 1 to 30 chars | Non-empty, trimmed; no `;` or `,`; unique per group |
| `Subtask.title` | 1 to 50 chars | Non-empty, trimmed (RNF-20 future-proof) |
| `Task.subtasks` | Max 25 items | Single-level collection (RNF-20 future-proof) |
| `Task.reminders` | Max 5 items | Fixed offsets: `15m`, `30m`, `1h`, `6h`, `1d` |
| `Invitation.expiration` | 24 hours | Timestamp auto-invalidation threshold (RNF-20) |
| `Notification.retention` | 1 month (30 days) | Auto-eviction threshold for notification center |
| `Session.duration` | Max 7 days | Invalidation window from creation |
| Entities volume | Unbounded | No limit on total tasks, groups, or tags |

### 4.2 Canonical Entity Type Contracts

```typescript
// --- User & Auth Entities ---
export interface User {
  id: string;
  email: string;                  // Max 254 chars, unique case-insensitively
  username: string;               // 3-30 chars, alphanumeric, unique case-insensitively
  displayName: string;            // 2-50 chars
  passwordHash: string;           // Persisted hash (NEVER plaintext password)
  timeZone: string;               // IANA timezone identifier (e.g. 'America/Bogota')
  timeFormat: '24h' | '12h';      // Default: '24h'
  createdAt: string;              // ISO-8601 string
}

export interface RecoveryCode {
  id: string;
  userId: string;
  code: string;                   // 8-character token
  used: boolean;
  usedAt?: string | null;         // ISO-8601 string when consumed
}

export interface Session {
  userId: string;
  token: string;
  expiresAt: string;              // ISO-8601 string (max 7 days from creation)
  createdAt: string;              // ISO-8601 string
}

// --- Group Entities ---
export type GroupRole = 'creator' | 'gestor' | 'visitante';

export interface GroupMember {
  userId: string;
  role: GroupRole;
  joinedAt: string;               // ISO-8601 string
}

export interface Group {
  id: string;
  name: string;                   // 3-30 chars
  creatorId: string;
  isPersonal: boolean;            // true for default "Personal" group (cannot delete/share)
  type: 'individual' | 'compartido'; // MVP: always 'individual'
  members: GroupMember[];         // MVP: [{ userId: creatorId, role: 'creator' }]
  createdAt: string;              // ISO-8601 string
}

// --- Task & Subtask Entities ---
export interface Subtask {
  id: string;
  taskId: string;
  title: string;                  // 1-50 chars
  completed: boolean;
  order?: number;
}

export type ReminderOffset = '15m' | '30m' | '1h' | '6h' | '1d';

export interface Reminder {
  id: string;
  taskId: string;
  offset: ReminderOffset;
}

export interface Task {
  id: string;
  title: string;                  // 2-100 chars
  description?: string | null;    // 0-750 chars
  groupId: string;                // References Group.id
  tagIds?: string[];              // References Tag.id (RF-22)
  completed: boolean;
  createdAt: string;              // ISO-8601 string (read-only, immutable)
  completedAt?: string | null;    // ISO-8601 string when completed
  dueDate?: string | null;        // Format: 'YYYY-MM-DD' (calendar date)
  dueTime?: string | null;        // Format: 'HH:mm' (24-hour time)
  assigneeId?: string | null;     // RNF-20: null in MVP
  subtasks?: Subtask[];           // RNF-20: max 25 single-level items
  reminders?: Reminder[];         // RNF-20: max 5 fixed items
}

// --- Tag Entity ---
export interface Tag {
  id: string;
  name: string;                   // 1-30 chars, no ';' or ',', unique per group
  groupId: string;                // References Group.id (tags belong to group)
}

// --- Notification Entity ---
export interface Notification {
  id: string;
  userId: string;
  eventType: string;              // e.g. 'due_date', 'system'
  content: string;
  read: boolean;
  createdAt: string;              // ISO-8601 string (evicted after 30 days)
}

// --- Future-Proof Invitation Entity (Reference) ---
export interface Invitation {
  id: string;
  groupId: string;
  invitedEmailOrUsername: string;
  role: 'gestor' | 'visitante';
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  createdAt: string;              // ISO-8601 string
  expiresAt: string;              // ISO-8601 string (createdAt + 24 hours)
}
```

### 4.3 Storage Key Specification

- Pattern: `tbt:v1:<domain_key>`
- Key Registry:
  - `tbt:v1:users`: Record of registered users (storing `User` objects with `passwordHash`, never plaintext passwords).
  - `tbt:v1:groups`: Array of `Group` objects.
  - `tbt:v1:tasks`: Array of `Task` objects.
  - `tbt:v1:tags`: Array of `Tag` objects.
  - `tbt:v1:notifications`: Array of `Notification` objects.
  - `tbt:v1:session`: Active `Session` object or null.
  - `tbt:v1:recovery_codes`: Array of `RecoveryCode` objects.

### 4.4 Date and Time Serialization Rules

```
+--------------------+------------------------+---------------------+-------------------------------------------------------+
| Field Type         | Entity Fields          | Storage Format      | Example Value / Evaluation Rule                       |
+--------------------+------------------------+---------------------+-------------------------------------------------------+
| Calendar Due Date  | Task.dueDate           | YYYY-MM-DD          | "2026-11-15" (no timezone conversion on serialize)    |
| Calendar Due Time  | Task.dueTime           | HH:mm (24h)         | "14:30" (evaluated with dueDate in user's timezone)   |
| System Timestamp   | createdAt, completedAt | ISO-8601 UTC string | "2026-10-29T15:00:00.000Z"                            |
| Expiration Marker  | expiresAt, usedAt      | ISO-8601 UTC string | "2026-10-30T15:00:00.000Z"                            |
+--------------------+------------------------+---------------------+-------------------------------------------------------+
```

### 4.5 Spanish Localization Dictionary Structure (`src/shared/i18n/es.ts`)

```typescript
export interface LocalizationDictionary {
  app: {
    title: string;
    tagline: string;
  };
  common: {
    save: string;
    cancel: string;
    delete: string;
    confirm: string;
    back: string;
    close: string;
    loading: string;
  };
  validation: {
    required: (field: string) => string;
    minLength: (field: string, min: number) => string;
    maxLength: (field: string, max: number) => string;
    invalidEmail: string;
    invalidUsername: string;
    invalidCharacters: (forbidden: string) => string;
    uniqueConstraint: (entity: string) => string;
  };
  errors: {
    notFound: (entity: string) => string;
    businessRule: (rule: string) => string;
    corruptedData: string;
    storageQuota: string;
    unexpected: string;
  };
  dateTime: {
    overdue: string;
    today: string;
    tomorrow: string;
    dateFormat: 'dd/mm/aaaa';
  };
}
```

---

## 5. Acceptance Criteria

1. **AC-FD-01:** Schemas reject strings outside minimum/maximum boundaries per Appendix B, reject forbidden characters (`;` and `,` in tag names, non-alphanumeric in usernames), and produce localized Spanish error messages.
2. **AC-FD-02:** Canonical entity interfaces (`User`, `RecoveryCode`, `Group`, `GroupMember`, `Task`, `Tag`, `Subtask`, `Reminder`, `Notification`, `Session`, `Invitation`) are completely typed with zero `any` usage.
3. **AC-FD-03:** `User` schema enforces `passwordHash: string` for persistence and prevents raw plaintext password retention.
4. **AC-FD-04:** Controlled domain error hierarchy distinguishes `ValidationError`, `NotFoundError`, `BusinessRuleViolationError`, `CorruptedDataError`, and `StorageQuotaError`.
5. **AC-FD-05:** Storage adapters namespace all keys under `tbt:v1:*`, intercept both malformed JSON strings and schema validation errors, raise `CorruptedDataError`, and safely return fallback states.
6. **AC-FD-06:** Calendar due dates are stored strictly as `YYYY-MM-DD` and due times as `HH:mm`; due date overdue calculations without time evaluate at `23:59:59.999` local time, and date-only reminders evaluate at `09:00:00` local time.
7. **AC-FD-07:** `src/shared/i18n/es.ts` is structured into canonical namespaces (`app`, `common`, `validation`, `errors`, `dateTime`) with 100% Spanish text.
8. **AC-FD-08:** Verification gates `npm run typecheck`, `npm run lint`, `npm test`, and `npm run e2e` (with a baseline smoke test in `tests/e2e/smoke.spec.ts`) execute cleanly once tooling and dependencies are installed.

---

## 6. Traceability Matrix

| SRS Requirement | Foundation Requirement | Coverage Details |
| :--- | :--- | :--- |
| **RNF-05** | REQ-FD-10b, Section 4.2 | Password hashing requirement; raw passwords never stored in plaintext |
| **RNF-07** | REQ-FD-02, REQ-FD-04, REQ-FD-06 | Controlled errors, invariant enforcement, and validated storage operations |
| **RNF-12** | REQ-FD-17, REQ-FD-19 | Accessible UI foundations and semantic Spanish screen-reader messages |
| **RNF-14** | REQ-FD-14, REQ-FD-15, REQ-FD-18 | Spanish-only dictionary, `dd/mm/aaaa`, 24h default, user IANA timezone |
| **RNF-15** | REQ-FD-19, REQ-FD-21 | Cross-browser compatibility verified via Vitest and Playwright harnesses |
| **RNF-18** | REQ-FD-04, REQ-FD-05 | `NotFoundError` and graceful redirection on missing/deleted elements |
| **RNF-19** | REQ-FD-01, REQ-FD-02, REQ-FD-03 | Appendix B limit validations in canonical Zod schemas |
| **RNF-20** | REQ-FD-11, REQ-FD-12, REQ-FD-13 | Extensible Group (`creatorId` + `members[]`) and Task (`assigneeId`) shapes |
| **UI-01** | REQ-FD-17, REQ-FD-19 | Centralized Spanish dictionary and Mobile-First base architecture |
| **UI-07** | REQ-FD-18 | User time format preference (24-hour default, 12-hour option) |
| **RF-22** | REQ-FD-01, Section 4.1 | Tag naming constraints: prohibition of `;` and `,`, unique per group |
| **RF-28** | REQ-FD-16 | Due-date notification at 09:00 local time for tasks without specific time |
| **Appendix B** | REQ-FD-01, Section 4.1, 4.2 | Complete length limits, capacities, retention, and collection bounds |

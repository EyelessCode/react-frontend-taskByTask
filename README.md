# Task by Task — Frontend (v1.0.0 MVP)

> **Mobile-First, Spanish-only** task management web application organized by **groups** and **tags**, featuring browser & Web Push due-date notifications. Inspired by Google Tasks and built for people juggling study, coding, and personal to-dos.

**Version:** `1.0.0` (MVP Complete) · **UI Language:** Spanish (`es`) · **Technical Docs:** English

---

## Table of Contents

- [Overview & Value Proposition](#overview--value-proposition)
- [Key MVP Features](#key-mvp-features)
- [Tech Stack](#tech-stack)
- [Architecture & Spec-Driven Development (SDD)](#architecture--spec-driven-development-sdd)
- [Getting Started & Dual Persistence Modes](#getting-started--dual-persistence-modes)
- [Available Scripts & Verification Baseline](#available-scripts--verification-baseline)
- [Project Structure](#project-structure)

---

## Overview & Value Proposition

**Task by Task** streamlines daily personal organization without unnecessary bloat:

- **Focused & Distraction-Free:** Organizes work into clean **individual groups** and **group-scoped tags**—no priorities, custom color pickers, or drag-and-drop clutter.
- **Mobile-First & Accessible:** Responsive layout built from `375px` up, adhering to WCAG/accessibility best practices (keyboard navigation, ARIA attributes, and never conveying state by color alone).
- **Zero-Friction Dual Persistence:** Runs out-of-the-box in **Offline / Demo (`localStorage`)** mode with zero backend setup, or connects seamlessly to the **Task by Task REST API (`v1.0.0-mvp`)** via a single environment variable.
- **Spec-Driven & Strictly Typed:** Engineered end-to-end with Spec-Driven Development (SDD), strict TypeScript 6, runtime Zod 4 validation, and React Compiler enabled.

---

## Key MVP Features

- **Authentication & Account Preferences**
  - Registration, login, logout, password change, and account deletion.
  - **8 one-time recovery codes** generated on signup/regeneration (supporting `XXXX-XXXX` and `XXXXXXXX` normalization) for password recovery.
  - Configurable **24h / 12h time format** and automatic browser **timezone** synchronization (dates formatted `dd/mm/aaaa`, never defaulting to UTC).
- **Individual Groups & Immutable `"Personal"` Group**
  - Create, rename, and delete individual groups.
  - Built-in `"Personal"` group (always listed first; can be renamed, never deleted).
  - Future-proof data model carrying `creatorId`, `members[]`, and optional task `assigneeId`.
- **Tasks CRUD, Due-Date Semantics & Workflows**
  - Create, edit, complete/reopen, **Move** (preserves creation date), **Copy** (creates a new task), and delete tasks.
  - **Overdue & Completion Rules:** Tasks with a date but no time become overdue at end-of-day in the user's local timezone (reminders fire at `09:00` local). Pending overdue tasks show red styling + `"Vencida"` text; completed tasks show strikethrough only.
  - **Deterministic Ordering:** Sorted by due date ascending, undated tasks last (by creation), and completed tasks last under `"Todas"`.
- **Group-Scoped Tags**
  - Tags belong to their parent group (not globally to the user).
  - Inline creation on `;` or `,` with automatic duplicate prevention, detach from task, and delete from group.
- **Combined Filters & Progressive Keyset Pagination**
  - Filter across groups by status (`Pendientes`, `Completadas`, `Todas`), title search, and selected groups (`groupIds`).
  - Progressive `"Cargar más"` pagination (`cursor` / `limit` / `hasNext`) across groups, per-group task cards, tags, and notifications.
- **Notification Center & Web Push (VAPID)**
  - In-app Notification Center with unread badge, mark-as-read, mark-all-read, and delete actions.
  - Browser notifications and **W3C Web Push (VAPID)** via Service Worker ([`public/sw.js`](public/sw.js)) for background due-date alerts even when the app tab is closed.

---

## Tech Stack

| Category | Technology | Version (`package.json`) |
| --- | --- | --- |
| **UI Framework** | React | `19.2.8` |
| **Build Tool** | Vite | `8.3.0` |
| **Language** | TypeScript (strict mode) | `~6.0.2` |
| **Compiler** | React Compiler (`babel-plugin-react-compiler`) | `1.0.0` |
| **Routing** | TanStack Router (`@tanstack/react-router`) | `1.170.46` |
| **State Management** | Zustand | `5.0.16` |
| **Forms & Validation** | React Hook Form + Zod 4 | `7.91.0` / `4.6.7` |
| **UI Components & CSS** | Bootstrap 5.3 + react-bootstrap | `5.3.8` / `2.10.10` |
| **Unit & Integration Tests** | Vitest 5 + React Testing Library | `5.1.0` / `16.3.3` |
| **End-to-End Tests** | Playwright | `1.64.1` |

---

## Architecture & Spec-Driven Development (SDD)

### Isolated Data Layer (`src/data/`)

UI components and feature modules never access `localStorage` or `fetch` directly. All persistence flows through repository interfaces in `src/data/contracts/` (implemented in `src/data/repositories/` and `src/data/api/`) with runtime Zod validation on every inbound datum:

- **`localStorage` Mode:** Versioned keys (`tbt:v1:*`) with client-side repository enforcement of SRS Appendix B limits and local due-date alert scheduling.
- **REST API Mode (`Task by Task API 1.0.0-mvp`):** Native `fetch` transport (`credentials: "include"`) with:
  - `HttpOnly`, `SameSite=Lax` `SESSION` cookie authentication.
  - Double-submit CSRF protection (`GET /api/v1/auth/csrf` -> `XSRF-TOKEN` cookie & `X-XSRF-TOKEN` header on mutations, with single-attempt refresh/retry on `403`).
  - Localized Spanish **RFC 7807** (`application/problem+json`) error parsing, including field-level `invalidParams` (`400`) and rate-limit `retryAfterSeconds` (`429`).
  - Server-delegated filtering, keyset pagination, and backend-scheduled Web Push notifications.

### SDD Traceability

Every feature in this repository was designed and verified using the project's Spec-Driven Development workflow (`spec.md` -> `plan.md` -> `tasks.md`):

| Artifact / Spec | Scope & Purpose | Status |
| --- | --- | --- |
| [SVD (`docs/TaskByTask-SVD.md`)](docs/TaskByTask-SVD.md) | Vision & Scope Document (Spanish) | Approved |
| [SRS (`docs/TaskByTask-SRS.md`)](docs/TaskByTask-SRS.md) | Software Requirements Specification (`RF-*`, `RNF-*`, Appendixes) (Spanish) | Approved |
| [Constitution (`docs/constitution.md`)](docs/constitution.md) | Non-negotiable engineering & architectural principles | Active |
| [Agent Guidelines (`AGENTS.md`)](AGENTS.md) | Repository conventions, domain rules, and verification gates | Active |
| [`000-foundation`](docs/specs/000-foundation/) | Tooling, strict TS, Vitest/Playwright setup, base shell, Spanish i18n, and contracts | Implemented |
| [`001-tasks`](docs/specs/001-tasks/) | Tasks CRUD, overdue/completion rules, deterministic ordering, Move & Copy | Implemented |
| [`002-groups`](docs/specs/002-groups/) | Individual groups, immutable `"Personal"`, group grid & management | Implemented |
| [`003-tags`](docs/specs/003-tags/) | Group-scoped tags, inline `;`/`,` creation, suggestions, duplicate prevention, and task-vs-group deletion modal | Implemented |
| [`004-auth`](docs/specs/004-auth/) | Auth, 8 one-time recovery codes, profile, `24H`/`12H` & timezone preferences | Implemented |
| [`005-notifications`](docs/specs/005-notifications/) | Notification Center, due-date reminders, browser notification permissions | Implemented |
| [`006-backend-integration`](docs/specs/006-backend-integration/) | Dual persistence mode, REST API integration, CSRF/cookies, Keyset pagination, Web Push | Implemented |

---

## Getting Started & Dual Persistence Modes

### Prerequisites

- **Node.js 22+** and **npm**

Install dependencies:

```bash
npm ci
```

### Mode 1: Offline / Demo (`localStorage` — Default)

When `.env.local` is unset (or `VITE_PERSISTENCE_MODE=localStorage`), the app runs completely offline in the browser using `localStorage`:

```bash
npm run dev
```

### Mode 2: Real Backend API (`api`)

To connect to the **Task by Task REST API (`v1.0.0-mvp`)**, copy [`.env.example`](.env.example) to `.env.local` and set `VITE_PERSISTENCE_MODE=api`:

```env
VITE_PERSISTENCE_MODE=api
# Optional: only needed if not using the Vite same-origin /api dev proxy
# VITE_API_BASE_URL=http://localhost:8080
```

Start the dev server:

```bash
npm run dev
```

By default, [`vite.config.ts`](vite.config.ts) proxies `/api` requests to `http://localhost:8080` (`changeOrigin: true`), allowing `HttpOnly` and `SameSite=Lax` session cookies to work seamlessly on same-origin during local development.

---

## Available Scripts & Verification Baseline

| Script | Command | Description |
| --- | --- | --- |
| `npm run dev` | `vite` | Start local development server |
| `npm run build` | `tsc -b && vite build` | Typecheck and build production bundle |
| `npm run preview` | `vite preview` | Preview production build locally |
| `npm run typecheck` | `tsc -b --noEmit` | Run strict TypeScript check without emitting files |
| `npm run lint` | `eslint .` | Run ESLint across the repository |
| `npm run test` | `vitest run` | Run unit and integration test suites |
| `npm run test:watch` | `vitest` | Run Vitest in interactive watch mode |
| `npm run e2e` | `playwright test` | Run Playwright end-to-end tests |

### Verification Baseline (`v1.0.0`)

- **TypeScript & ESLint:** `0` errors (`npm run typecheck`, `npm run lint`)
- **Vitest (`npm run test`):** `54` test suites / `506` passing tests
- **Playwright (`npm run e2e`):** `12` end-to-end tests passing across both `localStorage` and `api` persistence modes

---

## Project Structure

```text
├── public/
│   └── sw.js                 # Service Worker for Web Push (VAPID) notifications
├── src/
│   ├── app/                  # Application bootstrap, providers, and TanStack Router setup
│   ├── data/                 # Isolated persistence layer (contracts, repositories, storage, api)
│   ├── features/             # Feature modules: auth, groups, notifications, tags, tasks
│   └── shared/               # Reusable UI components, hooks, utilities, and Spanish i18n
├── tests/
│   ├── unit/                 # Unit tests mirroring src/
│   ├── integration/          # Feature & repository integration tests
│   ├── e2e/                  # Playwright E2E suites (localStorage & API modes)
│   └── mocks/                # Shared test mocks and fixtures
├── docs/
│   ├── specs/                # SDD feature specs (000-foundation through 006-backend-integration)
│   ├── constitution.md       # Architectural principles
│   ├── TaskByTask-SRS.md     # Software Requirements Specification (Spanish)
│   └── TaskByTask-SVD.md     # Vision & Scope Document (Spanish)
├── .env.example              # Environment variable template
├── AGENTS.md                 # Engineering rules and conventions
└── vite.config.ts            # Vite + React Compiler + /api dev proxy configuration
```

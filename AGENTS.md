# AGENTS.md — Task by Task
Mobile-First, Spanish-only web app to manage tasks by groups and tags, with browser notifications on due dates. This repo is the frontend (MVP) using `localStorage` until the separate backend repo exists; it targets people juggling study, coding and personal to-dos.

## Stack & Structure
- **Tech Stack:** React 19.2, Vite 8, TypeScript 6 (strict), React Compiler, TanStack Router, Zustand, React Hook Form + Zod, Bootstrap 5.3 + react-bootstrap, Vitest + React Testing Library, Playwright (E2E), npm.
- **Folders:**
  - `src/app/`: bootstrap, providers, router.
  - `src/features/{auth,tasks,groups,tags,notifications}/`: feature modules (UI, hooks, store, schemas).
  - `src/shared/`: reusable UI (`ui/`), hooks, utils, i18n (`i18n/es.ts`).
  - `src/data/`: repository interfaces + `localStorage` implementations.
  - `tests/`: `unit/` (mirrors `src/`), `integration/`, `e2e/`, `mocks/`, `setup.ts`.
  - `docs/specs/NNN-spec-name/`: SDD feature folders containing `spec.md` (requirements), `plan.md` (technical design), and `tasks.md` (atomic checklist).
  - `docs/`: `constitution.md`, `TaskByTask-SRS.md` and `TaskByTask-SVD.md` (requirements, in Spanish).
  - `MEMORY.md` (root): cross-session state, decisions and next steps.

## Commands
- Install deps: `npm ci`
- Run local dev: `npm run dev`
- Run tests: `npm test` (`vitest run`); E2E: `npm run e2e`
- Typecheck / Lint: `npm run typecheck` (`tsc -b --noEmit`) / `npm run lint`
- Build: `npm run build`
- Note: `typecheck`, `test` and `e2e` scripts do not exist yet; add them when setting up tooling (ask first).

## Conventions
- **Style:** Strict TypeScript, no `any`; functional components; `camelCase` vars/functions, `PascalCase` components/types and component files. React Compiler is on: no manual `useMemo`/`useCallback` unless needed.
- **Language:** Code, identifiers, commits and technical docs in English; UI text in Spanish. SRS/SVD stay in Spanish.
- **Reference File:** Follow the pattern of `src/features/tasks/` (golden reference, to be established as the first complete feature).

## Domain Rules & Known Pitfalls
- **Watch out (dates):** A task with a date but no time is overdue at end of that day in the user's time zone; its reminder fires at 09:00 local. Never default to UTC. Format `dd/mm/aaaa`, 24 h default (12 h optional).
- **Watch out (task state/order):** Overdue pending = red + "Vencida" text; completed = strikethrough; completed-but-was-overdue = strikethrough only. Sort by due date asc, undated last (by creation), completed last under "all".
- **Watch out (groups/tags):** "Personal" group can be renamed, never deleted or shared. Tags belong to the group, not the user; created on `;` or `,`, no duplicates. "Move" keeps creation date, "Copy" creates a new one.
- **Watch out (future-proofing):** Group = `creatorId` + `members[]`; task = optional `assigneeId`. Never assume one user per group.
- **Watch out (storage):** Enforce SRS Appendix B limits in repositories, not only forms. Validate data read from `localStorage` with Zod. Keys are versioned (`tbt:v1:*`). Never store plaintext passwords.
- **Watch out (AI mistakes):** Do not add priorities, custom colors, other languages, drag & drop, real-time or shared groups. Do not install unrequested libraries, mix English into the UI, use `any`, or access `localStorage` from components.

## Way of Working (SDD & Memory)
- Read `docs/constitution.md`, `MEMORY.md`, and the active spec folder (`docs/specs/NNN-spec-name/`) before writing code.
- Follow the strict SDD flow inside each feature folder: `spec.md` (what/why, cites `RF-xx`/`RNF-xx`, acceptance criteria, status `draft`/`approved`/`implemented`) -> `plan.md` (how/architecture) -> `tasks.md` (atomic execution).
- Work in small, atomic tasks following `tasks.md`; mark tasks as completed (`[x]`) as you progress and never make massive unrequested refactors.
- If code and spec diverge, update the spec first. After completing changes, give a short summary of modified files.
- After completing a session or milestone, update `MEMORY.md` with new decisions, learnings, or status changes.

## Boundaries
- ✅ **Always:** Read the spec first; run typecheck, lint and tests before finishing; validate inputs with Zod; access data via repositories; centralize Spanish UI text; meet basic accessibility (RNF-12); keep compatibility with "Posterior" features (RNF-20).
- ⚠️ **Ask First:** Installing/updating/removing packages; changing `localStorage` schema or key version; deleting/renaming files; editing `vite.config.ts`, `tsconfig*.json`, `eslint.config.js`; changing an approved spec or SRS/SVD; refactors spanning multiple features; implementing "Posterior" scope.
- 🚫 **Never:** Hardcode secrets/API keys; store plaintext passwords; use `any`, `@ts-ignore` or disable lint rules; hallucinate dependencies/APIs; edit files outside task scope; touch `node_modules/` or hand-edit `package-lock.json`; `git commit`/`git push` unless asked.

## Verification
- Run `npm run typecheck`, `npm run lint` and `npm test`; all must pass with zero errors.
- For large changes also run `npm run build`.
- For UI changes, check in the browser at ~375 px (mobile) and desktop widths; confirm no console errors.

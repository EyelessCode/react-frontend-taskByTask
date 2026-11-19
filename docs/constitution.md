# Constitution — Task by Task

Non-negotiable principles. Any deviation requires the owner's explicit approval.

1. **Spec-first.** Write no code without an approved feature folder `docs/specs/NNN-spec-name/` following `spec.md` (what/why, citing `RF-xx`/`RNF-xx`) → `plan.md` (how) → `tasks.md` (atomic checklist). If code and spec diverge, fix the spec first.
2. **MVP scope, future-proof design (RNF-20).** Implement only MVP scope; never build anything marked "Posterior" without authorization. Never assume "group = one user": groups carry `creatorId` + `members[]`; tasks carry optional `assigneeId`.
3. **Isolated data layer.** UI and components never touch `localStorage` or the network directly; all access goes through repository interfaces so a real API can replace the storage without touching features. Validate every inbound datum with Zod. Business rules are ultimately enforced by the backend (RNF-07); frontend checks are UX only.
4. **Strict type safety.** TypeScript strict; no `any`, `@ts-ignore` or disabled lint rules. SRS limits (Appendix B) live in one place as shared Zod schemas.
5. **Spanish, accessible, Mobile-First UI.** All UI text in Spanish, centralized in `src/shared/i18n/es.ts`. Dates `dd/mm/aaaa`, 24 h by default, user's time zone. Basic accessibility (RNF-12); never convey state by color alone.
6. **Small, verifiable, remembered changes.** Execute `tasks.md` atomically, no sweeping refactors, no unapproved dependencies. Nothing is "done" until `typecheck`, `lint` and `test` pass. Record decisions and learnings in `MEMORY.md`.

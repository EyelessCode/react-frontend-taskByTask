# Spec 001: Tasks Management (Golden Reference)

- **Feature Name:** `001-tasks`
- **Status:** implemented
- **Created Date:** 2026-11-03
- **Authors:** SDD Planner Agent
- **SRS / SVD References:** `RF-12`, `RF-13`, `RF-14`, `RF-15`, `RF-16`, `RF-22` (subset), `UI-01`, `UI-03`, `UI-04`, `UI-06`, `UI-07`, `RNF-01`, `RNF-07`, `RNF-12`, `RNF-14`, `RNF-18`, `RNF-19`, `RNF-20`, `Appendix B`, `Constitution Principles 1–6`

---

## 1. Purpose & Background

### 1.1 Purpose
Define the functional requirements, validation constraints, deterministic ordering semantics, lifecycle operations, and visual presentation for Tasks in Task by Task. This feature implements SRS requirements `RF-12` through `RF-16`, relevant UI specifications (`UI-01`, `UI-03`, `UI-04`, `UI-06`, `UI-07`), and tag integration (`RF-22` subset), establishing `src/features/tasks/` as the architectural **Golden Reference** for the entire application.

### 1.2 Background
Tasks represent the core unit of productivity in Task by Task. Users create tasks inside individual groups, set optional due dates and times, categorize them with tags, mark them complete, and move or copy them across groups.

Because `001-tasks` is the first functional feature module developed on top of `000-foundation`, it establishes the canonical architectural patterns:
- **Repository Pattern:** Pure data-layer separation in `src/data/repositories/` implementing `TaskRepository` through `LocalStorageAdapter` (`tbt:v1:tasks`), shielding UI from direct storage access (Constitution Principle 3).
- **Zustand Feature Store:** Domain state management in `src/features/tasks/store/` with immutable state transitions, pure selectors, and action dispatchers.
- **Form Management & Validation:** Strict validation using React Hook Form paired with canonical Zod schemas in `src/features/tasks/schemas/`.
- **Custom Hooks:** Domain logic encapsulation in `src/features/tasks/hooks/` (`useTasks`, `useTaskSort`, `useTaskForm`, `useTaskMoveCopy`).
- **Accessible, Mobile-First UI Components:** Modular presentation in `src/features/tasks/components/` (`TaskCard`, `TaskList`, `TaskFormModal`, `TaskMoveCopyModal`, `TaskDeleteConfirmModal`, `TaskTagRemovalModal`, `TaskFilterTabs`) styled with React-Bootstrap.
- **Centralized Spanish Localization:** All user-facing text, modal labels, accessibility labels, and error messages drawn exclusively from `src/shared/i18n/es.ts`.
- **Future-Proof Extensibility:** Preserves slots for `assigneeId`, `subtasks`, and `reminders` per `RNF-20`.

---

## 2. Scope

### 2.1 In Scope
1. **Task Creation (`RF-12`):** Creation of tasks with title (2..100 chars), optional description (up to 750 chars), optional due date (`YYYY-MM-DD`), optional due time (`HH:mm`, permitted only when due date is present), optional tag associations (`tagIds`), and assigned group. Past, current, and future due dates are accepted; tasks with past due dates are immediately marked as overdue.
2. **Task Editing & Deletion (`RF-13`):** Modification of editable fields with identical validation rules. Deletion with an explicit confirmation dialog warning of permanent removal (`UI-06`).
3. **Task Completion & Visual State (`RF-14`):** Toggle task completion status (`completed`, `completedAt`). Visual differentiation:
   - Pending overdue: Red indicator/text and explicit text badge "Vencida" (`UI-04`, `RNF-12`).
   - Completed: Strikethrough on task title.
   - Completed that was overdue: Strikethrough only (no red styling, no "Vencida" text).
   - Tasks with a due date but no due time become overdue after `23:59:59.999` in the user's local timezone.
4. **Deterministic Task Ordering (`RF-15`):** Ordered ascending by due date and time; undated tasks placed after dated tasks ordered ascending by creation date; under the "todas" (all) filter, all completed tasks are placed at the very bottom.
5. **Moving & Copying Tasks (`RF-16`):** Accessible three-dots vertical action menu (`UI-03`) with "Mover a…" and "Copiar a…":
   - "Mover a…": Reassigns task `groupId`, preserves original `createdAt` and `id`.
   - "Copiar a…": Clones all properties into target group with a newly generated `id` and current `createdAt`.
   - Destination targets restricted strictly to other individual groups owned by the user (`type: 'individual'` and `id !== task.groupId`).
   - Tags matched by case-insensitive name in target group (reusing existing tag or creating a new tag in target group).
   - Clear empty-state messaging when no other individual groups exist.
6. **Task-Level Tag Integration (`RF-22` subset):**
   - Delimited entry: Semicolon (`;`) or comma (`,`) converts typed text into a tag chip.
   - Tag suggestions / autocomplete: Matching existing tags in the group are suggested while typing.
   - Duplicate reuse: Identical tag names (case-insensitive, trimmed) reuse the existing tag without error or warning.
   - Inline tag replacement: Editing a tag on a task updates only that task's association.
   - Chip display: Shows up to 5 tag chips plus an overflow indicator `"+N más"` on task cards; full list in detail/edit view.
   - Removal prompt: Asking whether to remove tag "Solo de la tarea" or "Del grupo".
7. **Accessible Mobile-First UI (`UI-01`, `UI-04`, `RNF-12`):** Responsive card layout (~375px to desktop), full keyboard accessibility (Tab, Enter, Space), visible focus rings, and screen-reader support.
8. **Standalone Seed Provisioning (`RNF-07`, `RNF-20`):** Automatic provisioning of a default individual "Personal" group if none exists, ensuring `001-tasks` operates independently before `002-auth` and `003-groups` are developed.

### 2.2 Out of Scope
- Full group management screens (create, rename, delete groups) (handled in `003-groups`).
- User authentication, registration, recovery codes, and session login/logout (handled in `002-auth`).
- Standalone group tag catalog management screen (`RF-23`, handled in `004-tags`).
- Browser push notification scheduling and notification center UI (`RF-27`, `RF-28`, `RF-29`, handled in `notifications`).
- Collaborative and advanced features: Shared groups (`RF-08`), task assignment (`RF-19`), subtasks (`RF-18`), reminders (`RF-20`), drag & drop (`RF-33`).

---

## 3. Requirements (EARS Format)

### 3.1 Task Creation (`RF-12`, `RNF-19`, `Appendix B`)

- **REQ-TK-01 (Event-Driven - Task Creation Input):**  
  When a user opens the task creation form, the system shall accept a title (mandatory, 2 to 100 characters), description (optional, up to 750 characters), due date (optional, `YYYY-MM-DD`), due time (optional, `HH:mm`, enabled only if due date is provided), tag associations (`tagIds: string[]`), and target group identifier (`groupId`).

- **REQ-TK-02 (Event-Driven - Task Creation Processing):**  
  When the user submits a valid task creation payload, the system shall generate a unique identifier (`id`), record the current ISO-8601 UTC timestamp as `createdAt` (immutable), set `completed` to `false`, initialize `completedAt` to `null`, persist the task in storage, and position the task within the active view in accordance with the deterministic sorting rules defined in `REQ-TK-16` (`RF-15`).

- **REQ-TK-03 (Ubiquitous - Date Agnosticism):**  
  The system shall accept due dates in the past, present, or future without blocking task creation; a task created with a past due date shall immediately be treated as overdue upon creation.

- **REQ-TK-04 (Unwanted Behavior - Due Time without Due Date):**  
  If a user attempts to specify a due time without having specified a due date, then the system shall disable/prevent due time entry and display a localized Spanish validation message indicating that a due date is required.

- **REQ-TK-05 (Unwanted Behavior - Validation Rejection):**  
  If any task attribute fails canonical validation (title length < 2 or > 100 characters, description > 750 characters, or invalid date/time format), then the system shall reject submission, keep the form open, and display the corresponding localized Spanish error message from `src/shared/i18n/es.ts`.

### 3.2 Task Editing and Deletion (`RF-13`, `UI-06`)

- **REQ-TK-06 (Event-Driven - Task Editing Submission):**  
  When a user modifies an existing task and submits the changes, the system shall validate the updated attributes against the canonical schema, update `title`, `description`, `dueDate`, `dueTime`, and `tagIds`, and preserve immutable properties (`id`, `createdAt`, `groupId`).

- **REQ-TK-07 (Event-Driven - Task Deletion Request):**  
  When a user selects "Eliminar" from the task action menu, the system shall display a confirmation modal warning that the action is permanent and irreversible (`UI-06`).

- **REQ-TK-08 (Event-Driven - Task Deletion Confirmation):**  
  When the user confirms task deletion in the modal dialog, the system shall permanently remove the task record from storage and remove it from the active UI list.

### 3.3 Task Completion and Visual Status (`RF-14`, `UI-04`, `RNF-12`, `RNF-14`)

- **REQ-TK-09 (Event-Driven - Completing a Task):**  
  When a user marks a pending task as completed, the system shall set `completed` to `true`, record the current ISO-8601 UTC timestamp in `completedAt`, and update its visual presentation immediately.

- **REQ-TK-10 (Event-Driven - Unmarking a Completed Task):**  
  When a user unchecks a completed task, the system shall set `completed` to `false`, set `completedAt` to `null`, and recalculate its overdue status against the current time.

- **REQ-TK-11 (State-Driven - Overdue Pending Status):**  
  While a task is pending (`completed == false`) and its due cutoff has passed, the system shall display the task with red styling and an explicit visual badge/text "Vencida" to satisfy accessibility standards (`RNF-12`) by not relying solely on color.

- **REQ-TK-12 (State-Driven - Date-Only Overdue Cutoff):**  
  While evaluating overdue status for a task having a `dueDate` but no `dueTime`, the system shall consider the task overdue only after `23:59:59.999` of that calendar day in the user's local timezone.

- **REQ-TK-13 (State-Driven - Completed Task Styling):**  
  While a task is completed (`completed == true`), the system shall display its title with a strikethrough style (`text-decoration: line-through`).

- **REQ-TK-14 (State-Driven - Completed Overdue Styling Invariant):**  
  While a task is completed whose due date had expired prior to completion, the system shall display the task with strikethrough styling only, without red coloration and without the "Vencida" text badge.

- **REQ-TK-15 (State-Driven - Normal Pending Status):**  
  While a task is pending and its due date is in the future or not set, the system shall display the task in standard typography without red coloration and without the "Vencida" badge.

### 3.4 Deterministic Task Ordering (`RF-15`)

- **REQ-TK-16 (Ubiquitous - Deterministic Status-Group Ordering Algorithm):**  
  Within any task grouping (pending tasks or completed tasks), the system shall order tasks deterministically using the following sequential rules:
  1. Dated tasks appear first, sorted in ascending order by `dueDate`.
  2. For tasks sharing the same `dueDate`, tasks with an explicit `dueTime` are sorted ascending by `dueTime`; tasks on that date lacking a `dueTime` are placed after all timed tasks for that date (evaluated as end-of-day `23:59:59.999`).
  3. Undated tasks appear after all dated tasks, sorted in ascending order by `createdAt` (oldest tasks first).
  4. In the event of identical dates or timestamps, task `id` ascending shall serve as the deterministic tie-breaker.

- **REQ-TK-17 (State-Driven - Ordering Under "Todas" Filter):**  
  While viewing tasks under the "todas" (all) filter, the system shall partition the list into two deterministic blocks:
  1. All pending tasks appear first, sorted strictly according to `REQ-TK-16`.
  2. All completed tasks appear second at the bottom of the list, sorted strictly according to `REQ-TK-16`.

### 3.5 Moving and Copying Tasks (`RF-16`, `UI-03`)

- **REQ-TK-18 (Ubiquitous - Task Context Action Menu):**  
  The system shall display a vertical three-dots options menu button (`UI-03`) on each task card containing the actions: "Editar", "Mover a…", "Copiar a…", and "Eliminar".

- **REQ-TK-19 (Event-Driven - Group Destination Picker):**  
  When "Mover a…" or "Copiar a…" is selected, the system shall present a modal dialog listing all other individual groups belonging to the user (`type === 'individual'` and `id !== task.groupId`).

- **REQ-TK-19b (State-Driven - No Other Individual Groups Available):**  
  While opening "Mover a…" or "Copiar a…" when the user has no other individual groups available, the modal dialog shall display an informational Spanish empty-state message stating that no other individual groups exist and disable the confirmation button.

- **REQ-TK-20 (Event-Driven - Moving a Task):**  
  When a destination group is selected and confirmed for "Mover a…", the system shall update the task's `groupId` to the destination group ID while strictly preserving the original `createdAt` timestamp and task `id`.

- **REQ-TK-21 (Event-Driven - Copying a Task):**  
  When a destination group is selected and confirmed for "Copiar a…", the system shall duplicate the task into the destination group with a newly generated `id`, set `createdAt` to the current timestamp, and replicate all other attributes (`title`, `description`, `dueDate`, `dueTime`, `completed`, `completedAt`).

- **REQ-TK-22 (Event-Driven - Tag Synchronization on Move or Copy):**  
  When a task is moved or copied into a destination group, the system shall synchronize each associated tag by name (case-insensitive, trimmed) within the destination group:
  - If a tag with the same name already exists in the destination group, the task shall be associated with the existing tag's `id`.
  - If no tag with that name exists in the destination group, the system shall automatically create the tag in the destination group and associate its new `id` with the task.

- **REQ-TK-23 (Ubiquitous - Destination Group Restriction):**  
  The system shall only allow moving and copying tasks to individual groups (`type: 'individual'`); shared groups shall not be offered as targets.

### 3.6 Task Tag Integration (`RF-22` Subset)

- **REQ-TK-24 (Event-Driven - Delimited Tag Creation):**  
  When typing in the tag input field of the task form, entering a semicolon (`;`) or comma (`,`) shall immediately convert the preceding trimmed text into a tag chip, without including the `;` or `,` character in the tag name.

- **REQ-TK-24b (Event-Driven - Tag Autocomplete & Suggestions):**  
  While typing in the task tag input field, the system shall query existing tags belonging to the active group (`groupId`) and display matching suggestions (case-insensitive substring match) for immediate selection.

- **REQ-TK-24c (Ubiquitous - Case-Insensitive Duplicate Reuse):**  
  When a tag is entered or selected whose name matches an existing tag in the group (case-insensitive and trimmed), the system shall associate the existing tag's `id` with the task without showing any error or duplicate warning.

- **REQ-TK-24d (Event-Driven - Inline Tag Replacement):**  
  When a user edits an existing tag directly on a task, the system shall replace the tag association on that specific task only, leaving the original tag intact in the group catalog.

- **REQ-TK-25 (Ubiquitous - Tag Preview Limit & Overflow Indicator):**  
  The system shall display up to 5 tag chips on the task card preview; if a task has more than 5 associated tags, the card shall render the first 5 chips followed by an overflow badge indicating `"+N más"`. The full task detail and edit views shall render all associated tags.

- **REQ-TK-26 (Event-Driven - Tag Removal Prompt):**  
  When a user removes a tag chip from a task in the edit view, the system shall open a dialog asking whether to remove the tag "Solo de la tarea" (dissociating it from this task only) or "Del grupo" (deleting the tag from the group and all its tasks).

### 3.7 Accessibility, Responsiveness & Locale (`UI-01`, `UI-07`, `RNF-12`, `RNF-14`)

- **REQ-TK-27 (Ubiquitous - Responsive Mobile-First Presentation):**  
  The task list, task cards, and modals shall be styled for mobile viewports (~375px) using responsive layout rules and adapt gracefully to tablet and desktop viewports.

- **REQ-TK-28 (Ubiquitous - Accessibility Compliance):**  
  All interactive controls (completion checkbox, three-dots menu trigger, action items, modal buttons) shall be keyboard-navigable (Tab, Space, Enter), provide visible focus indicators, and feature descriptive Spanish `aria-label` attributes.

- **REQ-TK-29 (Ubiquitous - Formatted Date and Time Display):**  
  The system shall render due dates formatted strictly as `dd/mm/aaaa` and due times in 24-hour format (`HH:mm`) by default, or 12-hour format (`hh:mm a`) based on the user's preference, evaluated in the user's local timezone.

### 3.8 Standalone Operability & Extensibility (`RNF-07`, `RNF-18`, `RNF-20`)

- **REQ-TK-30 (Ubiquitous - Canonical Seed Group Provisioning):**  
  When initializing the task repository or store, if no groups exist in storage, the system shall automatically provision a default individual "Personal" group with full schema compliance:
  - `id`: `'group-personal'` (or valid UUID)
  - `name`: `'Personal'`
  - `creatorId`: `'local-user'`
  - `isPersonal`: `true`
  - `type`: `'individual'`
  - `members`: `[{ userId: 'local-user', role: 'creator', joinedAt: <current ISO-8601 UTC timestamp> }]`
  - `createdAt`: `<current ISO-8601 UTC timestamp>`

- **REQ-TK-31 (Unwanted Behavior - Entity Not Found):**  
  If an operation references a task or group identifier that does not exist in storage, then the system shall return a controlled `NotFoundError` and prevent cascading application errors (`RNF-18`).

- **REQ-TK-32 (Ubiquitous - Future-Proof Entity Structure):**  
  The Task entity schema shall preserve extensible optional properties (`assigneeId: null`, `subtasks: []`, `reminders: []`) conforming to `RNF-20`.

---

## 4. Domain Models & Specifications

### 4.1 Visual State Matrix (`RF-14`, `UI-04`, `RNF-12`)

| Status Scenario | `completed` | Due Date Cutoff Condition | Title Style | Badges / Text | Red Highlight |
| :--- | :---: | :--- | :--- | :--- | :---: |
| **Pending On-Time** | `false` | In the future or no due date | Normal | None | No |
| **Pending Overdue** | `false` | Cutoff timestamp passed | Normal | Badge "Vencida" | Yes (Border & Text) |
| **Completed On-Time** | `true` | Any / completed before due | Strikethrough | None | No |
| **Completed Overdue** | `true` | Cutoff timestamp passed | Strikethrough | None (no "Vencida") | No |

### 4.2 Deterministic Task Sorting Algorithm (`RF-15`)

```
Function compareTasks(taskA, taskB):
  1. Determine date presence:
     hasDueA = taskA.dueDate != null
     hasDueB = taskB.dueDate != null

  2. If hasDueA AND hasDueB:
     If taskA.dueDate != taskB.dueDate:
        Return compareString(taskA.dueDate, taskB.dueDate) // YYYY-MM-DD chronological ASC
     
     // Same dueDate: compare dueTime (null dueTime treated as "23:59:59.999" end of day)
     timeA = taskA.dueTime ?? "23:59:59.999"
     timeB = taskB.dueTime ?? "23:59:59.999"
     If timeA != timeB:
        Return compareString(timeA, timeB) // ASC (timed tasks first, untimed last on that date)

  3. If hasDueA != hasDueB:
     Return hasDueA ? -1 : 1 // Dated tasks always precede undated tasks

  4. If both undated (!hasDueA AND !hasDueB):
     If taskA.createdAt != taskB.createdAt:
        Return compareString(taskA.createdAt, taskB.createdAt) // Oldest first ASC

  5. Deterministic tie-breaker:
     Return compareString(taskA.id, taskB.id) // ASC
```

Partitioning by Filter:
- Filter `'pendientes'`: `pendingTasks.sort(compareTasks)`
- Filter `'completadas'`: `completedTasks.sort(compareTasks)`
- Filter `'todas'`: `[...pendingTasks.sort(compareTasks), ...completedTasks.sort(compareTasks)]`

### 4.3 Move vs. Copy Comparison (`RF-16`)

| Attribute | Move Operation ("Mover a…") | Copy Operation ("Copiar a…") |
| :--- | :--- | :--- |
| **Task ID** | Preserved (`id` unchanged) | Newly generated unique ID |
| **Creation Date** | Preserved (`createdAt` unchanged) | Current timestamp (`nowIsoUtc()`) |
| **Group ID** | Updated to destination `groupId` | Set to destination `groupId` |
| **Original Task** | Removed from origin group | Retained in origin group |
| **Tags** | Mapped by name to destination group | Mapped by name to destination group |
| **Allowed Targets** | Other individual groups (`id !== task.groupId`) | Other individual groups (`id !== task.groupId`) |
| **Empty State** | Message + confirm button disabled | Message + confirm button disabled |

### 4.4 Task Entity Contract & Tag Association Schema

To ensure seamless integration between tasks and tags per `RF-12` and `RF-22`, the `Task` domain entity incorporates `tagIds?: string[]`. This represents a backward-compatible extension to `src/shared/schemas/task.ts`:

```typescript
export interface Task {
  id: string;
  title: string;
  description?: string | null;
  groupId: string;
  tagIds?: string[];               // Array of Tag.id references (RF-22)
  completed: boolean;
  createdAt: string;              // ISO-8601 UTC
  completedAt?: string | null;    // ISO-8601 UTC
  dueDate?: string | null;        // YYYY-MM-DD
  dueTime?: string | null;        // HH:mm (24h)
  assigneeId?: string | null;     // RNF-20: null in MVP
  subtasks?: Subtask[];           // RNF-20: max 25 items
  reminders?: Reminder[];         // RNF-20: max 5 items
}
```

### 4.5 Standalone Seed Group Contract (`REQ-TK-30`)

When no groups exist in persistent storage upon task store initialization, the system automatically writes the following canonical seed group:

```typescript
export const SEED_PERSONAL_GROUP: Group = {
  id: 'group-personal',
  name: 'Personal',
  creatorId: 'local-user',
  isPersonal: true,
  type: 'individual',
  members: [
    {
      userId: 'local-user',
      role: 'creator',
      joinedAt: '2026-01-01T00:00:00.000Z',
    },
  ],
  createdAt: '2026-01-01T00:00:00.000Z',
};
```

### 4.6 Spanish Localization Extension Contract (`src/shared/i18n/es.ts`)

The `tasks` namespace is formally appended to the `LocalizationDictionary` structure:

```typescript
export interface TasksLocalization {
  createTitle: string;
  editTitle: string;
  titleLabel: string;
  titlePlaceholder: string;
  descLabel: string;
  descPlaceholder: string;
  dueDateLabel: string;
  dueTimeLabel: string;
  tagsLabel: string;
  tagsPlaceholder: string;
  groupLabel: string;
  filterPending: string;
  filterCompleted: string;
  filterAll: string;
  actionMenuAria: string;
  actionEdit: string;
  actionMove: string;
  actionCopy: string;
  actionDelete: string;
  deleteTitle: string;
  deleteMessage: string;
  confirmDelete: string;
  cancelDelete: string;
  moveTitle: string;
  copyTitle: string;
  selectGroupLabel: string;
  noOtherGroups: string;
  confirmMove: string;
  confirmCopy: string;
  tagOverflow: (count: number) => string;
  removeTagTitle: string;
  removeTagPrompt: (tagName: string) => string;
  removeOnlyFromTask: string;
  removeFromGroup: string;
  badgeOverdue: string;
  emptyPending: string;
  emptyCompleted: string;
  emptyAll: string;
}
```

Canonical dictionary entries:
- `filterPending`: `'Pendientes'`
- `filterCompleted`: `'Completadas'`
- `filterAll`: `'Todas'`
- `actionEdit`: `'Editar'`
- `actionMove`: `'Mover a…'`
- `actionCopy`: `'Copiar a…'`
- `actionDelete`: `'Eliminar'`
- `deleteTitle`: `'Eliminar tarea'`
- `deleteMessage`: `'¿Estás seguro de que deseas eliminar esta tarea? Esta acción no se puede deshacer.'`
- `noOtherGroups`: `'No tienes otros grupos disponibles para mover o copiar esta tarea.'`
- `tagOverflow`: `(count) => `+${count} más``
- `removeOnlyFromTask`: `'Solo de la tarea'`
- `removeFromGroup`: `'Del grupo'`
- `badgeOverdue`: `'Vencida'`

---

## 5. Acceptance Criteria

1. **AC-TK-01 (Task Creation & Ordering):** A task created with title (2..100 chars), optional description, valid due date (`YYYY-MM-DD`), due time (`HH:mm`), and tag associations is persisted with `completed: false`, auto-generated `id`, and auto `createdAt`, and appears in the list strictly positioned by the deterministic sorting rules.
2. **AC-TK-02 (Task Editing):** Modifying title, description, due date, due time, or tags updates the task and preserves `id` and `createdAt`.
3. **AC-TK-03 (Task Deletion):** Deletion displays a confirmation modal; confirming permanently removes the task from storage.
4. **AC-TK-04 (Completion Toggle):** Marking complete sets `completed: true` and `completedAt: ISO string`; unmarking resets `completed: false` and `completedAt: null`.
5. **AC-TK-05 (Visual Status):** Pending overdue tasks render in red with the text badge "Vencida"; completed tasks render with strikethrough; completed tasks that expired render with strikethrough only without red or badge.
6. **AC-TK-06 (Date-Only Overdue):** A task with a date but no time is NOT overdue before `23:59:59.999` local time, and IS overdue immediately after.
7. **AC-TK-07 (Deterministic Sorting):** Tasks display with dated pending first (due date asc, untimed last on that date), undated pending next (created at asc), and completed tasks placed last under the "todas" view.
8. **AC-TK-08 (Move Operation):** "Mover a…" moves task to another individual group, updates `groupId`, keeps original `createdAt` and `id`, synchronizes tags by name, and shows empty-state disabled modal when no other individual groups exist.
9. **AC-TK-09 (Copy Operation):** "Copiar a…" duplicates task into another individual group with new `id`, new `createdAt`, identical fields, synchronizes tags by name, and shows empty-state disabled modal when no other individual groups exist.
10. **AC-TK-10 (Tag Autocomplete & Chip Management):** Tag entry supports `;` and `,` delimiters, suggests existing tags from the group, reuses duplicate tags without warning, shows up to 5 chips with `"+N más"` badge, and prompts for removal scope ("Solo de la tarea" vs. "Del grupo").
11. **AC-TK-11 (Accessibility & Responsiveness):** All task actions (toggle, menu, modals) are operable via keyboard with visible focus at mobile (~375px) and desktop viewports, with 100% Spanish labels.

---

## 6. Traceability Matrix

| SRS Requirement | Feature Requirement | Coverage Details |
| :--- | :--- | :--- |
| **RF-12** | REQ-TK-01, REQ-TK-02, REQ-TK-03, REQ-TK-04, REQ-TK-05 | Task creation inputs, bounds, auto attributes, past date handling |
| **RF-13** | REQ-TK-06, REQ-TK-07, REQ-TK-08 | Task editing, deletion confirmation modal, storage removal |
| **RF-14** | REQ-TK-09, REQ-TK-10, REQ-TK-11, REQ-TK-12, REQ-TK-13, REQ-TK-14, REQ-TK-15 | Completion toggle, overdue red + "Vencida", strikethrough styling |
| **RF-15** | REQ-TK-02, REQ-TK-16, REQ-TK-17, Section 4.2 | Deterministic sort by due date asc, undated last by createdAt, completed last in "todas" |
| **RF-16** | REQ-TK-18, REQ-TK-19, REQ-TK-19b, REQ-TK-20, REQ-TK-21, REQ-TK-22, REQ-TK-23 | Three-dots menu, Move/Copy to other individual groups, empty state, tag sync by name |
| **RF-22** | REQ-TK-22, REQ-TK-24, REQ-TK-24b, REQ-TK-24c, REQ-TK-24d, REQ-TK-25, REQ-TK-26 | Delimiter `;`/`,`, suggestions, duplicate reuse, inline edit, 5 chips + `"+N más"`, removal scope |
| **UI-01** | REQ-TK-27, REQ-TK-28 | Mobile-First responsive design, 100% Spanish UI text |
| **UI-03** | REQ-TK-18 | Vertical three-dots options menu on task card |
| **UI-04** | REQ-TK-11, REQ-TK-13 | Red + "Vencida" text for overdue, strikethrough for completed |
| **UI-06** | REQ-TK-07, REQ-TK-26 | Confirmation dialogs for destructive actions (delete, tag removal) |
| **UI-07** | REQ-TK-29 | 24-hour default time format with 12-hour option |
| **RNF-01** | REQ-TK-02, REQ-TK-06 | Fast client-side response under 2 seconds |
| **RNF-07** | REQ-TK-05, REQ-TK-31 | Validation and controlled error handling |
| **RNF-12** | REQ-TK-11, REQ-TK-28 | Basic accessibility: tab navigation, focus rings, state not by color alone |
| **RNF-14** | REQ-TK-27, REQ-TK-29 | Spanish interface, `dd/mm/aaaa`, user local timezone |
| **RNF-18** | REQ-TK-31 | Graceful `NotFoundError` handling for missing tasks or groups |
| **RNF-19** | REQ-TK-01, REQ-TK-05 | Canonical Appendix B limits enforcement |
| **RNF-20** | REQ-TK-30, REQ-TK-32, Section 4.4, 4.5 | Extensible Task entity model, tag associations, and canonical seed group |
| **Appendix B** | REQ-TK-01, REQ-TK-05, Section 4 | Title (2..100), description (0..750), tag (1..30), group (3..30) |

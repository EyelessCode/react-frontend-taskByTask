# Implementation Plan: 001-tasks (Golden Reference)

- **Feature Name:** `001-tasks`
- **Spec Reference:** [`docs/specs/001-tasks/spec.md`](file:///C:/Users/crist/Documentos/GitHub/PERSONAL/PROJECTS-FULLSTACK/TaskByTask/react-frontend-taskByTask/docs/specs/001-tasks/spec.md) (Status: `approved`)
- **Plan Status:** Draft

---

## 1. Architecture & Folder Structure Overview

This plan defines the technical implementation of **001-tasks**, establishing `src/features/tasks/` as the project's Golden Reference. It implements all task lifecycle operations (`RF-12` through `RF-16`), tag integration (`RF-22` subset), deterministic sorting, visual status management (`UI-04`, `RNF-12`), and standalone seed group provisioning (`REQ-TK-30`).

### 1.1 Target File Layout

```
react-frontend-taskByTask/
├── src/
│   ├── main.tsx                                     # [Bootstrap CSS import]
│   ├── App.tsx                                      # [Golden Reference view integration]
│   ├── shared/
│   │   ├── i18n/
│   │   │   ├── es.ts                                # [tasks namespace extension]
│   │   │   └── index.ts
│   │   ├── schemas/
│   │   │   ├── task.ts                              # [tagIds?: string[] field extension]
│   │   │   ├── group.ts                             # [SEED_PERSONAL_GROUP export]
│   │   │   └── index.ts
│   │   └── utils/
│   │       ├── date-time.ts                         # (From 000-foundation)
│   │       └── index.ts
│   ├── data/
│   │   ├── contracts/
│   │   │   ├── task-repository.ts                   # TaskRepository interface
│   │   │   ├── group-repository.ts                  # GroupRepository interface (minimal for 001)
│   │   │   ├── tag-repository.ts                    # TagRepository interface (minimal for 001)
│   │   │   └── index.ts
│   │   └── repositories/
│   │       ├── local-storage-task-repository.ts     # TaskRepository implementation
│   │       ├── local-storage-group-repository.ts    # GroupRepository implementation (seed + list)
│   │       ├── local-storage-tag-repository.ts      # TagRepository implementation (group tags)
│   │       └── index.ts
│   └── features/
│       └── tasks/                                   # GOLDEN REFERENCE MODULE
│           ├── index.ts                             # Public feature barrel export
│           ├── schemas/
│           │   ├── task-form-schema.ts              # RHF + Zod form validation schema
│           │   └── index.ts
│           ├── utils/
│           │   ├── task-sort.ts                     # Deterministic compareTasks & filter sort
│           │   └── index.ts
│           ├── store/
│           │   ├── tasks-store.ts                   # Zustand state store + actions
│           │   └── index.ts
│           ├── hooks/
│           │   ├── use-tasks.ts                     # Custom hook for sorted list & stats
│           │   ├── use-task-form.ts                 # Custom hook for task form management
│           │   ├── use-task-move-copy.ts            # Custom hook for Move/Copy modal state
│           │   └── index.ts
│           └── components/
│               ├── TaskCard.tsx                     # Responsive task item with status & menu
│               ├── TaskList.tsx                     # Sorted list container with empty states
│               ├── TaskFilterTabs.tsx               # Nav tabs: Pendientes / Completadas / Todas
│               ├── TaskFormModal.tsx                # Create & Edit task dialog
│               ├── TaskTagInput.tsx                 # Delimited chip input with autocomplete
│               ├── TaskTagRemovalModal.tsx          # "Solo de la tarea" vs "Del grupo" dialog
│               ├── TaskMoveCopyModal.tsx            # Move / Copy destination group picker
│               ├── TaskDeleteConfirmModal.tsx       # Irreversible deletion confirmation dialog
│               ├── TasksView.tsx                    # Main container assembling task components
│               └── index.ts
└── tests/
    ├── unit/
    │   ├── features/
    │   │   └── tasks/
    │   │       ├── task-sort.test.ts                # Deterministic sorting unit tests
    │   │       ├── task-form-schema.test.ts         # Validation & dueTime rule tests
    │   │       └── tasks-store.test.ts              # Store actions & state transition tests
    │   └── data/
    │       ├── local-storage-task-repository.test.ts
    │       └── local-storage-tag-repository.test.ts
    ├── integration/
    │   └── features/
    │       └── tasks/
    │           ├── task-lifecycle.test.tsx          # Component integration: create/toggle/edit/delete
    │           └── task-tag-flow.test.tsx           # Component integration: tag chips & removal
    └── e2e/
        └── tasks.spec.ts                            # Playwright E2E full task workflow test
```

---

## 2. Design Decisions & Discarded Alternatives

### 2.1 Decision 1: Pure Function for Deterministic Task Ordering (`compareTasks`)
- **Decision:** Encapsulate the sorting rules defined in `spec.md` Section 4.2 in a pure utility function `compareTasks(a: Task, b: Task): number` and `sortTasksByFilter(tasks: Task[], filter: TaskFilter): Task[]`.
  - Dated tasks sort chronologically by `dueDate` ascending.
  - Tasks on the same date with `dueTime` sort ascending; untimed tasks on that date sort after timed tasks (treated as end-of-day `23:59:59.999`).
  - Undated tasks follow dated tasks, sorted ascending by `createdAt`.
  - Tie-breaker: task `id` ascending.
  - Under `'todas'`, pending tasks appear first, completed tasks appear at the bottom.
- **Why:** Keeps sorting logic 100% deterministic, testable in isolation without React rendering, and free of side effects.
- **Discarded Alternative:** Sorting inline inside React component render loops or Zustand store getters without a pure comparator. Rejected because inline sorting causes inconsistent ordering and duplication.

### 2.2 Decision 2: Tag Association Contract via `tagIds: string[]`
- **Decision:** Associate tags to tasks by storing `tagIds?: string[]` (array of `Tag.id` references, defaulting to `[]`) on the `Task` entity, backed by `local-storage-tag-repository.ts` for group-scoped tags.
- **Why:** Satisfies SRS Appendix B conceptual model (`TAREA }o--o{ ETIQUETA : "usa"` and `GRUPO ||--o{ ETIQUETA : "posee"`). Enables fast lookup, clean Move/Copy tag synchronization by name, and straightforward tag removal scoping ("Solo de la tarea" vs "Del grupo").
- **Discarded Alternative:** Storing tag names directly as raw strings on the task without tag entities. Rejected because tags belong to groups (`RF-22`), have their own lifecycles, and must support group-wide removal and suggestions.

### 2.3 Decision 3: Minimal Standalone Repositories for Group and Tag Dependencies
- **Decision:** Implement minimal `LocalStorageGroupRepository` and `LocalStorageTagRepository` alongside `LocalStorageTaskRepository`.
  - `LocalStorageGroupRepository` seeds the default `SEED_PERSONAL_GROUP` (`REQ-TK-30`) if no groups exist, and lists individual groups for Move / Copy (`REQ-TK-19`).
  - `LocalStorageTagRepository` queries tags by group (`REQ-TK-24b`), creates new tags, and deletes tags from a group (`REQ-TK-26`).
- **Why:** Allows `001-tasks` to be completely functional, interactive, and testable end-to-end without waiting for `003-groups` or `004-tags`.
- **Discarded Alternative:** Mocking group and tag behavior purely in-memory in the component layer. Rejected because page refresh or E2E tests would lose data, violating repository boundary rules (Constitution Principle 3).

### 2.4 Decision 4: React Compiler Optimization & Minimal Custom Hook Footprint
- **Decision:** Leverage React 19.2 and React Compiler (`babel-plugin-react-compiler`). Custom hooks (`useTasks`, `useTaskForm`, `useTaskMoveCopy`) expose reactive store state and handlers without unnecessary manual `useMemo` or `useCallback` boilerplate, following project conventions in `AGENTS.md`.
- **Why:** React Compiler handles memoization automatically at the AST level, ensuring optimal re-render performance without cognitive overhead.
- **Discarded Alternative:** Manually wrapping every handler and derived array in `useCallback` and `useMemo`. Rejected per `AGENTS.md`: *"React Compiler is on: no manual useMemo/useCallback unless needed."*

### 2.5 Decision 5: Mobile-First Accessible Modals with React-Bootstrap
- **Decision:** Build modal dialogs (`TaskFormModal`, `TaskMoveCopyModal`, `TaskDeleteConfirmModal`, `TaskTagRemovalModal`) using React-Bootstrap `Modal`, ensuring keyboard trap, focus restoration, visible focus rings, and `aria-labelledby` / `aria-describedby` attributes in Spanish.
- **Why:** Guarantees strict accessibility compliance (`RNF-12`, `UI-01`) on mobile viewports (~375px) up to desktop without custom DOM manipulation.
- **Discarded Alternative:** Using native browser `confirm()` or `alert()`. Rejected because native dialogs cannot be styled, lack Spanish screen-reader accessibility, and fail Mobile-First UX standards.

---

## 3. Technical Implementation Details

### 3.1 Domain Contracts & Localization Extensions (`src/shared/`)

#### 3.1.1 Task Schema Extension (`src/shared/schemas/task.ts`)
Update `taskSchema` to include `tagIds`:
```typescript
export const taskSchema = z.object({
  id: idSchema,
  title: z
    .string()
    .trim()
    .min(LIMITS.TASK_TITLE_MIN, es.validation.minLength('El título de la tarea', LIMITS.TASK_TITLE_MIN))
    .max(LIMITS.TASK_TITLE_MAX, es.validation.maxLength('El título de la tarea', LIMITS.TASK_TITLE_MAX)),
  description: z
    .string()
    .trim()
    .max(LIMITS.TASK_DESCRIPTION_MAX, es.validation.maxLength('La descripción', LIMITS.TASK_DESCRIPTION_MAX))
    .nullable()
    .optional(),
  groupId: idSchema,
  tagIds: z.array(idSchema).default([]).optional(),
  completed: z.boolean(),
  createdAt: isoDateTimeSchema,
  completedAt: isoDateTimeSchema.nullable().optional(),
  dueDate: dueDateSchema.nullable().optional(),
  dueTime: dueTimeSchema.nullable().optional(),
  assigneeId: z.string().nullable().optional(),
  subtasks: z.array(subtaskSchema).max(LIMITS.SUBTASKS_MAX_COUNT).optional(),
  reminders: z.array(reminderSchema).max(LIMITS.REMINDERS_MAX_COUNT).optional(),
});
```

#### 3.1.2 Seed Group Constant (`src/shared/schemas/group.ts`)
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

#### 3.1.3 Spanish Localization Extension (`src/shared/i18n/es.ts`)
Append `tasks` namespace to `LocalizationDictionary` and `es` object per `spec.md` Section 4.6:
- `createTitle`: `'Nueva tarea'`
- `editTitle`: `'Editar tarea'`
- `titleLabel`: `'Título'`
- `titlePlaceholder`: `'Escribe el título de la tarea'`
- `descLabel`: `'Descripción'`
- `descPlaceholder`: `'Añade una descripción (opcional)'`
- `dueDateLabel`: `'Fecha de caducidad'`
- `dueTimeLabel`: `'Hora de caducidad'`
- `tagsLabel`: `'Etiquetas'`
- `tagsPlaceholder`: `'Escribe una etiqueta y presiona coma o punto y coma'`
- `filterPending`: `'Pendientes'`
- `filterCompleted`: `'Completadas'`
- `filterAll`: `'Todas'`
- `actionMenuAria`: `'Opciones de la tarea'`
- `actionEdit`: `'Editar'`
- `actionMove`: `'Mover a…'`
- `actionCopy`: `'Copiar a…'`
- `actionDelete`: `'Eliminar'`
- `deleteTitle`: `'Eliminar tarea'`
- `deleteMessage`: `'¿Estás seguro de que deseas eliminar esta tarea? Esta acción no se puede deshacer.'`
- `noOtherGroups`: `'No tienes otros grupos individuales disponibles para mover o copiar esta tarea.'`
- `tagOverflow`: `(count: number) => `+${count} más``
- `removeTagTitle`: `'Quitar etiqueta'`
- `removeTagPrompt`: `(tagName: string) => `¿Cómo deseas quitar la etiqueta "${tagName}"?``
- `removeOnlyFromTask`: `'Solo de la tarea'`
- `removeFromGroup`: `'Del grupo'`
- `badgeOverdue`: `'Vencida'`
- `emptyPending`: `'No hay tareas pendientes en este grupo'`
- `emptyCompleted`: `'No hay tareas completadas en este grupo'`
- `emptyAll`: `'No hay tareas en este grupo'`

### 3.2 Repositories & Data Access Layer (`src/data/`)

#### 3.2.1 Repository Contracts (`src/data/contracts/`)
- `TaskRepository`: Extends `Repository<Task>`, adds `getByGroupId(groupId: string): Promise<Task[]>`.
- `GroupRepository`: Extends `Repository<Group>`, adds `getIndividualGroups(): Promise<Group[]>`, `ensureSeedGroup(): Promise<Group>`.
- `TagRepository`: Extends `Repository<Tag>`, adds `getByGroupId(groupId: string): Promise<Tag[]>`, `findByName(groupId: string, name: string): Promise<Tag | null>`, `ensureTag(groupId: string, name: string): Promise<Tag>`, `deleteFromGroup(tagId: string): Promise<void>`.

#### 3.2.2 LocalStorage Implementations (`src/data/repositories/`)
- `LocalStorageTaskRepository`: Persists to `STORAGE_KEYS.TASKS` (`tbt:v1:tasks`) using `LocalStorageAdapter` with safe parsing against `z.array(taskSchema)`.
- `LocalStorageGroupRepository`: Persists to `STORAGE_KEYS.GROUPS` (`tbt:v1:groups`), auto-seeds `SEED_PERSONAL_GROUP` when empty.
- `LocalStorageTagRepository`: Persists to `STORAGE_KEYS.TAGS` (`tbt:v1:tags`) with case-insensitive name matching.

### 3.3 Deterministic Sorting Utility (`src/features/tasks/utils/task-sort.ts`)

Implements pure comparator functions:
```typescript
export function compareTasks(a: Task, b: Task): number {
  const hasDueA = Boolean(a.dueDate);
  const hasDueB = Boolean(b.dueDate);

  if (hasDueA && hasDueB) {
    if (a.dueDate !== b.dueDate) {
      return a.dueDate!.localeCompare(b.dueDate!);
    }
    const timeA = a.dueTime ?? '23:59:59.999';
    const timeB = b.dueTime ?? '23:59:59.999';
    if (timeA !== timeB) {
      return timeA.localeCompare(timeB);
    }
  }

  if (hasDueA !== hasDueB) {
    return hasDueA ? -1 : 1;
  }

  if (!hasDueA && !hasDueB) {
    if (a.createdAt !== b.createdAt) {
      return a.createdAt.localeCompare(b.createdAt);
    }
  }

  return a.id.localeCompare(b.id);
}

export type TaskFilter = 'pendientes' | 'completadas' | 'todas';

export function sortTasksByFilter(tasks: Task[], filter: TaskFilter): Task[] {
  const pending = tasks.filter((t) => !t.completed).sort(compareTasks);
  const completed = tasks.filter((t) => t.completed).sort(compareTasks);

  if (filter === 'pendientes') return pending;
  if (filter === 'completadas') return completed;
  return [...pending, ...completed];
}
```

### 3.4 Task Form Schema (`src/features/tasks/schemas/task-form-schema.ts`)

Validates form inputs with the due time dependency rule (`REQ-TK-04`):
```typescript
export const taskFormSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(LIMITS.TASK_TITLE_MIN, es.validation.minLength('El título de la tarea', LIMITS.TASK_TITLE_MIN))
      .max(LIMITS.TASK_TITLE_MAX, es.validation.maxLength('El título de la tarea', LIMITS.TASK_TITLE_MAX)),
    description: z
      .string()
      .trim()
      .max(LIMITS.TASK_DESCRIPTION_MAX, es.validation.maxLength('La descripción', LIMITS.TASK_DESCRIPTION_MAX))
      .optional()
      .or(z.literal('')),
    dueDate: dueDateSchema.optional().or(z.literal('')),
    dueTime: dueTimeSchema.optional().or(z.literal('')),
    tagNames: z.array(z.string().trim().min(1).max(30)).default([]),
    groupId: z.string().min(1),
  })
  .refine(
    (data) => {
      if (data.dueTime && !data.dueDate) {
        return false;
      }
      return true;
    },
    {
      message: 'Debes indicar una fecha de caducidad para poder especificar la hora',
      path: ['dueTime'],
    },
  );

export type TaskFormData = z.infer<typeof taskFormSchema>;
```

### 3.5 Zustand Feature Store (`src/features/tasks/store/tasks-store.ts`)

Store architecture:
- **State:**
  - `tasks: Task[]`
  - `groups: Group[]`
  - `tags: Tag[]`
  - `activeGroupId: string` (default: `'group-personal'`)
  - `activeFilter: TaskFilter` (default: `'pendientes'`)
  - `isLoading: boolean`
  - `error: string | null`
  - `modalState`: tracking active modal (`create`, `edit`, `move`, `copy`, `delete`, `tagRemoval`) and active task ID.
- **Actions:**
  - `init()`: Loads initial groups (auto-seeding Personal if empty), loads tags and tasks for active group.
  - `setActiveGroup(groupId)`: Switches active group, reloads group tasks and tags.
  - `setActiveFilter(filter)`: Updates active filter.
  - `createTask(payload)`: Synchronizes tags in group, creates task record, updates store state.
  - `updateTask(taskId, payload)`: Synchronizes tags, updates task attributes.
  - `deleteTask(taskId)`: Removes task record.
  - `toggleTaskComplete(taskId)`: Toggles `completed`, records/clears `completedAt` timestamp.
  - `moveTask(taskId, targetGroupId)`: Reassigns `groupId`, synchronizes tags by name to target group, preserves `createdAt`.
  - `copyTask(taskId, targetGroupId)`: Creates clone in target group with new `id`, current `createdAt`, synchronizes tags by name.
  - `removeTagFromTask(taskId, tagId)`: Dissociates tag from task.
  - `deleteTagFromGroup(tagId)`: Deletes tag from group and strips from all tasks.

### 3.6 UI Components (`src/features/tasks/components/`)

- **`TaskCard.tsx`:**
  - Completion checkbox (`Form.Check`) with descriptive `aria-label`.
  - Title: strikethrough styling if completed.
  - Visual Overdue (`REQ-TK-11`, `UI-04`, `RNF-12`): Evaluated via `isTaskOverdue({ dueDate, dueTime, completed })`. If pending and overdue, applies `border-danger text-danger` and renders `<Badge bg="danger">Vencida</Badge>`.
  - Completed Overdue (`REQ-TK-14`): If completed, strikethrough only, no red, no "Vencida" badge.
  - Tag chips: Displays up to 5 tag badges; renders `+N más` overflow badge if > 5.
  - Action Menu: React-Bootstrap `Dropdown` with three-dots icon (`UI-03`), items: "Editar", "Mover a…", "Copiar a…", "Eliminar".
- **`TaskList.tsx`:**
  - Consumes sorted tasks via `sortTasksByFilter`. Renders empty states when count is 0.
- **`TaskFilterTabs.tsx`:**
  - Nav tabs / ButtonGroup with counts: `Pendientes (N)`, `Completadas (N)`, `Todas (N)`.
- **`TaskFormModal.tsx`:**
  - Create/Edit dialog using React Hook Form + Zod.
  - Title, description, date picker, time picker (disabled if date empty).
  - Integrates `TaskTagInput`.
- **`TaskTagInput.tsx`:**
  - Input field intercepting `;` and `,` key presses.
  - Renders tag chips with delete buttons.
  - Autocomplete suggestion dropdown querying group tags matching typed text.
- **`TaskTagRemovalModal.tsx`:**
  - Confirmation dialog asking: "Solo de la tarea" vs "Del grupo".
- **`TaskMoveCopyModal.tsx`:**
  - Dialog listing user's other individual groups (`id !== task.groupId`).
  - Displays empty-state message and disables confirm button when count is 0 (`REQ-TK-19b`).
- **`TaskDeleteConfirmModal.tsx`:**
  - Destructive confirmation dialog (`UI-06`, `REQ-TK-07`).
- **`TasksView.tsx`:**
  - Main container rendering navbar header, active group badge, "Nueva tarea" button, filter tabs, task list, and modal dialogs.

### 3.7 Application Integration (`src/App.tsx`, `src/main.tsx`)

- `src/main.tsx`: Import `bootstrap/dist/css/bootstrap.min.css`.
- `src/App.tsx`: Mount `TasksView` within a responsive container (`container-md py-4`).

---

## 4. Verification & Testing Strategy

### 4.1 Unit Tests (`tests/unit/`)
1. **`task-sort.test.ts`:**
   - Dated tasks sort ascending by `dueDate` + `dueTime`.
   - Untimed tasks on that date sort after timed tasks on the same date.
   - Undated tasks sort after dated tasks, ordered by `createdAt` ascending.
   - Tie-breaker sorts by `id` ascending.
   - Filter `'pendientes'` returns only pending; `'completadas'` returns only completed; `'todas'` returns all pending followed by all completed.
2. **`task-form-schema.test.ts`:**
   - Validates title length bounds (2..100).
   - Validates description length bound (max 750).
   - Validates `dueTime` without `dueDate` rejection rule (`REQ-TK-04`).
3. **`tasks-store.test.ts`:**
   - Initial seed group provisioning when storage is empty (`REQ-TK-30`).
   - Create task persists with `completed: false` and auto `createdAt`.
   - Toggle completion sets/clears `completedAt`.
   - Move task preserves `id`, `createdAt`, updates `groupId`, syncs tags.
   - Copy task generates new `id`, current `createdAt`, syncs tags.
   - Tag removal scope: from task only vs from group.
4. **`local-storage-task-repository.test.ts` & `local-storage-tag-repository.test.ts`:**
   - Repository CRUD, filtering by `groupId`, tag name case-insensitive matching.

### 4.2 Integration Tests (`tests/integration/`)
1. **`task-lifecycle.test.tsx` (RTL):**
   - Renders `TasksView`, opens create modal, fills title & date, submits -> task appears in list.
   - Marks task complete -> strikethrough applied, moves to completed tab.
   - Toggles overdue task -> red styling + "Vencida" badge shown; once completed, red and badge disappear.
   - Deletes task -> confirmation modal opens, confirming removes task.
2. **`task-tag-flow.test.tsx` (RTL):**
   - Enters tag with `;` or `,` -> chip appears.
   - Selects autocomplete suggestion -> existing tag reused.
   - Removes chip -> prompt dialog opens, choosing "Solo de la tarea" vs "Del grupo".
3. **`task-move-copy.test.tsx` (RTL):**
   - Opening Move/Copy when only 1 group exists -> displays empty-state message and disables confirm button.
   - With 2 groups -> moving reassigns group and preserves creation date.

### 4.3 End-to-End Tests (`tests/e2e/tasks.spec.ts`)
1. **Playwright E2E Workflow:**
   - Navigates to app root.
   - Creates a pending task with a due date.
   - Creates a past-due task and verifies the "Vencida" text badge and red styling render in browser.
   - Marks task complete and verifies strikethrough styling.
   - Switches between "Pendientes", "Completadas", and "Todas" tabs.
   - Opens three-dots menu and deletes task through confirmation modal.

---

## 5. Requirement Traceability Matrix

| Requirement | Plan Section | Target Components |
| :--- | :--- | :--- |
| **REQ-TK-01, REQ-TK-02, REQ-TK-03** | 3.1, 3.4, 3.5 | `taskFormSchema.ts`, `tasks-store.ts`, `TaskFormModal.tsx` |
| **REQ-TK-04, REQ-TK-05** | 3.4 | `taskFormSchema.ts` (dueTime refinement & Zod limits) |
| **REQ-TK-06, REQ-TK-07, REQ-TK-08** | 3.5, 3.6 | `TaskFormModal.tsx`, `TaskDeleteConfirmModal.tsx`, `tasks-store.ts` |
| **REQ-TK-09, REQ-TK-10** | 3.5, 3.6 | `TaskCard.tsx` (completion checkbox), `tasks-store.ts` |
| **REQ-TK-11, REQ-TK-12, REQ-TK-13, REQ-TK-14, REQ-TK-15** | 3.6 | `TaskCard.tsx` (visual overdue matrix, strikethrough, badge) |
| **REQ-TK-16, REQ-TK-17** | 3.3 | `task-sort.ts` (`compareTasks`, `sortTasksByFilter`) |
| **REQ-TK-18, REQ-TK-19, REQ-TK-19b, REQ-TK-20, REQ-TK-21, REQ-TK-22, REQ-TK-23** | 3.5, 3.6 | `TaskMoveCopyModal.tsx`, `TaskCard.tsx`, `tasks-store.ts` |
| **REQ-TK-24, REQ-TK-24b, REQ-TK-24c, REQ-TK-24d, REQ-TK-25, REQ-TK-26** | 3.5, 3.6 | `TaskTagInput.tsx`, `TaskTagRemovalModal.tsx`, `TaskCard.tsx` |
| **REQ-TK-27, REQ-TK-28, REQ-TK-29** | 3.6, 3.7 | `TasksView.tsx`, `TaskCard.tsx`, `date-time.ts`, React-Bootstrap |
| **REQ-TK-30, REQ-TK-31, REQ-TK-32** | 3.1, 3.2, 3.5 | `group.ts` (`SEED_PERSONAL_GROUP`), `LocalStorageGroupRepository.ts` |
| **AC-TK-01 .. AC-TK-11** | 4.1 - 4.3 | Unit, integration, and Playwright E2E test suites |

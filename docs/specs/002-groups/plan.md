# Implementation Plan: 002-groups (Groups Management & Grid View)

- **Feature Name:** `002-groups`
- **Spec Reference:** [`docs/specs/002-groups/spec.md`](file:///C:/Users/crist/Documentos/GitHub/PERSONAL/PROJECTS-FULLSTACK/TaskByTask/react-frontend-taskByTask/docs/specs/002-groups/spec.md) (Status: `approved`)
- **Plan Status:** Draft

---

## 1. Architecture & Folder Structure Overview

This plan defines the technical implementation for **002-groups**, implementing group lifecycle operations (`RF-06`, `RF-07`), the primary **Groups Grid View** (`RF-24`, `UI-02`), and combinable basic filters (`RF-25`, Appendix C). It builds upon `000-foundation` and `001-tasks` (Golden Reference), maintaining 100% backwards compatibility with existing task workflows and automated test suites.

### 1.1 Target File Layout

```
react-frontend-taskByTask/
├── src/
│   ├── App.tsx                                      # [Updated: renders GroupsGridView with task compatibility]
│   ├── shared/
│   │   ├── i18n/
│   │   │   ├── es.ts                                # [groups namespace extension]
│   │   │   └── index.ts
│   │   └── schemas/
│   │       ├── group.ts                             # (Existing canonical schema & SEED_PERSONAL_GROUP)
│   │       └── index.ts
│   ├── data/
│   │   ├── contracts/
│   │   │   ├── task-repository.ts                   # [Added deleteByGroupId contract]
│   │   │   ├── tag-repository.ts                    # [Added deleteByGroupId contract]
│   │   │   ├── group-repository.ts                  # (Existing group contract)
│   │   │   └── index.ts
│   │   └── repositories/
│   │       ├── local-storage-task-repository.ts     # [Implemented deleteByGroupId]
│   │       ├── local-storage-tag-repository.ts      # [Implemented deleteByGroupId]
│   │       ├── local-storage-group-repository.ts    # [Cascade deletion coordination]
│   │       └── index.ts
│   └── features/
│       ├── tasks/                                   # (Golden Reference module preserved)
│       │   ├── components/
│       │   │   ├── TaskCard.tsx                     # Reused inside GroupCard
│       │   │   ├── TaskFormModal.tsx                # Reused for task creation/editing
│       │   │   ├── TaskMoveCopyModal.tsx            # Reused for Move/Copy
│       │   │   ├── TaskDeleteConfirmModal.tsx       # Reused for task deletion
│       │   │   └── TaskTagRemovalModal.tsx          # Reused for tag removal
│       │   └── store/
│       │       └── tasks-store.ts                   # Full-hydration support across all groups
│       └── groups/                                  # NEW FEATURE MODULE
│           ├── index.ts                             # Public feature barrel export
│           ├── schemas/
│           │   ├── group-form-schema.ts             # RHF + Zod validation schema (3..30 chars)
│           │   └── index.ts
│           ├── utils/
│           │   ├── group-sort.ts                    # compareGroups (Personal first, createdAt asc)
│           │   ├── filter-tasks.ts                  # filterTasksByCriteria (main filter + search)
│           │   └── index.ts
│           ├── store/
│           │   ├── groups-store.ts                  # Zustand groups store (selectedGroupIds, query)
│           │   └── index.ts
│           ├── hooks/
│           │   ├── use-groups.ts                    # Hook for visible groups, counts, actions
│           │   ├── use-group-form.ts                # Hook for create/rename form controller
│           │   └── index.ts
│           └── components/
│               ├── GroupCard.tsx                    # Card for each group with header, menu, tasks
│               ├── GroupsFilterToolbar.tsx          # Search bar, filter tabs, multi-group selector
│               ├── GroupFormModal.tsx               # Create & Rename group dialog
│               ├── GroupDeleteConfirmModal.tsx      # Irreversible cascade deletion warning dialog
│               ├── GroupsGridView.tsx               # Primary application view
│               └── index.ts
└── tests/
    ├── unit/
    │   ├── features/
    │   │   └── groups/
    │   │       ├── group-sort.test.ts               # compareGroups unit tests
    │   │       ├── filter-tasks.test.ts             # filterTasksByCriteria unit tests
    │   │       ├── group-form-schema.test.ts        # Group name boundary validation tests
    │   │       └── groups-store.test.ts             # Groups store actions & cascade tests
    │   └── data/
    │       ├── local-storage-task-repository.test.ts # Added deleteByGroupId unit tests
    │       ├── local-storage-tag-repository.test.ts  # Added deleteByGroupId unit tests
    │       └── local-storage-group-repository.test.ts # Updated cascade & error tests
    ├── integration/
    │   └── features/
    │       └── groups/
    │           ├── groups-grid-view.test.tsx        # RTL test: grid rendering, search, filters
    │           └── group-lifecycle.test.tsx         # RTL test: create, rename, cascade delete
    └── e2e/
        ├── tasks.spec.ts                            # Preserved regression test
        └── groups.spec.ts                           # Playwright E2E full groups workflow test
```

---

## 2. Design Decisions & Discarded Alternatives

### 2.1 Decision 1: Full State Hydration Contract (`REQ-GRP-16b`)
- **Decision:** On application startup and manual refresh (`refresh()`), the system hydrates all user groups (`groupRepository.getAll()`), all tasks across all groups (`taskRepository.getAll()`), and all tags across all groups (`tagRepository.getAll()`) into memory.
- **Why:** In the Groups Grid View (`RF-24`, `UI-02`), multiple group cards are rendered simultaneously, each displaying its own tasks. Hydrating all tasks and tags upfront avoids waterfall network/storage calls per group card, enables instant real-time filtering across groups (`RF-25`), and allows instant Move/Copy operations without re-fetching.
- **Discarded Alternative:** Lazy-loading tasks individually per group card on render. Rejected because it triggers N+1 storage queries, creates rendering flickers during title search across groups, and complicates global count badges.

### 2.2 Decision 2: Deterministic Group Sorting via Pure Function (`compareGroups`)
- **Decision:** Implement `compareGroups(a: Group, b: Group): number` as a pure comparator:
  1. The default "Personal" group (`isPersonal === true`) is always ordered first.
  2. All other individual groups (`isPersonal === false`) are ordered ascending by `createdAt` (oldest first).
  3. Tie-breaker: `id` ascending.
- **Why:** Satisfies `REQ-GRP-12b` and guarantees consistent visual positioning across renders, browser reloads, and multi-device sessions.
- **Discarded Alternative:** Sorting groups by name alphabetically or leaving them in arbitrary storage order. Rejected because the "Personal" group must remain anchored as the primary container, and arbitrary order disorients users when groups are added.

### 2.3 Decision 3: Multi-Group Filter State Architecture (`selectedGroupIds: string[]`)
- **Decision:** Group filtering state is modeled as `selectedGroupIds: string[]`, where an empty array `[]` represents "Todos los grupos" (all groups visible). When one or more IDs are present, only those group cards are rendered in the grid.
- **Why:** Directly fulfills SRS `RF-25` ("Grupo: permite seleccionar uno o varios grupos") and Appendix C. The UI provides toggleable pill buttons for each group and an explicit "Todos los grupos" reset button.
- **Discarded Alternative:** Modeling group filter as a single nullable string (`selectedGroupId: string | null`). Rejected because SRS `RF-25` explicitly requires selecting one *or multiple* groups simultaneously.

### 2.4 Decision 4: Cascade Deletion at Repository & Store Boundary
- **Decision:** Add `deleteByGroupId(groupId: string)` to `TaskRepository` and `TagRepository`. When `deleteGroup(groupId)` is invoked:
  1. The group repository verifies the group exists (throws `NotFoundError` if missing per `REQ-GRP-11b`) and verifies `!isPersonal` (throws `BusinessRuleViolationError` if `isPersonal === true` per `REQ-GRP-11`).
  2. The group repository deletes the group record.
  3. The task repository cascade-deletes all tasks with `groupId === targetGroupId`.
  4. The tag repository cascade-deletes all tags with `groupId === targetGroupId`.
  5. The store removes the group's tasks from memory and removes `groupId` from `selectedGroupIds`, falling back to `[]` if no selected groups remain (`REQ-GRP-10b`).
- **Why:** Completely preserves data integrity, prevents orphaned tasks/tags in `localStorage`, and cleanly fulfills `RF-07` and `UI-06`.
- **Discarded Alternative:** Deleting only the group and leaving orphaned tasks in storage. Rejected because orphaned records violate integrity and bloat storage.

### 2.5 Decision 5: Non-Breaking Integration with `001-tasks` in `App.tsx`
- **Decision:** Design `GroupsGridView` so that it seamlessly satisfies `RF-24` and `UI-02` while preserving all elements expected by `tasks.spec.ts` (heading "Task by Task", active group select with `aria-label="Cambiar grupo activo"`, `header span.fw-semibold` with text "Personal", `.task-list .card`, "+ Nueva tarea" button). In addition, `App.tsx` supports view switching between `GroupsGridView` (default) and `TasksView`.
- **Why:** Guarantees zero regression on existing automated test suites (193 Vitest tests and `tasks.spec.ts` E2E) while promoting the Groups Grid View to the primary user interface.
- **Discarded Alternative:** Replacing `TasksView` completely and rewriting `tasks.spec.ts`. Rejected to respect SDD regression-free principles.

---

## 3. Technical Implementation Details

### 3.1 Data Access Layer Extensions (`src/data/`)

#### 3.1.1 TaskRepository Extension (`src/data/contracts/task-repository.ts`)
```typescript
export interface TaskRepository extends Repository<Task> {
  getByGroupId(groupId: string): Promise<Task[]>;
  deleteByGroupId(groupId: string): Promise<void>;
}
```

Implementation in `src/data/repositories/local-storage-task-repository.ts`:
```typescript
async deleteByGroupId(groupId: string): Promise<void> {
  const tasks = await this.getAll();
  const updatedTasks = tasks.filter((t) => t.groupId !== groupId);
  this.storageAdapter.setItem(STORAGE_KEYS.TASKS, z.array(taskSchema), updatedTasks);
}
```

#### 3.1.2 TagRepository Extension (`src/data/contracts/tag-repository.ts`)
```typescript
export interface TagRepository extends Repository<Tag> {
  getByGroupId(groupId: string): Promise<Tag[]>;
  findByName(groupId: string, name: string): Promise<Tag | null>;
  ensureTag(groupId: string, name: string): Promise<Tag>;
  deleteFromGroup(tagId: string): Promise<void>;
  deleteByGroupId(groupId: string): Promise<void>;
}
```

Implementation in `src/data/repositories/local-storage-tag-repository.ts`:
```typescript
async deleteByGroupId(groupId: string): Promise<void> {
  const tags = await this.getAll();
  const updatedTags = tags.filter((t) => t.groupId !== groupId);
  this.storageAdapter.setItem(STORAGE_KEYS.TAGS, z.array(tagSchema), updatedTags);
}
```

#### 3.1.3 GroupRepository (`src/data/repositories/local-storage-group-repository.ts`)
Already enforces `NotFoundError` if group does not exist and `BusinessRuleViolationError` if `isPersonal === true`. Verified and maintained.

### 3.2 Spanish Localization Extension (`src/shared/i18n/es.ts`)

Append `groups: GroupsLocalization` to `LocalizationDictionary` and `es` object per `spec.md` Section 4.6:
- `gridTitle`: `'Mis Grupos'`
- `createGroupButton`: `'Nuevo grupo'`
- `searchPlaceholder`: `'Buscar tareas por título...'`
- `filterGroupLabel`: `'Filtrar por grupo'`
- `allGroupsOption`: `'Todos los grupos'`
- `refreshButton`: `'Refrescar'`
- `addTaskToGroup`: `'Nueva tarea'`
- `personalBadge`: `'Personal'`
- `actionRename`: `'Renombrar'`
- `actionDelete`: `'Eliminar'`
- `createModalTitle`: `'Crear nuevo grupo'`
- `renameModalTitle`: `'Renombrar grupo'`
- `nameLabel`: `'Nombre del grupo'`
- `namePlaceholder`: `'Ej. Universidad, Proyecto, Trabajo'`
- `deleteModalTitle`: `'Eliminar grupo'`
- `deleteModalWarning`: `(groupName: string) => "¿Estás seguro de que deseas eliminar el grupo \"" + groupName + "\"? Todas sus tareas y etiquetas se eliminarán de forma permanente. Esta acción no se puede deshacer."`
- `cannotDeletePersonal`: `'El grupo Personal no se puede eliminar.'`
- `emptyGroupTasks`: `'No hay tareas que coincidan con los filtros en este grupo.'`
- `emptySearchGlobal`: `'No se encontraron tareas con el título especificado.'`
- `taskCount`: `(count: number) => count + " " + (count === 1 ? "tarea" : "tareas")`

### 3.3 Pure Utilities (`src/features/groups/utils/`)

#### 3.3.1 Group Sorting (`group-sort.ts`)
```typescript
export function compareGroups(a: Group, b: Group): number {
  if (a.isPersonal !== b.isPersonal) {
    return a.isPersonal ? -1 : 1;
  }
  if (a.createdAt !== b.createdAt) {
    return a.createdAt.localeCompare(b.createdAt);
  }
  return a.id.localeCompare(b.id);
}

export function sortGroups(groups: Group[]): Group[] {
  return [...groups].sort(compareGroups);
}
```

#### 3.3.2 Multi-Criteria Task Filtering (`filter-tasks.ts`)
```typescript
export interface TaskFilterCriteria {
  filter: TaskFilter; // 'pendientes' | 'completadas' | 'todas'
  searchQuery?: string;
  groupId?: string;
}

export function filterTasksByCriteria(tasks: Task[], criteria: TaskFilterCriteria): Task[] {
  let filtered = tasks;

  if (criteria.groupId) {
    filtered = filtered.filter((t) => t.groupId === criteria.groupId);
  }

  if (criteria.filter === 'pendientes') {
    filtered = filtered.filter((t) => !t.completed);
  } else if (criteria.filter === 'completadas') {
    filtered = filtered.filter((t) => t.completed);
  }

  if (criteria.searchQuery && criteria.searchQuery.trim().length > 0) {
    const q = criteria.searchQuery.trim().toLowerCase();
    filtered = filtered.filter((t) => t.title.toLowerCase().includes(q));
  }

  return sortTasksByFilter(filtered, criteria.filter);
}
```

### 3.4 Group Form Validation Schema (`src/features/groups/schemas/group-form-schema.ts`)

```typescript
export const groupFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(LIMITS.GROUP_NAME_MIN, es.validation.minLength(es.groups.nameLabel, LIMITS.GROUP_NAME_MIN))
    .max(LIMITS.GROUP_NAME_MAX, es.validation.maxLength(es.groups.nameLabel, LIMITS.GROUP_NAME_MAX)),
});

export type GroupFormInput = z.infer<typeof groupFormSchema>;
```

### 3.5 Zustand Groups Store (`src/features/groups/store/groups-store.ts`)

- **State:**
  - `groups: Group[]`
  - `selectedGroupIds: string[]` (`[]` = all groups visible)
  - `searchQuery: string`
  - `activeFilter: TaskFilter` (`'pendientes'` default)
  - `modalState`: `{ type: 'create' | 'rename' | 'delete' | null, group: Group | null }`
  - `isLoading: boolean`
  - `error: string | null`
- **Actions:**
  - `init()`:
    1. Ensures seed group (`groupRepository.ensureSeedGroup()`).
    2. Loads all groups (`groupRepository.getAll()`).
    3. Hydrates all tasks and tags via `useTasksStore.getState().init()`.
  - `createGroup(name: string)`:
    Generates ID, sets `creatorId: 'local-user'`, `isPersonal: false`, `type: 'individual'`, `members: [...]`, saves, updates list.
  - `renameGroup(groupId: string, newName: string)`:
    Validates group exists, updates `name`, saves, updates list.
  - `deleteGroup(groupId: string)`:
    Verifies group exists (throws `NotFoundError` if missing), verifies `!isPersonal` (throws `BusinessRuleViolationError` if personal).
    Calls `groupRepository.delete`, `taskRepository.deleteByGroupId`, `tagRepository.deleteByGroupId`.
    Removes `groupId` from `groups` and `selectedGroupIds` (falling back to `[]` if empty).
    Updates tasks in `useTasksStore`.
  - `refresh()`:
    Re-fetches groups and calls `useTasksStore.getState().init()` without page reload.
  - `setSelectedGroupIds(ids: string[])`
  - `toggleGroupId(id: string)`: toggles a group ID in `selectedGroupIds`.
  - `setSearchQuery(query: string)`
  - `setActiveFilter(filter: TaskFilter)`
  - `openModal(type, group)`
  - `closeModal()`

### 3.6 UI Components (`src/features/groups/components/`)

- **`GroupCard.tsx`:**
  - Responsive card (`.card`) displaying group header, "Personal" badge (if personal), matching task count badge, and three-dots context menu.
  - Three-dots menu: "Renombrar" opens rename modal; "Eliminar" opens delete modal (omitted for "Personal" group).
  - Tasks list container: `<div className="task-list d-flex flex-column gap-2">` rendering `TaskCard` for each matching task.
  - Empty state: Displays `es.groups.emptyGroupTasks` when matching task count is 0.
  - Action footer button: `+ Nueva tarea` (`es.groups.addTaskToGroup`) opening `TaskFormModal` with `groupId` pre-selected.
- **`GroupsFilterToolbar.tsx`:**
  - Search input with search icon, clear button, and `aria-label`.
  - Main status filter tabs (`Pendientes (N)`, `Completadas (N)`, `Todas (N)`), displaying matching task counts across all currently visible groups.
  - Multi-group selector: "Todos los grupos" pill plus toggleable pills for each group.
  - Action buttons: "+ Nuevo grupo" and "Refrescar".
- **`GroupFormModal.tsx`:**
  - Create and Rename modal dialog using React Hook Form + Zod.
- **`GroupDeleteConfirmModal.tsx`:**
  - Warning modal warning of permanent loss of all tasks and tags.
- **`GroupsGridView.tsx`:**
  - Assembles header, search alert banner (`emptySearchGlobal`), toolbar, responsive grid (`<Row xs={1} md={2} lg={3} className="g-3">`), and renders modal dialogs.

### 3.7 Application Integration (`src/App.tsx`)

`App.tsx` renders `GroupsGridView` as the primary application view (`RF-24`, `UI-02`):
```tsx
import { GroupsGridView } from './features/groups';

export function App() {
  return <GroupsGridView />;
}

export default App;
```

---

## 4. Verification & Testing Strategy

### 4.1 Unit Tests (`tests/unit/`)
1. **`group-sort.test.ts`:**
   - "Personal" group always sorts first.
   - Remaining groups sort ascending by `createdAt`.
   - Deterministic tie-breaker by `id` ascending.
2. **`filter-tasks.test.ts`:**
   - Filters tasks by `groupId`, main filter (`pendientes`/`completadas`/`todas`), and title substring search (case-insensitive).
   - Combines all three criteria simultaneously.
3. **`group-form-schema.test.ts`:**
   - Validates name boundaries: rejects < 3 chars or > 30 chars, trims whitespace.
4. **`groups-store.test.ts`:**
   - Initialization ensures seed group and hydrates all tasks/tags.
   - `createGroup` adds group.
   - `renameGroup` updates name.
   - `deleteGroup` cascade-deletes tasks and tags, prevents deletion of "Personal" group, and updates `selectedGroupIds`.
5. **`local-storage-task-repository.test.ts` & `local-storage-tag-repository.test.ts`:**
   - Tests `deleteByGroupId` removes all matching entities.

### 4.2 Integration Tests (`tests/integration/`)
1. **`groups-grid-view.test.tsx` (RTL):**
   - Renders `GroupsGridView` with multiple groups and tasks.
   - Tests multi-group selector filtering, title search query, and global tab count updates.
   - Tests manual refresh re-fetching state.
   - Tests global empty search alert banner.
2. **`group-lifecycle.test.tsx` (RTL):**
   - Opens create group modal, submits -> new group appears in grid.
   - Opens rename modal -> updates group title in grid.
   - Opens delete modal on individual group -> displays warning, confirms -> group, tasks, and tags disappear.
   - Verifies "Personal" group does not show delete option.

### 4.3 End-to-End Tests (`tests/e2e/`)
1. **`tasks.spec.ts`:**
   - Regression test: verifies all existing task workflows pass cleanly against `GroupsGridView`.
2. **`groups.spec.ts` (Playwright):**
   - Tests loading grid with default "Personal" group.
   - Creates a new group "Universidad".
   - Renames "Universidad" to "Facultad".
   - Creates tasks in "Personal" and "Facultad".
   - Searches for tasks across groups by title.
   - Filters by specific group pill.
   - Deletes "Facultad" and verifies all its tasks are cascade-deleted.
   - Verifies "Personal" group cannot be deleted.

---

## 5. Requirement Traceability Matrix

| Requirement | Plan Section | Target Components |
| :--- | :--- | :--- |
| **REQ-GRP-01, REQ-GRP-02, REQ-GRP-03** | 3.3, 3.4, 3.5 | `group-form-schema.ts`, `groups-store.ts`, `GroupFormModal.tsx` |
| **REQ-GRP-04, REQ-GRP-04b, REQ-GRP-05, REQ-GRP-06** | 3.4, 3.6 | `group-form-schema.ts`, `GroupCard.tsx` (omits shared controls) |
| **REQ-GRP-07, REQ-GRP-08** | 3.5, 3.6 | `GroupFormModal.tsx`, `groups-store.ts` |
| **REQ-GRP-09, REQ-GRP-10, REQ-GRP-10b** | 3.1, 3.5, 3.6 | `GroupDeleteConfirmModal.tsx`, `groups-store.ts`, `deleteByGroupId` |
| **REQ-GRP-11, REQ-GRP-11b** | 3.1, 3.5 | `local-storage-group-repository.ts`, `groups-store.ts` |
| **REQ-GRP-12, REQ-GRP-12b, REQ-GRP-13, REQ-GRP-14** | 3.3, 3.6 | `group-sort.ts`, `GroupCard.tsx`, `TaskCard.tsx` |
| **REQ-GRP-15** | 3.6 | `GroupCard.tsx` (+ Nueva tarea opens `TaskFormModal` with `groupId`) |
| **REQ-GRP-16, REQ-GRP-16b** | 2.1, 3.5 | `groups-store.ts` (`refresh()`, full hydration of tasks & tags) |
| **REQ-GRP-17, REQ-GRP-18, REQ-GRP-19, REQ-GRP-20, REQ-GRP-21** | 3.3, 3.6 | `filter-tasks.ts`, `GroupsFilterToolbar.tsx` |
| **REQ-GRP-22, REQ-GRP-23** | 3.6 | `GroupCard.tsx` (empty group), `GroupsGridView.tsx` (global search alert) |
| **REQ-GRP-24, REQ-GRP-25, REQ-GRP-26** | 3.2, 3.6, 3.7 | `es.ts`, React-Bootstrap responsive layout, keyboard accessibility |
| **AC-GRP-01 .. AC-GRP-13** | 4.1 - 4.3 | Unit, integration, and Playwright E2E test suites |

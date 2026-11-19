# Spec 002: Groups Management & Groups Grid View

- **Feature Name:** `002-groups`
- **Status:** implemented
- **Created Date:** 2026-11-05
- **Authors:** SDD Planner Agent
- **SRS / SVD References:** `RF-06`, `RF-07`, `RF-24`, `RF-25`, `UI-01`, `UI-02`, `UI-05`, `UI-06`, `RNF-01`, `RNF-04`, `RNF-07`, `RNF-12`, `RNF-14`, `RNF-16`, `RNF-18`, `RNF-19`, `RNF-20`, `Appendix A`, `Appendix B`, `Appendix C`, `Constitution Principles 1–6`

---

## 1. Purpose & Background

### 1.1 Purpose
Define the functional requirements, validation boundaries, lifecycle operations, deterministic multi-group layout, hydration architecture, and combinable basic filtering for Groups in Task by Task. This specification covers SRS requirements `RF-06` (Personal and individual groups), `RF-07` (Renaming and deleting groups), `RF-24` (Groups grid view), and `RF-25` (Combinable basic filters), respecting UI requirements (`UI-01`, `UI-02`, `UI-05`, `UI-06`) and non-functional requirements (`RNF-01`, `RNF-04`, `RNF-07`, `RNF-12`, `RNF-14`, `RNF-16`, `RNF-18`, `RNF-19`, `RNF-20`).

### 1.2 Background
In Task by Task, Groups serve as the fundamental containers for tasks and tags. Every user begins with a default "Personal" group that is individual and can be renamed, but can never be deleted or shared. Users can also create an unlimited number of individual groups to organize different spheres of their life (study, work, personal).

Per SRS `RF-24` and `UI-02`, the primary default screen of the application is the **Groups Grid View** ("Vista de grupos"), displaying all user groups in a responsive, Mobile-First grid where each group card presents its own tasks sorted deterministically. Users can filter tasks simultaneously using three combinable criteria (`RF-25`): main status (`'pendientes'`, `'completadas'`, `'todas'`), title substring search, and specific group selection (`selectedGroupIds: string[]`).

---

## 2. Scope

### 2.1 In Scope
1. **Group Provisioning & Creation (`RF-06`):**
   - Guarantee the existence of the default "Personal" group (`isPersonal: true`) on application startup.
   - Creation of unlimited individual groups with name (3 to 30 characters, trimmed).
   - Identity invariant: "Personal" group status is determined strictly by the immutable boolean `isPersonal: true` (not by its name string). Group names are validated against Appendix B limits without artificial uniqueness constraints across groups.
   - Omission of shared group functionality (members list, roles, task assignments, invites) in individual groups (`UI-05`).
2. **Group Renaming & Deletion (`RF-07`, `UI-06`, `RNF-07`, `RNF-18`):**
   - Renaming any group (including "Personal") with validation (3 to 30 characters).
   - Deletion of non-personal individual groups (`isPersonal === false`).
   - Strict invariant: The "Personal" group can never be deleted (`BusinessRuleViolationError`).
   - Prior confirmation modal warning that deleting a group will permanently remove all its tasks and tags (`UI-06`).
   - Cascade deletion: deleting a group permanently removes all its tasks (`Task.groupId === groupId`) and tags (`Tag.groupId === groupId`).
   - Graceful fallback: deleting an active group automatically removes its `id` from `selectedGroupIds`; if no selected groups remain, it falls back to "Todos los grupos" (`[]`).
   - Controlled `NotFoundError` when targeting a non-existent group ID (`RNF-18`).
3. **Groups Grid View & Deterministic Group Ordering (`RF-24`, `UI-01`, `UI-02`, `RNF-16`):**
   - Responsive Mobile-First grid layout: single-column stack on mobile viewports (~375px) and multi-column grid on tablet and desktop.
   - Deterministic group ordering: "Personal" (`isPersonal: true`) is always positioned first; remaining groups are ordered ascending by `createdAt` (oldest first), with `id` ascending as tie-breaker.
   - Group card composition: group header (name, "Personal" badge, matching task count badge, action menu), list of tasks rendered with interactive `TaskCard` components from `001-tasks` sorted per `RF-15`, and "+ Nueva tarea" button pre-setting that group's `id`.
   - Built-in manual refresh button to re-fetch state from storage (`RF-24`, `RNF-16`).
   - Hydration contract: loads all groups, tasks, and tags simultaneously on init and refresh so every visible group card displays its own tasks and tags without per-group round-trips.
4. **Combinable Basic Filters (`RF-25`, Appendix C):**
   - Main filter: `'pendientes'` (default), `'completadas'`, `'todas'`. Tab badges display matching task counts across all currently visible groups.
   - Title substring search: case-insensitive partial match against `Task.title`. Global alert banner shown when search matches zero tasks across all visible groups.
   - Multi-group selector: state managed as `selectedGroupIds: string[]` (`[]` = "Todos los grupos"). Accessible toggleable pill buttons or multi-select control.
   - Multi-criteria filter combination: tasks must satisfy all active filters simultaneously.
5. **Accessibility & Responsive Layout (`UI-01`, `RNF-12`, `RNF-14`):**
   - Full keyboard navigation and visible focus rings.
   - Screen-reader accessible Spanish labels and alerts.
   - 100% Spanish UI copy drawn from `src/shared/i18n/es.ts`.

### 2.2 Out of Scope
- Shared group collaboration, member management, roles, invites, and task assignment (`RF-08`, `RF-09`, `RF-10`, `RF-11`, `RF-19`).
- Advanced filters by date range and tags (`RF-26`, scheduled for future phase).
- Dedicated group tags management screen (`RF-23`, handled in `003-tags`).
- User account authentication, registration, recovery codes, and session login/logout (`RF-01`–`RF-05`, handled in `auth`).
- Browser push notification scheduling and notification center UI (`RF-27`–`RF-29`, handled in `notifications`).

---

## 3. Requirements (EARS Format)

### 3.1 Group Provisioning & Creation (`RF-06`, `RNF-19`, `RNF-20`, `Appendix B`)

- **REQ-GRP-01 (Ubiquitous - Default Personal Group):**  
  The system shall ensure that every user has a default individual "Personal" group (`name: 'Personal'`, `isPersonal: true`, `type: 'individual'`) provisioned in storage upon application startup if no groups exist.

- **REQ-GRP-02 (Event-Driven - Group Creation Input):**  
  When a user opens the group creation dialog, the system shall accept a group name (mandatory, 3 to 30 characters, trimmed).

- **REQ-GRP-03 (Event-Driven - Group Creation Processing):**  
  When the user submits a valid group name, the system shall generate a unique identifier (`id`), set `creatorId` to the current user identifier, set `isPersonal` to `false`, set `type` to `'individual'`, initialize `members` with the creator as `'creator'`, record `createdAt` as the current ISO-8601 UTC timestamp, and persist the new group in storage.

- **REQ-GRP-04 (Unwanted Behavior - Invalid Group Name):**  
  If a user submits a group name shorter than 3 characters or longer than 30 characters (after trimming), then the system shall reject creation, keep the dialog open, and display a localized Spanish validation error message.

- **REQ-GRP-04b (Ubiquitous - Group Identity and Name Boundaries):**  
  A group's "Personal" identity shall be determined strictly and exclusively by the immutable boolean flag `isPersonal: true`, not by its string name; the system shall validate group names strictly against the 3 to 30 character length boundary without enforcing an artificial uniqueness restriction across group names.

- **REQ-GRP-05 (Ubiquitous - Individual Group Control Isolation):**  
  The system shall not display shared group features (member lists, role pickers, task assignees, or invite actions) on any individual group card or modal (`UI-05`).

- **REQ-GRP-06 (Ubiquitous - Unlimited Groups Capacity):**  
  The system shall allow users to create an arbitrary number of individual groups without a hard numerical limit (`RNF-04`, Appendix B).

### 3.2 Group Renaming and Deletion (`RF-07`, `UI-06`, `RNF-07`, `RNF-18`)

- **REQ-GRP-07 (Event-Driven - Group Renaming Input):**  
  When a user selects "Renombrar" from a group's action menu (including the "Personal" group), the system shall display a modal dialog pre-filled with the current group name.

- **REQ-GRP-08 (Event-Driven - Group Renaming Processing):**  
  When the user submits an updated group name satisfying the 3 to 30 characters constraint, the system shall update the group's `name` attribute in storage and update the grid header immediately, preserving all other group properties (`id`, `creatorId`, `isPersonal`, `type`, `members`, `createdAt`).

- **REQ-GRP-09 (Event-Driven - Group Deletion Request):**  
  When a user selects "Eliminar" from an individual group's action menu (`isPersonal === false`), the system shall display a confirmation modal explicitly warning that the group and all its tasks and tags will be permanently deleted (`UI-06`).

- **REQ-GRP-10 (Event-Driven - Group Deletion Confirmation and Cascade):**  
  When the user confirms deletion in the modal dialog, the system shall permanently delete the group from storage and cascade-delete all tasks (`Task.groupId === groupId`) and tags (`Tag.groupId === groupId`) belonging to that group.

- **REQ-GRP-10b (State-Driven - Group Filter Fallback on Deletion):**  
  When a group is deleted, the system shall immediately remove its `id` from the group filter state (`selectedGroupIds`); if `selectedGroupIds` becomes empty as a result, the filter shall automatically fall back to "Todos los grupos" (`selectedGroupIds: []`).

- **REQ-GRP-11 (Unwanted Behavior - Attempted Deletion of Personal Group):**  
  If an operation attempts to delete the default "Personal" group (`isPersonal === true`), then the system shall reject the action with a controlled `BusinessRuleViolationError`, omit the "Eliminar" option from the "Personal" group's action menu, and preserve the group intact.

- **REQ-GRP-11b (Unwanted Behavior - Group Not Found):**  
  If an operation (renaming, deletion, or task creation) targets a group `id` that does not exist in storage, then the system shall raise a controlled `NotFoundError` and prevent cascading application errors (`RNF-18`).

### 3.3 Groups Grid View (`RF-24`, `UI-01`, `UI-02`, `RNF-16`)

- **REQ-GRP-12 (Ubiquitous - Responsive Groups Grid Layout):**  
  The system shall display the user's groups in a responsive Mobile-First grid layout as the primary application view (`UI-02`), rendering as a single-column stack on mobile viewports (~375px) and as a multi-column grid on tablet and desktop viewports.

- **REQ-GRP-12b (Ubiquitous - Deterministic Group Ordering):**  
  In the Groups Grid View, the system shall order group cards deterministically:
  1. The default "Personal" group (`isPersonal === true`) is always positioned first.
  2. All other individual groups (`isPersonal === false`) are ordered ascending by `createdAt` (oldest first).
  3. In the event of identical creation timestamps, group `id` ascending shall serve as the deterministic tie-breaker.

- **REQ-GRP-13 (Ubiquitous - Group Card Composition):**  
  Each group card in the grid shall contain:
  1. A header displaying the group name, an indicator badge if it is the "Personal" group, a task count badge displaying the count of tasks within that group matching active filters, and a context action menu.
  2. The list of tasks belonging to that group, rendered using the interactive `TaskCard` component from `001-tasks` (supporting completion toggle, tag chips, overdue badge, and three-dots menu for Edit, Move, Copy, Delete), filtered by the active main filter and title query, and sorted per `RF-15`.
  3. An accessible button to create a new task directly inside that group (`+ Nueva tarea`).

- **REQ-GRP-14 (Ubiquitous - Group Action Menu):**  
  The system shall provide a context options menu (three-dots icon) on each group card containing:
  1. "Renombrar": Opens the group rename modal dialog.
  2. "Eliminar": Opens the group deletion confirmation modal (omitted for the "Personal" group).

- **REQ-GRP-15 (Event-Driven - Inline Task Creation on Group):**  
  When a user activates the "Nueva tarea" button on a specific group card, the system shall open `TaskFormModal` with `groupId` set to that group's `id`.

- **REQ-GRP-16 (Event-Driven - Manual Refresh and Hydration):**  
  When the user activates the manual refresh button in the toolbar, the system shall re-fetch all groups (`groupRepository.getAll()`), all tasks (`taskRepository.getAll()`), and all tags (`tagRepository.getAll()`) from storage and refresh the grid display without requiring a full browser page reload (`RF-24`, `RNF-16`).

- **REQ-GRP-16b (Ubiquitous - Multi-Group Data Hydration):**  
  On application initialization and upon manual refresh, the system shall hydrate complete state across all user groups, tasks, and tags so that every visible group card simultaneously renders its own tasks and tags, and cross-group operations (Move, Copy, search) execute against complete state.

### 3.4 Combinable Basic Filters (`RF-25`, Appendix C)

- **REQ-GRP-17 (Ubiquitous - Main Filter Options & Count Badges):**  
  The system shall provide a main filter selector with three options:
  - "Pendientes" (`'pendientes'`, default): displays only incomplete tasks (`completed === false`).
  - "Completadas" (`'completadas'`): displays only completed tasks (`completed === true`).
  - "Todas" (`'todas'`): displays both pending and completed tasks, with completed tasks placed at the bottom (`RF-15`).  
  Each filter tab badge (`Pendientes (N)`, `Completadas (N)`, `Todas (N)`) shall display the total count of tasks across all currently visible groups matching the active title search query.

- **REQ-GRP-18 (Event-Driven - Title Substring Search):**  
  When a user enters text into the search input field, the system shall filter tasks by matching the query as a case-insensitive partial substring against the task's `title` only.

- **REQ-GRP-19 (Event-Driven - Multi-Group Selection Control):**  
  The system shall manage group filter state as `selectedGroupIds: string[]`, providing an accessible multi-group filter control (toggleable group pill buttons or checkboxes for each group, plus a "Todos los grupos" option that sets `selectedGroupIds` to `[]`).

- **REQ-GRP-20 (Ubiquitous - Visible Groups Evaluation):**  
  When `selectedGroupIds` is empty (`[]`), the system shall display all individual groups belonging to the user; when `selectedGroupIds` contains one or more group IDs, the grid shall display only the cards corresponding to the selected groups.

- **REQ-GRP-21 (Ubiquitous - Multi-Criteria Filter Combination):**  
  The system shall evaluate all active filters simultaneously: a task is displayed within a visible group if and only if it matches both the active main filter and the title substring query (`RF-25`, Appendix C).

- **REQ-GRP-22 (State-Driven - Group Empty Filter State):**  
  While a visible group contains no tasks matching the combined active filters, the group card shall display a localized Spanish message indicating that no tasks match the active filters.

- **REQ-GRP-23 (State-Driven - Global Empty Search State):**  
  While an active non-empty title search query matches zero tasks across all visible groups, the grid view shall render a prominent Spanish alert banner above the groups grid informing the user that no matching tasks were found, while keeping the group cards visible in the grid.

### 3.5 Accessibility, Responsiveness & Locale (`UI-01`, `RNF-12`, `RNF-14`)

- **REQ-GRP-24 (Ubiquitous - Mobile-First Viewports):**  
  The groups grid, filter toolbar, group cards, and modals shall adapt smoothly to mobile (~375px), tablet, and desktop viewports using semantic Bootstrap layout utilities.

- **REQ-GRP-25 (Ubiquitous - Keyboard Accessibility):**  
  All interactive group elements (creation button, group menu, rename modal, delete modal, search input, filter controls, refresh button) shall be fully navigable by keyboard (Tab, Enter, Space, Escape) with visible focus outlines.

- **REQ-GRP-26 (Ubiquitous - Spanish Localization):**  
  All user-facing copy, modal labels, accessibility descriptions, placeholders, and error messages shall be centralized in `src/shared/i18n/es.ts` in 100% Spanish text.

---

## 4. Domain Models & Specifications

### 4.1 Group Entity & Invariants

```
Group Contract:
- id: string (UUID or 'group-personal')
- name: string (3..30 chars, trimmed)
- creatorId: string
- isPersonal: boolean (true only for default 'Personal' group)
- type: 'individual' | 'compartido' (MVP: always 'individual')
- members: GroupMember[] (MVP: 1 member with role 'creator')
- createdAt: ISO-8601 UTC string

Core Invariants:
1. Exactly one group with isPersonal === true exists per user account.
2. A group's "Personal" status is determined strictly by isPersonal === true, never by its name string.
3. The group with isPersonal === true can be renamed, but can NEVER be deleted or converted to shared.
4. Group names are validated strictly against length (3..30 chars) without enforcing name uniqueness across groups.
5. Deleting an individual group with isPersonal === false triggers cascade deletion of all tasks and tags where groupId === group.id.
```

### 4.2 Deterministic Group Ordering Algorithm (`RF-24`)

```
Function compareGroups(groupA, groupB):
  // Rule 1: 'Personal' group always comes first
  If groupA.isPersonal !== groupB.isPersonal:
     Return groupA.isPersonal ? -1 : 1

  // Rule 2: Order by creation timestamp ASC (oldest first)
  If groupA.createdAt !== groupB.createdAt:
     Return compareString(groupA.createdAt, groupB.createdAt)

  // Rule 3: Tie-breaker by ID ASC
  Return compareString(groupA.id, groupB.id)
```

### 4.3 Group Actions by Type

| Group Type | Renaming Allowed | Deletion Allowed | Cascade Affected | Card Menu Options |
| :--- | :---: | :---: | :--- | :--- |
| **Personal (`isPersonal: true`)** | Yes (3..30 chars) | No (Strict Invariant) | N/A | "Renombrar" |
| **Individual (`isPersonal: false`)** | Yes (3..30 chars) | Yes (with confirmation) | Tasks & Tags in group | "Renombrar", "Eliminar" |

### 4.4 Filter Combination Matrix (`RF-25`, Appendix C)

| Main Filter | Title Search Query | Group Filter State (`selectedGroupIds`) | Displayed Groups in Grid | Displayed Tasks per Group Card |
| :--- | :--- | :--- | :--- | :--- |
| `pendientes` | Empty | `[]` ("Todos los grupos") | All user groups | Pending tasks in each group (sorted per RF-15) |
| `completadas` | Empty | `['group-personal']` | Only "Personal" card | Completed tasks in "Personal" (sorted per RF-15) |
| `todas` | `"examen"` | `['group-personal', 'group-study']` | Only "Personal" and "Estudio" cards | Pending and completed tasks in those groups matching "examen" (completed at bottom) |
| `pendientes` | `"urgente"` | `[]` ("Todos los grupos") | All user groups | Pending tasks matching "urgente" across all groups |
| `pendientes` | `"inexistente"` | `[]` ("Todos los grupos") | All user groups | Each group card shows empty filter message; global alert banner displayed |

### 4.5 Multi-Group Data Hydration & Store State Contract

To ensure high performance and avoid waterfall network requests:
- State tracks:
  - `groups: Group[]`: All groups loaded via `groupRepository.getAll()`.
  - `tasks: Task[]`: All tasks loaded via `taskRepository.getAll()`.
  - `tags: Tag[]`: All tags loaded via `tagRepository.getAll()`.
  - `selectedGroupIds: string[]`: Active multi-group filter (`[]` = all groups).
  - `searchQuery: string`: Active title search filter.
  - `activeFilter: TaskFilter`: Active main status filter (`'pendientes' | 'completadas' | 'todas'`).
- Group cards derive their contained tasks directly from the shared `tasks` array: `tasks.filter(t => t.groupId === group.id && matchesFilters(t))`.

### 4.6 Spanish Localization Extension Contract (`src/shared/i18n/es.ts`)

A dedicated `groups` namespace is added to `LocalizationDictionary`:

```typescript
export interface GroupsLocalization {
  // Navigation & Toolbar
  gridTitle: string;
  createGroupButton: string;
  searchPlaceholder: string;
  filterGroupLabel: string;
  allGroupsOption: string;
  refreshButton: string;
  refreshTooltip: string;
  addTaskToGroup: string;

  // Group Card & Modals
  personalBadge: string;
  groupMenuAria: string;
  actionRename: string;
  actionDelete: string;
  createModalTitle: string;
  renameModalTitle: string;
  nameLabel: string;
  namePlaceholder: string;
  deleteModalTitle: string;
  deleteModalWarning: (groupName: string) => string;
  cannotDeletePersonal: string;

  // Empty & Feedback States
  emptyGroupTasks: string;
  emptySearchGlobal: string;
  noGroupsFound: string;
  taskCount: (count: number) => string;
}
```

Canonical dictionary entries:
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
- `deleteModalWarning`: `(groupName: string) => `¿Estás seguro de que deseas eliminar el grupo "${groupName}"? Todas sus tareas y etiquetas se eliminarán de forma permanente. Esta acción no se puede deshacer.``
- `cannotDeletePersonal`: `'El grupo Personal no se puede eliminar.'`
- `emptyGroupTasks`: `'No hay tareas que coincidan con los filtros en este grupo.'`
- `emptySearchGlobal`: `'No se encontraron tareas con el título especificado.'`
- `taskCount`: `(count: number) => `${count} ${count === 1 ? 'tarea' : 'tareas'}``

---

## 5. Acceptance Criteria

1. **AC-GRP-01 (Default Personal Group & Deterministic Ordering):** When the application loads, the "Personal" group is verified or provisioned, always rendered in the first position in the grid, and displays the "Personal" badge. All other individual groups are ordered ascending by `createdAt`.
2. **AC-GRP-02 (Group Creation):** Submitting a valid group name (3..30 chars) creates an individual group, displays it in the grid, and enables task creation in that group. Submitting a name < 3 or > 30 chars displays a localized Spanish validation message.
3. **AC-GRP-03 (Group Renaming):** Renaming a group (including "Personal") updates its header title in the grid immediately, keeping all contained tasks and tags intact.
4. **AC-GRP-04 (Personal Group Deletion Invariant):** The "Personal" group does not render an "Eliminar" option in its action menu, and any direct programmatic attempt to delete it throws a controlled `BusinessRuleViolationError`.
5. **AC-GRP-05 (Group Deletion & Cascade Removal):** Deleting an individual group shows a confirmation modal warning of permanent data loss. Confirming removes the group from storage and permanently deletes all tasks and tags associated with that group.
6. **AC-GRP-06 (Group Filter Fallback on Deletion):** When a deleted group was part of the active `selectedGroupIds`, its `id` is removed from the filter; if no selected groups remain, it falls back to "Todos los grupos".
7. **AC-GRP-07 (Groups Grid View Composition):** Groups are presented in a responsive grid (1 column on mobile, multi-column on desktop). Each group card displays group header, count badge of matching tasks, action menu, task list rendered with interactive `TaskCard` components, and "+ Nueva tarea" button.
8. **AC-GRP-08 (Task Ordering in Grid Cards):** Tasks in each group card follow deterministic ordering per `RF-15` according to the active main filter.
9. **AC-GRP-09 (Inline Task Creation):** Clicking "+ Nueva tarea" on a group card opens `TaskFormModal` with `groupId` pre-set to that group's `id`.
10. **AC-GRP-10 (Filter Combination):** Main filter (with global tab count badges), title search query, and multi-group filter selection combine simultaneously, updating displayed groups and tasks in real-time.
11. **AC-GRP-11 (Global Search Alert Banner):** When an active title search matches zero tasks across all visible groups, an alert banner (`emptySearchGlobal`) is rendered above the grid while preserving visible group cards.
12. **AC-GRP-12 (Manual Refresh & Complete Hydration):** Activating the "Refrescar" button reloads all groups, tasks, and tags from storage and updates the view without a full page reload.
13. **AC-GRP-13 (Accessibility & Keyboard Operability):** All group actions, modals, search inputs, and filters are fully navigable by keyboard (Tab, Enter, Space, Escape) with visible focus outlines and Spanish screen-reader labels.

---

## 6. Traceability Matrix

| SRS Requirement | Feature Requirement | Coverage Details |
| :--- | :--- | :--- |
| **RF-06** | REQ-GRP-01, REQ-GRP-02, REQ-GRP-03, REQ-GRP-04, REQ-GRP-04b, REQ-GRP-05, REQ-GRP-06 | Default "Personal" group, unlimited individual groups, immutable isPersonal flag, isolation from shared controls |
| **RF-07** | REQ-GRP-07, REQ-GRP-08, REQ-GRP-09, REQ-GRP-10, REQ-GRP-10b, REQ-GRP-11 | Rename any group, delete non-personal groups with confirmation, cascade deletion, filter fallback |
| **RF-24** | REQ-GRP-12, REQ-GRP-12b, REQ-GRP-13, REQ-GRP-14, REQ-GRP-15, REQ-GRP-16, REQ-GRP-16b | Responsive groups grid view, deterministic group sort, TaskCard integration, manual refresh, data hydration |
| **RF-25** | REQ-GRP-17, REQ-GRP-18, REQ-GRP-19, REQ-GRP-20, REQ-GRP-21, REQ-GRP-22, REQ-GRP-23 | Combinable main filter, title substring search, multi-group selector control, global empty alert |
| **UI-01** | REQ-GRP-12, REQ-GRP-24, REQ-GRP-26 | Responsive Mobile-First design, 100% Spanish UI text |
| **UI-02** | REQ-GRP-12, REQ-GRP-13 | Default view displays user's groups in a grid, each with its tasks |
| **UI-05** | REQ-GRP-05 | Shared group functions (members, roles, assignments, invites) do not appear |
| **UI-06** | REQ-GRP-09, REQ-GRP-10 | Destructive confirmation dialog before group deletion |
| **RNF-01** | REQ-GRP-12, REQ-GRP-21 | Client-side response within 2 seconds |
| **RNF-04** | REQ-GRP-06, REQ-GRP-12 | Unlimited groups volume support |
| **RNF-07** | REQ-GRP-04, REQ-GRP-11 | Controlled validation and business rule violation errors |
| **RNF-12** | REQ-GRP-25 | Accessible tab navigation, visible focus rings, labeled inputs |
| **RNF-14** | REQ-GRP-26 | Centralized Spanish dictionary in `src/shared/i18n/es.ts` |
| **RNF-16** | REQ-GRP-16 | Manual refresh capability, no real-time dependency |
| **RNF-18** | REQ-GRP-08, REQ-GRP-10, REQ-GRP-11b | Controlled NotFoundError when group is missing |
| **RNF-19** | REQ-GRP-02, REQ-GRP-04, REQ-GRP-04b, Section 4.1 | Appendix B group name limits (3..30 chars) |
| **RNF-20** | REQ-GRP-03, Section 4.1 | Extensible group model with `creatorId` and `members[]` |
| **Appendix B** | REQ-GRP-02, REQ-GRP-04, REQ-GRP-04b, Section 4.1 | Group name length limits (3..30 chars), unlimited count |
| **Appendix C** | REQ-GRP-17, REQ-GRP-18, REQ-GRP-19, REQ-GRP-20, REQ-GRP-21, Section 4.4 | Visibility rules and multi-filter combination matrix |

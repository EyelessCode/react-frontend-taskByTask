# Implementation Plan: 003-tags (Task Tags & Group-Scoped Tag Management)

- **Feature Name:** `003-tags`
- **Spec Reference:** [`docs/specs/003-tags/spec.md`](file:///C:/Users/crist/Documentos/GitHub/PERSONAL/PROJECTS-FULLSTACK/TaskByTask/react-frontend-taskByTask/docs/specs/003-tags/spec.md) (Status: `approved`)
- **Plan Status:** Approved

---

## 1. Architecture & Folder Structure Overview

This plan defines the technical implementation for **003-tags**, completing SRS requirement `RF-22` (Etiquetas en tareas) and its interactions with `RF-12`, `RF-13`, `RF-16`, `RF-07`, `UI-01`, `UI-06`, `RNF-01`, `RNF-04`, `RNF-07`, `RNF-12`, `RNF-14`, `RNF-18`, `RNF-19`, `RNF-20`, and `Appendix B`. It populates the `src/features/tags/` feature module with pure domain utilities, custom hooks, and accessible React-Bootstrap components while integrating cleanly with `src/features/tasks/` and `src/features/groups/` with zero regressions on existing `000-foundation`, `001-tasks`, and `002-groups` test suites.

### 1.1 Target File Layout

```
react-frontend-taskByTask/
├── src/
│   ├── shared/
│   │   ├── i18n/
│   │   │   └── es.ts                                    # [Extended: tag accessibility, inline edit, and UI-06 consequence strings]
│   │   └── schemas/
│   │       └── tag.ts                                   # (Existing canonical tagNameSchema & tagSchema)
│   ├── data/
│   │   ├── contracts/
│   │   │   └── tag-repository.ts                        # (Existing TagRepository contract)
│   │   └── repositories/
│   │       └── local-storage-tag-repository.ts          # (Existing LocalStorageTagRepository)
│   └── features/
│       ├── tags/                                        # POPULATED FEATURE MODULE
│       │   ├── index.ts                                 # Public feature barrel export
│       │   ├── utils/
│       │   │   ├── tag-operations.ts                    # Pure functions: delimiter parsing, inline edit, deduplication, resolution
│       │   │   └── index.ts
│       │   ├── hooks/
│       │   │   ├── use-tag-input.ts                     # State machine hook for chip input, inline editing, composite blur & validation
│       │   │   └── index.ts
│       │   └── components/
│       │       ├── TaskTagInput.tsx                     # Accessible tag input with inline chip editing & composite blur auto-capture
│       │       ├── TaskTagRemovalModal.tsx              # UI-06 confirmation dialog with consequence warning
│       │       └── index.ts
│       ├── tasks/
│       │   ├── store/
│       │   │   └── tasks-store.ts                       # [Updated: allTags hydration, intra-task tagId deduplication, multi-group sync]
│       │   ├── hooks/
│       │   │   └── use-task-form.ts                     # [Updated: multi-group tag resolution by task.groupId, non-destructive edit reset]
│       │   └── components/
│       │       ├── TaskCard.tsx                         # [Updated: per-chip remove button trigger & accessible overflow badge aria-label]
│       │       ├── TaskList.tsx                         # [Updated: forwards onRemoveTag callback to TaskCard]
│       │       ├── TaskFormModal.tsx                    # [Updated: inline tag edit, persisted tag removal modal stacking, pre-submit commit]
│       │       ├── TaskTagInput.tsx                     # [Re-exports from features/tags/components/TaskTagInput]
│       │       ├── TaskTagRemovalModal.tsx              # [Re-exports from features/tags/components/TaskTagRemovalModal]
│       │       └── TasksView.tsx                        # [Updated: wires onRemoveTag from TaskList/TaskCard to TaskTagRemovalModal]
│       └── groups/
│           └── components/
│               ├── GroupCard.tsx                        # [Updated: forwards onRemoveTag from TaskCard & filters group tags accurately]
│               └── GroupsGridView.tsx                   # [Updated: wires TaskCard tag removal modal & in-modal tag mutation refresh]
└── tests/
    ├── unit/
    │   ├── shared/
    │   │   └── i18n/
    │   │       └── es.test.ts                           # [Updated: verifies new tag localization keys]
    │   └── features/
    │       ├── tags/
    │       │   └── tag-operations.test.ts               # [Created: unit tests for all pure tag functions]
    │       └── tasks/
    │           └── tasks-store.test.ts                  # [Updated: tests multi-group tag resolution & intra-task deduplication]
    ├── integration/
    │   └── features/
    │       ├── tags/
    │       │   ├── task-tag-input.test.tsx              # [Created: inline editing, composite blur, >30 char error, session vs persisted removal]
    │       │   └── tag-removal-flows.test.tsx           # [Created: card & edit-form removal modal, unsaved state preservation, focus return]
    │       └── tasks/
    │           ├── task-card.test.tsx                   # [Updated: verifies chip remove button & overflow badge aria-label]
    │           └── task-form-modal.test.tsx             # (Preserved + verified regression-free)
    └── e2e/
        ├── tasks.spec.ts                                # (Preserved regression test)
        ├── groups.spec.ts                               # (Preserved regression test)
        └── tags.spec.ts                                 # [Created: Playwright E2E full RF-22 tag lifecycle across groups]
```

---

## 2. Design Decisions & Discarded Alternatives

### 2.1 Decision 1: Pure State-Transition Functions for Delimited Capture, Inline Editing & Deduplication (`tag-operations.ts`)
- **Decision:** Extract all tag string normalization, canonical casing lookup, delimited segment splitting, inline chip editing rules, and persisted-tag checks into pure, side-effect-free functions in `src/features/tags/utils/tag-operations.ts`.
- **Why:** `RF-22` has nuanced rules for case-insensitive canonical reuse (`REQ-TG-09`), intra-task deduplication with index retention (`REQ-TG-10`, `REQ-TG-12`), `> 30` character validation (`REQ-TG-03`, `REQ-TG-06`, `REQ-TG-13`), and distinguishing persisted task tags from unsaved session chips (`REQ-TG-15`, `REQ-TG-16`). Pure functions make every branch deterministically unit-testable without DOM overhead.
- **Discarded Alternative:** Embedding string manipulation and deduplication inline inside React event handlers in `TaskTagInput.tsx`. Rejected because it couples domain rules to DOM events and complicates unit testing.

### 2.2 Decision 2: Composite Blur Boundary via `containerRef.contains(e.relatedTarget)` (`REQ-TG-06b`)
- **Decision:** Handle auto-conversion of unconfirmed tag input text on blur at the composite container boundary (`containerRef` wrapping both the text input and the autocomplete suggestion `ListGroup`). When `onBlur` fires on the input, check whether `e.relatedTarget` is inside `containerRef.current`. If focus moved to an autocomplete suggestion button inside `containerRef`, do **not** auto-convert the partial query; if focus moved outside `containerRef` (or if the form is submitted via `commitPendingInput()`), auto-convert valid 1..30 char text into a chip or block submission with a validation error if `> 30` chars.
- **Why:** Directly satisfies `REQ-TG-06b`, `REQ-TG-07`, `REQ-TG-08`, and `REQ-TG-27`, allowing both keyboard (`Tab` to suggestion + `Enter`/`Space`) and pointer suggestion selection without premature conversion of partial queries.
- **Discarded Alternative:** Using an arbitrary `setTimeout(..., 200)` on input blur to convert text. Rejected because `Tab` navigation to the suggestion list would still fire after 200ms and convert the partial query while the user is navigating suggestions via keyboard.

### 2.3 Decision 3: Non-Destructive Edit Form State & Stacked Confirmation Modal (`REQ-TG-18(2)`, `REQ-TG-19(2)`, `REQ-TG-20`)
- **Decision:**
  1. In `useTaskForm`, scope the edit-mode `form.reset(...)` effect to trigger only when the edited task identity (`task?.id`) changes (not on every background `store.tags` or `task.tagIds` reference change while the modal is already open for the same task).
  2. When a user clicks `×` on a persisted tag chip inside `TaskFormModal` (edit mode), open `TaskTagRemovalModal` while keeping `TaskFormModal` mounted and open. Upon confirming "Solo de la tarea" or "Del grupo", execute the repository/store removal immediately, remove only that tag name from `form.getValues('tagNames')` via `form.setValue('tagNames', ...)`, refresh parent group/task views via an `onTagMutated` callback (without calling `onClose()`), and return focus to the tag input field (`tagInputRef.current?.focus()`).
- **Why:** Guarantees that unsaved edits to `title`, `description`, `dueDate`, `dueTime`, and other session/inline-edited tag chips in `TaskFormModal` are never wiped when removing a persisted tag (`REQ-TG-18(2)`, `REQ-TG-19(2)`, `MEMORY.md` RHF modal lesson), while ensuring confirmed removals persist immediately even if the user later clicks "Cancelar" on the task edit modal (`REQ-TG-20(3)`).
- **Discarded Alternative:** Closing `TaskFormModal` whenever `TaskTagRemovalModal` opens, or deferring "Del grupo" deletion until the task form is saved. Rejected because closing the edit modal loses unsaved form edits, and `UI-06` confirmation dialogs represent immediate confirmed actions.

### 2.4 Decision 4: Multi-Group Tag Resolution via `allTags` Hydration (`REQ-TG-23`)
- **Decision:** Extend `useTasksStore` with `allTags: Tag[]` (hydrated alongside `tags` on `init()`, `setActiveGroup()`, `createTask()`, `updateTask()`, `moveTask()`, `copyTask()`, and `deleteTagFromGroup()`), while keeping `state.tags` scoped to `activeGroupId` for 100% backward compatibility with `001-tasks` unit tests. In `useTaskForm`, resolve `targetGroupId = task?.groupId ?? defaultGroupId ?? store.activeGroupId` and compute `groupTags` for `targetGroupId` from `store.allTags` (falling back to `store.tags` if `targetGroupId === store.activeGroupId`).
- **Why:** In `GroupsGridView`, users can click "Editar" or "+ Nueva tarea" on any group card regardless of the header's `activeGroupId` selector. Resolving `groupTags` strictly by `targetGroupId` ensures `TaskFormModal` always displays existing tag chips and autocomplete suggestions for the task's actual group (`REQ-TG-23`).
- **Discarded Alternative:** Forcing `GroupsGridView` to await `tasksSetActiveGroup(task.groupId)` before opening `TaskFormModal`. Rejected because changing the global active group selector as a side effect of editing a card in the grid mutates unrelated UI state and introduces async race conditions during modal mount.

---

## 3. Technical Implementation Details

### 3.1 Spanish Localization Extensions (`src/shared/i18n/es.ts`)

Extend `TasksLocalization` (and expose `tags` alias on `LocalizationDictionary` / `es`) with the keys specified in `spec.md` Section 4.4:

```typescript
export interface TasksLocalization {
  // ...existing keys preserved...
  tagOverflow: (count: number) => string;
  tagOverflowAria: (count: number) => string;
  editTagAria: (tagName: string) => string;
  editingTagInputAria: (tagName: string) => string;
  editTagHint: string;
  removeTagAria: (tagName: string) => string;
  removeTagTitle: string;
  removeTagPrompt: (tagName: string) => string;
  removeTagDescription: string;
  removeOnlyFromTask: string;
  removeFromGroup: string;
  // ...
}
```

Canonical values added to `es.tasks` (and referenced by `es.tags`):
- `tagOverflowAria`: `(count: number) => `${count} etiquetas adicionales ocultas. Edita la tarea para ver todas.``
- `editTagAria`: `(tagName: string) => `Editar etiqueta ${tagName}``
- `editingTagInputAria`: `(tagName: string) => `Editando etiqueta ${tagName}``
- `editTagHint`: `'Haz clic o presiona Enter en una etiqueta para editarla en esta tarea'`
- `removeTagAria`: `(tagName: string) => `Quitar etiqueta ${tagName}``
- `removeTagDescription`: `'Si eliges "Solo de la tarea", la etiqueta se conservará en el grupo. Si eliges "Del grupo", se eliminará permanentemente del grupo y de todas sus tareas.'`

### 3.2 Pure Tag Domain Utilities (`src/features/tags/utils/tag-operations.ts`)

All pure functions take explicit inputs and return deterministic outputs:

```typescript
import { LIMITS, type Tag } from '../../../shared/schemas';
import { es } from '../../../shared/i18n';

const TAG_FIELD_LABEL = 'El nombre de la etiqueta';

export function normalizeTagName(name: string): string {
  return name.trim().toLowerCase();
}

export function findMatchingGroupTag(name: string, groupTags: Tag[]): Tag | undefined {
  const normalized = normalizeTagName(name);
  if (!normalized) return undefined;
  return groupTags.find((t) => normalizeTagName(t.name) === normalized);
}

export function resolveCanonicalTagName(name: string, groupTags: Tag[]): string {
  const trimmed = name.trim();
  const match = findMatchingGroupTag(trimmed, groupTags);
  return match ? match.name : trimmed;
}

export function hasTagInList(tagName: string, list: string[]): boolean {
  const normalized = normalizeTagName(tagName);
  return list.some((item) => normalizeTagName(item) === normalized);
}

export function isTagPersistedOnTask(
  tagName: string,
  persistedTagNames: string[],
): boolean {
  return hasTagInList(tagName, persistedTagNames);
}

export interface TagCaptureResult {
  updatedTags: string[];
  remainingInput: string;
  validationError: string | null;
}

export function captureTagSegments(
  segments: string[],
  trailingSegment: string,
  currentTags: string[],
  groupTags: Tag[],
): TagCaptureResult {
  const nextTags = [...currentTags];

  for (const rawSegment of segments) {
    const trimmed = rawSegment.trim();
    if (trimmed.length === 0) {
      continue; // Empty delimiter press or empty segment is a no-op (REQ-TG-03, REQ-TG-06)
    }
    if (trimmed.length > LIMITS.TAG_NAME_MAX) {
      return {
        updatedTags: nextTags,
        remainingInput: trimmed,
        validationError: es.validation.maxLength(TAG_FIELD_LABEL, LIMITS.TAG_NAME_MAX),
      };
    }
    const canonical = resolveCanonicalTagName(trimmed, groupTags);
    if (!hasTagInList(canonical, nextTags)) {
      nextTags.push(canonical);
    }
  }

  return {
    updatedTags: nextTags,
    remainingInput: trailingSegment,
    validationError: null,
  };
}

export interface InlineTagEditResult {
  updatedTags: string[];
  shouldExitEdit: boolean;
  validationError: string | null;
}

export function applyInlineTagEdit(
  currentTags: string[],
  editIndex: number,
  rawNewValue: string,
  groupTags: Tag[],
  mode: 'commit' | 'blur',
): InlineTagEditResult {
  if (editIndex < 0 || editIndex >= currentTags.length) {
    return { updatedTags: currentTags, shouldExitEdit: true, validationError: null };
  }

  // Strip any delimiter characters pasted or typed into inline edit (REQ-TG-12)
  const sanitized = rawNewValue.replace(/[;,]/g, '').trim();

  if (sanitized.length === 0) {
    // Empty confirm or blur cancels inline edit and restores original chip (REQ-TG-13(2))
    return { updatedTags: currentTags, shouldExitEdit: true, validationError: null };
  }

  if (sanitized.length > LIMITS.TAG_NAME_MAX) {
    if (mode === 'commit') {
      // Pressing Enter, ',', or ';' with > 30 chars stays in edit and shows error (REQ-TG-13(1))
      return {
        updatedTags: currentTags,
        shouldExitEdit: false,
        validationError: es.validation.maxLength(TAG_FIELD_LABEL, LIMITS.TAG_NAME_MAX),
      };
    }
    // Blurring with > 30 chars cancels inline edit and restores original chip (REQ-TG-13(2))
    return { updatedTags: currentTags, shouldExitEdit: true, validationError: null };
  }

  const canonical = resolveCanonicalTagName(sanitized, groupTags);
  const normalizedCanonical = normalizeTagName(canonical);

  const existingDuplicateIndex = currentTags.findIndex(
    (t, idx) => idx !== editIndex && normalizeTagName(t) === normalizedCanonical,
  );

  if (existingDuplicateIndex >= 0) {
    // Keep existing matching chip at its original position and remove edited duplicate (REQ-TG-12(2))
    const deduplicated = currentTags.filter((_, idx) => idx !== editIndex);
    return { updatedTags: deduplicated, shouldExitEdit: true, validationError: null };
  }

  // Replace chip at exact original index (REQ-TG-12(1))
  const replaced = currentTags.map((t, idx) => (idx === editIndex ? canonical : t));
  return { updatedTags: replaced, shouldExitEdit: true, validationError: null };
}

export function filterTagSuggestions(
  query: string,
  availableTags: Tag[],
  currentTags: string[],
): Tag[] {
  const normalizedQuery = normalizeTagName(query);
  if (normalizedQuery.length === 0) return [];

  return availableTags.filter(
    (tag) =>
      normalizeTagName(tag.name).includes(normalizedQuery) &&
      !hasTagInList(tag.name, currentTags),
  );
}

export function resolveTaskTags(
  tagIds: string[] | undefined,
  availableTags: Tag[],
  groupId?: string,
): Tag[] {
  if (!tagIds || tagIds.length === 0) return [];
  const seen = new Set<string>();
  const resolved: Tag[] = [];

  for (const id of tagIds) {
    if (seen.has(id)) continue;
    const tag = availableTags.find(
      (t) => t.id === id && (!groupId || !t.groupId || t.groupId === groupId),
    );
    if (tag) {
      seen.add(id);
      resolved.push(tag);
    }
  }
  return resolved;
}
```

### 3.3 Custom Hook (`src/features/tags/hooks/use-tag-input.ts`)

Encapsulates the interaction state for `TaskTagInput`:
- State:
  - `inputValue: string`
  - `inputError: string | null`
  - `isFocused: boolean`
  - `editingIndex: number | null`
  - `editingValue: string`
  - `inlineError: string | null`
- Handlers:
  - `handleInputChange(val: string)`: clears `inputError` if `val.trim().length <= LIMITS.TAG_NAME_MAX`; if `val` contains `;` or `,`, splits on `/[;,]/` and runs `captureTagSegments(parts.slice(0, -1), parts[parts.length - 1], value, availableTags)`.
  - `handleInputKeyDown(e)`: on `;`, `,`, or `Enter`, `e.preventDefault()`, runs `captureTagSegments([inputValue], '', value, availableTags)`.
  - `handleCompositeBlur(relatedTarget: EventTarget | null, container: HTMLElement | null)`: if `container && relatedTarget instanceof Node && container.contains(relatedTarget)`, keeps `isFocused = true` (`REQ-TG-06b(3)`). Otherwise sets `isFocused = false` and, if `inputValue.trim().length > 0`, runs `captureTagSegments([inputValue], '', value, availableTags)`.
  - `commitPendingBeforeSubmit()`: commits any active inline edit (`applyInlineTagEdit(..., 'commit')`) and any non-empty `inputValue` (`captureTagSegments([inputValue], '', ...)`), returning `{ ok: boolean; tags: string[] }` so `TaskFormModal` can block submission if `inputValue` or `editingValue` is invalid (`> 30` chars, `REQ-TG-06b(2)`, `REQ-TG-12b`) or submit with the newly committed chip(s) (`REQ-TG-06b(1)`).
  - `startInlineEdit(index: number)`: sets `editingIndex = index`, `editingValue = value[index]`, `inlineError = null`.
  - `handleInlineKeyDown(e)`:
    - On `Escape`: `e.preventDefault()`, `e.stopPropagation()`, cancels inline edit (`editingIndex = null`, `inlineError = null`, `REQ-TG-13(2)`).
    - On `Enter`, `,`, or `;`: `e.preventDefault()`, runs `applyInlineTagEdit(value, editingIndex, editingValue, availableTags, 'commit')`.
  - `handleInlineBlur()`: runs `applyInlineTagEdit(value, editingIndex, editingValue, availableTags, 'blur')`.
  - `handleChipRemoveClick(tagName: string)`: if an inline edit is active, resolves blur first (`REQ-TG-12b`). Checks `isTagPersistedOnTask(tagName, persistedTagNames)`: if `true` and `onRemoveRequest` is provided, invokes `onRemoveRequest(tagName)` (`REQ-TG-16`); otherwise removes `tagName` immediately from `value` via `onChange` (`REQ-TG-15`).

### 3.4 UI Components (`src/features/tags/components/` & `src/features/tasks/components/`)

1. **`TaskTagInput.tsx` (`src/features/tags/components/TaskTagInput.tsx`):**
   - Props:
     ```typescript
     export interface TaskTagInputHandle {
       commitPendingInput: () => { ok: boolean; tags: string[] };
       focusInput: () => void;
     }

     export interface TaskTagInputProps {
       value?: string[];
       onChange?: (tags: string[]) => void;
       availableTags?: Tag[];
       persistedTagNames?: string[];
       onRemoveRequest?: (tagName: string) => void;
       disabled?: boolean;
       placeholder?: string;
       ref?: React.Ref<TaskTagInputHandle>;
     }
     ```
   - Renders each chip in `value`:
     - If `editingIndex === index`, renders an inline `<Form.Control size="sm" ... aria-label={es.tasks.editingTagInputAria(tagName)} />` with `autoFocus`, `onKeyDown={handleInlineKeyDown}`, `onBlur={handleInlineBlur}`, and inline validation feedback if `inlineError` is present.
     - Otherwise, renders a `<Badge bg="secondary" ...>` containing:
       - An interactive chip label trigger `<span role="button" tabIndex={0} aria-label={es.tasks.editTagAria(tagName)} onClick={() => startInlineEdit(index)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); startInlineEdit(index); } }}>{tagName}</span>` (`REQ-TG-11`, `REQ-TG-27`).
       - The remove button `<button type="button" className="btn-close btn-close-white p-0 ms-1" aria-label={es.tasks.removeTagAria(tagName)} onClick={() => handleChipRemoveClick(tagName)} />` (`REQ-TG-15`, `REQ-TG-16`, `REQ-TG-27`).
   - Renders the main tag `<Form.Control>` with `isInvalid={Boolean(inputError)}` and `<Form.Control.Feedback type="invalid">{inputError}</Form.Control.Feedback>` (`REQ-TG-03`, `REQ-TG-06`).
   - Renders the autocomplete `<ListGroup>` when `isFocused && suggestions.length > 0`, where each `<ListGroup.Item action as="button" type="button" onClick={() => selectSuggestion(suggestion.name)}>` can be activated via pointer click or keyboard `Tab` + `Enter`/`Space` (`REQ-TG-06b`, `REQ-TG-07`, `REQ-TG-08`, `REQ-TG-27`).

2. **`TaskTagRemovalModal.tsx` (`src/features/tags/components/TaskTagRemovalModal.tsx`):**
   - Renders the `UI-06` confirmation dialog with:
     - Title: `es.tasks.removeTagTitle` (`'Quitar etiqueta'`)
     - Prompt: `es.tasks.removeTagPrompt(resolvedTagName)` (`'¿Cómo deseas quitar la etiqueta "..."?'`)
     - Consequence warning description: `es.tasks.removeTagDescription` (`REQ-TG-16`, `REQ-TG-17`, `UI-06`)
     - Buttons: `es.common.cancel` (`'Cancelar'`), `es.tasks.removeOnlyFromTask` (`'Solo de la tarea'`), and `es.tasks.removeFromGroup` (`'Del grupo'`).

3. **`TaskCard.tsx` (`src/features/tasks/components/TaskCard.tsx`):**
   - Adds optional prop `onRemoveTag?: (task: Task, tag: Tag) => void`.
   - Resolves `resolvedTags = resolveTaskTags(task.tagIds, tags, task.groupId)`.
   - Renders up to 5 visible tag chips, each with `<span>{tag.name}</span>` and an accessible remove button (`type="button"`, `className="btn-close btn-close-white p-0 ms-1"`, `aria-label={es.tasks.removeTagAria(tag.name)}`, `onClick={() => onRemoveTag?.(task, tag)}`) (`REQ-TG-17`, `REQ-TG-21`, `REQ-TG-27`).
   - Renders the non-interactive overflow badge when `overflowCount > 0` with `aria-label={es.tasks.tagOverflowAria(overflowCount)}` (`REQ-TG-21`, `REQ-TG-27`).

4. **`TaskFormModal.tsx` & `use-task-form.ts`:**
   - `useTaskForm` resolves `targetGroupId = task?.groupId ?? defaultGroupId ?? store.activeGroupId` and selects `groupTags` for `targetGroupId` from `store.allTags` (falling back to `store.tags`), plus computes `persistedTagNames` from `task?.tagIds` resolved against `groupTags` (`REQ-TG-23`).
   - `useTaskForm` tracks `lastResetTaskIdRef` so that in edit mode, `form.reset(...)` runs only when `task.id` changes or `show` transitions to `true`, preventing background store updates from wiping unsaved form fields (`REQ-TG-18(2)`, `REQ-TG-19(2)`).
   - `TaskFormModal` passes `persistedTagNames` and `onRemoveRequest` to `TaskTagInput`, and renders a stacked `TaskTagRemovalModal` when a persisted tag's `×` is clicked in edit mode (`REQ-TG-16`, `REQ-TG-20`).
   - Confirming "Solo de la tarea" or "Del grupo" inside `TaskFormModal`:
     - Calls `store.removeTagFromTask(task.id, targetTag.id)` or `store.deleteTagFromGroup(targetTag.id)`.
     - Removes `targetTag.name` from `form.getValues('tagNames')` via `form.setValue('tagNames', ...)` while preserving all other unsaved form fields and session chips (`REQ-TG-18(2)`, `REQ-TG-19(2)`).
     - Calls `onTagMutated?.()` (used by `GroupsGridView` to refresh grid cards without closing `TaskFormModal`).
     - Returns focus to `tagInputRef.current?.focusInput()` (`REQ-TG-20(2)`).

5. **`GroupsGridView.tsx`, `GroupCard.tsx`, `TasksView.tsx`, and `TaskList.tsx`:**
   - `GroupCard` and `TaskList` accept and forward `onRemoveTag?: (task: Task, tag: Tag) => void` to `TaskCard`.
   - When `onRemoveTag(task, tag)` is triggered on a `TaskCard` in `GroupsGridView` or `TasksView`, it opens `TaskTagRemovalModal` (`tasksOpenModal('tagRemoval', task.id, { tagId: tag.id, tagName: tag.name })`), and upon confirmation executes `removeTagFromTask` or `deleteTagFromGroup` (followed by `refresh()` in `GroupsGridView`) and returns focus cleanly.

---

## 4. Verification & Testing Strategy

### 4.1 Unit Tests (`tests/unit/`)
1. **`tests/unit/shared/i18n/es.test.ts`:**
   - Verifies all new tag localization keys (`tagOverflowAria`, `editTagAria`, `editingTagInputAria`, `editTagHint`, `removeTagAria`, `removeTagDescription`, and `es.tags`).
2. **`tests/unit/features/tags/tag-operations.test.ts`:**
   - Tests `normalizeTagName`, `resolveCanonicalTagName` (case-insensitive canonical name reuse), and `hasTagInList`.
   - Tests `captureTagSegments`: valid segments (1..30 chars), empty/whitespace segments as no-ops, `> 30` char rejection with Spanish error message, and intra-task deduplication.
   - Tests `applyInlineTagEdit`: in-place replacement at exact index, case-only edit reusing canonical group name, intra-task duplicate removal keeping original chip position, `> 30` char commit showing validation error while staying in edit mode, and empty/invalid blur reverting to original chip.
   - Tests `isTagPersistedOnTask`, `filterTagSuggestions`, and `resolveTaskTags` (ignoring stale `tagId`s).
3. **`tests/unit/features/tasks/tasks-store.test.ts`:**
   - Verifies `allTags` hydration across multiple groups, intra-task `tagIds` deduplication on `createTask`/`updateTask`, and multi-group `removeTagFromTask` / `deleteTagFromGroup`.

### 4.2 Integration Tests (`tests/integration/`)
1. **`tests/integration/features/tags/task-tag-input.test.tsx` (RTL):**
   - Delimited creation via `;`, `,`, `Enter`, and multi-tag paste.
   - Empty delimiter no-op and `> 30` char Spanish validation error display/clearance.
   - Composite blur auto-capture when focus leaves container vs. preserving query when focus moves to an autocomplete suggestion (`Tab` + `Enter` or click).
   - Inline chip editing via click, `Enter`, and `Space`: confirming valid edit, cancelling via `Escape`, `> 30` char error on `Enter`, revert on empty/over-limit blur, and case-insensitive deduplication.
   - Immediate removal of unsaved session chips vs. triggering `onRemoveRequest` for persisted chips.
2. **`tests/integration/features/tags/tag-removal-flows.test.tsx` (RTL):**
   - Removing a tag chip directly from a `TaskCard` opens `TaskTagRemovalModal` with consequence warning; confirming "Solo de la tarea" vs. "Del grupo" updates tasks and group catalog appropriately.
   - Removing a persisted tag chip inside `TaskFormModal` (edit mode) while other form fields (`title`, `description`, session tags) have unsaved changes removes only that tag, preserves all unsaved form edits, persists the removal even if the edit modal is subsequently cancelled, and returns focus to the tag input.
   - Editing a task belonging to a non-active group in `GroupsGridView` resolves that group's tags and autocomplete suggestions accurately (`REQ-TG-23`).
3. **`tests/integration/features/tasks/task-card.test.tsx` & `task-form-modal.test.tsx`:**
   - Verifies per-chip remove button and non-interactive `"+N más"` overflow badge `aria-label` without breaking any existing tests.

### 4.3 End-to-End Tests (`tests/e2e/`)
1. **`tests/e2e/tags.spec.ts` (Playwright):**
   - Creates a task with multiple tags using `;` and `,` delimiters and blur auto-capture.
   - Verifies `> 30` char validation error in browser.
   - Verifies autocomplete suggestions and case-insensitive duplicate reuse across tasks in the same group.
   - Edits a tag inline on a task ("Editar desde una tarea") and verifies the change applies only to that task while the original tag remains on other tasks and in group suggestions.
   - Removes a tag from a task card via "Solo de la tarea" and verifies the tag remains available in group suggestions.
   - Removes a tag via "Del grupo" and verifies it disappears from all tasks in the group.
   - Verifies 5-chip preview + `"+N más"` overflow on card and full tag list in edit modal.
   - Verifies multi-group tag isolation when creating/editing tasks across two groups in `GroupsGridView`.
2. **Regression E2E (`tasks.spec.ts` & `groups.spec.ts`):**
   - Both existing Playwright suites must pass with 0 console errors.

---

## 5. Requirement Traceability Matrix

| Requirement | Plan Section | Target Files |
| :--- | :--- | :--- |
| **REQ-TG-01, REQ-TG-02, REQ-TG-04** | 3.2 | `src/shared/schemas/tag.ts`, `src/features/tags/utils/tag-operations.ts` |
| **REQ-TG-03** | 3.1, 3.2, 3.3, 3.4 | `tag-operations.ts`, `use-tag-input.ts`, `TaskTagInput.tsx`, `es.ts` |
| **REQ-TG-05** | 3.2 | `local-storage-tag-repository.ts`, `tag-operations.ts` (`resolveTaskTags`) |
| **REQ-TG-06, REQ-TG-06b** | 2.2, 3.2, 3.3, 3.4 | `tag-operations.ts`, `use-tag-input.ts`, `TaskTagInput.tsx`, `TaskFormModal.tsx` |
| **REQ-TG-07, REQ-TG-08** | 2.2, 3.2, 3.3, 3.4 | `tag-operations.ts` (`filterTagSuggestions`), `TaskTagInput.tsx` |
| **REQ-TG-09, REQ-TG-10** | 3.2, 3.4 | `tag-operations.ts` (`resolveCanonicalTagName`, `captureTagSegments`), `tasks-store.ts` |
| **REQ-TG-11, REQ-TG-12, REQ-TG-12b, REQ-TG-13, REQ-TG-14** | 2.1, 3.2, 3.3, 3.4 | `tag-operations.ts` (`applyInlineTagEdit`), `use-tag-input.ts`, `TaskTagInput.tsx`, `tasks-store.ts` |
| **REQ-TG-15, REQ-TG-16, REQ-TG-17** | 2.3, 3.2, 3.4 | `tag-operations.ts` (`isTagPersistedOnTask`), `TaskTagInput.tsx`, `TaskCard.tsx`, `TaskTagRemovalModal.tsx` |
| **REQ-TG-18, REQ-TG-19, REQ-TG-20** | 2.3, 3.4 | `TaskFormModal.tsx`, `use-task-form.ts`, `TaskTagRemovalModal.tsx`, `GroupsGridView.tsx`, `TasksView.tsx` |
| **REQ-TG-21, REQ-TG-22** | 3.2, 3.4 | `TaskCard.tsx`, `TaskFormModal.tsx`, `TaskTagInput.tsx` |
| **REQ-TG-23, REQ-TG-24, REQ-TG-25** | 2.4, 3.4 | `tasks-store.ts`, `use-task-form.ts`, `GroupCard.tsx`, `GroupsGridView.tsx` |
| **REQ-TG-26, REQ-TG-27** | 3.1, 3.4 | `es.ts`, `TaskTagInput.tsx`, `TaskCard.tsx`, `TaskTagRemovalModal.tsx` |
| **AC-TG-01 .. AC-TG-12** | 4.1 - 4.3 | Unit, integration, and Playwright E2E test suites |

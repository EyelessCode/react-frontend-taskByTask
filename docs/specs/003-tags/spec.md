# Spec 003: Task Tags & Group-Scoped Tag Management

- **Feature Name:** `003-tags`
- **Status:** approved
- **Created Date:** 2026-11-15
- **Authors:** SDD Planner Agent
- **SRS / SVD References:** `RF-22`, `RF-12`, `RF-13`, `RF-16`, `RF-07`, `UI-01`, `UI-06`, `RNF-01`, `RNF-04`, `RNF-07`, `RNF-12`, `RNF-14`, `RNF-18`, `RNF-19`, `RNF-20`, `Appendix A`, `Appendix B`, `Constitution Principles 1–6`

---

## 1. Purpose & Background

### 1.1 Purpose
Define the functional requirements, validation boundaries, lifecycle rules, inline editing behaviors, removal confirmation flows, and multi-group consistency invariants for Tags in Task by Task. This specification covers SRS requirement `RF-22` (Etiquetas en tareas) and its interactions with task creation/editing (`RF-12`, `RF-13`), cross-group task move/copy (`RF-16`), and group cascade deletion (`RF-07`), while adhering to user interface requirements (`UI-01`, `UI-06`) and non-functional requirements (`RNF-01`, `RNF-04`, `RNF-07`, `RNF-12`, `RNF-14`, `RNF-18`, `RNF-19`, `RNF-20`).

### 1.2 Background
In Task by Task, Tags ("Etiquetas") provide flexible, optional categorization for tasks within a group. Unlike personal user-level labels, tags belong strictly to the **group** (`groupId`) in which they are created (`RF-22`). They exist independently of tasks—meaning a tag remains in the group's catalog even when zero tasks currently reference it—and are shared across all tasks within that group.

While initial task-tag creation and chip rendering were introduced as a foundational subset in `001-tasks`, the complete `RF-22` lifecycle requires:
1. **Inline Tag Replacement on a Task ("Editar desde una tarea"):** Allowing users to activate and rewrite a tag chip directly inside a task's form so that the change replaces the tag association **only on that task**, leaving the original tag intact in the group catalog and on other tasks.
2. **End-to-End Dual-Scope Tag Removal ("Quitar de una tarea"):** Prompting the user with a confirmation dialog (`UI-06`) that warns of the consequences whenever removing a tag that is already persisted on a task—either directly from a task card or from the task edit view—to choose between removing the tag **"Solo de la tarea"** (dissociating it from that task only) or **"Del grupo"** (deleting the tag from the group catalog and dissociating it from all tasks in that group), while allowing unsaved session chips in the form to be dismissed immediately without a modal prompt.
3. **Accurate Multi-Group Tag Resolution:** Ensuring that tag display, autocomplete suggestions, inline replacement, and removal always resolve against the task's actual owning group (`task.groupId`) across all groups in the Groups Grid View.

---

## 2. Scope

### 2.1 In Scope
1. **Group-Scoped Tag Domain & Validation (`RF-22`, `RNF-04`, `RNF-19`, `Appendix B`):**
   - Tag name validation: mandatory 1 to 30 characters (after trimming), prohibiting delimiter characters (`;` and `,`).
   - Unlimited tags capacity per group (`RNF-04`, `Appendix B`).
   - Group ownership and persistence independence: tags belong to a specific group (`groupId`), persist even if no task references them, and are cascade-deleted only when their owning group is deleted (`RF-07`) or when explicitly deleted from the group via the removal confirmation dialog (`RF-22`).
2. **Delimited Tag Capture, Autocomplete & Deduplication (`RF-22`):**
   - Immediate conversion of typed text into a tag chip upon pressing `;`, `,`, or `Enter`, advancing the input cursor for the next tag without including `;` or `,` in the tag name.
   - Multi-tag paste/entry splitting when input contains `;` or `,` delimiters.
   - Auto-conversion of valid unconfirmed text remaining in the tag input when focus leaves the composite tag input and suggestion control or upon form submission, and validation error feedback when a tag exceeds 30 characters.
   - Real-time autocomplete suggestions filtered from existing tags belonging to the task's target group (`groupId`), excluding tags already selected on the current task.
   - Case-insensitive, whitespace-trimmed duplicate reuse: entering or selecting a tag name that matches an existing tag in the same group reuses that tag (and its canonical stored name) without displaying any error or duplicate warning.
3. **Inline Tag Editing on a Task ("Editar desde una tarea", `RF-22`):**
   - Activating (via pointer click or keyboard `Enter` / `Space`) a tag chip inside the task form's tag input transforms that chip into an inline editable text field pre-filled with the chip's current name.
   - Confirming the inline edit (via `Enter`, `,`, `;`, or focus blur) validates the new name (1 to 30 characters, no `;` or `,`) and replaces the tag in the task's tag list at the same index (or deduplicates if the new name already exists on the task).
   - Cancelling the inline edit (via `Escape`, confirming an empty string, or blurring an invalid string) restores the original chip unchanged.
   - Task-scoped isolation: saving the task after rewriting a tag associates the task with the new/reused group tag while leaving the original tag intact in the group catalog and on any other tasks that reference it.
4. **Dual-Scope Tag Removal Confirmation ("Quitar de una tarea", `RF-22`, `UI-06`):**
   - Triggered in **both** contexts for tags already persisted on the task:
     1. Directly on a task card when the user activates the remove button on any of the visible tag chips.
     2. Inside the task edit form when the user activates the remove button (`×`) on a tag chip that was already persisted on that task prior to the edit session (and has not been rewritten inline to an unsaved value).
   - Confirmation dialog (`UI-06`) warning of the consequences and presenting three explicit choices:
     - **"Solo de la tarea"**: Immediately dissociates the tag from that specific task only (in storage and in the open edit form, if active); the tag remains in the group catalog and on all other tasks.
     - **"Del grupo"**: Immediately deletes the tag from the group catalog in storage and removes its association from all tasks in that group (updating all visible cards and the open edit form, if active).
     - **"Cancelar"**: Closes the confirmation dialog with no changes.
   - Unsaved session chips: Any tag chip added during the current create or edit form session (whether newly typed or chosen from group autocomplete suggestions before saving the task), or any chip rewritten inline during the current session to a value not originally persisted on that task, is removed immediately from the form input upon clicking `×`, without opening the confirmation modal.
5. **Tag Visualization & Overflow Handling (`RF-22`):**
   - Task card preview displays up to 5 tag chips (each displaying its name and an accessible remove control) followed by a `"+N más"` badge when more than 5 tags are associated with the task.
   - Task edit/detail view displays all associated tags without truncation (including the 6th and subsequent tags hidden behind `"+N más"` on the card), enabling full viewing, inline editing, and removal.
6. **Multi-Group Tag Integrity (`RF-16`, `RF-22`, `RF-24`):**
   - Creating or editing a task in any group from the multi-group grid resolves existing tags and autocomplete suggestions strictly against that task's `groupId`.
   - Moving or copying a task between individual groups (`RF-16`) matches each associated tag by normalized name (trimmed, case-insensitive) in the destination group—reusing existing destination tags or creating missing ones in the destination group.
7. **Accessibility, Mobile-First Responsiveness & Spanish Localization (`UI-01`, `RNF-12`, `RNF-14`):**
   - Keyboard-accessible tag chips, inline edit inputs, autocomplete suggestions, remove buttons, and confirmation modals (`Tab`, `Enter`, `Space`, `Escape`).
   - 100% Spanish user-facing text and `aria-label` descriptions centralized in the localization dictionary.

### 2.2 Out of Scope
- Dedicated per-group tag catalog screen to list, globally rename, and delete unused group tags (`RF-23`, classified as **Posterior** in the SRS; barred by Constitution Principle 2 unless explicitly authorized).
- Advanced filtering of tasks by tags (`RF-26`, classified as **Posterior** in the SRS).
- Shared group role-based permissions for tag management (`RF-08`, `RF-09`, classified as **Posterior** in the SRS).
- Custom colors or priority badges on tags (`SVD 3.3`, explicitly excluded from product vision).

---

## 3. Requirements (EARS Format)

### 3.1 Tag Domain & Validation Rules (`RF-22`, `RNF-04`, `RNF-07`, `RNF-18`, `RNF-19`, `Appendix B`)

- **REQ-TG-01 (Ubiquitous - Group Ownership & Independence):**  
  The system shall scope every tag strictly to a single group (`groupId`) rather than to an individual user, and shall retain tags in the group catalog even when zero tasks in that group reference them (`RF-22`).

- **REQ-TG-02 (Ubiquitous - Tag Name Length & Character Constraints):**  
  The system shall enforce that every persisted or confirmed tag name, after trimming leading and trailing whitespace, has a length between 1 and 30 characters inclusive (`Appendix B`) and contains neither a semicolon (`;`) nor a comma (`,`) (`RF-22`, `RNF-19`).

- **REQ-TG-03 (Unwanted Behavior - Invalid Tag Name Rejection):**  
  If a user attempts to confirm or save a tag whose trimmed name exceeds 30 characters (or if a direct repository save receives a tag name `< 1` character, `> 30` characters, or containing `;` or `,`), then the system shall reject the invalid tag, preserve the user's input for correction, and display a localized Spanish validation message (`RNF-07`, `RNF-19`). Pressing `;`, `,`, or `Enter` when the tag input is empty or whitespace-only shall be treated as a no-op (clearing any whitespace without displaying an error).

- **REQ-TG-04 (Ubiquitous - Unlimited Tags Per Group):**  
  The system shall allow an arbitrary number of tags to be created within any group and associated with any task without imposing a hard numerical limit (`RNF-04`, `Appendix B`).

- **REQ-TG-05 (Unwanted Behavior - Missing Tag on Mutation vs. Safe Lookup):**  
  If a targeted tag deletion operation references a tag `id` that does not exist in storage, then the system shall raise a controlled `NotFoundError` (`RNF-07`, `RNF-18`). Conversely, read/query lookups by tag `id` or name shall safely return empty/`null` without throwing, and any stale or unresolvable `tagId` encountered on a task during card rendering, edit form initialization, or cross-group move/copy shall be silently ignored without error.

### 3.2 Delimited Tag Entry, Autocomplete & Deduplication (`RF-22`)

- **REQ-TG-06 (Event-Driven - Delimited Tag Capture):**  
  When a user types in the task tag input field and presses `;`, `,`, or `Enter` (or pastes/enters text containing `;` or `,`), the system shall split the text by `;` and `,`, trim each segment, ignore empty segments, convert each valid segment (1 to 30 characters) into a tag chip, and clear the valid segments from the input field so the cursor is ready for the next tag (`RF-22`). If any segment exceeds 30 characters, that invalid segment shall be kept in the input field and trigger the localized Spanish max-length validation error (`REQ-TG-03`), which clears as soon as the user edits the input to a valid length.

- **REQ-TG-06b (Event-Driven - Unconfirmed Tag Input on Composite Blur or Form Submit):**  
  When focus leaves the entire tag input and autocomplete suggestion composite control (excluding focus transitions or pointer interactions moving between the text input and its autocomplete suggestion items) or when the user submits the task form ("Guardar") while non-empty unconfirmed text remains in the tag input field:
  1. If the trimmed text is between 1 and 30 characters, the system shall automatically convert it into a tag chip (applying case-insensitive deduplication) before completing the composite blur or form submission.
  2. If the trimmed text exceeds 30 characters, the system shall display the localized Spanish max-length validation error and block form submission until corrected or cleared.
  3. While focus moves from the tag input field to an item in the autocomplete suggestion list (via `Tab` or pointer interaction), the system shall keep the suggestion list open and shall **not** prematurely convert the partial query into a chip so the user can activate the desired suggestion (`REQ-TG-08`).

- **REQ-TG-07 (Event-Driven - Group-Scoped Autocomplete Suggestions):**  
  While a user types non-empty text in the task tag input field, the system shall display a selectable list of existing tags belonging to the task's target group (`groupId`) whose names contain the typed substring (case-insensitive) and that are not already present on the current task (`RF-22`).

- **REQ-TG-08 (Event-Driven - Selecting an Autocomplete Suggestion):**  
  When a user selects a tag from the autocomplete suggestion list (via pointer click or keyboard activation), the system shall append that tag (using its canonical stored name) as a chip on the task, clear the text input and any validation error, and keep focus ready for additional tag entry (`RF-22`).

- **REQ-TG-09 (Ubiquitous - Case-Insensitive Duplicate Reuse):**  
  When a user enters, inline-edits, or confirms a tag name that matches an existing tag in the same group (comparing trimmed, case-insensitive strings), the system shall reuse the existing group tag (preserving its canonical `id` and canonical stored name, including when the user only changed letter casing such as `"trabajo"` to `"Trabajo"`) without creating a duplicate record and without displaying any error or duplicate warning (`RF-22`).

- **REQ-TG-10 (Ubiquitous - Intra-Task Tag Deduplication):**  
  When a user enters or edits a tag name that matches a tag chip already present on the same task (comparing trimmed, case-insensitive strings), the system shall retain only a single instance of that tag at its existing position on the task without showing an error or duplicate warning (`RF-22`).

### 3.3 Inline Tag Editing on a Task ("Editar desde una tarea", `RF-22`)

- **REQ-TG-11 (Event-Driven - Entering Inline Edit Mode on a Tag Chip):**  
  When a user activates a tag chip's label inside the task form's tag input (via pointer click or keyboard `Enter` / `Space`), the system shall transform that specific chip into an inline editable text input pre-populated with the chip's current name and focused for immediate editing (`RF-22`).

- **REQ-TG-12 (Event-Driven - Confirming an Inline Tag Edit):**  
  When a user confirms an inline tag edit (by pressing `Enter`, `,`, `;`, or moving focus away via blur; any `;` or `,` characters pasted into the inline input are stripped prior to evaluation) with a valid trimmed name (1 to 30 characters):
  1. If the updated name does not match any other chip currently on the task (case-insensitively), the system shall replace the chip at its **exact original index** with the updated name (or canonical group tag name if a matching group tag exists per `REQ-TG-09`).
  2. If the updated name matches another chip already present on the task (case-insensitively), the system shall keep the existing matching chip at its original position and remove the duplicate edited entry (`REQ-TG-10`).

- **REQ-TG-12b (Event-Driven - Inline Edit Interaction with Chip Removal or Form Submit):**  
  If a user clicks a chip's remove button (`×`) or submits the task form ("Guardar") while an inline chip edit input is active, the inline input's blur resolution (`REQ-TG-12` / `REQ-TG-13`) shall execute first before processing the removal or form submission.

- **REQ-TG-13 (Event-Driven - Invalid Input or Cancellation During Inline Tag Edit):**  
  1. If a user presses `Enter`, `,`, or `;` while editing a tag chip inline and the trimmed text exceeds 30 characters, the system shall reject confirmation, keep the inline input active, and display the localized Spanish max-length validation message (`REQ-TG-03`).
  2. If a user presses `Escape` during inline editing, confirms an empty/whitespace-only string (`0` characters after trim), or blurs the inline input while its trimmed text is empty or exceeds 30 characters, the system shall cancel the inline edit, clear any inline validation error, and restore the original tag chip unchanged (`RF-22`).

- **REQ-TG-14 (Event-Driven - Task-Only Replacement Upon Save):**  
  When a user saves a task after rewriting one or more of its tag chips inline, the system shall update the tag associations **only on that task** (matching an existing tag by case-insensitive name in `task.groupId` or creating a new tag in `task.groupId`), while leaving the original tag record untouched in the group catalog and preserving its association with all other tasks in the group (`RF-22`).

### 3.4 Dual-Scope Tag Removal Confirmation ("Quitar de una tarea", `RF-22`, `UI-06`)

- **REQ-TG-15 (Event-Driven - Immediate Removal of Unsaved Session Tag Chips):**  
  When a user clicks the remove button (`×`) on a tag chip in the task form that is **not** currently persisted on that task—specifically:
  1. Any tag chip in the task creation form (`create` mode),
  2. Any tag chip added during the current task edit form session (whether newly typed or selected from group autocomplete suggestions prior to saving the task), or
  3. Any tag chip in the task edit form that was rewritten inline during the current session to a name that was not originally persisted on that task,  
  the system shall immediately remove that chip from the form's tag list without opening a confirmation modal (`RF-22`).

- **REQ-TG-16 (Event-Driven - Requesting Removal of a Persisted Tag in the Task Edit Form):**  
  When a user is editing an existing persisted task and clicks the remove button (`×`) on a tag chip that was already persisted on that task (matching its persisted `tagIds` in `task.groupId`), the system shall open the tag removal confirmation dialog (`UI-06`), displaying the tag name, warning the user of the consequences of removing the tag from the task versus deleting it from the entire group and all its tasks, and offering **"Solo de la tarea"**, **"Del grupo"**, and **"Cancelar"** (`RF-22`, `UI-06`).

- **REQ-TG-17 (Event-Driven - Requesting Removal of a Tag Directly from a Task Card):**  
  When a user clicks the remove control (`×`) on a visible tag chip rendered on a task card, the system shall open the tag removal confirmation dialog (`UI-06`), displaying the tag name, warning the user of the consequences of removing the tag from the task versus deleting it from the entire group and all its tasks, and offering **"Solo de la tarea"**, **"Del grupo"**, and **"Cancelar"** (`RF-22`, `UI-06`).

- **REQ-TG-18 (Event-Driven - Confirming "Solo de la tarea" Removal):**  
  When the user selects **"Solo de la tarea"** in the tag removal confirmation dialog:
  1. The system shall immediately dissociate that tag `id` from the target task in storage and update all visible task cards, while keeping the tag in the group catalog and on all other tasks (`RF-22`).
  2. If triggered from inside the open task edit form, the system shall also remove that single tag chip from the active form's tag list while **strictly preserving** all other unsaved edits in the form (title, description, due date, due time, and other session or inline-edited tag chips).

- **REQ-TG-19 (Event-Driven - Confirming "Del grupo" Removal):**  
  When the user selects **"Del grupo"** in the tag removal confirmation dialog:
  1. The system shall permanently delete the tag from the group catalog in storage and remove its `id` from `tagIds` across **all** tasks belonging to that group (`RF-22`, `UI-06`).
  2. If triggered from inside the open task edit form, the system shall also remove that tag chip from the active form's tag list while **strictly preserving** all other unsaved edits in the form.

- **REQ-TG-20 (Event-Driven - Cancelling Tag Removal & Modal Stacking / Focus Return):**  
  1. When the user selects **"Cancelar"** or dismisses the tag removal confirmation dialog, the system shall close the confirmation dialog and leave both the task's tags and the group's tag catalog unchanged (`UI-06`).
  2. When the tag removal confirmation dialog is opened from inside the task edit modal, the task edit modal shall remain active with its unsaved form state intact; upon confirming or cancelling the removal dialog, keyboard focus shall return to the task edit form (or to the originating task card when triggered from a card) (`RNF-12`).
  3. Because confirmed "Solo de la tarea" and "Del grupo" actions persist immediately upon confirmation in the `UI-06` dialog, subsequently cancelling ("Cancelar") the task edit modal discards only the remaining unsaved form edits while keeping the confirmed tag removal persisted.

### 3.5 Tag Visualization & Overflow Rules (`RF-22`)

- **REQ-TG-21 (Ubiquitous - Task Card 5-Chip Preview & Informational Overflow Badge):**  
  On every task card, the system shall display at most the first 5 associated resolvable tags (in the order stored in `task.tagIds`) as individual chips, each with an accessible remove button; when a task has more than 5 associated resolvable tags (`N > 5`), the card shall display the first 5 tag chips followed by a non-interactive informational overflow badge displaying `"+(N - 5) más"` with descriptive Spanish `aria-label` text for assistive technologies (`RF-22`, `RNF-12`).

- **REQ-TG-22 (Ubiquitous - Full Tag List in Task Detail/Edit View):**  
  When a user opens a task in the edit/detail modal, the system shall display all resolvable tags associated with that task without truncation (including any tags beyond the first 5 that were summarized by `"+N más"` on the card), allowing every tag to be viewed, edited inline, or removed (`RF-22`).

### 3.6 Multi-Group Tag Resolution & Cross-Group Operations (`RF-07`, `RF-16`, `RF-22`, `RF-24`)

- **REQ-TG-23 (Ubiquitous - Group-Accurate Tag Resolution in Multi-Group View):**  
  When rendering task cards, opening the task creation form for a specific group, or opening the task edit form for an existing task in the Groups Grid View, the system shall resolve existing tag names and autocomplete suggestions strictly from the tags belonging to that task's `groupId`, regardless of which group was previously selected as active (`RF-22`, `RF-24`).

- **REQ-TG-24 (Event-Driven - Tag Synchronization on Task Move or Copy):**  
  When a task with associated tags is moved or copied to another individual group (`RF-16`), the system shall resolve each resolvable tag by its trimmed, case-insensitive name in the destination group—reusing the destination group's existing tag `id` if present, or creating a new tag with that name in the destination group—while leaving the origin group's tag catalog intact (`RF-16`, `RF-22`).

- **REQ-TG-25 (Event-Driven - Cascade Tag Deletion on Group Deletion):**  
  When an individual group is deleted (`RF-07`), the system shall permanently delete all tags belonging to that group (`Tag.groupId === groupId`) from storage.

### 3.7 Accessibility, Responsiveness & Spanish Localization (`UI-01`, `RNF-12`, `RNF-14`)

- **REQ-TG-26 (Ubiquitous - Mobile-First Responsive Tag Presentation):**  
  All tag chips, inline tag edit inputs, autocomplete dropdowns, and tag removal confirmation modals shall wrap and adapt cleanly on mobile viewports (~375px) as well as tablet and desktop viewports (`UI-01`).

- **REQ-TG-27 (Ubiquitous - Keyboard & Screen-Reader Accessibility):**  
  All interactive tag controls (tag input field, chip inline-edit trigger via `Enter` / `Space`, active inline-edit input, chip remove button `×`, autocomplete suggestion items, and confirmation modal buttons) shall be operable via keyboard (`Tab`, `Enter`, `Space`, `Escape`), display visible focus indicators, and expose descriptive Spanish `aria-label` attributes; non-interactive informational indicators (such as the `"+N más"` overflow badge) shall expose descriptive Spanish `aria-label` text without requiring keyboard activation (`RNF-12`, `RNF-14`).

---

## 4. Domain Models & Specifications

### 4.1 Tag Entity & Core Invariants

```
Tag Contract:
- id: string (unique identifier)
- name: string (1..30 chars, trimmed, no ';' or ',')
- groupId: string (owning Group.id)

Core Invariants:
1. Group Ownership: Every Tag belongs to exactly one Group (groupId) and never to an individual user.
2. Case-Insensitive Uniqueness per Group: Within the same groupId, no two tags may share the same normalized name (name.trim().toLowerCase()). Attempting to create or inline-rename to a case-insensitive match reuses the existing Tag and its canonical stored name silently.
3. Cross-Group Independence: Two different groups may each have a tag with the same name; they have distinct Tag IDs and independent lifecycles.
4. Task-Independent Lifespan: A Tag remains in its group catalog even when 0 tasks reference its id.
5. Referential Integrity on Group Delete: Deleting a tag "Del grupo" removes the Tag record and strips its id from every Task.tagIds in that group.
```

### 4.2 Tag Operations Comparison Matrix (`RF-22`)

| User Action | Where Triggered | Confirmation Dialog? | Effect on Target Task | Effect on Other Tasks in Group | Effect on Group Tag Catalog |
| :--- | :--- | :---: | :--- | :--- | :--- |
| **Type tag + `;` / `,` / `Enter` or blur/submit (new name)** | Task Form | No | Associates newly created tag `id` upon task save | None | Creates new `Tag` in `groupId` upon task save |
| **Type tag + `;` / `,` / `Enter` or select suggestion (existing name)** | Task Form | No | Associates existing tag `id` upon task save | None | Reuses existing `Tag` and canonical name silently |
| **Inline edit chip (`Editar desde una tarea`)** | Task Form (activate chip) | No | Replaces chip at same index on this task only (deduplicating if already on task) | None (other tasks keep original tag) | Original `Tag` remains intact; new `Tag` created or existing `Tag` reused in `groupId` upon task save |
| **Remove unsaved session chip (`×`)** | Task Form (newly typed, suggestion-added before save, or inline-rewritten chip) | No | Removes chip from form state immediately | None | None |
| **Remove persisted task tag → `"Solo de la tarea"`** | Task Card chip `×` OR Task Edit Form chip `×` (persisted on task) | Yes (`UI-06`) | Immediately removes tag `id` from this task (and from open edit form while preserving unsaved fields) | None (other tasks keep tag) | `Tag` remains in `groupId` (even if now unused) |
| **Remove persisted task tag → `"Del grupo"`** | Task Card chip `×` OR Task Edit Form chip `×` (persisted on task) | Yes (`UI-06`) | Immediately removes tag `id` from this task (and from open edit form while preserving unsaved fields) | Immediately removes tag `id` from **all** tasks in `groupId` | Permanently deletes `Tag` from `groupId` |

### 4.3 Inline Tag Chip Editing State Machine (`RF-22`)

```mermaid
stateDiagram-v2
    [*] --> DisplayChip: Render tag chip in Task Form
    DisplayChip --> EditingChip: Click chip label or press Enter / Space on focused chip
    EditingChip --> DisplayChip: Press Escape (clear error, revert to original name)
    EditingChip --> DisplayChip: Confirm via Enter / ',' / ';' / Blur (valid 1..30 chars -> replace at index or deduplicate)
    EditingChip --> EditingChip: Press Enter / ',' / ';' with > 30 chars (show max-length error, stay in edit)
    EditingChip --> DisplayChip: Confirm empty string or Blur with empty / > 30 chars (clear error, revert to original name)
    DisplayChip --> ConfirmRemoval: Click '×' on tag already persisted on task (in edit mode)
    DisplayChip --> RemovedFromForm: Click '×' on unsaved session tag (newly typed, suggestion-picked before save, or inline-rewritten)
    ConfirmRemoval --> RemovedFromTask: Select "Solo de la tarea"
    ConfirmRemoval --> RemovedFromGroup: Select "Del grupo"
    ConfirmRemoval --> DisplayChip: Select "Cancelar"
```

### 4.4 Spanish Localization Contract (`RNF-14`)

All user-facing copy for tag interactions, validation messages, inline editing, and removal confirmation is maintained in the centralized Spanish localization dictionary:

- **Input & Suggestions:**
  - `tagsLabel`: `'Etiquetas'`
  - `tagsPlaceholder`: `'Escribe una etiqueta y presiona coma o punto y coma'`
  - `tagOverflow`: `'+{count} más'` (e.g., `'+2 más'`)
  - `tagOverflowAria`: `'{count} etiquetas adicionales ocultas. Edita la tarea para ver todas.'`
- **Validation Messages (`REQ-TG-03`, `Appendix B`, via shared `validation` templates for `'El nombre de la etiqueta'`):**
  - `minLength('El nombre de la etiqueta', 1)`: `'El nombre de la etiqueta debe tener al menos 1 caracteres'`
  - `maxLength('El nombre de la etiqueta', 30)`: `'El nombre de la etiqueta no puede exceder 30 caracteres'`
  - `invalidCharacters('; o ,')`: `'No se permiten los siguientes caracteres: ; o ,'`
- **Accessibility & Inline Editing (`RNF-12`):**
  - `editTagAria`: `'Editar etiqueta {tagName}'`
  - `editingTagInputAria`: `'Editando etiqueta {tagName}'`
  - `editTagHint`: `'Haz clic o presiona Enter en una etiqueta para editarla en esta tarea'`
  - `removeTagAria`: `'Quitar etiqueta {tagName}'`
- **Removal Confirmation Modal (`UI-06`):**
  - `removeTagTitle`: `'Quitar etiqueta'`
  - `removeTagPrompt`: `'¿Cómo deseas quitar la etiqueta "{tagName}"?'`
  - `removeTagDescription`: `'Si eliges "Solo de la tarea", la etiqueta se conservará en el grupo. Si eliges "Del grupo", se eliminará permanentemente del grupo y de todas sus tareas.'`
  - `removeOnlyFromTask`: `'Solo de la tarea'`
  - `removeFromGroup`: `'Del grupo'`

---

## 5. Acceptance Criteria

1. **AC-TG-01 (Delimited Tag Creation, Composite Blur Auto-Capture & Validation):** In the task form, typing a tag name (1 to 30 characters) followed by `;`, `,`, or `Enter` (or moving focus outside the composite tag input + suggestion control, or submitting the form with valid unconfirmed text) converts the text into a tag chip without the delimiter and clears the input for the next tag, while moving focus into the autocomplete suggestion list preserves the query until a suggestion is chosen. Pressing `;`, `,`, or `Enter` on an empty/whitespace input is a no-op. Attempting to confirm or submit a tag > 30 characters displays the Spanish max-length validation error and retains the text for correction.
2. **AC-TG-02 (Group-Scoped Suggestions):** Typing in the tag input displays matching autocomplete suggestions strictly from the target group's existing tags (`groupId`), excluding tags already added to the task. Selecting a suggestion adds the chip with its canonical name and clears the input.
3. **AC-TG-03 (Case-Insensitive Duplicate Reuse):** Adding or inline-editing a tag whose trimmed name matches an existing tag in the same group (regardless of letter case, e.g., `"trabajo"` vs `"Trabajo"`) reuses the existing tag and its canonical stored name without creating a duplicate in storage and without displaying any error or warning.
4. **AC-TG-04 (Tag Persistence Independence):** Removing a tag from the last task that used it (via "Solo de la tarea" or task deletion) leaves the tag in the group's catalog so it continues to appear in autocomplete suggestions for that group.
5. **AC-TG-05 (Inline Tag Replacement on a Task):** Activating a tag chip in the task form (via click, `Enter`, or `Space`) turns it into an inline input. Confirming a valid new name (via `Enter`, `,`, `;`, or blur) replaces the chip at its original index (or deduplicates if the new name is already on the task). Pressing `Enter`, `,`, or `;` with > 30 characters displays a Spanish validation message; pressing `Escape` or blurring an empty/over-limit value restores the original chip. Saving the task associates the new/reused tag with that task only, leaving the original tag intact in the group catalog and on other tasks.
6. **AC-TG-06 (Unsaved Session Chip Immediate Removal):** Clicking `×` on any tag chip added during the current create or edit session (whether newly typed, selected from autocomplete suggestions before saving, or rewritten inline to a non-persisted value) removes it immediately from the form without opening the confirmation modal.
7. **AC-TG-07 (Persisted Tag Removal from Task Edit Form):** Clicking `×` on a tag chip that was already persisted on the task inside the task edit modal opens the tag removal confirmation dialog displaying the consequence warning and offering "Solo de la tarea", "Del grupo", and "Cancelar". Confirming removes only that tag while preserving all other unsaved form field edits and session chips, and returns focus to the edit modal.
8. **AC-TG-08 (Persisted Tag Removal from Task Card):** Clicking the remove button on a tag chip directly on a task card opens the tag removal confirmation dialog displaying the consequence warning and offering "Solo de la tarea", "Del grupo", and "Cancelar".
9. **AC-TG-09 ("Solo de la tarea" vs. "Del grupo" Execution):**
   - Selecting "Solo de la tarea" immediately removes the tag only from the target task in storage and UI; other tasks in the group and the group tag catalog keep the tag.
   - Selecting "Del grupo" immediately deletes the tag from the group catalog and removes it from all tasks in that group.
10. **AC-TG-10 (5-Chip Preview & Overflow Handling):** A task with more than 5 tags displays the first 5 tag chips and a `"+N más"` badge on its task card, while opening the task edit modal displays all associated tags and allows editing or removing any of them (including the 6th+ tags).
11. **AC-TG-11 (Multi-Group Tag Resolution):** Editing a task or creating a task inside any group card in the Groups Grid View resolves existing tags and suggestions strictly for that group's `groupId`, even when multiple groups are visible on screen.
12. **AC-TG-12 (Accessibility & Mobile-First UI):** All interactive tag controls (chips, inline inputs, remove buttons, suggestions, and confirmation dialogs) are operable via keyboard with visible focus indicators and Spanish `aria-label` attributes, the non-interactive `"+N más"` overflow badge exposes descriptive Spanish `aria-label` text, and all elements wrap responsively at ~375px mobile width.

---

## 6. Traceability Matrix

| SRS Requirement | Feature Requirement | Coverage Details |
| :--- | :--- | :--- |
| **RF-22** | REQ-TG-01 to REQ-TG-24 | Group-scoped tags, `;`/`,` capture, suggestions, case-insensitive reuse, persistence when unused, inline edit on task only, dual-scope removal ("Solo de la tarea" vs. "Del grupo"), 5 chips + `"+N más"` |
| **RF-12 / RF-13** | REQ-TG-06, REQ-TG-06b, REQ-TG-11 to REQ-TG-20, REQ-TG-22, REQ-TG-23 | Tag creation, inline editing, and removal during task creation and task editing |
| **RF-16** | REQ-TG-05, REQ-TG-24 | Tag synchronization by case-insensitive name when moving or copying tasks between individual groups |
| **RF-07** | REQ-TG-25 | Cascade deletion of all group tags when an individual group is deleted |
| **UI-01** | REQ-TG-26, REQ-TG-27 | Mobile-First responsive chip wrapping and 100% Spanish UI text |
| **UI-06** | REQ-TG-16, REQ-TG-17, REQ-TG-18, REQ-TG-19, REQ-TG-20 | Confirmation dialog with explicit consequence warning before removing a persisted tag from a task or from the entire group |
| **RNF-01** | REQ-TG-07, REQ-TG-18, REQ-TG-19 | Immediate client-side autocomplete and tag removal under 2 seconds |
| **RNF-04** | REQ-TG-04 | Unlimited tags capacity per group and per task |
| **RNF-07** | REQ-TG-02, REQ-TG-03, REQ-TG-05 | Controlled validation and not-found error handling |
| **RNF-12** | REQ-TG-20, REQ-TG-27 | Keyboard navigation (`Tab`, `Enter`, `Space`, `Escape`), focus return, visible focus rings, screen-reader labels |
| **RNF-14** | REQ-TG-27, Section 4.4 | Spanish localization for all tag labels, hints, validation errors, and modal prompts |
| **RNF-18** | REQ-TG-05 | Controlled `NotFoundError` when deleting a non-existent tag ID, safe handling of stale tag references |
| **RNF-19 / Appendix B** | REQ-TG-02, REQ-TG-03, REQ-TG-04, Section 4.1 | Tag name length limits (1..30 chars), forbidden `;`/`,` characters, unlimited tag count |
| **RNF-20** | REQ-TG-01, Section 4.1 | Group-scoped tag model ready for future shared groups (`RF-08`, `RF-09`) and tag filtering (`RF-26`) |

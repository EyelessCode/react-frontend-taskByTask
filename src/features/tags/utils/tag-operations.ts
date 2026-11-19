import { LIMITS, type Tag } from '../../../shared/schemas';
import { es } from '../../../shared/i18n';

const TAG_FIELD_LABEL = 'El nombre de la etiqueta';

/** Normalizes a tag name for case-insensitive, trimmed comparison. */
export function normalizeTagName(name: string): string {
  return name.trim().toLowerCase();
}

/** Finds an existing group tag matching the given name case-insensitively. */
export function findMatchingGroupTag(name: string, groupTags: Tag[]): Tag | undefined {
  const normalized = normalizeTagName(name);
  if (!normalized) return undefined;
  return groupTags.find((t) => normalizeTagName(t.name) === normalized);
}

/** Resolves a tag name to its canonical group casing when present, or trimmed input otherwise. */
export function resolveCanonicalTagName(name: string, groupTags: Tag[]): string {
  const trimmed = name.trim();
  const match = findMatchingGroupTag(trimmed, groupTags);
  return match ? match.name : trimmed;
}

/** Checks whether a tag name is already present in a string list (case-insensitive). */
export function hasTagInList(tagName: string, list: string[]): boolean {
  const normalized = normalizeTagName(tagName);
  return list.some((item) => normalizeTagName(item) === normalized);
}

/** Returns true if a chip name matches a tag already persisted on the edited task. */
export function isTagPersistedOnTask(tagName: string, persistedTagNames: string[]): boolean {
  return hasTagInList(tagName, persistedTagNames);
}

/** Result of capturing delimited tag segments from user input. */
export interface TagCaptureResult {
  updatedTags: string[];
  remainingInput: string;
  validationError: string | null;
}

/**
 * Converts delimited tag segments into deduplicated canonical chips.
 * Empty/whitespace segments are no-ops; segments exceeding `LIMITS.TAG_NAME_MAX` halt capture and return an error.
 */
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
      continue;
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

/** Result of confirming or blurring an inline tag chip edit. */
export interface InlineTagEditResult {
  updatedTags: string[];
  shouldExitEdit: boolean;
  validationError: string | null;
}

/**
 * Applies an inline tag edit at `editIndex`, handling delimiter stripping,
 * max-length validation (`commit` vs `blur`), canonical casing reuse, and intra-task deduplication.
 */
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

  const sanitized = rawNewValue.replace(/[;,]/g, '').trim();

  if (sanitized.length === 0) {
    return { updatedTags: currentTags, shouldExitEdit: true, validationError: null };
  }

  if (sanitized.length > LIMITS.TAG_NAME_MAX) {
    if (mode === 'commit') {
      return {
        updatedTags: currentTags,
        shouldExitEdit: false,
        validationError: es.validation.maxLength(TAG_FIELD_LABEL, LIMITS.TAG_NAME_MAX),
      };
    }
    return { updatedTags: currentTags, shouldExitEdit: true, validationError: null };
  }

  const canonical = resolveCanonicalTagName(sanitized, groupTags);
  const normalizedCanonical = normalizeTagName(canonical);

  const existingDuplicateIndex = currentTags.findIndex(
    (t, idx) => idx !== editIndex && normalizeTagName(t) === normalizedCanonical,
  );

  if (existingDuplicateIndex >= 0) {
    const deduplicated = currentTags.filter((_, idx) => idx !== editIndex);
    return { updatedTags: deduplicated, shouldExitEdit: true, validationError: null };
  }

  const replaced = currentTags.map((t, idx) => (idx === editIndex ? canonical : t));
  return { updatedTags: replaced, shouldExitEdit: true, validationError: null };
}

/** Filters group tag suggestions by query while excluding tags already selected on the task. */
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

/** Resolves task `tagIds` to `Tag` entities, deduplicating IDs and ignoring stale or cross-group IDs. */
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

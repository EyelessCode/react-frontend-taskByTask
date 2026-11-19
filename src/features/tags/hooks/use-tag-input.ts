import { useState, type ChangeEvent, type KeyboardEvent } from 'react';
import { LIMITS, type Tag } from '../../../shared/schemas';
import {
  applyInlineTagEdit,
  captureTagSegments,
  filterTagSuggestions,
  hasTagInList,
  isTagPersistedOnTask,
  resolveCanonicalTagName,
} from '../utils';

export interface UseTagInputOptions {
  value: string[];
  onChange?: (tags: string[]) => void;
  availableTags: Tag[];
  persistedTagNames: string[];
  onRemoveRequest?: (tagName: string) => void;
}

function areTagArraysEqual(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((item, idx) => item === b[idx]);
}

/**
 * Encapsulates tag chip input state, delimited capture, composite blur handling,
 * inline chip editing, and persisted vs. session chip removal.
 */
export function useTagInput({
  value,
  onChange,
  availableTags,
  persistedTagNames,
  onRemoveRequest,
}: UseTagInputOptions) {
  const [inputValue, setInputValue] = useState('');
  const [inputError, setInputError] = useState<string | null>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [inlineError, setInlineError] = useState<string | null>(null);

  const emitIfChanged = (nextTags: string[]) => {
    if (!areTagArraysEqual(nextTags, value)) {
      onChange?.(nextTags);
    }
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val.includes(';') || val.includes(',')) {
      const parts = val.split(/[;,]/);
      const result = captureTagSegments(
        parts.slice(0, -1),
        parts[parts.length - 1] ?? '',
        value,
        availableTags,
      );
      emitIfChanged(result.updatedTags);
      setInputValue(result.remainingInput);
      setInputError(result.validationError);
      return;
    }

    setInputValue(val);
    if (inputError && val.trim().length <= LIMITS.TAG_NAME_MAX) {
      setInputError(null);
    }
  };

  const handleInputKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === ';' || e.key === ',' || e.key === 'Enter') {
      e.preventDefault();
      const result = captureTagSegments([inputValue], '', value, availableTags);
      emitIfChanged(result.updatedTags);
      setInputValue(result.remainingInput);
      setInputError(result.validationError);
    }
  };

  const handleCompositeBlur = (
    relatedTarget: EventTarget | null,
    container: HTMLElement | null,
  ) => {
    if (container && relatedTarget instanceof Node && container.contains(relatedTarget)) {
      setIsFocused(true);
      return;
    }
    setIsFocused(false);
    if (inputValue.trim().length > 0) {
      const result = captureTagSegments([inputValue], '', value, availableTags);
      emitIfChanged(result.updatedTags);
      setInputValue(result.remainingInput);
      setInputError(result.validationError);
    }
  };

  const selectSuggestion = (suggestionName: string) => {
    const canonical = resolveCanonicalTagName(suggestionName, availableTags);
    if (!hasTagInList(canonical, value)) {
      onChange?.([...value, canonical]);
    }
    setInputValue('');
    setInputError(null);
    setIsFocused(false);
  };

  const startInlineEdit = (index: number) => {
    if (index < 0 || index >= value.length) return;
    setEditingIndex(index);
    setEditingValue(value[index] ?? '');
    setInlineError(null);
  };

  const handleInlineValueChange = (val: string) => {
    setEditingValue(val);
    if (inlineError && val.replace(/[;,]/g, '').trim().length <= LIMITS.TAG_NAME_MAX) {
      setInlineError(null);
    }
  };

  const commitInlineEdit = (mode: 'commit' | 'blur', currentTags: string[] = value): string[] | null => {
    if (editingIndex === null) return currentTags;
    const result = applyInlineTagEdit(
      currentTags,
      editingIndex,
      editingValue,
      availableTags,
      mode,
    );
    if (!result.shouldExitEdit) {
      setInlineError(result.validationError);
      return null;
    }
    emitIfChanged(result.updatedTags);
    setEditingIndex(null);
    setEditingValue('');
    setInlineError(null);
    return result.updatedTags;
  };

  const handleInlineKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      setEditingIndex(null);
      setEditingValue('');
      setInlineError(null);
      return;
    }
    if (e.key === 'Enter' || e.key === ',' || e.key === ';') {
      e.preventDefault();
      commitInlineEdit('commit');
    }
  };

  const handleInlineBlur = () => {
    commitInlineEdit('blur');
  };

  const handleChipRemoveClick = (tagName: string) => {
    let latestTags = value;
    if (editingIndex !== null) {
      const resolved = commitInlineEdit('blur', value);
      if (resolved) {
        latestTags = resolved;
      }
    }

    if (isTagPersistedOnTask(tagName, persistedTagNames) && onRemoveRequest) {
      onRemoveRequest(tagName);
      return;
    }

    const filtered = latestTags.filter((t) => t !== tagName);
    if (!areTagArraysEqual(filtered, latestTags)) {
      onChange?.(filtered);
    }
  };

  const commitPendingBeforeSubmit = (): { ok: boolean; tags: string[] } => {
    let workingTags = value;

    if (editingIndex !== null) {
      const resolved = commitInlineEdit('commit', workingTags);
      if (resolved === null) {
        return { ok: false, tags: workingTags };
      }
      workingTags = resolved;
    }

    if (inputValue.trim().length > 0) {
      const result = captureTagSegments([inputValue], '', workingTags, availableTags);
      if (result.validationError) {
        setInputError(result.validationError);
        setInputValue(result.remainingInput);
        return { ok: false, tags: workingTags };
      }
      workingTags = result.updatedTags;
      emitIfChanged(workingTags);
      setInputValue('');
      setInputError(null);
    }

    return { ok: true, tags: workingTags };
  };

  const suggestions = filterTagSuggestions(inputValue, availableTags, value);

  return {
    inputValue,
    inputError,
    isFocused,
    setIsFocused,
    editingIndex,
    editingValue,
    inlineError,
    suggestions,
    handleInputChange,
    handleInputKeyDown,
    handleCompositeBlur,
    selectSuggestion,
    startInlineEdit,
    handleInlineValueChange,
    handleInlineKeyDown,
    handleInlineBlur,
    handleChipRemoveClick,
    commitPendingBeforeSubmit,
  };
}

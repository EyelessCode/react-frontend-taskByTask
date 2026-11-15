import { describe, it, expect } from 'vitest';
import type { Tag } from '@/shared/schemas';
import { es } from '@/shared/i18n';
import {
  normalizeTagName,
  findMatchingGroupTag,
  resolveCanonicalTagName,
  hasTagInList,
  isTagPersistedOnTask,
  captureTagSegments,
  applyInlineTagEdit,
  filterTagSuggestions,
  resolveTaskTags,
} from '@/features/tags/utils/tag-operations';

const groupTags: Tag[] = [
  { id: 't1', name: 'Trabajo', groupId: 'g1' },
  { id: 't2', name: 'Urgente', groupId: 'g1' },
  { id: 't3', name: 'Estudio', groupId: 'g1' },
  { id: 't4', name: 'Personal', groupId: 'g2' },
];

describe('tag-operations', () => {
  describe('normalizeTagName', () => {
    it('trims whitespace and lowercases tag names', () => {
      expect(normalizeTagName('  Trabajo  ')).toBe('trabajo');
      expect(normalizeTagName('URGENTE')).toBe('urgente');
      expect(normalizeTagName('   ')).toBe('');
    });
  });

  describe('findMatchingGroupTag', () => {
    it('returns undefined for empty or whitespace-only input', () => {
      expect(findMatchingGroupTag('', groupTags)).toBeUndefined();
      expect(findMatchingGroupTag('   ', groupTags)).toBeUndefined();
    });

    it('matches group tags case-insensitively and trimmed', () => {
      expect(findMatchingGroupTag('  trabajo ', groupTags)).toEqual(groupTags[0]);
      expect(findMatchingGroupTag('URGENTE', groupTags)).toEqual(groupTags[1]);
    });

    it('returns undefined when no group tag matches', () => {
      expect(findMatchingGroupTag('inexistente', groupTags)).toBeUndefined();
    });
  });

  describe('resolveCanonicalTagName', () => {
    it('returns canonical stored casing when matching a group tag', () => {
      expect(resolveCanonicalTagName('  trabajo  ', groupTags)).toBe('Trabajo');
    });

    it('returns trimmed input when no group tag matches', () => {
      expect(resolveCanonicalTagName('  NuevaEtiqueta  ', groupTags)).toBe('NuevaEtiqueta');
    });
  });

  describe('hasTagInList & isTagPersistedOnTask', () => {
    it('checks list membership case-insensitively and trimmed', () => {
      expect(hasTagInList('  trabajo ', ['Trabajo', 'Urgente'])).toBe(true);
      expect(hasTagInList('Estudio', ['Trabajo', 'Urgente'])).toBe(false);
    });

    it('identifies whether a tag chip is persisted on the task', () => {
      expect(isTagPersistedOnTask('trabajo', ['Trabajo', 'Estudio'])).toBe(true);
      expect(isTagPersistedOnTask('Nueva', ['Trabajo', 'Estudio'])).toBe(false);
    });
  });

  describe('captureTagSegments', () => {
    it('converts valid segments into deduplicated chips with canonical casing', () => {
      const result = captureTagSegments(
        [' trabajo ', 'Nueva', 'TRABAJO', 'urgente'],
        'pendiente',
        [],
        groupTags,
      );

      expect(result).toEqual({
        updatedTags: ['Trabajo', 'Nueva', 'Urgente'],
        remainingInput: 'pendiente',
        validationError: null,
      });
    });

    it('ignores empty or whitespace-only segments as no-ops', () => {
      const result = captureTagSegments(['', '   ', '\t'], '', ['Trabajo'], groupTags);

      expect(result).toEqual({
        updatedTags: ['Trabajo'],
        remainingInput: '',
        validationError: null,
      });
    });

    it('rejects segments exceeding 30 characters and returns remainingInput with Spanish error', () => {
      const overLimit = 'a'.repeat(31);
      const result = captureTagSegments(['estudio', overLimit, 'otra'], '', ['Trabajo'], groupTags);

      expect(result).toEqual({
        updatedTags: ['Trabajo', 'Estudio'],
        remainingInput: overLimit,
        validationError: es.validation.maxLength('El nombre de la etiqueta', 30),
      });
    });
  });

  describe('applyInlineTagEdit', () => {
    it('returns original tags and exits edit mode if editIndex is out of bounds', () => {
      expect(applyInlineTagEdit(['Trabajo'], -1, 'Nueva', groupTags, 'commit')).toEqual({
        updatedTags: ['Trabajo'],
        shouldExitEdit: true,
        validationError: null,
      });
      expect(applyInlineTagEdit(['Trabajo'], 1, 'Nueva', groupTags, 'commit')).toEqual({
        updatedTags: ['Trabajo'],
        shouldExitEdit: true,
        validationError: null,
      });
    });

    it('strips pasted semicolon or comma delimiters and replaces chip at its original index', () => {
      const result = applyInlineTagEdit(
        ['Trabajo', 'Urgente', 'Estudio'],
        1,
        '  Prioridad,; alta  ',
        groupTags,
        'commit',
      );

      expect(result).toEqual({
        updatedTags: ['Trabajo', 'Prioridad alta', 'Estudio'],
        shouldExitEdit: true,
        validationError: null,
      });
    });

    it('reuses canonical group tag casing on case-only or group-matching edits', () => {
      const result = applyInlineTagEdit(['otra', 'Urgente'], 0, 'trabajo', groupTags, 'commit');

      expect(result).toEqual({
        updatedTags: ['Trabajo', 'Urgente'],
        shouldExitEdit: true,
        validationError: null,
      });
    });

    it('deduplicates by keeping the existing chip position and removing the edited duplicate', () => {
      const result = applyInlineTagEdit(
        ['Trabajo', 'Nueva', 'Estudio'],
        1,
        'trabajo',
        groupTags,
        'commit',
      );

      expect(result).toEqual({
        updatedTags: ['Trabajo', 'Estudio'],
        shouldExitEdit: true,
        validationError: null,
      });
    });

    it('stays in edit mode and returns Spanish max-length error in commit mode when > 30 chars', () => {
      const overLimit = 'x'.repeat(31);
      const result = applyInlineTagEdit(['Trabajo'], 0, overLimit, groupTags, 'commit');

      expect(result).toEqual({
        updatedTags: ['Trabajo'],
        shouldExitEdit: false,
        validationError: es.validation.maxLength('El nombre de la etiqueta', 30),
      });
    });

    it('cancels edit and restores original chips in blur mode when > 30 chars', () => {
      const overLimit = 'x'.repeat(31);
      const result = applyInlineTagEdit(['Trabajo'], 0, overLimit, groupTags, 'blur');

      expect(result).toEqual({
        updatedTags: ['Trabajo'],
        shouldExitEdit: true,
        validationError: null,
      });
    });

    it('cancels edit and restores original chips when value is empty or only delimiters', () => {
      expect(applyInlineTagEdit(['Trabajo'], 0, '  ;,  ', groupTags, 'commit')).toEqual({
        updatedTags: ['Trabajo'],
        shouldExitEdit: true,
        validationError: null,
      });
      expect(applyInlineTagEdit(['Trabajo'], 0, '   ', groupTags, 'blur')).toEqual({
        updatedTags: ['Trabajo'],
        shouldExitEdit: true,
        validationError: null,
      });
    });
  });

  describe('filterTagSuggestions', () => {
    const g1Tags = groupTags.filter((t) => t.groupId === 'g1');

    it('returns empty array when query is empty or whitespace', () => {
      expect(filterTagSuggestions('   ', g1Tags, [])).toEqual([]);
    });

    it('filters matching group tags excluding already-selected tags case-insensitively', () => {
      expect(filterTagSuggestions('t', g1Tags, ['trabajo'])).toEqual([g1Tags[1], g1Tags[2]]);
    });
  });

  describe('resolveTaskTags', () => {
    it('returns empty array for undefined or empty tagIds', () => {
      expect(resolveTaskTags(undefined, groupTags)).toEqual([]);
      expect(resolveTaskTags([], groupTags)).toEqual([]);
    });

    it('resolves matching tags, deduplicates IDs, ignores stale IDs, and scopes by groupId', () => {
      expect(resolveTaskTags(['t1', 't1', 'stale', 't4', 't2'], groupTags, 'g1')).toEqual([
        groupTags[0],
        groupTags[1],
      ]);
      expect(resolveTaskTags(['t1', 't4'], groupTags)).toEqual([groupTags[0], groupTags[3]]);
    });
  });
});

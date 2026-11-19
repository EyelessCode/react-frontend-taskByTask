import { describe, it, expect } from 'vitest';
import type { Group } from '@/shared/schemas';
import {
  compareGroups,
  sortGroups,
} from '@/features/groups/utils/group-sort';

function createGroup(overrides: Partial<Group> = {}): Group {
  return {
    id: overrides.id ?? 'grp-1',
    name: overrides.name ?? 'Test group',
    creatorId: overrides.creatorId ?? 'local-user',
    isPersonal: overrides.isPersonal ?? false,
    type: overrides.type ?? 'individual',
    members: overrides.members ?? [
      {
        userId: 'local-user',
        role: 'creator',
        joinedAt: '2026-11-01T12:00:00.000Z',
      },
    ],
    createdAt: overrides.createdAt ?? '2026-11-01T12:00:00.000Z',
  };
}

describe('Deterministic Group Sorting Utility (features/groups/utils/group-sort)', () => {
  describe('compareGroups (REQ-GRP-12b, AC-GRP-01)', () => {
    it('should place Personal group before non-personal group', () => {
      const personal = createGroup({
        id: 'group-personal',
        name: 'Personal',
        isPersonal: true,
        createdAt: '2026-11-05T00:00:00.000Z',
      });
      const regular = createGroup({
        id: 'group-work',
        name: 'Trabajo',
        isPersonal: false,
        createdAt: '2026-11-01T00:00:00.000Z',
      });

      expect(compareGroups(personal, regular)).toBeLessThan(0);
      expect(compareGroups(regular, personal)).toBeGreaterThan(0);
    });

    it('should order non-personal groups ascending by createdAt (oldest first)', () => {
      const older = createGroup({
        id: 'grp-old',
        createdAt: '2026-11-01T10:00:00.000Z',
      });
      const newer = createGroup({
        id: 'grp-new',
        createdAt: '2026-11-02T10:00:00.000Z',
      });

      expect(compareGroups(older, newer)).toBeLessThan(0);
      expect(compareGroups(newer, older)).toBeGreaterThan(0);
    });

    it('should break ties deterministically by id ascending when createdAt is identical', () => {
      const groupA = createGroup({
        id: 'grp-alpha',
        createdAt: '2026-11-01T10:00:00.000Z',
      });
      const groupB = createGroup({
        id: 'grp-beta',
        createdAt: '2026-11-01T10:00:00.000Z',
      });

      expect(compareGroups(groupA, groupB)).toBeLessThan(0);
      expect(compareGroups(groupB, groupA)).toBeGreaterThan(0);
    });

    it('should return 0 when groups have identical isPersonal, createdAt, and id', () => {
      const group1 = createGroup({
        id: 'grp-same',
        createdAt: '2026-11-01T10:00:00.000Z',
      });
      const group2 = createGroup({
        id: 'grp-same',
        createdAt: '2026-11-01T10:00:00.000Z',
      });

      expect(compareGroups(group1, group2)).toBe(0);
    });
  });

  describe('sortGroups (REQ-GRP-12b)', () => {
    it('should return an empty array when given an empty array', () => {
      expect(sortGroups([])).toEqual([]);
    });

    it('should return a new array and not mutate the input array', () => {
      const input = [
        createGroup({ id: 'b', createdAt: '2026-11-02T00:00:00.000Z' }),
        createGroup({ id: 'a', createdAt: '2026-11-01T00:00:00.000Z' }),
      ];
      const copy = [...input];

      const result = sortGroups(input);

      expect(result).not.toBe(input);
      expect(input).toEqual(copy);
    });

    it('should sort Personal group first, then other groups by createdAt asc, then id asc', () => {
      const work = createGroup({
        id: 'grp-work',
        name: 'Trabajo',
        isPersonal: false,
        createdAt: '2026-11-02T10:00:00.000Z',
      });
      const study = createGroup({
        id: 'grp-study',
        name: 'Estudio',
        isPersonal: false,
        createdAt: '2026-11-01T08:00:00.000Z',
      });
      const studyClone = createGroup({
        id: 'grp-study-2',
        name: 'Estudio 2',
        isPersonal: false,
        createdAt: '2026-11-01T08:00:00.000Z',
      });
      const personal = createGroup({
        id: 'group-personal',
        name: 'Personal',
        isPersonal: true,
        createdAt: '2026-11-10T12:00:00.000Z', // Even if created much later
      });

      const sorted = sortGroups([work, personal, studyClone, study]);

      expect(sorted.map((g) => g.id)).toEqual([
        'group-personal',
        'grp-study',
        'grp-study-2',
        'grp-work',
      ]);
    });
  });
});

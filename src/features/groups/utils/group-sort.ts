import type { Group } from '../../../shared/schemas';

/**
 * Deterministic comparator for Groups (REQ-GRP-12b).
 * 1. Default "Personal" group (`isPersonal === true`) always comes first.
 * 2. Non-personal groups sort ascending by `createdAt` (oldest first).
 * 3. Ties in `createdAt` break deterministically by `id` ascending.
 */
export function compareGroups(a: Group, b: Group): number {
  if (a.isPersonal !== b.isPersonal) {
    return a.isPersonal ? -1 : 1;
  }
  if (a.createdAt !== b.createdAt) {
    return a.createdAt.localeCompare(b.createdAt);
  }
  return a.id.localeCompare(b.id);
}

/**
 * Pure function that returns a new array with groups deterministically sorted (REQ-GRP-12b).
 */
export function sortGroups(groups: Group[]): Group[] {
  return [...groups].sort(compareGroups);
}

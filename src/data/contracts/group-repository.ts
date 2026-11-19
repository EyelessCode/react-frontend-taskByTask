import type { Group } from '../../shared/schemas';
import type { Repository } from './repository';

export interface GroupRepository extends Repository<Group> {
  getIndividualGroups(): Promise<Group[]>;
  ensureSeedGroup(): Promise<Group>;
  getAccessibleByUserId(userId: string): Promise<Group[]>;
  ensurePersonalGroupForUser(userId: string, nowIso?: string): Promise<Group>;
  deleteAllByOwnerId(userId: string): Promise<string[]>;
}

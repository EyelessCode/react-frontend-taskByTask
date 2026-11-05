import type { Group } from '../../shared/schemas';
import type { Repository } from './repository';

export interface GroupRepository extends Repository<Group> {
  getIndividualGroups(): Promise<Group[]>;
  ensureSeedGroup(): Promise<Group>;
}

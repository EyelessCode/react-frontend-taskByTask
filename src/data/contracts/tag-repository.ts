import type { Tag } from '../../shared/schemas';
import type { Repository } from './repository';

export interface TagRepository extends Repository<Tag> {
  getByGroupId(groupId: string): Promise<Tag[]>;
  findByName(groupId: string, name: string): Promise<Tag | null>;
  ensureTag(groupId: string, name: string): Promise<Tag>;
  deleteFromGroup(tagId: string): Promise<void>;
}

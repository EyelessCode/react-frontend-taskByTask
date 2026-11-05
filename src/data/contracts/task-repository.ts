import type { Task } from '../../shared/schemas';
import type { Repository } from './repository';

export interface TaskRepository extends Repository<Task> {
  getByGroupId(groupId: string): Promise<Task[]>;
}

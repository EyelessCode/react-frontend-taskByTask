import type { User } from '../../shared/schemas';
import type { Repository } from './repository';

export interface UserRepository extends Repository<User> {
  getByEmail(normalizedEmail: string): Promise<User | null>;
  getByUsername(username: string): Promise<User | null>;
}

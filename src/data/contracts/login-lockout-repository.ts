import type { LoginLockoutState } from '../../shared/schemas';

export interface LoginLockoutRepository {
  getByEmail(normalizedEmail: string): Promise<LoginLockoutState | null>;
  save(state: LoginLockoutState): Promise<void>;
  clearByEmail(normalizedEmail: string): Promise<void>;
}

import type { Session } from '../../shared/schemas';

export interface SessionRepository {
  get(): Promise<Session | null>;
  save(session: Session): Promise<void>;
  clear(): Promise<void>;
}

import type { RecoveryCode } from '../../shared/schemas';

export interface RecoveryCodeRepository {
  getByUserId(userId: string): Promise<RecoveryCode[]>;
  replaceForUser(userId: string, codes: RecoveryCode[]): Promise<void>;
  save(code: RecoveryCode): Promise<void>;
  deleteByUserId(userId: string): Promise<void>;
}

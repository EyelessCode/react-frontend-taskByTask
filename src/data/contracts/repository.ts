export interface Repository<T, TId = string> {
  getAll(): Promise<T[]> | T[];
  getById(id: TId): Promise<T | null> | T | null;
  save(entity: T): Promise<void> | void;
  delete(id: TId): Promise<void> | void;
}

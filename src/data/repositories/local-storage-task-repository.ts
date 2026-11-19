import { z } from 'zod';
import type { TaskRepository } from '../contracts/task-repository';
import type { StorageAdapter } from '../contracts/storage-adapter';
import { taskSchema, type Task } from '../../shared/schemas';
import { NotFoundError, ValidationError } from '../../shared/errors';
import { STORAGE_KEYS } from '../storage/keys';
import { LocalStorageAdapter } from '../storage/local-storage-adapter';

export class LocalStorageTaskRepository implements TaskRepository {
  private readonly storageAdapter: StorageAdapter;

  constructor(storageAdapter?: StorageAdapter) {
    this.storageAdapter = storageAdapter ?? new LocalStorageAdapter();
  }

  async getAll(): Promise<Task[]> {
    return Promise.resolve(
      this.storageAdapter.getItem(STORAGE_KEYS.TASKS, z.array(taskSchema), []),
    );
  }

  async getById(id: string): Promise<Task | null> {
    const tasks = await this.getAll();
    return tasks.find((t) => t.id === id) ?? null;
  }

  async getByGroupId(groupId: string): Promise<Task[]> {
    const tasks = await this.getAll();
    return tasks.filter((t) => t.groupId === groupId);
  }

  async save(task: Task): Promise<void> {
    const parseResult = taskSchema.safeParse(task);
    if (!parseResult.success) {
      const issues = parseResult.error.issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
        code: i.code,
      }));
      throw new ValidationError('Task validation failed', issues);
    }

    const validatedTask = parseResult.data;
    const tasks = await this.getAll();
    const existingIndex = tasks.findIndex((t) => t.id === validatedTask.id);
    const updatedTasks = [...tasks];

    if (existingIndex >= 0) {
      updatedTasks[existingIndex] = validatedTask;
    } else {
      updatedTasks.push(validatedTask);
    }

    this.storageAdapter.setItem(STORAGE_KEYS.TASKS, z.array(taskSchema), updatedTasks);
  }

  async delete(id: string): Promise<void> {
    const tasks = await this.getAll();
    const existingIndex = tasks.findIndex((t) => t.id === id);
    if (existingIndex < 0) {
      throw new NotFoundError('Tarea', id);
    }

    const updatedTasks = tasks.filter((t) => t.id !== id);
    this.storageAdapter.setItem(STORAGE_KEYS.TASKS, z.array(taskSchema), updatedTasks);
  }

  async deleteByGroupId(groupId: string): Promise<void> {
    const tasks = await this.getAll();
    const updatedTasks = tasks.filter((t) => t.groupId !== groupId);
    this.storageAdapter.setItem(STORAGE_KEYS.TASKS, z.array(taskSchema), updatedTasks);
  }
}

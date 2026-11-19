import { describe, it, expect, beforeEach } from 'vitest';
import { MockStorage } from '../../mocks/mock-storage';
import { LocalStorageAdapter } from '@/data/storage';
import { LocalStorageTaskRepository } from '@/data/repositories/local-storage-task-repository';
import type { Task } from '@/shared/schemas';
import { NotFoundError, ValidationError } from '@/shared/errors';

describe('LocalStorageTaskRepository (unit/data/local-storage-task-repository)', () => {
  let mockStorage: MockStorage;
  let adapter: LocalStorageAdapter;
  let repository: LocalStorageTaskRepository;

  const sampleTask: Task = {
    id: 'task-1',
    title: 'Tarea de prueba',
    description: 'Descripción de prueba',
    groupId: 'grp-personal',
    completed: false,
    createdAt: '2026-11-01T10:00:00.000Z',
    dueDate: '2026-11-10',
    dueTime: '15:00',
    tagIds: ['tag-1'],
  };

  beforeEach(() => {
    mockStorage = new MockStorage();
    adapter = new LocalStorageAdapter(mockStorage);
    repository = new LocalStorageTaskRepository(adapter);
  });

  it('should return empty array when no tasks exist', async () => {
    const tasks = await repository.getAll();
    expect(tasks).toEqual([]);
  });

  it('should save a new task and retrieve it with getAll and getById', async () => {
    await repository.save(sampleTask);

    const all = await repository.getAll();
    expect(all).toHaveLength(1);
    expect(all[0]).toEqual(sampleTask);

    const fetched = await repository.getById('task-1');
    expect(fetched).toEqual(sampleTask);
  });

  it('should return null when getById does not find the task', async () => {
    const fetched = await repository.getById('non-existent');
    expect(fetched).toBeNull();
  });

  it('should update an existing task when saving with same ID', async () => {
    await repository.save(sampleTask);

    const updatedTask: Task = {
      ...sampleTask,
      title: 'Título actualizado',
      completed: true,
      completedAt: '2026-11-02T10:00:00.000Z',
    };
    await repository.save(updatedTask);

    const all = await repository.getAll();
    expect(all).toHaveLength(1);
    expect(all[0].title).toBe('Título actualizado');
    expect(all[0].completed).toBe(true);
  });

  it('should filter tasks by groupId with getByGroupId', async () => {
    const taskGroupA = { ...sampleTask, id: 't-1', groupId: 'group-a' };
    const taskGroupB = { ...sampleTask, id: 't-2', groupId: 'group-b' };
    const taskGroupA2 = { ...sampleTask, id: 't-3', groupId: 'group-a' };

    await repository.save(taskGroupA);
    await repository.save(taskGroupB);
    await repository.save(taskGroupA2);

    const groupATasks = await repository.getByGroupId('group-a');
    expect(groupATasks).toHaveLength(2);
    expect(groupATasks.map((t) => t.id)).toEqual(['t-1', 't-3']);

    const groupBTasks = await repository.getByGroupId('group-b');
    expect(groupBTasks).toHaveLength(1);
    expect(groupBTasks[0].id).toBe('t-2');

    const emptyGroup = await repository.getByGroupId('non-existent-group');
    expect(emptyGroup).toEqual([]);
  });

  it('should reject invalid tasks with ValidationError upon save', async () => {
    // Title with less than 2 characters violates Appendix B limits
    const invalidTask = {
      ...sampleTask,
      title: 'x',
    };

    await expect(repository.save(invalidTask as Task)).rejects.toThrowError(ValidationError);
  });

  it('should delete a task by ID', async () => {
    await repository.save(sampleTask);

    await repository.delete('task-1');
    const all = await repository.getAll();
    expect(all).toHaveLength(0);
  });

  it('should throw NotFoundError when attempting to delete a non-existent task', async () => {
    await expect(repository.delete('does-not-exist')).rejects.toThrowError(NotFoundError);
  });

  it('should delete all tasks belonging to a specific groupId and preserve other groups', async () => {
    const taskGroupA1 = { ...sampleTask, id: 't-a1', groupId: 'group-a' };
    const taskGroupA2 = { ...sampleTask, id: 't-a2', groupId: 'group-a' };
    const taskGroupB1 = { ...sampleTask, id: 't-b1', groupId: 'group-b' };

    await repository.save(taskGroupA1);
    await repository.save(taskGroupA2);
    await repository.save(taskGroupB1);

    await repository.deleteByGroupId('group-a');

    const remaining = await repository.getAll();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe('t-b1');
    expect(remaining[0].groupId).toBe('group-b');
  });

  it('should be idempotent and succeed when deleteByGroupId is called for group with 0 tasks', async () => {
    await repository.save(sampleTask);

    await expect(repository.deleteByGroupId('non-existent-group')).resolves.toBeUndefined();

    const all = await repository.getAll();
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe(sampleTask.id);
  });
});

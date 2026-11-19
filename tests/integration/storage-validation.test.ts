import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { MockStorage } from '../mocks/mock-storage';
import { LocalStorageAdapter, STORAGE_KEYS } from '@/data/storage';
import {
  taskSchema,
  groupSchema,
  userSchema,
  type Task,
  type Group,
  type User,
} from '@/shared/schemas';

describe('Storage Validation Integration (tests/integration/storage-validation)', () => {
  it('should persist and retrieve real Task domain collections', () => {
    const mockStorage = new MockStorage();
    const adapter = new LocalStorageAdapter(mockStorage);
    const tasksSchema = z.array(taskSchema);

    const initialTasks: Task[] = [
      {
        id: 'tsk-1',
        title: 'Estudiar Arquitectura de Software',
        description: 'Repasar patrones de diseño',
        groupId: 'grp-1',
        completed: false,
        createdAt: '2026-11-02T12:00:00.000Z',
        dueDate: '2026-11-05',
        dueTime: '15:00',
        subtasks: [
          { id: 'sub-1', taskId: 'tsk-1', title: 'Capítulo 1', completed: true },
        ],
        reminders: [
          { id: 'rem-1', taskId: 'tsk-1', offset: '1h' },
        ],
      },
    ];

    adapter.setItem(STORAGE_KEYS.TASKS, tasksSchema, initialTasks);
    const retrieved = adapter.getItem(STORAGE_KEYS.TASKS, tasksSchema, []);

    expect(retrieved).toHaveLength(1);
    expect(retrieved[0].title).toBe('Estudiar Arquitectura de Software');
    expect(retrieved[0].subtasks).toHaveLength(1);
    expect(retrieved[0].reminders).toHaveLength(1);
  });

  it('should persist and retrieve real Group domain collections', () => {
    const mockStorage = new MockStorage();
    const adapter = new LocalStorageAdapter(mockStorage);
    const groupsSchema = z.array(groupSchema);

    const groups: Group[] = [
      {
        id: 'grp-1',
        name: 'Personal',
        creatorId: 'usr-1',
        isPersonal: true,
        type: 'individual',
        members: [{ userId: 'usr-1', role: 'creator', joinedAt: '2026-11-02T12:00:00.000Z' }],
        createdAt: '2026-11-02T12:00:00.000Z',
      },
    ];

    adapter.setItem(STORAGE_KEYS.GROUPS, groupsSchema, groups);
    const retrieved = adapter.getItem(STORAGE_KEYS.GROUPS, groupsSchema, []);

    expect(retrieved).toHaveLength(1);
    expect(retrieved[0].isPersonal).toBe(true);
    expect(retrieved[0].members[0].role).toBe('creator');
  });

  it('should reject tampered users records with plaintext password and return safe fallback', () => {
    const mockStorage = new MockStorage();
    const onCorrupted = vi.fn();
    const adapter = new LocalStorageAdapter(mockStorage, { onCorruptedData: onCorrupted });
    const usersSchema = z.array(userSchema);

    // Save a valid user first
    const validUser: User = {
      id: 'usr-1',
      email: 'user@example.com',
      username: 'usuario1',
      displayName: 'Usuario Uno',
      passwordHash: 'sha256_mock_hash_value',
      timeZone: 'America/Bogota',
      timeFormat: '24h',
      createdAt: '2026-11-02T12:00:00.000Z',
    };
    adapter.setItem(STORAGE_KEYS.USERS, usersSchema, [validUser]);

    // Simulate external tampering in localStorage injecting plaintext password
    const tamperedPayload = [
      {
        ...validUser,
        password: 'plain_injected_password', // strictly rejected by userSchema
      },
    ];
    mockStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(tamperedPayload));

    // Retrieval should detect the violation, notify corrupted data, and return fallback
    const result = adapter.getItem(STORAGE_KEYS.USERS, usersSchema, []);
    expect(result).toEqual([]);
    expect(onCorrupted).toHaveBeenCalledTimes(1);
  });
});

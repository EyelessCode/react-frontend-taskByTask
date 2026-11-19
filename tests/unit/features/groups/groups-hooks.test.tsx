import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { MockStorage } from '../../../mocks/mock-storage';
import { LocalStorageAdapter } from '@/data/storage';
import {
  LocalStorageTaskRepository,
  LocalStorageGroupRepository,
  LocalStorageTagRepository,
} from '@/data/repositories';
import {
  configureGroupsStore,
  resetGroupsStore,
} from '@/features/groups/store/groups-store';
import {
  configureTasksStore,
  resetTasksStore,
} from '@/features/tasks/store/tasks-store';
import { useGroups, useGroupForm } from '@/features/groups/hooks';
import { SEED_PERSONAL_GROUP, type Group, type Task } from '@/shared/schemas';

describe('Groups Custom Hooks (unit/features/groups/groups-hooks)', () => {
  let mockStorage: MockStorage;
  let adapter: LocalStorageAdapter;
  let taskRepository: LocalStorageTaskRepository;
  let groupRepository: LocalStorageGroupRepository;
  let tagRepository: LocalStorageTagRepository;

  const workGroup: Group = {
    id: 'grp-work',
    name: 'Trabajo',
    creatorId: 'local-user',
    isPersonal: false,
    type: 'individual',
    members: [
      {
        userId: 'local-user',
        role: 'creator',
        joinedAt: '2026-11-01T10:00:00.000Z',
      },
    ],
    createdAt: '2026-11-01T10:00:00.000Z',
  };

  beforeEach(() => {
    mockStorage = new MockStorage();
    adapter = new LocalStorageAdapter(mockStorage);
    taskRepository = new LocalStorageTaskRepository(adapter);
    groupRepository = new LocalStorageGroupRepository(adapter);
    tagRepository = new LocalStorageTagRepository(adapter);

    configureGroupsStore({
      groupRepository,
      taskRepository,
      tagRepository,
      getActiveUserId: () => Promise.resolve('local-user'),
    });
    resetGroupsStore();

    configureTasksStore({
      taskRepository,
      groupRepository,
      tagRepository,
      getActiveUserId: () => Promise.resolve('local-user'),
    });
    resetTasksStore();
  });

  describe('useGroups', () => {
    it('should expose reactive groups, counts, visible groups, and filter helpers', async () => {
      await groupRepository.ensureSeedGroup();
      await groupRepository.save(workGroup);

      const task1: Task = {
        id: 't-1',
        title: 'Examen de Cálculo',
        groupId: SEED_PERSONAL_GROUP.id,
        completed: false,
        createdAt: '2026-11-01T10:00:00.000Z',
        tagIds: [],
      };
      const task2: Task = {
        id: 't-2',
        title: 'Examen de Física',
        groupId: workGroup.id,
        completed: true,
        createdAt: '2026-11-02T10:00:00.000Z',
        tagIds: [],
      };
      await taskRepository.save(task1);
      await taskRepository.save(task2);

      const { result } = renderHook(() => useGroups());

      await act(async () => {
        await result.current.init();
      });

      // Deterministic sort: Personal first
      expect(result.current.groups[0].id).toBe(SEED_PERSONAL_GROUP.id);
      expect(result.current.groups[1].id).toBe(workGroup.id);

      // Counts across visible groups (no searchQuery):
      expect(result.current.counts).toEqual({
        pending: 1,
        completed: 1,
        all: 2,
      });

      // Filtering with searchQuery:
      act(() => {
        result.current.setSearchQuery('Cálculo');
      });

      expect(result.current.counts).toEqual({
        pending: 1,
        completed: 0,
        all: 1,
      });

      // Group tasks helper:
      const personalTasks = result.current.getGroupTasks(SEED_PERSONAL_GROUP.id);
      expect(personalTasks).toHaveLength(1);
      expect(personalTasks[0].id).toBe('t-1');
    });

    it('should filter visibleGroups when selectedGroupIds is populated (REQ-GRP-20)', async () => {
      await groupRepository.ensureSeedGroup();
      await groupRepository.save(workGroup);

      const { result } = renderHook(() => useGroups());

      await act(async () => {
        await result.current.init();
      });

      expect(result.current.visibleGroups).toHaveLength(2);

      act(() => {
        result.current.setSelectedGroupIds([workGroup.id]);
      });

      expect(result.current.visibleGroups).toHaveLength(1);
      expect(result.current.visibleGroups[0].id).toBe(workGroup.id);
    });
  });

  describe('useGroupForm', () => {
    it('should create group in create mode and invoke onSuccess', async () => {
      await groupRepository.ensureSeedGroup();
      const onSuccess = vi.fn();

      const { result } = renderHook(() => useGroupForm({ onSuccess }));

      expect(result.current.isEdit).toBe(false);

      await act(async () => {
        result.current.form.setValue('name', 'Nuevo Grupo');
        await result.current.onSubmit();
      });

      expect(onSuccess).toHaveBeenCalledTimes(1);
      const groups = await groupRepository.getAll();
      expect(groups.some((g) => g.name === 'Nuevo Grupo')).toBe(true);
    });

    it('should rename group in edit mode and invoke onSuccess', async () => {
      await groupRepository.ensureSeedGroup();
      const onSuccess = vi.fn();

      const { result } = renderHook(() =>
        useGroupForm({ group: SEED_PERSONAL_GROUP, onSuccess }),
      );

      expect(result.current.isEdit).toBe(true);

      await act(async () => {
        result.current.form.setValue('name', 'Personal Renombrado');
        await result.current.onSubmit();
      });

      expect(onSuccess).toHaveBeenCalledTimes(1);
      const updated = await groupRepository.getById(SEED_PERSONAL_GROUP.id);
      expect(updated?.name).toBe('Personal Renombrado');
    });
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { MockStorage } from '../../../mocks/mock-storage';
import { LocalStorageAdapter } from '@/data/storage';
import {
  LocalStorageTaskRepository,
  LocalStorageGroupRepository,
  LocalStorageTagRepository,
} from '@/data/repositories';
import {
  configureTasksStore,
  resetTasksStore,
  useTasksStore,
} from '@/features/tasks/store/tasks-store';
import { useTasks, useTaskForm, useTaskMoveCopy } from '@/features/tasks/hooks';
import { SEED_PERSONAL_GROUP, type Group, type Task } from '@/shared/schemas';

describe('Tasks Custom Hooks (unit/features/tasks/tasks-hooks)', () => {
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

  beforeEach(async () => {
    mockStorage = new MockStorage();
    adapter = new LocalStorageAdapter(mockStorage);
    taskRepository = new LocalStorageTaskRepository(adapter);
    groupRepository = new LocalStorageGroupRepository(adapter);
    tagRepository = new LocalStorageTagRepository(adapter);

    configureTasksStore({
      taskRepository,
      groupRepository,
      tagRepository,
      getActiveUserId: () => Promise.resolve('local-user'),
    });
    resetTasksStore();
    await groupRepository.ensureSeedGroup();
  });

  describe('useTasks', () => {
    it('should expose reactive tasks, counts, active group, and handlers', async () => {
      const { result } = renderHook(() => useTasks());

      await act(async () => {
        await result.current.init();
      });

      expect(result.current.groups).toHaveLength(1);
      expect(result.current.activeGroupId).toBe(SEED_PERSONAL_GROUP.id);
      expect(result.current.counts).toEqual({ pending: 0, completed: 0, all: 0 });

      await act(async () => {
        await result.current.createTask({
          title: 'Nueva tarea hook',
          groupId: SEED_PERSONAL_GROUP.id,
        });
      });

      expect(result.current.counts).toEqual({ pending: 1, completed: 0, all: 1 });
      expect(result.current.tasks).toHaveLength(1);
    });
  });

  describe('useTaskForm', () => {
    it('should initialize empty in create mode and submit valid data', async () => {
      await useTasksStore.getState().init();

      let successCalled = false;
      const { result } = renderHook(() =>
        useTaskForm({
          onSuccess: () => {
            successCalled = true;
          },
        }),
      );

      expect(result.current.isEdit).toBe(false);

      await act(async () => {
        result.current.form.setValue('title', 'Tarea creada via hook');
        result.current.form.setValue('groupId', SEED_PERSONAL_GROUP.id);
        await result.current.onSubmit();
      });

      expect(successCalled).toBe(true);
      expect(useTasksStore.getState().tasks).toHaveLength(1);
      expect(useTasksStore.getState().tasks[0].title).toBe('Tarea creada via hook');
    });

    it('should initialize with task data in edit mode and submit updates', async () => {
      await useTasksStore.getState().init();

      const created = await useTasksStore.getState().createTask({
        title: 'Original',
        description: 'Desc original',
        groupId: SEED_PERSONAL_GROUP.id,
      });

      let successCalled = false;
      const { result } = renderHook(() =>
        useTaskForm({
          task: created,
          onSuccess: () => {
            successCalled = true;
          },
        }),
      );

      expect(result.current.isEdit).toBe(true);
      expect(result.current.form.getValues('title')).toBe('Original');

      await act(async () => {
        result.current.form.setValue('title', 'Título actualizado');
        await result.current.onSubmit();
      });

      expect(successCalled).toBe(true);
      expect(useTasksStore.getState().tasks[0].title).toBe('Título actualizado');
    });

    it('should resolve groupTags and persistedTagNames for task.groupId even when activeGroupId differs', async () => {
      await groupRepository.save(workGroup);
      await tagRepository.ensureTag(SEED_PERSONAL_GROUP.id, 'Hogar');
      const workTag = await tagRepository.ensureTag('grp-work', 'Sprint');
      await useTasksStore.getState().init();

      const workTask: Task = {
        id: 'task-work-1',
        title: 'Tarea secundaria',
        groupId: 'grp-work',
        tagIds: [workTag.id],
        completed: false,
        createdAt: '2026-11-01T10:00:00.000Z',
      };
      await taskRepository.save(workTask);

      const { result } = renderHook(() => useTaskForm({ task: workTask }));

      expect(result.current.groupTags.map((t) => t.name)).toEqual(['Sprint']);
      expect(result.current.persistedTagNames).toEqual(['Sprint']);
      expect(result.current.form.getValues('tagNames')).toEqual(['Sprint']);
    });

    it('should preserve unsaved form edits when store tags update in the background', async () => {
      await useTasksStore.getState().init();
      const created = await useTasksStore.getState().createTask({
        title: 'Título inicial',
        tagNames: ['Inicial'],
        groupId: SEED_PERSONAL_GROUP.id,
      });

      const { result } = renderHook(() => useTaskForm({ task: created }));

      act(() => {
        result.current.form.setValue('title', 'Título sin guardar');
        result.current.form.setValue('tagNames', ['Inicial', 'Temporal']);
      });

      // Background store tag mutation while modal is open for the same task
      await act(async () => {
        await useTasksStore.getState().createTask({
          title: 'Otra tarea',
          tagNames: ['NuevaEnFondo'],
          groupId: SEED_PERSONAL_GROUP.id,
        });
      });

      expect(result.current.form.getValues('title')).toBe('Título sin guardar');
      expect(result.current.form.getValues('tagNames')).toEqual(['Inicial', 'Temporal']);
    });
  });

  describe('useTaskMoveCopy', () => {
    it('should filter candidate target individual groups and support move and copy', async () => {
      await groupRepository.save(workGroup);
      await useTasksStore.getState().init();

      const sampleTask: Task = {
        id: 'task-1',
        title: 'Tarea para mover/copiar',
        groupId: SEED_PERSONAL_GROUP.id,
        completed: false,
        createdAt: '2026-11-01T10:00:00.000Z',
      };
      await taskRepository.save(sampleTask);

      let successMoved = false;
      const { result } = renderHook(() =>
        useTaskMoveCopy({
          task: sampleTask,
          onSuccess: () => {
            successMoved = true;
          },
        }),
      );

      expect(result.current.hasOtherGroups).toBe(true);
      expect(result.current.targetGroups).toHaveLength(1);
      expect(result.current.targetGroups[0].id).toBe('grp-work');

      await act(async () => {
        await result.current.moveTask('grp-work');
      });

      expect(successMoved).toBe(true);
      const moved = await taskRepository.getById('task-1');
      expect(moved?.groupId).toBe('grp-work');
    });
  });
});

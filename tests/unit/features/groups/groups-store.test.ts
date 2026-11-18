import { describe, it, expect, beforeEach } from 'vitest';
import { MockStorage } from '../../../mocks/mock-storage';
import { LocalStorageAdapter } from '@/data/storage';
import {
  LocalStorageTaskRepository,
  LocalStorageGroupRepository,
  LocalStorageTagRepository,
} from '@/data/repositories';
import {
  useGroupsStore,
  configureGroupsStore,
  resetGroupsStore,
} from '@/features/groups/store/groups-store';
import {
  configureTasksStore,
  resetTasksStore,
  useTasksStore,
} from '@/features/tasks/store/tasks-store';
import {
  SEED_PERSONAL_GROUP,
  type Group,
  type Task,
  type Tag,
} from '@/shared/schemas';
import {
  NotFoundError,
  BusinessRuleViolationError,
} from '@/shared/errors';

describe('useGroupsStore (unit/features/groups/groups-store)', () => {
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
    await groupRepository.ensureSeedGroup();
  });

  describe('init (REQ-GRP-16b & REQ-AU-21)', () => {
    it('should return empty workspace when unauthenticated without seeding local-user', async () => {
      mockStorage.clear();
      configureGroupsStore({ getActiveUserId: () => Promise.resolve(null) });
      configureTasksStore({ getActiveUserId: () => Promise.resolve(null) });

      await useGroupsStore.getState().init();

      const state = useGroupsStore.getState();
      expect(state.groups).toEqual([]);
      expect(state.tasks).toEqual([]);
      expect(state.tags).toEqual([]);
      expect(await groupRepository.getAll()).toEqual([]);
    });

    it('should self-heal missing Personal group for authenticated user and isolate from other users', async () => {
      mockStorage.clear();
      await groupRepository.ensureSeedGroup(); // legacy local-user group
      configureGroupsStore({ getActiveUserId: () => Promise.resolve('user-1') });
      configureTasksStore({ getActiveUserId: () => Promise.resolve('user-1') });

      await useGroupsStore.getState().init();

      const state = useGroupsStore.getState();
      expect(state.groups).toHaveLength(1);
      expect(state.groups[0].isPersonal).toBe(true);
      expect(state.groups[0].creatorId).toBe('user-1');
      expect(state.groups[0].id).not.toBe(SEED_PERSONAL_GROUP.id);

      const created = await useGroupsStore.getState().createGroup('Proyecto Auth');
      expect(created.creatorId).toBe('user-1');

      // Mid-session expiration aborts mutation cleanly
      configureGroupsStore({ getActiveUserId: () => Promise.resolve(null) });
      await expect(useGroupsStore.getState().createGroup('No Debe Guardarse')).rejects.toThrow();
    });

    it('should load all existing groups, tasks, and tags from storage', async () => {
      await groupRepository.ensureSeedGroup();
      await groupRepository.save(workGroup);

      const task: Task = {
        id: 't-1',
        title: 'Informe Q4',
        groupId: workGroup.id,
        completed: false,
        createdAt: '2026-11-02T10:00:00.000Z',
        tagIds: ['tag-1'],
      };
      await taskRepository.save(task);

      const tag: Tag = {
        id: 'tag-1',
        name: 'Urgente',
        groupId: workGroup.id,
      };
      await tagRepository.save(tag);

      await useGroupsStore.getState().init();

      const state = useGroupsStore.getState();
      expect(state.groups).toHaveLength(2);
      expect(state.tasks).toHaveLength(1);
      expect(state.tasks[0].id).toBe('t-1');
      expect(state.tags).toHaveLength(1);
      expect(state.tags[0].id).toBe('tag-1');
    });
  });

  describe('createGroup (REQ-GRP-05, REQ-GRP-06)', () => {
    it('should create an individual group with local-user as creator and append to store', async () => {
      await useGroupsStore.getState().init();

      const created = await useGroupsStore.getState().createGroup('Facultad');

      expect(created.id).toBeDefined();
      expect(created.name).toBe('Facultad');
      expect(created.isPersonal).toBe(false);
      expect(created.type).toBe('individual');
      expect(created.creatorId).toBe('local-user');
      expect(created.members).toHaveLength(1);
      expect(created.members[0]).toMatchObject({
        userId: 'local-user',
        role: 'creator',
      });

      const persisted = await groupRepository.getById(created.id);
      expect(persisted).toBeDefined();
      expect(persisted?.name).toBe('Facultad');

      const state = useGroupsStore.getState();
      expect(state.groups.some((g) => g.id === created.id)).toBe(true);
      expect(useTasksStore.getState().groups.some((g) => g.id === created.id)).toBe(true);
    });
  });

  describe('renameGroup (REQ-GRP-08, REQ-GRP-11b)', () => {
    it('should update group name in repository and store state', async () => {
      await useGroupsStore.getState().init();
      const group = await useGroupsStore.getState().createGroup('Antiguo');

      const updated = await useGroupsStore.getState().renameGroup(group.id, 'Nuevo');

      expect(updated.name).toBe('Nuevo');
      const persisted = await groupRepository.getById(group.id);
      expect(persisted?.name).toBe('Nuevo');

      const state = useGroupsStore.getState();
      expect(state.groups.find((g) => g.id === group.id)?.name).toBe('Nuevo');
    });

    it('should allow renaming the Personal group (REQ-GRP-07, REQ-GRP-08)', async () => {
      await useGroupsStore.getState().init();

      const updated = await useGroupsStore.getState().renameGroup(SEED_PERSONAL_GROUP.id, 'Mi Día a Día');

      expect(updated.name).toBe('Mi Día a Día');
      expect(updated.isPersonal).toBe(true);
      const state = useGroupsStore.getState();
      expect(state.groups.find((g) => g.id === SEED_PERSONAL_GROUP.id)?.name).toBe('Mi Día a Día');
    });

    it('should throw NotFoundError when renaming a non-existent group (REQ-GRP-11b)', async () => {
      await useGroupsStore.getState().init();

      await expect(
        useGroupsStore.getState().renameGroup('grp-inexistente', 'Nuevo Nombre'),
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('deleteGroup (REQ-GRP-10, REQ-GRP-10b, REQ-GRP-11, REQ-GRP-11b)', () => {
    it('should throw BusinessRuleViolationError when attempting to delete the Personal group (REQ-GRP-11)', async () => {
      await useGroupsStore.getState().init();

      await expect(
        useGroupsStore.getState().deleteGroup(SEED_PERSONAL_GROUP.id),
      ).rejects.toThrow(BusinessRuleViolationError);
    });

    it('should throw NotFoundError when deleting a non-existent group (REQ-GRP-11b)', async () => {
      await useGroupsStore.getState().init();

      await expect(
        useGroupsStore.getState().deleteGroup('grp-inexistente'),
      ).rejects.toThrow(NotFoundError);
    });

    it('should cascade delete group, tasks, and tags and prune selectedGroupIds', async () => {
      await groupRepository.ensureSeedGroup();
      await groupRepository.save(workGroup);

      await taskRepository.save({
        id: 't-work',
        title: 'Tarea de trabajo',
        groupId: workGroup.id,
        completed: false,
        createdAt: '2026-11-01T12:00:00.000Z',
        tagIds: ['tag-work'],
      });

      await tagRepository.save({
        id: 'tag-work',
        name: 'Oficina',
        groupId: workGroup.id,
      });

      await useGroupsStore.getState().init();
      useGroupsStore.getState().setSelectedGroupIds([workGroup.id]);

      await useGroupsStore.getState().deleteGroup(workGroup.id);

      // Verify cascade in storage
      expect(await groupRepository.getById(workGroup.id)).toBeNull();
      expect(await taskRepository.getByGroupId(workGroup.id)).toEqual([]);
      expect(await tagRepository.getByGroupId(workGroup.id)).toEqual([]);

      // Verify state update
      const state = useGroupsStore.getState();
      expect(state.groups.some((g) => g.id === workGroup.id)).toBe(false);
      expect(state.tasks.some((t) => t.groupId === workGroup.id)).toBe(false);
      expect(state.tags.some((t) => t.groupId === workGroup.id)).toBe(false);

      // Verify fallback to [] when selectedGroupIds becomes empty (REQ-GRP-10b)
      expect(state.selectedGroupIds).toEqual([]);
    });

    it('should prune only the deleted group from selectedGroupIds when other groups were selected', async () => {
      await groupRepository.ensureSeedGroup();
      await groupRepository.save(workGroup);
      const otherGroup: Group = {
        ...workGroup,
        id: 'grp-other',
        name: 'Otro',
      };
      await groupRepository.save(otherGroup);

      await useGroupsStore.getState().init();
      useGroupsStore.getState().setSelectedGroupIds([workGroup.id, otherGroup.id]);

      await useGroupsStore.getState().deleteGroup(workGroup.id);

      expect(useGroupsStore.getState().selectedGroupIds).toEqual([otherGroup.id]);
    });
  });

  describe('refresh (REQ-GRP-16)', () => {
    it('should re-query storage and hydrate groups, tasks, and tags without page reload', async () => {
      await useGroupsStore.getState().init();
      expect(useGroupsStore.getState().groups).toHaveLength(1);

      // Directly insert to repository (simulating external update)
      await groupRepository.save(workGroup);

      await useGroupsStore.getState().refresh();

      expect(useGroupsStore.getState().groups).toHaveLength(2);
      expect(useGroupsStore.getState().groups.some((g) => g.id === workGroup.id)).toBe(true);
    });
  });

  describe('Filter and Modal actions', () => {
    it('should update selectedGroupIds via setSelectedGroupIds', () => {
      useGroupsStore.getState().setSelectedGroupIds(['grp-1', 'grp-2']);
      expect(useGroupsStore.getState().selectedGroupIds).toEqual(['grp-1', 'grp-2']);
    });

    it('should toggle groupId in selectedGroupIds via toggleGroupId', () => {
      useGroupsStore.getState().toggleGroupId('grp-1');
      expect(useGroupsStore.getState().selectedGroupIds).toEqual(['grp-1']);

      useGroupsStore.getState().toggleGroupId('grp-2');
      expect(useGroupsStore.getState().selectedGroupIds).toEqual(['grp-1', 'grp-2']);

      useGroupsStore.getState().toggleGroupId('grp-1');
      expect(useGroupsStore.getState().selectedGroupIds).toEqual(['grp-2']);
    });

    it('should update searchQuery and activeFilter', () => {
      useGroupsStore.getState().setSearchQuery('cálculo');
      expect(useGroupsStore.getState().searchQuery).toBe('cálculo');

      useGroupsStore.getState().setActiveFilter('completadas');
      expect(useGroupsStore.getState().activeFilter).toBe('completadas');
    });

    it('should manage modalState via openModal and closeModal', () => {
      useGroupsStore.getState().openModal('rename', workGroup);
      expect(useGroupsStore.getState().modalState).toEqual({
        type: 'rename',
        group: workGroup,
      });

      useGroupsStore.getState().closeModal();
      expect(useGroupsStore.getState().modalState).toEqual({
        type: null,
        group: null,
      });
    });

    it('should invoke onTasksDeleted with deleted group task IDs during deleteGroup cascade (005-notifications, REQ-NT-09(5))', async () => {
      const deletedBatches: Array<{ taskIds: string[]; userId: string }> = [];
      configureGroupsStore({
        groupRepository,
        taskRepository,
        tagRepository,
        getActiveUserId: () => Promise.resolve(SEED_PERSONAL_GROUP.creatorId),
        onTasksDeleted: async (taskIds, userId) => {
          deletedBatches.push({ taskIds, userId });
        },
      });

      await groupRepository.save(workGroup);
      await taskRepository.save({
        id: 't-work-1',
        title: 'Tarea Trabajo 1',
        description: null,
        groupId: workGroup.id,
        tagIds: [],
        completed: false,
        createdAt: '2026-11-01T10:00:00.000Z',
        completedAt: null,
        dueDate: '2026-11-25',
        dueTime: null,
        assigneeId: null,
        subtasks: [],
        reminders: [],
      });
      await taskRepository.save({
        id: 't-work-2',
        title: 'Tarea Trabajo 2',
        description: null,
        groupId: workGroup.id,
        tagIds: [],
        completed: false,
        createdAt: '2026-11-01T10:05:00.000Z',
        completedAt: null,
        dueDate: null,
        dueTime: null,
        assigneeId: null,
        subtasks: [],
        reminders: [],
      });

      await useGroupsStore.getState().init();
      await useGroupsStore.getState().deleteGroup(workGroup.id);

      expect(deletedBatches).toEqual([
        {
          taskIds: ['t-work-1', 't-work-2'],
          userId: SEED_PERSONAL_GROUP.creatorId,
        },
      ]);
    });
  });
});

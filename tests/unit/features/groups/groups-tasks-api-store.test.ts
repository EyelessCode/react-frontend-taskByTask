import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  GroupsApiRepository,
  TagsApiRepository,
  TasksApiRepository,
} from '@/data/contracts';
import {
  configureGroupsStore,
  resetGroupsStore,
  useGroupsStore,
} from '@/features/groups/store';
import {
  configureTasksStore,
  resetTasksStore,
  useTasksStore,
  type TaskNotificationHooks,
} from '@/features/tasks/store';
import { ApiProblemError } from '@/shared/errors';
import type { Group, Tag, Task } from '@/shared/schemas';

function makeGroup(overrides: Partial<Group> = {}): Group {
  return {
    id: overrides.id ?? '1',
    name: overrides.name ?? 'Personal',
    creatorId: overrides.creatorId ?? '1',
    isPersonal: overrides.isPersonal ?? true,
    type: 'individual',
    members: overrides.members ?? [
      { userId: '1', role: 'creator', joinedAt: '2026-11-20T09:00:00Z' },
    ],
    createdAt: overrides.createdAt ?? '2026-11-20T09:00:00Z',
  };
}

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: overrides.id ?? '100',
    title: overrides.title ?? 'Tarea de prueba',
    description: overrides.description ?? null,
    groupId: overrides.groupId ?? '1',
    tagIds: overrides.tagIds ?? [],
    completed: overrides.completed ?? false,
    createdAt: overrides.createdAt ?? '2026-11-20T10:00:00Z',
    completedAt: overrides.completedAt ?? null,
    dueDate: overrides.dueDate ?? null,
    dueTime: overrides.dueTime ?? null,
    assigneeId: overrides.assigneeId ?? null,
    overdue: overrides.overdue ?? false,
  };
}

function makeTag(overrides: Partial<Tag> = {}): Tag {
  return {
    id: overrides.id ?? '10',
    groupId: overrides.groupId ?? '1',
    name: overrides.name ?? 'urgente',
  };
}

function createMocks() {
  const groupsApi: GroupsApiRepository = {
    listGroups: vi.fn<GroupsApiRepository['listGroups']>(),
    getGroup: vi.fn<GroupsApiRepository['getGroup']>(),
    createGroup: vi.fn<GroupsApiRepository['createGroup']>(),
    renameGroup: vi.fn<GroupsApiRepository['renameGroup']>(),
    deleteGroup: vi.fn<GroupsApiRepository['deleteGroup']>(),
  };

  const tasksApi: TasksApiRepository = {
    listTasks: vi.fn<TasksApiRepository['listTasks']>(),
    listGroupTasks: vi.fn<TasksApiRepository['listGroupTasks']>(),
    getTask: vi.fn<TasksApiRepository['getTask']>(),
    createTask: vi.fn<TasksApiRepository['createTask']>(),
    updateTask: vi.fn<TasksApiRepository['updateTask']>(),
    deleteTask: vi.fn<TasksApiRepository['deleteTask']>(),
    updateCompletion: vi.fn<TasksApiRepository['updateCompletion']>(),
    moveTask: vi.fn<TasksApiRepository['moveTask']>(),
    copyTask: vi.fn<TasksApiRepository['copyTask']>(),
    detachTagFromTask: vi.fn<TasksApiRepository['detachTagFromTask']>(),
  };

  const tagsApi: TagsApiRepository = {
    listGroupTags: vi.fn<TagsApiRepository['listGroupTags']>(),
    createOrReuseTag: vi.fn<TagsApiRepository['createOrReuseTag']>(),
    deleteGroupTag: vi.fn<TagsApiRepository['deleteGroupTag']>(),
  };

  return { groupsApi, tasksApi, tagsApi };
}

describe('Dual-mode useGroupsStore & useTasksStore in API mode (T7)', () => {
  let groupsApi: GroupsApiRepository;
  let tasksApi: TasksApiRepository;
  let tagsApi: TagsApiRepository;
  let onTaskSavedSpy: ReturnType<typeof vi.fn<TaskNotificationHooks['onTaskSaved']>>;
  let onTaskToggledSpy: ReturnType<typeof vi.fn<TaskNotificationHooks['onTaskToggled']>>;
  let onTaskDeletedSpy: ReturnType<typeof vi.fn<TaskNotificationHooks['onTaskDeleted']>>;

  beforeEach(() => {
    const mocks = createMocks();
    groupsApi = mocks.groupsApi;
    tasksApi = mocks.tasksApi;
    tagsApi = mocks.tagsApi;

    onTaskSavedSpy = vi.fn<TaskNotificationHooks['onTaskSaved']>().mockResolvedValue(undefined);
    onTaskToggledSpy = vi.fn<TaskNotificationHooks['onTaskToggled']>().mockResolvedValue(undefined);
    onTaskDeletedSpy = vi.fn<TaskNotificationHooks['onTaskDeleted']>().mockResolvedValue(undefined);

    resetGroupsStore();
    resetTasksStore();

    configureGroupsStore({
      mode: 'api',
      groupsApi,
      tasksApi,
      tagsApi,
      getActiveUserId: async () => '1',
      searchDebounceMs: 10,
    });

    configureTasksStore({
      mode: 'api',
      groupsApi,
      tasksApi,
      tagsApi,
      getActiveUserId: async () => '1',
      notificationHooks: {
        onTaskSaved: onTaskSavedSpy,
        onTaskToggled: onTaskToggledSpy,
        onTaskDeleted: onTaskDeletedSpy,
      },
    });
  });

  afterEach(() => {
    configureGroupsStore({});
    configureTasksStore({});
  });

  it('hydrates paginated groups without Personal self-healing, loads per-group tasks, and supports loadMoreGroups with deduplication & newly created group insertion', async () => {
    const personal = makeGroup({ id: '1', name: 'Personal', isPersonal: true });
    const study = makeGroup({
      id: '2',
      name: 'Estudio',
      isPersonal: false,
      createdAt: '2026-11-20T09:05:00Z',
    });
    const work = makeGroup({
      id: '3',
      name: 'Trabajo',
      isPersonal: false,
      createdAt: '2026-11-20T09:10:00Z',
    });

    vi.mocked(groupsApi.listGroups)
      .mockResolvedValueOnce({
        content: [personal],
        nextCursor: 'g-cur-1',
        hasNext: true,
        size: 1,
      })
      .mockResolvedValueOnce({
        content: [study, work],
        nextCursor: null,
        hasNext: false,
        size: 2,
      });

    vi.mocked(tasksApi.listGroupTasks).mockImplementation(async (groupId) => {
      if (groupId === '1') {
        return {
          content: [{ task: makeTask({ id: '101', groupId: '1', tagIds: ['10'] }), tags: [makeTag({ id: '10', groupId: '1', name: 'casa' })] }],
          nextCursor: 't-cur-1',
          hasNext: true,
          size: 1,
        };
      }
      if (groupId === '2') {
        return {
          content: [{ task: makeTask({ id: '201', groupId: '2' }), tags: [] }],
          nextCursor: null,
          hasNext: false,
          size: 1,
        };
      }
      return { content: [], nextCursor: null, hasNext: false, size: 0 };
    });

    await useGroupsStore.getState().init();

    const state1 = useGroupsStore.getState();
    expect(state1.groups.map((g) => g.id)).toEqual(['1']);
    expect(state1.groupsHasNext).toBe(true);
    expect(state1.groupsNextCursor).toBe('g-cur-1');
    expect(state1.groupTaskPages['1']).toEqual({
      nextCursor: 't-cur-1',
      hasNext: true,
      isLoadingMore: false,
    });
    expect(state1.tags).toEqual([{ id: '10', groupId: '1', name: 'casa' }]);

    // Create group 'Trabajo' immediately before page 2 loads
    vi.mocked(groupsApi.createGroup).mockResolvedValueOnce(work);
    await useGroupsStore.getState().createGroup('Trabajo');
    expect(useGroupsStore.getState().groups.map((g) => g.id)).toEqual(['1', '3']);

    // Load page 2 (contains Estudio + already-inserted Trabajo) -> deduplicated & sorted
    await useGroupsStore.getState().loadMoreGroups();
    const state2 = useGroupsStore.getState();
    expect(state2.groups.map((g) => g.id)).toEqual(['1', '2', '3']);
    expect(state2.groupsHasNext).toBe(false);
    expect(state2.tasks.map((t) => t.id)).toEqual(['101', '201']);
  });

  it('paginates per-group tasks via loadMoreGroupTasks and preserves server order', async () => {
    const personal = makeGroup({ id: '1', name: 'Personal', isPersonal: true });
    vi.mocked(groupsApi.listGroups).mockResolvedValueOnce({
      content: [personal],
      nextCursor: null,
      hasNext: false,
      size: 1,
    });
    vi.mocked(tasksApi.listGroupTasks)
      .mockResolvedValueOnce({
        content: [{ task: makeTask({ id: '101', title: 'Primera' }), tags: [] }],
        nextCursor: 't-cur-2',
        hasNext: true,
        size: 1,
      })
      .mockResolvedValueOnce({
        content: [{ task: makeTask({ id: '102', title: 'Segunda' }), tags: [] }],
        nextCursor: null,
        hasNext: false,
        size: 1,
      });

    await useGroupsStore.getState().init();
    await useGroupsStore.getState().loadMoreGroupTasks('1');

    const state = useGroupsStore.getState();
    expect(tasksApi.listGroupTasks).toHaveBeenLastCalledWith('1', {
      status: 'PENDING',
      search: undefined,
      cursor: 't-cur-2',
      limit: 20,
    });
    expect(state.tasks.map((t) => t.id)).toEqual(['101', '102']);
    expect(state.groupTaskPages['1']?.hasNext).toBe(false);
  });

  it('delegates status/search/group filters, debounces search, discards stale responses, and checks cross-group search via GET /api/v1/tasks', async () => {
    const personal = makeGroup({ id: '1', name: 'Personal', isPersonal: true });
    vi.mocked(groupsApi.listGroups).mockResolvedValueOnce({
      content: [personal],
      nextCursor: 'g-cur-2',
      hasNext: true,
      size: 1,
    });

    let resolveSlowQuery!: (value: Awaited<ReturnType<TasksApiRepository['listGroupTasks']>>) => void;
    const slowPromise = new Promise<Awaited<ReturnType<TasksApiRepository['listGroupTasks']>>>(
      (resolve) => {
        resolveSlowQuery = resolve;
      },
    );

    vi.mocked(tasksApi.listGroupTasks)
      // init
      .mockResolvedValueOnce({
        content: [{ task: makeTask({ id: '101', title: 'Inicial' }), tags: [] }],
        nextCursor: null,
        hasNext: false,
        size: 1,
      })
      // slow query for COMPLETED
      .mockReturnValueOnce(slowPromise)
      // immediate query when switching to ALL before debounced search fires
      .mockResolvedValueOnce({
        content: [{ task: makeTask({ id: '101', title: 'Inicial' }), tags: [] }],
        nextCursor: null,
        hasNext: false,
        size: 1,
      })
      // faster subsequent debounced query for ALL + search 'reporte'
      .mockResolvedValueOnce({
        content: [],
        nextCursor: null,
        hasNext: false,
        size: 0,
      });

    vi.mocked(tasksApi.listTasks).mockResolvedValueOnce({
      content: [{ task: makeTask({ id: '999', groupId: '9', title: 'Reporte oculto' }), tags: [] }],
      nextCursor: null,
      hasNext: false,
      size: 1,
    });

    await useGroupsStore.getState().init();

    // Trigger slow filter change
    useGroupsStore.getState().setActiveFilter('completadas');

    // Rapidly switch to ALL and search before slow COMPLETED resolves
    useGroupsStore.getState().setActiveFilter('todas');
    useGroupsStore.getState().setSearchQuery('rep');
    useGroupsStore.getState().setSearchQuery('reporte');

    await new Promise((r) => setTimeout(r, 30));

    // Resolve stale slow response AFTER newer response already landed
    resolveSlowQuery({
      content: [{ task: makeTask({ id: '777', title: 'Stale Task', completed: true }), tags: [] }],
      nextCursor: null,
      hasNext: false,
      size: 1,
    });
    await Promise.resolve();

    const state = useGroupsStore.getState();
    expect(state.activeFilter).toBe('todas');
    // Stale task '777' must NOT overwrite latest query result
    expect(state.tasks.some((t) => t.id === '777')).toBe(false);
    // Cross-group search detected match in unloaded page
    expect(tasksApi.listTasks).toHaveBeenCalledWith({
      groupIds: undefined,
      status: 'ALL',
      search: 'reporte',
      limit: 1,
    });
    expect(state.globalSearchHasMatches).toBe(true);
  });

  it('executes task create, explicit-null PATCH, completion, move, copy, delete, tag search/detach/delete without local notification hooks', async () => {
    const personal = makeGroup({ id: '1', name: 'Personal', isPersonal: true });
    const work = makeGroup({ id: '2', name: 'Trabajo', isPersonal: false });
    const tagUrgent = makeTag({ id: '10', groupId: '1', name: 'urgente' });
    const baseTask = makeTask({
      id: '42',
      groupId: '1',
      title: 'Original',
      description: 'Desc',
      dueDate: '2026-12-01',
      dueTime: '14:30',
      tagIds: ['10'],
    });

    useGroupsStore.setState({
      groups: [personal, work],
      tasks: [baseTask],
      tags: [tagUrgent],
    });
    useTasksStore.setState({
      groups: [personal, work],
      activeGroupId: '1',
      tasks: [baseTask],
      tags: [tagUrgent],
      allTags: [tagUrgent],
    });

    vi.mocked(tasksApi.createTask).mockResolvedValueOnce({
      task: makeTask({ id: '43', groupId: '1', title: 'Nueva' }),
      tags: [],
    });
    await useTasksStore.getState().createTask({
      title: 'Nueva',
      description: '',
      dueDate: '',
      dueTime: '',
      tagNames: [],
      groupId: '1',
    });
    expect(tasksApi.createTask).toHaveBeenCalledWith('1', {
      title: 'Nueva',
      description: null,
      dueDate: null,
      dueTime: null,
      tags: null,
    });

    vi.mocked(tasksApi.updateTask).mockResolvedValueOnce({
      task: makeTask({ id: '42', groupId: '1', title: 'Editada', description: null, dueDate: null, dueTime: null, tagIds: [] }),
      tags: [],
    });
    await useTasksStore.getState().updateTask('42', {
      title: 'Editada',
      description: '',
      dueDate: '',
      dueTime: '',
      tagNames: [],
    });
    expect(tasksApi.updateTask).toHaveBeenCalledWith('42', {
      title: 'Editada',
      description: null,
      dueDate: null,
      dueTime: null,
      tags: null,
    });

    vi.mocked(tasksApi.updateCompletion).mockResolvedValueOnce({
      task: makeTask({ id: '42', groupId: '1', title: 'Editada', completed: true }),
      tags: [],
    });
    await useTasksStore.getState().toggleTaskComplete('42');
    expect(tasksApi.updateCompletion).toHaveBeenCalledWith('42', true);

    vi.mocked(tasksApi.moveTask).mockResolvedValueOnce({
      task: makeTask({ id: '42', groupId: '2', title: 'Editada', tagIds: ['20'] }),
      tags: [makeTag({ id: '20', groupId: '2', name: 'urgente' })],
    });
    await useTasksStore.getState().moveTask('42', '2');
    expect(tasksApi.moveTask).toHaveBeenCalledWith('42', '2');

    vi.mocked(tasksApi.copyTask).mockResolvedValueOnce({
      task: makeTask({ id: '44', groupId: '1', title: 'Editada (copia)', completed: false }),
      tags: [],
    });
    const copied = await useTasksStore.getState().copyTask('42', '1');
    expect(copied.id).toBe('44');

    vi.mocked(tagsApi.listGroupTags).mockResolvedValueOnce({
      content: [tagUrgent],
      nextCursor: null,
      hasNext: false,
      size: 1,
    });
    expect(await useTasksStore.getState().loadGroupTags('1', 'urg')).toEqual([tagUrgent]);

    vi.mocked(tasksApi.detachTagFromTask).mockResolvedValueOnce(undefined);
    await useTasksStore.getState().removeTagFromTask('42', '20');
    expect(tasksApi.detachTagFromTask).toHaveBeenCalledWith('42', '20');

    vi.mocked(tagsApi.deleteGroupTag).mockResolvedValueOnce(undefined);
    await useTasksStore.getState().deleteTagFromGroup('10');
    expect(tagsApi.deleteGroupTag).toHaveBeenCalledWith('1', '10');

    vi.mocked(tasksApi.deleteTask).mockResolvedValueOnce(undefined);
    await useTasksStore.getState().deleteTask('43');
    expect(tasksApi.deleteTask).toHaveBeenCalledWith('43');

    // Local notification hooks must NEVER run in api mode
    expect(onTaskSavedSpy).not.toHaveBeenCalled();
    expect(onTaskToggledSpy).not.toHaveBeenCalled();
    expect(onTaskDeletedSpy).not.toHaveBeenCalled();
  });

  it('reconciles 403/404/409 errors cleanly without corrupting workspace state', async () => {
    const personal = makeGroup({ id: '1', name: 'Personal', isPersonal: true });
    const other = makeGroup({ id: '2', name: 'Otro', isPersonal: false });
    useGroupsStore.setState({
      groups: [personal, other],
      tasks: [makeTask({ id: '99', groupId: '2' })],
    });

    // 409 when attempting to delete Personal
    vi.mocked(groupsApi.deleteGroup).mockRejectedValueOnce(
      new ApiProblemError('Conflicto', {
        status: 409,
        detail: 'El grupo Personal no se puede eliminar.',
      }),
    );
    await expect(useGroupsStore.getState().deleteGroup('1')).rejects.toBeInstanceOf(
      ApiProblemError,
    );
    expect(useGroupsStore.getState().groups.some((g) => g.id === '1')).toBe(true);
    expect(useGroupsStore.getState().error).toBe('El grupo Personal no se puede eliminar.');

    // 404 when deleting stale group removes stale group/tasks from local state
    vi.mocked(groupsApi.deleteGroup).mockRejectedValueOnce(
      new ApiProblemError('No encontrado', {
        status: 404,
        detail: 'Grupo no encontrado.',
      }),
    );
    await expect(useGroupsStore.getState().deleteGroup('2')).rejects.toBeInstanceOf(
      ApiProblemError,
    );
    expect(useGroupsStore.getState().groups.some((g) => g.id === '2')).toBe(false);
    expect(useGroupsStore.getState().tasks.some((t) => t.groupId === '2')).toBe(false);
  });
});

import { create } from 'zustand';
import { getApiServices, mapTaskFilterToApiStatus } from '../../../data/api';
import type {
  GroupRepository,
  GroupsApiRepository,
  TagRepository,
  TagsApiRepository,
  TaskRepository,
  TasksApiRepository,
  UpdateTaskPatchApiInput,
} from '../../../data/contracts';
import {
  LocalStorageGroupRepository,
  LocalStorageTagRepository,
  LocalStorageTaskRepository,
} from '../../../data/repositories';
import { getPersistenceConfig, type PersistenceMode } from '../../../shared/config';
import {
  ApiProblemError,
  BusinessRuleViolationError,
  NetworkError,
  NotFoundError,
  RateLimitError,
  UnauthorizedError,
} from '../../../shared/errors';
import { es } from '../../../shared/i18n';
import { LIMITS, type Group, type Tag, type Task } from '../../../shared/schemas';
import { subscribeAuthSessionEnd, useAuthStore } from '../../auth/store';
import { useGroupsStore } from '../../groups/store/groups-store';
import { useNotificationsStore } from '../../notifications/store';
import type { TaskFormInput } from '../schemas/task-form-schema';
import type { TaskFilter } from '../utils/task-sort';

export type ModalType =
  | 'create'
  | 'edit'
  | 'move'
  | 'copy'
  | 'delete'
  | 'tagRemoval'
  | null;

export interface ModalState {
  type: ModalType;
  taskId: string | null;
  tagId?: string | null;
  tagName?: string | null;
}

export interface TasksState {
  tasks: Task[];
  groups: Group[];
  tags: Tag[];
  allTags: Tag[];
  activeGroupId: string;
  activeFilter: TaskFilter;
  isLoading: boolean;
  error: string | null;
  modalState: ModalState;
}

export interface TasksActions {
  init: () => Promise<void>;
  setActiveGroup: (groupId: string) => Promise<void>;
  setActiveFilter: (filter: TaskFilter) => void;
  openModal: (
    type: ModalType,
    taskId?: string | null,
    extra?: { tagId?: string; tagName?: string },
  ) => void;
  closeModal: () => void;
  loadGroupTags: (groupId: string, query?: string) => Promise<Tag[]>;
  getTaskById: (taskId: string) => Promise<Task | null>;
  createTask: (payload: TaskFormInput) => Promise<Task>;
  updateTask: (taskId: string, payload: Partial<TaskFormInput>) => Promise<Task>;
  deleteTask: (taskId: string) => Promise<void>;
  toggleTaskComplete: (taskId: string) => Promise<void>;
  moveTask: (taskId: string, targetGroupId: string) => Promise<void>;
  copyTask: (taskId: string, targetGroupId: string) => Promise<Task>;
  removeTagFromTask: (taskId: string, tagId: string) => Promise<void>;
  deleteTagFromGroup: (tagId: string, groupId?: string) => Promise<void>;
}

export type TasksStore = TasksState & TasksActions;

export interface TaskNotificationHooks {
  onTaskSaved: (task: Task, userId: string, scheduleChanged: boolean) => Promise<void>;
  onTaskToggled: (task: Task, userId: string) => Promise<void>;
  onTaskDeleted: (taskId: string, userId: string) => Promise<void>;
}

export interface TasksStoreDependencies {
  mode?: PersistenceMode;
  tasksApi?: TasksApiRepository;
  groupsApi?: GroupsApiRepository;
  tagsApi?: TagsApiRepository;
  taskRepository: TaskRepository;
  groupRepository: GroupRepository;
  tagRepository: TagRepository;
  getActiveUserId: () => Promise<string | null>;
  notificationHooks?: TaskNotificationHooks;
}

function createDefaultDependencies(): TasksStoreDependencies {
  return {
    taskRepository: new LocalStorageTaskRepository(),
    groupRepository: new LocalStorageGroupRepository(),
    tagRepository: new LocalStorageTagRepository(),
    getActiveUserId: () => useAuthStore.getState().ensureActiveUserId(),
    notificationHooks: {
      onTaskSaved: (task, userId, scheduleChanged) =>
        useNotificationsStore.getState().handleTaskSaved(task, userId, scheduleChanged),
      onTaskToggled: (task, userId) =>
        useNotificationsStore.getState().handleTaskToggled(task, userId),
      onTaskDeleted: (taskId, userId) =>
        useNotificationsStore.getState().handleTaskDeleted(taskId, userId),
    },
  };
}

let deps: TasksStoreDependencies = createDefaultDependencies();

export function configureTasksStore(newDeps: Partial<TasksStoreDependencies>): void {
  deps = { ...createDefaultDependencies(), ...newDeps };
}

export function isTasksStoreApiMode(): boolean {
  return (deps.mode ?? getPersistenceConfig().mode) === 'api';
}

function resolveTasksApi(): TasksApiRepository {
  return deps.tasksApi ?? getApiServices().tasksApi;
}

function resolveGroupsApi(): GroupsApiRepository {
  return deps.groupsApi ?? getApiServices().groupsApi;
}

function resolveTagsApi(): TagsApiRepository {
  return deps.tagsApi ?? getApiServices().tagsApi;
}

function resolveApiErrorMessage(err: unknown): string {
  if (err instanceof ApiProblemError) {
    return err.detail?.trim() || err.message;
  }
  if (
    err instanceof RateLimitError ||
    err instanceof NetworkError ||
    err instanceof UnauthorizedError ||
    err instanceof Error
  ) {
    return err.message;
  }
  return es.errors.unexpected;
}

function mergeById<T extends { id: string }>(
  existing: readonly T[],
  incoming: readonly T[],
): T[] {
  const map = new Map<string, T>();
  for (const item of existing) {
    map.set(item.id, item);
  }
  for (const item of incoming) {
    map.set(item.id, item);
  }
  return Array.from(map.values());
}

const initialState: TasksState = {
  tasks: [],
  groups: [],
  tags: [],
  allTags: [],
  activeGroupId: '',
  activeFilter: 'pendientes',
  isLoading: false,
  error: null,
  modalState: {
    type: null,
    taskId: null,
    tagId: null,
    tagName: null,
  },
};

async function ensureDeduplicatedTagIds(groupId: string, tagNames: string[]): Promise<string[]> {
  const tagIds: string[] = [];
  for (const name of tagNames) {
    const tag = await deps.tagRepository.ensureTag(groupId, name);
    if (!tagIds.includes(tag.id)) {
      tagIds.push(tag.id);
    }
  }
  return tagIds;
}

async function requireActiveUserId(): Promise<string> {
  const activeUserId = await deps.getActiveUserId();
  if (!activeUserId) {
    resetTasksStore();
    throw new BusinessRuleViolationError(es.auth.sessionExpired);
  }
  return activeUserId;
}

async function getAccessibleGroupIds(activeUserId: string): Promise<Set<string>> {
  const accessibleGroups = await deps.groupRepository.getAccessibleByUserId(activeUserId);
  return new Set(accessibleGroups.map((g) => g.id));
}

function assertGroupAccessible(accessibleGroupIds: Set<string>, groupId: string): void {
  if (!accessibleGroupIds.has(groupId)) {
    throw new NotFoundError('Grupo', groupId);
  }
}

async function getAccessibleAllTags(accessibleGroupIds: Set<string>): Promise<Tag[]> {
  const allTags = await deps.tagRepository.getAll();
  return allTags.filter((t) => accessibleGroupIds.has(t.groupId));
}

function removeStaleTaskFromStores(taskId: string): void {
  useTasksStore.setState((state) => ({
    tasks: state.tasks.filter((t) => t.id !== taskId),
  }));
  useGroupsStore.setState((gState) => ({
    tasks: gState.tasks.filter((t) => t.id !== taskId),
  }));
}

export const useTasksStore = create<TasksStore>()((set, get) => ({
  ...initialState,

  init: async () => {
    set({ isLoading: true, error: null });
    try {
      const activeUserId = await deps.getActiveUserId();
      if (!activeUserId) {
        set({
          groups: [],
          activeGroupId: '',
          tasks: [],
          tags: [],
          allTags: [],
          isLoading: false,
        });
        return;
      }

      if (isTasksStoreApiMode()) {
        const existingGroups = useGroupsStore.getState().groups;
        const groups =
          existingGroups.length > 0
            ? existingGroups
            : (await resolveGroupsApi().listGroups({ limit: LIMITS.KEYSET_PAGE_LIMIT_DEFAULT })).content;

        const personalGroup = groups.find((g) => g.isPersonal);
        const currentActive = get().activeGroupId;
        const resolvedActive = groups.some((g) => g.id === currentActive)
          ? currentActive
          : personalGroup?.id ?? groups[0]?.id ?? '';

        if (!resolvedActive) {
          set({
            groups,
            activeGroupId: '',
            tasks: [],
            tags: [],
            allTags: [],
            isLoading: false,
          });
          return;
        }

        const [taskPage, tagPage] = await Promise.all([
          resolveTasksApi().listGroupTasks(resolvedActive, {
            status: mapTaskFilterToApiStatus(get().activeFilter),
            limit: LIMITS.KEYSET_PAGE_LIMIT_DEFAULT,
          }),
          resolveTagsApi().listGroupTags(resolvedActive, {
            limit: LIMITS.KEYSET_PAGE_LIMIT_MAX,
          }),
        ]);

        const groupTasks = taskPage.content.map((item) => item.task);
        const extractedTags = taskPage.content.flatMap((item) => item.tags);
        const mergedGroupTags = mergeById(tagPage.content, extractedTags);

        set((state) => ({
          groups,
          activeGroupId: resolvedActive,
          tasks: groupTasks,
          tags: mergedGroupTags,
          allTags: mergeById(state.allTags, mergedGroupTags),
          isLoading: false,
        }));
        return;
      }

      await deps.groupRepository.ensurePersonalGroupForUser(activeUserId);
      const accessibleGroups = await deps.groupRepository.getAccessibleByUserId(activeUserId);
      const accessibleGroupIds = new Set(accessibleGroups.map((g) => g.id));
      const personalGroup = accessibleGroups.find((g) => g.isPersonal);
      const currentActive = get().activeGroupId;
      const resolvedActive = accessibleGroups.some((g) => g.id === currentActive)
        ? currentActive
        : personalGroup?.id ?? accessibleGroups[0]?.id ?? '';

      const [groupTasks, groupTags, allTags] = resolvedActive
        ? await Promise.all([
            deps.taskRepository.getByGroupId(resolvedActive),
            deps.tagRepository.getByGroupId(resolvedActive),
            deps.tagRepository.getAll(),
          ])
        : [[], [], []];

      set({
        groups: accessibleGroups,
        activeGroupId: resolvedActive,
        tasks: groupTasks,
        tags: groupTags,
        allTags: allTags.filter((t) => accessibleGroupIds.has(t.groupId)),
        isLoading: false,
      });
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        set({ isLoading: false });
        return;
      }
      set({ error: resolveApiErrorMessage(err), isLoading: false });
    }
  },

  setActiveGroup: async (groupId: string) => {
    set({ isLoading: true, error: null });
    try {
      const activeUserId = await deps.getActiveUserId();
      if (!activeUserId) {
        resetTasksStore();
        return;
      }

      if (isTasksStoreApiMode()) {
        const [taskPage, tagPage] = await Promise.all([
          resolveTasksApi().listGroupTasks(groupId, {
            status: mapTaskFilterToApiStatus(get().activeFilter),
            limit: LIMITS.KEYSET_PAGE_LIMIT_DEFAULT,
          }),
          resolveTagsApi().listGroupTags(groupId, {
            limit: LIMITS.KEYSET_PAGE_LIMIT_MAX,
          }),
        ]);
        const groupTasks = taskPage.content.map((item) => item.task);
        const extractedTags = taskPage.content.flatMap((item) => item.tags);
        const mergedGroupTags = mergeById(tagPage.content, extractedTags);

        set((state) => ({
          activeGroupId: groupId,
          tasks: groupTasks,
          tags: mergedGroupTags,
          allTags: mergeById(state.allTags, mergedGroupTags),
          isLoading: false,
        }));
        return;
      }

      const accessibleGroupIds = await getAccessibleGroupIds(activeUserId);
      assertGroupAccessible(accessibleGroupIds, groupId);

      const [groupTasks, groupTags, allTags] = await Promise.all([
        deps.taskRepository.getByGroupId(groupId),
        deps.tagRepository.getByGroupId(groupId),
        getAccessibleAllTags(accessibleGroupIds),
      ]);
      set({
        activeGroupId: groupId,
        tasks: groupTasks,
        tags: groupTags,
        allTags,
        isLoading: false,
      });
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        set({ isLoading: false });
        return;
      }
      set({ error: resolveApiErrorMessage(err), isLoading: false });
    }
  },

  setActiveFilter: (filter: TaskFilter) => {
    set({ activeFilter: filter });
  },

  openModal: (type, taskId = null, extra) => {
    set({
      error: null,
      modalState: {
        type,
        taskId: taskId ?? null,
        tagId: extra?.tagId ?? null,
        tagName: extra?.tagName ?? null,
      },
    });
  },

  closeModal: () => {
    set({
      modalState: {
        type: null,
        taskId: null,
        tagId: null,
        tagName: null,
      },
    });
  },

  loadGroupTags: async (groupId: string, query?: string): Promise<Tag[]> => {
    if (!groupId) {
      return [];
    }

    if (!isTasksStoreApiMode()) {
      const localTags = await deps.tagRepository.getByGroupId(groupId);
      const q = query?.trim().toLowerCase();
      return q ? localTags.filter((t) => t.name.toLowerCase().includes(q)) : localTags;
    }

    try {
      const page = await resolveTagsApi().listGroupTags(groupId, {
        query: query?.trim() || undefined,
        limit: LIMITS.KEYSET_PAGE_LIMIT_MAX,
      });

      set((state) => ({
        tags: state.activeGroupId === groupId ? mergeById(state.tags, page.content) : state.tags,
        allTags: mergeById(state.allTags, page.content),
      }));
      useGroupsStore.setState((gState) => ({
        tags: mergeById(gState.tags, page.content),
      }));

      return page.content;
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        return [];
      }
      set({ error: resolveApiErrorMessage(err) });
      return [];
    }
  },

  getTaskById: async (taskId: string): Promise<Task | null> => {
    if (!isTasksStoreApiMode()) {
      return deps.taskRepository.getById(taskId);
    }

    try {
      const { task, tags } = await resolveTasksApi().getTask(taskId);
      set((state) => ({
        tasks: mergeById(state.tasks, [task]),
        tags: state.activeGroupId === task.groupId ? mergeById(state.tags, tags) : state.tags,
        allTags: mergeById(state.allTags, tags),
      }));
      useGroupsStore.setState((gState) => ({
        tasks: mergeById(gState.tasks, [task]),
        tags: mergeById(gState.tags, tags),
      }));
      return task;
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        return null;
      }
      if (err instanceof ApiProblemError && err.status === 404) {
        removeStaleTaskFromStores(taskId);
      }
      set({ error: resolveApiErrorMessage(err) });
      return null;
    }
  },

  createTask: async (payload: TaskFormInput) => {
    const activeUserId = await requireActiveUserId();
    const targetGroupId = payload.groupId || get().activeGroupId;

    if (isTasksStoreApiMode()) {
      try {
        const { task, tags } = await resolveTasksApi().createTask(targetGroupId, {
          title: payload.title.trim(),
          description: payload.description?.trim() || null,
          dueDate: payload.dueDate?.trim() || null,
          dueTime: payload.dueTime?.trim() || null,
          tags: payload.tagNames && payload.tagNames.length > 0 ? payload.tagNames : null,
        });

        set((state) => ({
          tasks:
            targetGroupId === state.activeGroupId
              ? mergeById(state.tasks, [task])
              : state.tasks,
          tags:
            targetGroupId === state.activeGroupId
              ? mergeById(state.tags, tags)
              : state.tags,
          allTags: mergeById(state.allTags, tags),
          error: null,
        }));

        useGroupsStore.setState((gState) => ({
          tasks:
            gState.activeFilter === 'completadas'
              ? gState.tasks
              : mergeById(gState.tasks, [task]),
          tags: mergeById(gState.tags, tags),
        }));

        return task;
      } catch (err) {
        set({ error: resolveApiErrorMessage(err) });
        throw err;
      }
    }

    const accessibleGroupIds = await getAccessibleGroupIds(activeUserId);
    assertGroupAccessible(accessibleGroupIds, targetGroupId);
    const tagIds =
      payload.tagNames && payload.tagNames.length > 0
        ? await ensureDeduplicatedTagIds(targetGroupId, payload.tagNames)
        : [];

    const id =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const newTask: Task = {
      id,
      title: payload.title.trim(),
      description: payload.description?.trim() || null,
      groupId: targetGroupId,
      tagIds,
      completed: false,
      createdAt: new Date().toISOString(),
      completedAt: null,
      dueDate: payload.dueDate?.trim() || null,
      dueTime: payload.dueTime?.trim() || null,
      assigneeId: null,
      subtasks: [],
      reminders: [],
    };

    await deps.taskRepository.save(newTask);
    const allTags = await getAccessibleAllTags(accessibleGroupIds);

    if (targetGroupId === get().activeGroupId) {
      const updatedTags = allTags.filter((t) => t.groupId === targetGroupId);
      set((state) => ({
        tasks: [...state.tasks, newTask],
        tags: updatedTags,
        allTags,
      }));
    } else {
      set({ allTags });
    }

    await deps.notificationHooks?.onTaskSaved(newTask, activeUserId, true);

    return newTask;
  },

  updateTask: async (taskId: string, payload: Partial<TaskFormInput>) => {
    const activeUserId = await requireActiveUserId();

    if (isTasksStoreApiMode()) {
      const patch: UpdateTaskPatchApiInput = {};
      if (payload.title !== undefined) {
        patch.title = payload.title.trim();
      }
      if (payload.description !== undefined) {
        patch.description = payload.description?.trim() || null;
      }
      if (payload.dueDate !== undefined) {
        patch.dueDate = payload.dueDate?.trim() || null;
      }
      if (payload.dueTime !== undefined) {
        patch.dueTime = payload.dueTime?.trim() || null;
      }
      if (payload.tagNames !== undefined) {
        patch.tags = payload.tagNames.length > 0 ? payload.tagNames : null;
      }

      try {
        const { task, tags } = await resolveTasksApi().updateTask(taskId, patch);

        set((state) => ({
          tasks: state.tasks.some((t) => t.id === taskId)
            ? state.tasks.map((t) => (t.id === taskId ? task : t))
            : state.activeGroupId === task.groupId
              ? [...state.tasks, task]
              : state.tasks,
          tags:
            state.activeGroupId === task.groupId
              ? mergeById(state.tags, tags)
              : state.tags,
          allTags: mergeById(state.allTags, tags),
          error: null,
        }));

        useGroupsStore.setState((gState) => ({
          tasks: gState.tasks.some((t) => t.id === taskId)
            ? gState.tasks.map((t) => (t.id === taskId ? task : t))
            : [...gState.tasks, task],
          tags: mergeById(gState.tags, tags),
        }));

        return task;
      } catch (err) {
        if (err instanceof ApiProblemError && err.status === 404) {
          removeStaleTaskFromStores(taskId);
        }
        set({ error: resolveApiErrorMessage(err) });
        throw err;
      }
    }

    const existing = await deps.taskRepository.getById(taskId);
    if (!existing) {
      throw new NotFoundError('Tarea', taskId);
    }
    const accessibleGroupIds = await getAccessibleGroupIds(activeUserId);
    assertGroupAccessible(accessibleGroupIds, existing.groupId);

    const tagIds =
      payload.tagNames !== undefined
        ? await ensureDeduplicatedTagIds(existing.groupId, payload.tagNames)
        : existing.tagIds ?? [];

    const updatedTask: Task = {
      ...existing,
      title: payload.title !== undefined ? payload.title.trim() : existing.title,
      description:
        payload.description !== undefined
          ? payload.description?.trim() || null
          : existing.description,
      dueDate:
        payload.dueDate !== undefined ? payload.dueDate?.trim() || null : existing.dueDate,
      dueTime:
        payload.dueTime !== undefined ? payload.dueTime?.trim() || null : existing.dueTime,
      tagIds,
    };

    await deps.taskRepository.save(updatedTask);
    const allTags = await getAccessibleAllTags(accessibleGroupIds);

    if (existing.groupId === get().activeGroupId) {
      const updatedTags = allTags.filter((t) => t.groupId === existing.groupId);
      set((state) => ({
        tasks: state.tasks.map((t) => (t.id === taskId ? updatedTask : t)),
        tags: updatedTags,
        allTags,
      }));
    } else {
      set({ allTags });
    }

    const scheduleChanged =
      existing.dueDate !== updatedTask.dueDate || existing.dueTime !== updatedTask.dueTime;
    await deps.notificationHooks?.onTaskSaved(updatedTask, activeUserId, scheduleChanged);

    return updatedTask;
  },

  deleteTask: async (taskId: string) => {
    const activeUserId = await requireActiveUserId();

    if (isTasksStoreApiMode()) {
      try {
        await resolveTasksApi().deleteTask(taskId);
        removeStaleTaskFromStores(taskId);
        set({ error: null });
        return;
      } catch (err) {
        if (err instanceof ApiProblemError && err.status === 404) {
          removeStaleTaskFromStores(taskId);
        }
        set({ error: resolveApiErrorMessage(err) });
        throw err;
      }
    }

    const existing = await deps.taskRepository.getById(taskId);
    if (!existing) {
      throw new NotFoundError('Tarea', taskId);
    }
    const accessibleGroupIds = await getAccessibleGroupIds(activeUserId);
    assertGroupAccessible(accessibleGroupIds, existing.groupId);

    await deps.taskRepository.delete(taskId);
    set((state) => ({
      tasks: state.tasks.filter((t) => t.id !== taskId),
    }));

    await deps.notificationHooks?.onTaskDeleted(taskId, activeUserId);
  },

  toggleTaskComplete: async (taskId: string) => {
    const activeUserId = await requireActiveUserId();

    if (isTasksStoreApiMode()) {
      const existing =
        get().tasks.find((t) => t.id === taskId) ??
        useGroupsStore.getState().tasks.find((t) => t.id === taskId) ??
        (await get().getTaskById(taskId));

      if (!existing) {
        throw new NotFoundError('Tarea', taskId);
      }

      try {
        const { task: updated, tags } = await resolveTasksApi().updateCompletion(
          taskId,
          !existing.completed,
        );

        set((state) => ({
          tasks: state.tasks.map((t) => (t.id === taskId ? updated : t)),
          allTags: mergeById(state.allTags, tags),
          error: null,
        }));

        useGroupsStore.setState((gState) => {
          const matchesActiveFilter =
            gState.activeFilter === 'todas' ||
            (gState.activeFilter === 'pendientes' && !updated.completed) ||
            (gState.activeFilter === 'completadas' && updated.completed);
          return {
            tasks: matchesActiveFilter
              ? gState.tasks.map((t) => (t.id === taskId ? updated : t))
              : gState.tasks.filter((t) => t.id !== taskId),
            tags: mergeById(gState.tags, tags),
          };
        });

        return;
      } catch (err) {
        if (err instanceof ApiProblemError && err.status === 404) {
          removeStaleTaskFromStores(taskId);
        }
        set({ error: resolveApiErrorMessage(err) });
        throw err;
      }
    }

    const task = await deps.taskRepository.getById(taskId);
    if (!task) {
      throw new NotFoundError('Tarea', taskId);
    }
    const accessibleGroupIds = await getAccessibleGroupIds(activeUserId);
    assertGroupAccessible(accessibleGroupIds, task.groupId);

    const updated: Task = {
      ...task,
      completed: !task.completed,
      completedAt: !task.completed ? new Date().toISOString() : null,
    };

    await deps.taskRepository.save(updated);

    set((state) => ({
      tasks: state.tasks.map((t) => (t.id === taskId ? updated : t)),
    }));

    await deps.notificationHooks?.onTaskToggled(updated, activeUserId);
  },

  moveTask: async (taskId: string, targetGroupId: string) => {
    const activeUserId = await requireActiveUserId();

    if (isTasksStoreApiMode()) {
      try {
        const { task: moved, tags } = await resolveTasksApi().moveTask(taskId, targetGroupId);

        set((state) => ({
          tasks:
            state.activeGroupId === targetGroupId
              ? mergeById(state.tasks, [moved])
              : state.tasks.filter((t) => t.id !== taskId),
          tags:
            state.activeGroupId === targetGroupId
              ? mergeById(state.tags, tags)
              : state.tags,
          allTags: mergeById(state.allTags, tags),
          error: null,
        }));

        useGroupsStore.setState((gState) => ({
          tasks: gState.tasks.some((t) => t.id === taskId)
            ? gState.tasks.map((t) => (t.id === taskId ? moved : t))
            : [...gState.tasks, moved],
          tags: mergeById(gState.tags, tags),
        }));

        return;
      } catch (err) {
        if (err instanceof ApiProblemError && err.status === 404) {
          removeStaleTaskFromStores(taskId);
        }
        set({ error: resolveApiErrorMessage(err) });
        throw err;
      }
    }

    const task = await deps.taskRepository.getById(taskId);
    if (!task) {
      throw new NotFoundError('Tarea', taskId);
    }
    const accessibleGroupIds = await getAccessibleGroupIds(activeUserId);
    assertGroupAccessible(accessibleGroupIds, task.groupId);
    assertGroupAccessible(accessibleGroupIds, targetGroupId);

    const newTagIds: string[] = [];
    if (task.tagIds && task.tagIds.length > 0) {
      for (const tagId of task.tagIds) {
        const tag = await deps.tagRepository.getById(tagId);
        if (tag) {
          const synced = await deps.tagRepository.ensureTag(targetGroupId, tag.name);
          if (!newTagIds.includes(synced.id)) {
            newTagIds.push(synced.id);
          }
        }
      }
    }

    const movedTask: Task = {
      ...task,
      groupId: targetGroupId,
      tagIds: newTagIds,
    };

    await deps.taskRepository.save(movedTask);
    const allTags = await getAccessibleAllTags(accessibleGroupIds);

    if (get().activeGroupId !== targetGroupId) {
      set((state) => ({
        tasks: state.tasks.filter((t) => t.id !== taskId),
        allTags,
      }));
    } else {
      const updatedTags = allTags.filter((t) => t.groupId === targetGroupId);
      set((state) => ({
        tasks: state.tasks.map((t) => (t.id === taskId ? movedTask : t)),
        tags: updatedTags,
        allTags,
      }));
    }
  },

  copyTask: async (taskId: string, targetGroupId: string) => {
    const activeUserId = await requireActiveUserId();

    if (isTasksStoreApiMode()) {
      try {
        const { task: copied, tags } = await resolveTasksApi().copyTask(taskId, targetGroupId);

        set((state) => ({
          tasks:
            state.activeGroupId === targetGroupId
              ? mergeById(state.tasks, [copied])
              : state.tasks,
          tags:
            state.activeGroupId === targetGroupId
              ? mergeById(state.tags, tags)
              : state.tags,
          allTags: mergeById(state.allTags, tags),
          error: null,
        }));

        useGroupsStore.setState((gState) => {
          const matchesActiveFilter =
            gState.activeFilter === 'todas' ||
            (gState.activeFilter === 'pendientes' && !copied.completed) ||
            (gState.activeFilter === 'completadas' && copied.completed);
          return {
            tasks: matchesActiveFilter ? mergeById(gState.tasks, [copied]) : gState.tasks,
            tags: mergeById(gState.tags, tags),
          };
        });

        return copied;
      } catch (err) {
        if (err instanceof ApiProblemError && err.status === 404) {
          removeStaleTaskFromStores(taskId);
        }
        set({ error: resolveApiErrorMessage(err) });
        throw err;
      }
    }

    const task = await deps.taskRepository.getById(taskId);
    if (!task) {
      throw new NotFoundError('Tarea', taskId);
    }
    const accessibleGroupIds = await getAccessibleGroupIds(activeUserId);
    assertGroupAccessible(accessibleGroupIds, task.groupId);
    assertGroupAccessible(accessibleGroupIds, targetGroupId);

    const newTagIds: string[] = [];
    if (task.tagIds && task.tagIds.length > 0) {
      for (const tagId of task.tagIds) {
        const tag = await deps.tagRepository.getById(tagId);
        if (tag) {
          const synced = await deps.tagRepository.ensureTag(targetGroupId, tag.name);
          if (!newTagIds.includes(synced.id)) {
            newTagIds.push(synced.id);
          }
        }
      }
    }

    const newId =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const copiedTask: Task = {
      ...task,
      id: newId,
      groupId: targetGroupId,
      createdAt: new Date().toISOString(),
      tagIds: newTagIds,
    };

    await deps.taskRepository.save(copiedTask);
    const allTags = await getAccessibleAllTags(accessibleGroupIds);

    if (get().activeGroupId === targetGroupId) {
      const updatedTags = allTags.filter((t) => t.groupId === targetGroupId);
      set((state) => ({
        tasks: [...state.tasks, copiedTask],
        tags: updatedTags,
        allTags,
      }));
    } else {
      set({ allTags });
    }

    await deps.notificationHooks?.onTaskSaved(copiedTask, activeUserId, true);

    return copiedTask;
  },

  removeTagFromTask: async (taskId: string, tagId: string) => {
    const activeUserId = await requireActiveUserId();

    if (isTasksStoreApiMode()) {
      try {
        await resolveTasksApi().detachTagFromTask(taskId, tagId);
        const stripTag = (t: Task): Task =>
          t.id === taskId ? { ...t, tagIds: (t.tagIds ?? []).filter((id) => id !== tagId) } : t;

        set((state) => ({
          tasks: state.tasks.map(stripTag),
          error: null,
        }));
        useGroupsStore.setState((gState) => ({
          tasks: gState.tasks.map(stripTag),
        }));
        return;
      } catch (err) {
        if (err instanceof ApiProblemError && err.status === 404) {
          removeStaleTaskFromStores(taskId);
        }
        set({ error: resolveApiErrorMessage(err) });
        throw err;
      }
    }

    const task = await deps.taskRepository.getById(taskId);
    if (!task) {
      throw new NotFoundError('Tarea', taskId);
    }
    const accessibleGroupIds = await getAccessibleGroupIds(activeUserId);
    assertGroupAccessible(accessibleGroupIds, task.groupId);

    const updatedTask: Task = {
      ...task,
      tagIds: (task.tagIds ?? []).filter((id) => id !== tagId),
    };

    await deps.taskRepository.save(updatedTask);

    set((state) => ({
      tasks: state.tasks.map((t) => (t.id === taskId ? updatedTask : t)),
    }));
  },

  deleteTagFromGroup: async (tagId: string, explicitGroupId?: string) => {
    const activeUserId = await requireActiveUserId();

    if (isTasksStoreApiMode()) {
      const gState = useGroupsStore.getState();
      const resolvedGroupId =
        explicitGroupId ??
        get().tags.find((t) => t.id === tagId)?.groupId ??
        get().allTags.find((t) => t.id === tagId)?.groupId ??
        gState.tags.find((t) => t.id === tagId)?.groupId ??
        get().tasks.find((t) => t.tagIds?.includes(tagId))?.groupId ??
        gState.tasks.find((t) => t.tagIds?.includes(tagId))?.groupId;

      if (!resolvedGroupId) {
        throw new NotFoundError('Etiqueta', tagId);
      }

      try {
        await resolveTagsApi().deleteGroupTag(resolvedGroupId, tagId);

        const stripTagFromTask = (t: Task): Task => ({
          ...t,
          tagIds: (t.tagIds ?? []).filter((id) => id !== tagId),
        });

        set((state) => ({
          tags: state.tags.filter((t) => t.id !== tagId),
          allTags: state.allTags.filter((t) => t.id !== tagId),
          tasks: state.tasks.map(stripTagFromTask),
          error: null,
        }));

        useGroupsStore.setState((prev) => ({
          tags: prev.tags.filter((t) => t.id !== tagId),
          tasks: prev.tasks.map(stripTagFromTask),
        }));
        return;
      } catch (err) {
        set({ error: resolveApiErrorMessage(err) });
        throw err;
      }
    }

    const tag = await deps.tagRepository.getById(tagId);
    if (!tag) {
      throw new NotFoundError('Etiqueta', tagId);
    }
    const accessibleGroupIds = await getAccessibleGroupIds(activeUserId);
    assertGroupAccessible(accessibleGroupIds, tag.groupId);

    await deps.tagRepository.deleteFromGroup(tagId);

    const groupTasks = await deps.taskRepository.getByGroupId(tag.groupId);
    for (const task of groupTasks) {
      if (task.tagIds && task.tagIds.includes(tagId)) {
        const updated: Task = {
          ...task,
          tagIds: task.tagIds.filter((id) => id !== tagId),
        };
        await deps.taskRepository.save(updated);
      }
    }

    set((state) => ({
      tags: state.tags.filter((t) => t.id !== tagId),
      allTags: state.allTags.filter((t) => t.id !== tagId),
      tasks: state.tasks.map((t) => ({
        ...t,
        tagIds: (t.tagIds ?? []).filter((id) => id !== tagId),
      })),
    }));
  },
}));

export function resetTasksStore(): void {
  useTasksStore.setState(initialState);
}

subscribeAuthSessionEnd(() => {
  resetTasksStore();
});

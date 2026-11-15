import { create } from 'zustand';
import type { Task, Group, Tag } from '../../../shared/schemas';
import type { TaskFilter } from '../utils/task-sort';
import type { TaskFormInput } from '../schemas/task-form-schema';
import type {
  TaskRepository,
  GroupRepository,
  TagRepository,
} from '../../../data/contracts';
import {
  LocalStorageTaskRepository,
  LocalStorageGroupRepository,
  LocalStorageTagRepository,
} from '../../../data/repositories';
import { BusinessRuleViolationError, NotFoundError } from '../../../shared/errors';
import { es } from '../../../shared/i18n';
import { subscribeAuthSessionEnd, useAuthStore } from '../../auth/store';

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
  createTask: (payload: TaskFormInput) => Promise<Task>;
  updateTask: (taskId: string, payload: Partial<TaskFormInput>) => Promise<Task>;
  deleteTask: (taskId: string) => Promise<void>;
  toggleTaskComplete: (taskId: string) => Promise<void>;
  moveTask: (taskId: string, targetGroupId: string) => Promise<void>;
  copyTask: (taskId: string, targetGroupId: string) => Promise<Task>;
  removeTagFromTask: (taskId: string, tagId: string) => Promise<void>;
  deleteTagFromGroup: (tagId: string) => Promise<void>;
}

export type TasksStore = TasksState & TasksActions;

export interface TasksStoreDependencies {
  taskRepository: TaskRepository;
  groupRepository: GroupRepository;
  tagRepository: TagRepository;
  getActiveUserId: () => Promise<string | null>;
}

let deps: TasksStoreDependencies = {
  taskRepository: new LocalStorageTaskRepository(),
  groupRepository: new LocalStorageGroupRepository(),
  tagRepository: new LocalStorageTagRepository(),
  getActiveUserId: () => useAuthStore.getState().ensureActiveUserId(),
};

export function configureTasksStore(newDeps: Partial<TasksStoreDependencies>): void {
  deps = { ...deps, ...newDeps };
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
      set({ error: (err as Error).message, isLoading: false });
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
      set({ error: (err as Error).message, isLoading: false });
    }
  },

  setActiveFilter: (filter: TaskFilter) => {
    set({ activeFilter: filter });
  },

  openModal: (type, taskId = null, extra) => {
    set({
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

  createTask: async (payload: TaskFormInput) => {
    const activeUserId = await requireActiveUserId();
    const targetGroupId = payload.groupId || get().activeGroupId;
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

    return newTask;
  },

  updateTask: async (taskId: string, payload: Partial<TaskFormInput>) => {
    const activeUserId = await requireActiveUserId();
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

    return updatedTask;
  },

  deleteTask: async (taskId: string) => {
    const activeUserId = await requireActiveUserId();
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
  },

  toggleTaskComplete: async (taskId: string) => {
    const activeUserId = await requireActiveUserId();
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
  },

  moveTask: async (taskId: string, targetGroupId: string) => {
    const activeUserId = await requireActiveUserId();
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

    return copiedTask;
  },

  removeTagFromTask: async (taskId: string, tagId: string) => {
    const activeUserId = await requireActiveUserId();
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

  deleteTagFromGroup: async (tagId: string) => {
    const activeUserId = await requireActiveUserId();
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

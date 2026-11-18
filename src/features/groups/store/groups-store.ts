import { create } from 'zustand';
import type { Group, Task, Tag } from '../../../shared/schemas';
import type { TaskFilter } from '../../tasks/utils/task-sort';
import type {
  GroupRepository,
  TaskRepository,
  TagRepository,
} from '../../../data/contracts';
import {
  LocalStorageGroupRepository,
  LocalStorageTaskRepository,
  LocalStorageTagRepository,
} from '../../../data/repositories';
import {
  NotFoundError,
  BusinessRuleViolationError,
} from '../../../shared/errors';
import { es } from '../../../shared/i18n';
import { subscribeAuthSessionEnd, useAuthStore } from '../../auth/store';
import { useNotificationsStore } from '../../notifications/store';
import { useTasksStore } from '../../tasks/store/tasks-store';

export type GroupModalType = 'create' | 'rename' | 'delete' | null;

export interface GroupModalState {
  type: GroupModalType;
  group: Group | null;
}

export interface GroupsState {
  groups: Group[];
  tasks: Task[];
  tags: Tag[];
  selectedGroupIds: string[];
  searchQuery: string;
  activeFilter: TaskFilter;
  isLoading: boolean;
  error: string | null;
  modalState: GroupModalState;
}

export interface GroupsActions {
  init: () => Promise<void>;
  createGroup: (name: string) => Promise<Group>;
  renameGroup: (groupId: string, newName: string) => Promise<Group>;
  deleteGroup: (groupId: string) => Promise<void>;
  refresh: () => Promise<void>;
  setSelectedGroupIds: (ids: string[]) => void;
  toggleGroupId: (groupId: string) => void;
  setSearchQuery: (query: string) => void;
  setActiveFilter: (filter: TaskFilter) => void;
  openModal: (type: GroupModalType, group?: Group | null) => void;
  closeModal: () => void;
}

export type GroupsStore = GroupsState & GroupsActions;

export interface GroupsStoreDependencies {
  groupRepository: GroupRepository;
  taskRepository: TaskRepository;
  tagRepository: TagRepository;
  getActiveUserId: () => Promise<string | null>;
  onTasksDeleted?: (taskIds: string[], userId: string) => Promise<void>;
}

function createDefaultDependencies(): GroupsStoreDependencies {
  return {
    groupRepository: new LocalStorageGroupRepository(),
    taskRepository: new LocalStorageTaskRepository(),
    tagRepository: new LocalStorageTagRepository(),
    getActiveUserId: () => useAuthStore.getState().ensureActiveUserId(),
    onTasksDeleted: (taskIds, userId) =>
      useNotificationsStore.getState().handleTasksDeleted(taskIds, userId),
  };
}

let deps: GroupsStoreDependencies = createDefaultDependencies();

export function configureGroupsStore(newDeps: Partial<GroupsStoreDependencies>): void {
  deps = { ...createDefaultDependencies(), ...newDeps };
}

function isGroupAccessibleToUser(group: Group, userId: string): boolean {
  return (
    group.creatorId === userId || group.members.some((member) => member.userId === userId)
  );
}

const initialState: GroupsState = {
  groups: [],
  tasks: [],
  tags: [],
  selectedGroupIds: [],
  searchQuery: '',
  activeFilter: 'pendientes',
  isLoading: false,
  error: null,
  modalState: {
    type: null,
    group: null,
  },
};

export const useGroupsStore = create<GroupsStore>()((set) => ({
  ...initialState,

  init: async () => {
    set({ isLoading: true, error: null });
    try {
      const activeUserId = await deps.getActiveUserId();
      if (!activeUserId) {
        set({
          groups: [],
          tasks: [],
          tags: [],
          selectedGroupIds: [],
          isLoading: false,
        });
        await useTasksStore.getState().init();
        return;
      }

      await deps.groupRepository.ensurePersonalGroupForUser(activeUserId);
      const accessibleGroups = await deps.groupRepository.getAccessibleByUserId(activeUserId);
      const accessibleGroupIds = new Set(accessibleGroups.map((g) => g.id));

      const [allTasks, allTags] = await Promise.all([
        deps.taskRepository.getAll(),
        deps.tagRepository.getAll(),
      ]);

      await useTasksStore.getState().init();

      set({
        groups: accessibleGroups,
        tasks: allTasks.filter((t) => accessibleGroupIds.has(t.groupId)),
        tags: allTags.filter((t) => accessibleGroupIds.has(t.groupId)),
        isLoading: false,
      });
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },

  createGroup: async (name: string) => {
    set({ isLoading: true, error: null });
    try {
      const activeUserId = await deps.getActiveUserId();
      if (!activeUserId) {
        resetGroupsStore();
        throw new BusinessRuleViolationError(es.auth.sessionExpired);
      }

      const trimmed = name.trim();
      const nowIso = new Date().toISOString();
      const newGroup: Group = {
        id:
          typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID()
            : `group-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        name: trimmed,
        creatorId: activeUserId,
        isPersonal: false,
        type: 'individual',
        members: [
          {
            userId: activeUserId,
            role: 'creator',
            joinedAt: nowIso,
          },
        ],
        createdAt: nowIso,
      };

      await deps.groupRepository.save(newGroup);

      set((state) => ({
        groups: [...state.groups, newGroup],
        isLoading: false,
      }));

      useTasksStore.setState((state) => ({
        groups: [...state.groups, newGroup],
      }));

      return newGroup;
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
      throw err;
    }
  },

  renameGroup: async (groupId: string, newName: string) => {
    set({ isLoading: true, error: null });
    try {
      const activeUserId = await deps.getActiveUserId();
      if (!activeUserId) {
        resetGroupsStore();
        throw new BusinessRuleViolationError(es.auth.sessionExpired);
      }

      const group = await deps.groupRepository.getById(groupId);
      if (!group || !isGroupAccessibleToUser(group, activeUserId)) {
        throw new NotFoundError(es.errors.notFound('Grupo'));
      }

      const updated: Group = {
        ...group,
        name: newName.trim(),
      };

      await deps.groupRepository.save(updated);

      set((state) => ({
        groups: state.groups.map((g) => (g.id === groupId ? updated : g)),
        isLoading: false,
      }));

      useTasksStore.setState((state) => ({
        groups: state.groups.map((g) => (g.id === groupId ? updated : g)),
      }));

      return updated;
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
      throw err;
    }
  },

  deleteGroup: async (groupId: string) => {
    set({ isLoading: true, error: null });
    try {
      const activeUserId = await deps.getActiveUserId();
      if (!activeUserId) {
        resetGroupsStore();
        throw new BusinessRuleViolationError(es.auth.sessionExpired);
      }

      const group = await deps.groupRepository.getById(groupId);
      if (!group || !isGroupAccessibleToUser(group, activeUserId)) {
        throw new NotFoundError(es.errors.notFound('Grupo'));
      }
      if (group.isPersonal) {
        throw new BusinessRuleViolationError(es.groups.cannotDeletePersonal);
      }

      const groupTasks = await deps.taskRepository.getByGroupId(groupId);
      const deletedTaskIds = groupTasks.map((t) => t.id);

      await deps.groupRepository.delete(groupId);
      await deps.taskRepository.deleteByGroupId(groupId);
      await deps.tagRepository.deleteByGroupId(groupId);
      await deps.onTasksDeleted?.(deletedTaskIds, activeUserId);

      set((state) => {
        const remainingSelected = state.selectedGroupIds.filter((id) => id !== groupId);
        return {
          groups: state.groups.filter((g) => g.id !== groupId),
          tasks: state.tasks.filter((t) => t.groupId !== groupId),
          tags: state.tags.filter((t) => t.groupId !== groupId),
          selectedGroupIds: remainingSelected,
          isLoading: false,
        };
      });

      await useTasksStore.getState().init();
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
      throw err;
    }
  },

  refresh: async () => {
    set({ isLoading: true, error: null });
    try {
      const activeUserId = await deps.getActiveUserId();
      if (!activeUserId) {
        set({
          groups: [],
          tasks: [],
          tags: [],
          selectedGroupIds: [],
          isLoading: false,
        });
        await useTasksStore.getState().init();
        return;
      }

      await deps.groupRepository.ensurePersonalGroupForUser(activeUserId);
      const accessibleGroups = await deps.groupRepository.getAccessibleByUserId(activeUserId);
      const accessibleGroupIds = new Set(accessibleGroups.map((g) => g.id));

      const [allTasks, allTags] = await Promise.all([
        deps.taskRepository.getAll(),
        deps.tagRepository.getAll(),
      ]);

      await useTasksStore.getState().init();

      set({
        groups: accessibleGroups,
        tasks: allTasks.filter((t) => accessibleGroupIds.has(t.groupId)),
        tags: allTags.filter((t) => accessibleGroupIds.has(t.groupId)),
        isLoading: false,
      });
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },

  setSelectedGroupIds: (ids: string[]) => {
    set({ selectedGroupIds: ids });
  },

  toggleGroupId: (groupId: string) => {
    set((state) => {
      const exists = state.selectedGroupIds.includes(groupId);
      return {
        selectedGroupIds: exists
          ? state.selectedGroupIds.filter((id) => id !== groupId)
          : [...state.selectedGroupIds, groupId],
      };
    });
  },

  setSearchQuery: (query: string) => {
    set({ searchQuery: query });
  },

  setActiveFilter: (filter: TaskFilter) => {
    set({ activeFilter: filter });
  },

  openModal: (type: GroupModalType, group: Group | null = null) => {
    set({ modalState: { type, group: group ?? null } });
  },

  closeModal: () => {
    set({ modalState: { type: null, group: null } });
  },
}));

export function resetGroupsStore(): void {
  useGroupsStore.setState(initialState);
}

subscribeAuthSessionEnd(() => {
  resetGroupsStore();
});

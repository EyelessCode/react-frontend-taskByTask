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
}

let deps: GroupsStoreDependencies = {
  groupRepository: new LocalStorageGroupRepository(),
  taskRepository: new LocalStorageTaskRepository(),
  tagRepository: new LocalStorageTagRepository(),
};

export function configureGroupsStore(newDeps: Partial<GroupsStoreDependencies>): void {
  deps = { ...deps, ...newDeps };
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
      await deps.groupRepository.ensureSeedGroup();
      const [allGroups, allTasks, allTags] = await Promise.all([
        deps.groupRepository.getAll(),
        deps.taskRepository.getAll(),
        deps.tagRepository.getAll(),
      ]);

      await useTasksStore.getState().init();

      set({
        groups: allGroups,
        tasks: allTasks,
        tags: allTags,
        isLoading: false,
      });
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },

  createGroup: async (name: string) => {
    set({ isLoading: true, error: null });
    try {
      const trimmed = name.trim();
      const newGroup: Group = {
        id:
          typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID()
            : `group-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        name: trimmed,
        creatorId: 'local-user',
        isPersonal: false,
        type: 'individual',
        members: [
          {
            userId: 'local-user',
            role: 'creator',
            joinedAt: new Date().toISOString(),
          },
        ],
        createdAt: new Date().toISOString(),
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
      const group = await deps.groupRepository.getById(groupId);
      if (!group) {
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
      const group = await deps.groupRepository.getById(groupId);
      if (!group) {
        throw new NotFoundError(es.errors.notFound('Grupo'));
      }
      if (group.isPersonal) {
        throw new BusinessRuleViolationError(es.groups.cannotDeletePersonal);
      }

      await deps.groupRepository.delete(groupId);
      await deps.taskRepository.deleteByGroupId(groupId);
      await deps.tagRepository.deleteByGroupId(groupId);

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
      const [allGroups, allTasks, allTags] = await Promise.all([
        deps.groupRepository.getAll(),
        deps.taskRepository.getAll(),
        deps.tagRepository.getAll(),
      ]);

      await useTasksStore.getState().init();

      set({
        groups: allGroups,
        tasks: allTasks,
        tags: allTags,
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

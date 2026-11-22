import { create } from 'zustand';
import { getApiServices, mapTaskFilterToApiStatus } from '../../../data/api';
import type {
  GroupRepository,
  GroupsApiRepository,
  TagRepository,
  TagsApiRepository,
  TaskRepository,
  TasksApiRepository,
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
import { useNotificationsStore } from '../../notifications/store';
import { useTasksStore } from '../../tasks/store/tasks-store';
import type { TaskFilter } from '../../tasks/utils/task-sort';
import { sortGroups } from '../utils/group-sort';

export type GroupModalType = 'create' | 'rename' | 'delete' | null;

export interface GroupModalState {
  type: GroupModalType;
  group: Group | null;
}

export interface GroupTaskPageState {
  nextCursor: string | null;
  hasNext: boolean;
  isLoadingMore: boolean;
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
  groupsNextCursor: string | null;
  groupsHasNext: boolean;
  isLoadingMoreGroups: boolean;
  groupTaskPages: Record<string, GroupTaskPageState>;
  globalSearchHasMatches: boolean;
}

export interface GroupsActions {
  init: () => Promise<void>;
  createGroup: (name: string) => Promise<Group>;
  renameGroup: (groupId: string, newName: string) => Promise<Group>;
  deleteGroup: (groupId: string) => Promise<void>;
  refresh: () => Promise<void>;
  loadMoreGroups: () => Promise<void>;
  loadMoreGroupTasks: (groupId: string) => Promise<void>;
  setSelectedGroupIds: (ids: string[]) => void;
  toggleGroupId: (groupId: string) => void;
  setSearchQuery: (query: string) => void;
  setActiveFilter: (filter: TaskFilter) => void;
  openModal: (type: GroupModalType, group?: Group | null) => void;
  closeModal: () => void;
  clearError: () => void;
}

export type GroupsStore = GroupsState & GroupsActions;

export interface GroupsStoreDependencies {
  mode?: PersistenceMode;
  groupsApi?: GroupsApiRepository;
  tasksApi?: TasksApiRepository;
  tagsApi?: TagsApiRepository;
  searchDebounceMs?: number;
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
let requestSeq = 0;
let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;

function clearSearchDebounce(): void {
  if (searchDebounceTimer !== null) {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = null;
  }
}

export function configureGroupsStore(newDeps: Partial<GroupsStoreDependencies>): void {
  deps = { ...createDefaultDependencies(), ...newDeps };
}

export function isGroupsStoreApiMode(): boolean {
  return (deps.mode ?? getPersistenceConfig().mode) === 'api';
}

function resolveGroupsApi(): GroupsApiRepository {
  return deps.groupsApi ?? getApiServices().groupsApi;
}

function resolveTasksApi(): TasksApiRepository {
  return deps.tasksApi ?? getApiServices().tasksApi;
}

function resolveErrorMessage(err: unknown): string {
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

function mergeEntitiesById<T extends { id: string }>(
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
  groupsNextCursor: null,
  groupsHasNext: false,
  isLoadingMoreGroups: false,
  groupTaskPages: {},
  globalSearchHasMatches: false,
};

async function fetchVisibleGroupTaskPages(
  groups: readonly Group[],
  selectedGroupIds: readonly string[],
  activeFilter: TaskFilter,
  searchQuery: string,
): Promise<{
  tasks: Task[];
  tags: Tag[];
  groupTaskPages: Record<string, GroupTaskPageState>;
  staleGroupIds: string[];
  errorMessage: string | null;
}> {
  const targetGroups =
    selectedGroupIds.length === 0
      ? groups
      : groups.filter((g) => selectedGroupIds.includes(g.id));

  const apiStatus = mapTaskFilterToApiStatus(activeFilter);
  const trimmedSearch = searchQuery.trim() || undefined;
  const tasksApi = resolveTasksApi();

  const results = await Promise.all(
    targetGroups.map(async (group) => {
      try {
        const page = await tasksApi.listGroupTasks(group.id, {
          status: apiStatus,
          search: trimmedSearch,
          limit: LIMITS.KEYSET_PAGE_LIMIT_DEFAULT,
        });
        return { ok: true as const, groupId: group.id, page };
      } catch (err) {
        if (err instanceof UnauthorizedError) {
          throw err;
        }
        if (err instanceof ApiProblemError && (err.status === 403 || err.status === 404)) {
          return {
            ok: false as const,
            groupId: group.id,
            removeStale: err.status === 404,
            message: resolveErrorMessage(err),
          };
        }
        throw err;
      }
    }),
  );

  const tasks: Task[] = [];
  const tags: Tag[] = [];
  const groupTaskPages: Record<string, GroupTaskPageState> = {};
  const staleGroupIds: string[] = [];
  let errorMessage: string | null = null;

  for (const res of results) {
    if (!res.ok) {
      errorMessage = res.message;
      if (res.removeStale) {
        staleGroupIds.push(res.groupId);
      }
      continue;
    }

    for (const item of res.page.content) {
      tasks.push(item.task);
      for (const tag of item.tags) {
        tags.push(tag);
      }
    }
    groupTaskPages[res.groupId] = {
      nextCursor: res.page.nextCursor,
      hasNext: res.page.hasNext,
      isLoadingMore: false,
    };
  }

  return {
    tasks: mergeEntitiesById([], tasks),
    tags: mergeEntitiesById([], tags),
    groupTaskPages,
    staleGroupIds,
    errorMessage,
  };
}

export const useGroupsStore = create<GroupsStore>()((set, get) => ({
  ...initialState,

  init: async () => {
    clearSearchDebounce();
    requestSeq += 1;
    const seq = requestSeq;
    set({ isLoading: true, error: null });

    try {
      const activeUserId = await deps.getActiveUserId();
      if (!activeUserId) {
        set({
          groups: [],
          tasks: [],
          tags: [],
          selectedGroupIds: [],
          groupsNextCursor: null,
          groupsHasNext: false,
          isLoadingMoreGroups: false,
          groupTaskPages: {},
          globalSearchHasMatches: false,
          isLoading: false,
        });
        if (!isGroupsStoreApiMode()) {
          await useTasksStore.getState().init();
        }
        return;
      }

      if (isGroupsStoreApiMode()) {
        const groupPage = await resolveGroupsApi().listGroups({
          limit: LIMITS.KEYSET_PAGE_LIMIT_DEFAULT,
        });
        if (seq !== requestSeq) {
          return;
        }

        const sortedGroups = sortGroups(mergeEntitiesById([], groupPage.content));
        const { activeFilter, searchQuery, selectedGroupIds } = get();
        const taskData = await fetchVisibleGroupTaskPages(
          sortedGroups,
          selectedGroupIds,
          activeFilter,
          searchQuery,
        );
        if (seq !== requestSeq) {
          return;
        }

        const finalGroups =
          taskData.staleGroupIds.length > 0
            ? sortedGroups.filter((g) => !taskData.staleGroupIds.includes(g.id))
            : sortedGroups;

        const trimmedSearch = searchQuery.trim();
        let globalSearchHasMatches = taskData.tasks.length > 0;
        if (trimmedSearch.length > 0 && taskData.tasks.length === 0 && groupPage.hasNext) {
          const crossPage = await resolveTasksApi().listTasks({
            groupIds: selectedGroupIds.length > 0 ? selectedGroupIds : undefined,
            status: mapTaskFilterToApiStatus(activeFilter),
            search: trimmedSearch,
            limit: 1,
          });
          if (seq !== requestSeq) {
            return;
          }
          globalSearchHasMatches = crossPage.content.length > 0;
        } else if (trimmedSearch.length === 0) {
          globalSearchHasMatches = false;
        }

        set({
          groups: finalGroups,
          tasks: taskData.tasks,
          tags: taskData.tags,
          groupsNextCursor: groupPage.nextCursor,
          groupsHasNext: groupPage.hasNext,
          isLoadingMoreGroups: false,
          groupTaskPages: taskData.groupTaskPages,
          globalSearchHasMatches,
          error: taskData.errorMessage,
          isLoading: false,
        });

        useTasksStore.setState((tState) => {
          const personalGroup = finalGroups.find((g) => g.isPersonal);
          const resolvedActive = finalGroups.some((g) => g.id === tState.activeGroupId)
            ? tState.activeGroupId
            : personalGroup?.id ?? finalGroups[0]?.id ?? '';
          return {
            groups: finalGroups,
            activeGroupId: resolvedActive,
            allTags: mergeEntitiesById(tState.allTags, taskData.tags),
          };
        });
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
      if (err instanceof UnauthorizedError) {
        set({ isLoading: false });
        return;
      }
      set({ error: resolveErrorMessage(err), isLoading: false });
    }
  },

  refresh: async () => {
    await get().init();
  },

  loadMoreGroups: async () => {
    if (!isGroupsStoreApiMode()) {
      return;
    }

    const state = get();
    if (!state.groupsHasNext || !state.groupsNextCursor || state.isLoadingMoreGroups) {
      return;
    }

    const seq = requestSeq;
    set({ isLoadingMoreGroups: true, error: null });

    try {
      const nextPage = await resolveGroupsApi().listGroups({
        cursor: state.groupsNextCursor,
        limit: LIMITS.KEYSET_PAGE_LIMIT_DEFAULT,
      });
      if (seq !== requestSeq) {
        return;
      }

      const currentState = get();
      const existingIds = new Set(currentState.groups.map((g) => g.id));
      const newlyLoadedGroups = nextPage.content.filter((g) => !existingIds.has(g.id));
      const mergedGroups = sortGroups(mergeEntitiesById(currentState.groups, nextPage.content));

      const taskData = await fetchVisibleGroupTaskPages(
        newlyLoadedGroups,
        currentState.selectedGroupIds,
        currentState.activeFilter,
        currentState.searchQuery,
      );
      if (seq !== requestSeq) {
        return;
      }

      const finalGroups =
        taskData.staleGroupIds.length > 0
          ? mergedGroups.filter((g) => !taskData.staleGroupIds.includes(g.id))
          : mergedGroups;

      const mergedTasks = mergeEntitiesById(get().tasks, taskData.tasks);
      const mergedTags = mergeEntitiesById(get().tags, taskData.tags);

      set((prev) => ({
        groups: finalGroups,
        tasks: mergedTasks,
        tags: mergedTags,
        groupsNextCursor: nextPage.nextCursor,
        groupsHasNext: nextPage.hasNext,
        isLoadingMoreGroups: false,
        groupTaskPages: {
          ...prev.groupTaskPages,
          ...taskData.groupTaskPages,
        },
        globalSearchHasMatches:
          prev.searchQuery.trim().length > 0
            ? mergedTasks.length > 0 || prev.globalSearchHasMatches
            : false,
        error: taskData.errorMessage,
      }));

      useTasksStore.setState((tState) => ({
        groups: finalGroups,
        allTags: mergeEntitiesById(tState.allTags, mergedTags),
      }));
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        set({ isLoadingMoreGroups: false });
        return;
      }
      set({ error: resolveErrorMessage(err), isLoadingMoreGroups: false });
    }
  },

  loadMoreGroupTasks: async (groupId: string) => {
    if (!isGroupsStoreApiMode()) {
      return;
    }

    const state = get();
    const pageInfo = state.groupTaskPages[groupId];
    if (!pageInfo || !pageInfo.hasNext || !pageInfo.nextCursor || pageInfo.isLoadingMore) {
      return;
    }

    const seq = requestSeq;
    set((prev) => ({
      error: null,
      groupTaskPages: {
        ...prev.groupTaskPages,
        [groupId]: {
          ...pageInfo,
          isLoadingMore: true,
        },
      },
    }));

    try {
      const page = await resolveTasksApi().listGroupTasks(groupId, {
        status: mapTaskFilterToApiStatus(state.activeFilter),
        search: state.searchQuery.trim() || undefined,
        cursor: pageInfo.nextCursor,
        limit: LIMITS.KEYSET_PAGE_LIMIT_DEFAULT,
      });
      if (seq !== requestSeq) {
        return;
      }

      const incomingTasks = page.content.map((item) => item.task);
      const incomingTags = page.content.flatMap((item) => item.tags);

      set((prev) => {
        const mergedTasks = mergeEntitiesById(prev.tasks, incomingTasks);
        const mergedTags = mergeEntitiesById(prev.tags, incomingTags);
        return {
          tasks: mergedTasks,
          tags: mergedTags,
          groupTaskPages: {
            ...prev.groupTaskPages,
            [groupId]: {
              nextCursor: page.nextCursor,
              hasNext: page.hasNext,
              isLoadingMore: false,
            },
          },
        };
      });

      useTasksStore.setState((tState) => ({
        allTags: mergeEntitiesById(tState.allTags, incomingTags),
      }));
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        return;
      }
      if (err instanceof ApiProblemError && err.status === 404) {
        set((prev) => {
          const nextPages = { ...prev.groupTaskPages };
          delete nextPages[groupId];
          return {
            groups: prev.groups.filter((g) => g.id !== groupId),
            tasks: prev.tasks.filter((t) => t.groupId !== groupId),
            tags: prev.tags.filter((t) => t.groupId !== groupId),
            selectedGroupIds: prev.selectedGroupIds.filter((id) => id !== groupId),
            groupTaskPages: nextPages,
            error: resolveErrorMessage(err),
          };
        });
        return;
      }
      set((prev) => ({
        error: resolveErrorMessage(err),
        groupTaskPages: {
          ...prev.groupTaskPages,
          [groupId]: {
            ...pageInfo,
            isLoadingMore: false,
          },
        },
      }));
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

      if (isGroupsStoreApiMode()) {
        const created = await resolveGroupsApi().createGroup(name.trim());
        const updatedGroups = sortGroups(mergeEntitiesById(get().groups, [created]));

        set((prev) => ({
          groups: updatedGroups,
          groupTaskPages: {
            ...prev.groupTaskPages,
            [created.id]: prev.groupTaskPages[created.id] ?? {
              nextCursor: null,
              hasNext: false,
              isLoadingMore: false,
            },
          },
          isLoading: false,
        }));

        useTasksStore.setState({ groups: updatedGroups });
        return created;
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
      set({ error: resolveErrorMessage(err), isLoading: false });
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

      if (isGroupsStoreApiMode()) {
        try {
          const updated = await resolveGroupsApi().renameGroup(groupId, newName.trim());
          set((state) => ({
            groups: state.groups.map((g) => (g.id === groupId ? updated : g)),
            isLoading: false,
          }));
          useTasksStore.setState((state) => ({
            groups: state.groups.map((g) => (g.id === groupId ? updated : g)),
          }));
          return updated;
        } catch (err) {
          if (err instanceof ApiProblemError && err.status === 404) {
            set((state) => ({
              groups: state.groups.filter((g) => g.id !== groupId),
              tasks: state.tasks.filter((t) => t.groupId !== groupId),
              tags: state.tags.filter((t) => t.groupId !== groupId),
              selectedGroupIds: state.selectedGroupIds.filter((id) => id !== groupId),
              error: resolveErrorMessage(err),
              isLoading: false,
            }));
            throw err;
          }
          throw err;
        }
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
      set({ error: resolveErrorMessage(err), isLoading: false });
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

      if (isGroupsStoreApiMode()) {
        try {
          await resolveGroupsApi().deleteGroup(groupId);
        } catch (err) {
          if (err instanceof ApiProblemError && err.status === 404) {
            set((state) => {
              const nextPages = { ...state.groupTaskPages };
              delete nextPages[groupId];
              return {
                groups: state.groups.filter((g) => g.id !== groupId),
                tasks: state.tasks.filter((t) => t.groupId !== groupId),
                tags: state.tags.filter((t) => t.groupId !== groupId),
                selectedGroupIds: state.selectedGroupIds.filter((id) => id !== groupId),
                groupTaskPages: nextPages,
                error: resolveErrorMessage(err),
                isLoading: false,
              };
            });
            useTasksStore.setState((tState) => ({
              groups: tState.groups.filter((g) => g.id !== groupId),
              tasks: tState.tasks.filter((t) => t.groupId !== groupId),
              tags: tState.tags.filter((t) => t.groupId !== groupId),
              allTags: tState.allTags.filter((t) => t.groupId !== groupId),
            }));
            throw err;
          }
          throw err;
        }

        set((state) => {
          const nextPages = { ...state.groupTaskPages };
          delete nextPages[groupId];
          return {
            groups: state.groups.filter((g) => g.id !== groupId),
            tasks: state.tasks.filter((t) => t.groupId !== groupId),
            tags: state.tags.filter((t) => t.groupId !== groupId),
            selectedGroupIds: state.selectedGroupIds.filter((id) => id !== groupId),
            groupTaskPages: nextPages,
            isLoading: false,
          };
        });
        useTasksStore.setState((tState) => ({
          groups: tState.groups.filter((g) => g.id !== groupId),
          tasks: tState.tasks.filter((t) => t.groupId !== groupId),
          tags: tState.tags.filter((t) => t.groupId !== groupId),
          allTags: tState.allTags.filter((t) => t.groupId !== groupId),
        }));
        return;
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
      set({ error: resolveErrorMessage(err), isLoading: false });
      throw err;
    }
  },

  setSelectedGroupIds: (ids: string[]) => {
    set({ selectedGroupIds: ids });
    if (isGroupsStoreApiMode()) {
      clearSearchDebounce();
      requestSeq += 1;
      void runFilteredTaskQuery(requestSeq, get, set);
    }
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
    if (isGroupsStoreApiMode()) {
      clearSearchDebounce();
      requestSeq += 1;
      void runFilteredTaskQuery(requestSeq, get, set);
    }
  },

  setSearchQuery: (query: string) => {
    set({ searchQuery: query });
    if (isGroupsStoreApiMode()) {
      clearSearchDebounce();
      const debounceMs = deps.searchDebounceMs ?? 250;
      searchDebounceTimer = setTimeout(() => {
        searchDebounceTimer = null;
        requestSeq += 1;
        void runFilteredTaskQuery(requestSeq, get, set);
      }, debounceMs);
    }
  },

  setActiveFilter: (filter: TaskFilter) => {
    set({ activeFilter: filter });
    if (isGroupsStoreApiMode()) {
      clearSearchDebounce();
      requestSeq += 1;
      void runFilteredTaskQuery(requestSeq, get, set);
    }
  },

  openModal: (type: GroupModalType, group: Group | null = null) => {
    set({ error: null, modalState: { type, group: group ?? null } });
  },

  closeModal: () => {
    set({ modalState: { type: null, group: null } });
  },

  clearError: () => {
    set({ error: null });
  },
}));

async function runFilteredTaskQuery(
  seq: number,
  get: () => GroupsStore,
  set: (
    partial:
      | GroupsStore
      | Partial<GroupsStore>
      | ((state: GroupsStore) => GroupsStore | Partial<GroupsStore>),
  ) => void,
): Promise<void> {
  try {
    const { groups, selectedGroupIds, activeFilter, searchQuery, groupsHasNext } = get();
    const taskData = await fetchVisibleGroupTaskPages(
      groups,
      selectedGroupIds,
      activeFilter,
      searchQuery,
    );
    if (seq !== requestSeq) {
      return;
    }

    const trimmedSearch = searchQuery.trim();
    let globalSearchHasMatches = taskData.tasks.length > 0;
    if (trimmedSearch.length > 0 && taskData.tasks.length === 0 && groupsHasNext) {
      const crossPage = await resolveTasksApi().listTasks({
        groupIds: selectedGroupIds.length > 0 ? selectedGroupIds : undefined,
        status: mapTaskFilterToApiStatus(activeFilter),
        search: trimmedSearch,
        limit: 1,
      });
      if (seq !== requestSeq) {
        return;
      }
      globalSearchHasMatches = crossPage.content.length > 0;
    } else if (trimmedSearch.length === 0) {
      globalSearchHasMatches = false;
    }

    set((prev) => ({
      groups:
        taskData.staleGroupIds.length > 0
          ? prev.groups.filter((g) => !taskData.staleGroupIds.includes(g.id))
          : prev.groups,
      tasks: taskData.tasks,
      tags: mergeEntitiesById(prev.tags, taskData.tags),
      groupTaskPages: taskData.groupTaskPages,
      globalSearchHasMatches,
      error: taskData.errorMessage,
    }));

    useTasksStore.setState((tState) => ({
      allTags: mergeEntitiesById(tState.allTags, taskData.tags),
    }));
  } catch (err) {
    if (seq !== requestSeq || err instanceof UnauthorizedError) {
      return;
    }
    set({ error: resolveErrorMessage(err) });
  }
}

export function resetGroupsStore(): void {
  clearSearchDebounce();
  requestSeq += 1;
  useGroupsStore.setState(initialState);
}

subscribeAuthSessionEnd(() => {
  resetGroupsStore();
});

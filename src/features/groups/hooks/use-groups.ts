import { isGroupsStoreApiMode, useGroupsStore } from '../store';
import { sortGroups } from '../utils/group-sort';
import { filterTasksByCriteria } from '../utils/filter-tasks';

export function useGroups() {
  const store = useGroupsStore();
  const isApiMode = isGroupsStoreApiMode();

  const sortedGroups = sortGroups(store.groups);
  const visibleGroups =
    store.selectedGroupIds.length === 0
      ? sortedGroups
      : sortedGroups.filter((g) => store.selectedGroupIds.includes(g.id));

  const visibleGroupIds = visibleGroups.map((g) => g.id);
  const tasksInVisibleGroups = store.tasks.filter((t) =>
    visibleGroupIds.includes(t.groupId),
  );

  const query = store.searchQuery.trim().toLowerCase();
  const searchMatchedTasks =
    query.length > 0
      ? tasksInVisibleGroups.filter((t) => t.title.toLowerCase().includes(query))
      : tasksInVisibleGroups;

  const counts = isApiMode
    ? {
        pending: store.activeFilter === 'pendientes' ? tasksInVisibleGroups.length : 0,
        completed: store.activeFilter === 'completadas' ? tasksInVisibleGroups.length : 0,
        all: store.activeFilter === 'todas' ? tasksInVisibleGroups.length : 0,
      }
    : {
        pending: searchMatchedTasks.filter((t) => !t.completed).length,
        completed: searchMatchedTasks.filter((t) => t.completed).length,
        all: searchMatchedTasks.length,
      };

  const activeTabHasMore = isApiMode
    ? visibleGroups.some((g) => store.groupTaskPages[g.id]?.hasNext === true)
    : false;

  const getGroupTasks = (groupId: string) => {
    if (isApiMode) {
      return store.tasks.filter((t) => t.groupId === groupId);
    }
    return filterTasksByCriteria(store.tasks, {
      groupId,
      filter: store.activeFilter,
      searchQuery: store.searchQuery,
    });
  };

  return {
    groups: sortedGroups,
    rawGroups: store.groups,
    visibleGroups,
    tasks: store.tasks,
    tags: store.tags,
    selectedGroupIds: store.selectedGroupIds,
    searchQuery: store.searchQuery,
    activeFilter: store.activeFilter,
    modalState: store.modalState,
    isLoading: store.isLoading,
    error: store.error,
    counts,
    isApiMode,
    groupsNextCursor: store.groupsNextCursor,
    groupsHasNext: store.groupsHasNext,
    isLoadingMoreGroups: store.isLoadingMoreGroups,
    groupTaskPages: store.groupTaskPages,
    activeTabHasMore,
    globalSearchHasMatches: store.globalSearchHasMatches,
    getGroupTasks,

    init: store.init,
    createGroup: store.createGroup,
    renameGroup: store.renameGroup,
    deleteGroup: store.deleteGroup,
    refresh: store.refresh,
    loadMoreGroups: store.loadMoreGroups,
    loadMoreGroupTasks: store.loadMoreGroupTasks,
    setSelectedGroupIds: store.setSelectedGroupIds,
    toggleGroupId: store.toggleGroupId,
    setSearchQuery: store.setSearchQuery,
    setActiveFilter: store.setActiveFilter,
    openModal: store.openModal,
    closeModal: store.closeModal,
    clearError: store.clearError,
  };
}

import { useTasksStore } from '../store';
import { sortTasksByFilter } from '../utils/task-sort';

export function useTasks() {
  const store = useTasksStore();

  const sortedTasks = sortTasksByFilter(store.tasks, store.activeFilter);
  const activeGroup =
    store.groups.find((g) => g.id === store.activeGroupId) ?? null;

  const counts = {
    pending: store.tasks.filter((t) => !t.completed).length,
    completed: store.tasks.filter((t) => t.completed).length,
    all: store.tasks.length,
  };

  return {
    tasks: sortedTasks,
    rawTasks: store.tasks,
    groups: store.groups,
    tags: store.tags,
    activeGroupId: store.activeGroupId,
    activeGroup,
    activeFilter: store.activeFilter,
    isLoading: store.isLoading,
    error: store.error,
    modalState: store.modalState,
    counts,

    init: store.init,
    setActiveGroup: store.setActiveGroup,
    setActiveFilter: store.setActiveFilter,
    openModal: store.openModal,
    closeModal: store.closeModal,
    loadGroupTags: store.loadGroupTags,
    getTaskById: store.getTaskById,
    createTask: store.createTask,
    updateTask: store.updateTask,
    deleteTask: store.deleteTask,
    toggleTaskComplete: store.toggleTaskComplete,
    moveTask: store.moveTask,
    copyTask: store.copyTask,
    removeTagFromTask: store.removeTagFromTask,
    deleteTagFromGroup: store.deleteTagFromGroup,
  };
}

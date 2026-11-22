import { useGroupsStore } from '../../groups/store';
import { isTasksStoreApiMode, useTasksStore } from '../store';
import type { Group, Task } from '../../../shared/schemas';

export interface UseTaskMoveCopyOptions {
  task?: Task | null;
  mode?: 'move' | 'copy';
  onSuccess?: () => void;
}

export function useTaskMoveCopy(options: UseTaskMoveCopyOptions = {}) {
  const { task, mode = 'move', onSuccess } = options;
  const tasksStore = useTasksStore();
  const groupsStore = useGroupsStore();
  const isApiMode = isTasksStoreApiMode();

  const availableGroups: Group[] =
    groupsStore.groups.length > 0 ? groupsStore.groups : tasksStore.groups;

  const originGroupId = task?.groupId ?? tasksStore.activeGroupId;
  const includeOriginForCopy = isApiMode && mode === 'copy';
  const targetGroups: Group[] = availableGroups.filter(
    (g) => g.type === 'individual' && (includeOriginForCopy || g.id !== originGroupId),
  );
  const hasOtherGroups = targetGroups.length > 0;

  const moveTask = async (targetGroupId: string) => {
    if (!task) return;
    await tasksStore.moveTask(task.id, targetGroupId);
    onSuccess?.();
  };

  const copyTask = async (targetGroupId: string) => {
    if (!task) return;
    await tasksStore.copyTask(task.id, targetGroupId);
    onSuccess?.();
  };

  return {
    task,
    targetGroups,
    hasOtherGroups,
    groupsHasNext: isApiMode ? groupsStore.groupsHasNext : false,
    isLoadingMoreGroups: isApiMode ? groupsStore.isLoadingMoreGroups : false,
    loadMoreGroups: groupsStore.loadMoreGroups,
    moveTask,
    copyTask,
  };
}

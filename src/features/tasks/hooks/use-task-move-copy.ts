import { useTasksStore } from '../store';
import type { Task, Group } from '../../../shared/schemas';

export interface UseTaskMoveCopyOptions {
  task?: Task | null;
  onSuccess?: () => void;
}

export function useTaskMoveCopy(options: UseTaskMoveCopyOptions = {}) {
  const { task, onSuccess } = options;
  const store = useTasksStore();

  const originGroupId = task?.groupId ?? store.activeGroupId;
  const targetGroups: Group[] = store.groups.filter(
    (g) => g.type === 'individual' && g.id !== originGroupId,
  );
  const hasOtherGroups = targetGroups.length > 0;

  const moveTask = async (targetGroupId: string) => {
    if (!task) return;
    await store.moveTask(task.id, targetGroupId);
    onSuccess?.();
  };

  const copyTask = async (targetGroupId: string) => {
    if (!task) return;
    await store.copyTask(task.id, targetGroupId);
    onSuccess?.();
  };

  return {
    task,
    targetGroups,
    hasOtherGroups,
    moveTask,
    copyTask,
  };
}

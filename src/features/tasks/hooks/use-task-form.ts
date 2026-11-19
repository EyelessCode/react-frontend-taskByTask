import { useEffect, useMemo, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { taskFormSchema, type TaskFormData, type TaskFormInput } from '../schemas/task-form-schema';
import { useTasksStore } from '../store';
import { resolveTaskTags } from '../../tags/utils';
import type { Task } from '../../../shared/schemas';

export interface UseTaskFormOptions {
  task?: Task | null;
  defaultGroupId?: string;
  show?: boolean;
  onSuccess?: () => void;
}

export function useTaskForm(options: UseTaskFormOptions = {}) {
  const { task, defaultGroupId, show = true, onSuccess } = options;
  const store = useTasksStore();
  const targetGroupId = task?.groupId ?? defaultGroupId ?? store.activeGroupId;
  const isEdit = Boolean(task);

  const groupTags = useMemo(
    () =>
      store.allTags.length > 0
        ? store.allTags.filter((t) => t.groupId === targetGroupId)
        : targetGroupId === store.activeGroupId
          ? store.tags
          : [],
    [store.allTags, store.tags, store.activeGroupId, targetGroupId],
  );

  const persistedTagNames = resolveTaskTags(task?.tagIds, groupTags, targetGroupId).map(
    (t) => t.name,
  );

  const form = useForm<TaskFormInput, unknown, TaskFormData>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: {
      title: task?.title ?? '',
      description: task?.description ?? '',
      dueDate: task?.dueDate ?? '',
      dueTime: task?.dueTime ?? '',
      tagNames: persistedTagNames,
      groupId: targetGroupId,
    },
  });

  const lastResetKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!show) {
      lastResetKeyRef.current = null;
      return;
    }

    if (task) {
      const editKey = `edit:${task.id}`;
      if (lastResetKeyRef.current === editKey) {
        return;
      }
      lastResetKeyRef.current = editKey;

      const initialTagNames = resolveTaskTags(task.tagIds, groupTags, task.groupId).map(
        (t) => t.name,
      );

      form.reset({
        title: task.title,
        description: task.description ?? '',
        dueDate: task.dueDate ?? '',
        dueTime: task.dueTime ?? '',
        tagNames: initialTagNames,
        groupId: task.groupId,
      });
      return;
    }

    const createKey = `create:${targetGroupId}`;
    if (lastResetKeyRef.current === createKey) {
      return;
    }
    lastResetKeyRef.current = createKey;

    form.reset({
      title: '',
      description: '',
      dueDate: '',
      dueTime: '',
      tagNames: [],
      groupId: targetGroupId,
    });
  }, [show, task, targetGroupId, groupTags, form]);

  const onSubmit = form.handleSubmit(async (data: TaskFormData) => {
    if (isEdit && task) {
      await store.updateTask(task.id, data);
    } else {
      await store.createTask(data);
    }
    onSuccess?.();
  });

  return {
    form,
    isEdit,
    onSubmit,
    groupTags,
    persistedTagNames,
  };
}

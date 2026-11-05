import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { taskFormSchema, type TaskFormData, type TaskFormInput } from '../schemas/task-form-schema';
import { useTasksStore } from '../store';
import type { Task } from '../../../shared/schemas';

export interface UseTaskFormOptions {
  task?: Task | null;
  defaultGroupId?: string;
  onSuccess?: () => void;
}

export function useTaskForm(options: UseTaskFormOptions = {}) {
  const { task, defaultGroupId, onSuccess } = options;
  const store = useTasksStore();
  const activeGroupId = defaultGroupId ?? store.activeGroupId;
  const isEdit = Boolean(task);

  const initialTagNames: string[] = task?.tagIds
    ? task.tagIds
        .map((tagId) => store.tags.find((t) => t.id === tagId)?.name)
        .filter((name): name is string => Boolean(name))
    : [];

  const form = useForm<TaskFormInput, unknown, TaskFormData>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: {
      title: task?.title ?? '',
      description: task?.description ?? '',
      dueDate: task?.dueDate ?? '',
      dueTime: task?.dueTime ?? '',
      tagNames: initialTagNames,
      groupId: task?.groupId ?? activeGroupId,
    },
  });

  useEffect(() => {
    if (task) {
      const currentTagNames = task.tagIds
        ? task.tagIds
            .map((tagId) => store.tags.find((t) => t.id === tagId)?.name)
            .filter((name): name is string => Boolean(name))
        : [];

      form.reset({
        title: task.title,
        description: task.description ?? '',
        dueDate: task.dueDate ?? '',
        dueTime: task.dueTime ?? '',
        tagNames: currentTagNames,
        groupId: task.groupId,
      });
    } else {
      form.reset({
        title: '',
        description: '',
        dueDate: '',
        dueTime: '',
        tagNames: [],
        groupId: activeGroupId,
      });
    }
  }, [task, activeGroupId, form, store.tags]);

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
    groupTags: store.tags,
  };
}

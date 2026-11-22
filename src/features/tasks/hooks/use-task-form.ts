import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { extractFieldErrorMap } from '../../../data/api';
import {
  ApiProblemError,
  NetworkError,
  UnauthorizedError,
} from '../../../shared/errors';
import { es } from '../../../shared/i18n';
import type { Task } from '../../../shared/schemas';
import { resolveTaskTags } from '../../tags/utils';
import {
  taskFormSchema,
  type TaskFormData,
  type TaskFormInput,
} from '../schemas/task-form-schema';
import { isTasksStoreApiMode, useTasksStore } from '../store';

export interface UseTaskFormOptions {
  task?: Task | null;
  defaultGroupId?: string;
  show?: boolean;
  onSuccess?: () => void;
}

export function useTaskForm(options: UseTaskFormOptions = {}) {
  const { task, defaultGroupId, show = true, onSuccess } = options;
  const store = useTasksStore();
  const isApiMode = isTasksStoreApiMode();
  const targetGroupId = task?.groupId ?? defaultGroupId ?? store.activeGroupId;
  const isEdit = Boolean(task);
  const errorResetKey = show ? (task ? `edit:${task.id}` : `create:${targetGroupId}`) : 'closed';
  const [prevErrorResetKey, setPrevErrorResetKey] = useState(errorResetKey);
  const [apiError, setApiError] = useState<string | null>(null);
  if (errorResetKey !== prevErrorResetKey) {
    setPrevErrorResetKey(errorResetKey);
    setApiError(null);
  }

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

  const { loadGroupTags } = store;
  useEffect(() => {
    if (show && isApiMode && targetGroupId) {
      void loadGroupTags(targetGroupId);
    }
  }, [show, isApiMode, targetGroupId, loadGroupTags]);

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
    setApiError(null);
    try {
      if (isEdit && task) {
        await store.updateTask(task.id, data);
      } else {
        await store.createTask(data);
      }
      onSuccess?.();
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        return;
      }
      if (error instanceof ApiProblemError) {
        const fieldErrors = extractFieldErrorMap(error);
        const fieldMap: Array<[string, keyof TaskFormInput]> = [
          ['title', 'title'],
          ['description', 'description'],
          ['dueDate', 'dueDate'],
          ['dueTime', 'dueTime'],
          ['tags', 'tagNames'],
          ['tagNames', 'tagNames'],
          ['groupId', 'groupId'],
        ];
        for (const [apiKey, formKey] of fieldMap) {
          const message = fieldErrors[apiKey];
          if (message) {
            form.setError(formKey, { type: 'server', message });
          }
        }
        setApiError(error.detail?.trim() || error.message);
        return;
      }
      if (error instanceof NetworkError || error instanceof Error) {
        setApiError(error.message);
        return;
      }
      setApiError(es.errors.unexpected);
    }
  });

  return {
    form,
    isEdit,
    onSubmit,
    groupTags,
    persistedTagNames,
    apiError,
    clearApiError: () => setApiError(null),
  };
}

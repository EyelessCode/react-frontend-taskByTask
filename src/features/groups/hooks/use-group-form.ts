import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { extractFieldErrorMap } from '../../../data/api';
import {
  ApiProblemError,
  NetworkError,
  UnauthorizedError,
} from '../../../shared/errors';
import { es } from '../../../shared/i18n';
import type { Group } from '../../../shared/schemas';
import {
  groupFormSchema,
  type GroupFormInput,
} from '../schemas/group-form-schema';
import { useGroupsStore } from '../store';

export interface UseGroupFormOptions {
  group?: Group | null;
  onSuccess?: () => void;
}

export function useGroupForm(options: UseGroupFormOptions = {}) {
  const { group, onSuccess } = options;
  const store = useGroupsStore();
  const isEdit = Boolean(group);
  const groupKey = group?.id ?? 'new';
  const [prevGroupKey, setPrevGroupKey] = useState(groupKey);
  const [apiError, setApiError] = useState<string | null>(null);
  if (groupKey !== prevGroupKey) {
    setPrevGroupKey(groupKey);
    setApiError(null);
  }

  const form = useForm<GroupFormInput>({
    resolver: zodResolver(groupFormSchema),
    defaultValues: {
      name: group?.name ?? '',
    },
  });

  useEffect(() => {
    if (group) {
      form.reset({ name: group.name });
    } else {
      form.reset({ name: '' });
    }
  }, [group, form]);

  const onSubmit = form.handleSubmit(async (data: GroupFormInput) => {
    setApiError(null);
    try {
      if (isEdit && group) {
        await store.renameGroup(group.id, data.name);
      } else {
        await store.createGroup(data.name);
      }
      onSuccess?.();
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        return;
      }
      if (error instanceof ApiProblemError) {
        const fieldErrors = extractFieldErrorMap(error);
        if (fieldErrors.name) {
          form.setError('name', { type: 'server', message: fieldErrors.name });
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
    apiError,
    clearApiError: () => setApiError(null),
  };
}

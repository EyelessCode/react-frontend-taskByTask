import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  groupFormSchema,
  type GroupFormInput,
} from '../schemas/group-form-schema';
import { useGroupsStore } from '../store';
import type { Group } from '../../../shared/schemas';

export interface UseGroupFormOptions {
  group?: Group | null;
  onSuccess?: () => void;
}

export function useGroupForm(options: UseGroupFormOptions = {}) {
  const { group, onSuccess } = options;
  const store = useGroupsStore();
  const isEdit = Boolean(group);

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
    if (isEdit && group) {
      await store.renameGroup(group.id, data.name);
    } else {
      await store.createGroup(data.name);
    }
    onSuccess?.();
  });

  return {
    form,
    isEdit,
    onSubmit,
  };
}

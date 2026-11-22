import { LIMITS } from '../../shared/schemas';
import type {
  ApiTaskWithTags,
  CreateTaskApiInput,
  KeysetPage,
  ListGroupTasksQuery,
  ListTasksQuery,
  TasksApiRepository,
  UpdateTaskPatchApiInput,
} from '../contracts';
import { mapTaskWithTagsFromDto, parseNumericId } from './dto-mappers';
import {
  keysetPageTaskResponseDtoSchema,
  taskResponseDtoSchema,
} from './dto-schemas';
import type { ApiHttpClient } from './http-client';

export class HttpTasksApiRepository implements TasksApiRepository {
  private readonly httpClient: ApiHttpClient;

  constructor(httpClient: ApiHttpClient) {
    this.httpClient = httpClient;
  }

  async listTasks(query?: ListTasksQuery): Promise<KeysetPage<ApiTaskWithTags>> {
    const numericGroupIds =
      query?.groupIds && query.groupIds.length > 0
        ? query.groupIds.map((id) => parseNumericId(id, 'Grupo'))
        : undefined;
    const trimmedSearch = query?.search?.trim();

    const page = await this.httpClient.requestJson({
      method: 'GET',
      path: '/api/v1/tasks',
      query: {
        groupIds: numericGroupIds,
        status: query?.status,
        search: trimmedSearch || undefined,
        cursor: query?.cursor ?? undefined,
        limit: query?.limit ?? LIMITS.KEYSET_PAGE_LIMIT_DEFAULT,
      },
      responseSchema: keysetPageTaskResponseDtoSchema,
    });

    return {
      content: page.content.map(mapTaskWithTagsFromDto),
      nextCursor: page.nextCursor,
      hasNext: page.hasNext,
      size: page.size,
    };
  }

  async listGroupTasks(
    groupId: string,
    query?: ListGroupTasksQuery,
  ): Promise<KeysetPage<ApiTaskWithTags>> {
    const numericGroupId = parseNumericId(groupId, 'Grupo');
    const trimmedSearch = query?.search?.trim();

    const page = await this.httpClient.requestJson({
      method: 'GET',
      path: `/api/v1/groups/${numericGroupId}/tasks`,
      query: {
        status: query?.status,
        search: trimmedSearch || undefined,
        cursor: query?.cursor ?? undefined,
        limit: query?.limit ?? LIMITS.KEYSET_PAGE_LIMIT_DEFAULT,
      },
      responseSchema: keysetPageTaskResponseDtoSchema,
    });

    return {
      content: page.content.map(mapTaskWithTagsFromDto),
      nextCursor: page.nextCursor,
      hasNext: page.hasNext,
      size: page.size,
    };
  }

  async getTask(taskId: string): Promise<ApiTaskWithTags> {
    const numericTaskId = parseNumericId(taskId, 'Tarea');
    const dto = await this.httpClient.requestJson({
      method: 'GET',
      path: `/api/v1/tasks/${numericTaskId}`,
      responseSchema: taskResponseDtoSchema,
    });
    return mapTaskWithTagsFromDto(dto);
  }

  async createTask(
    groupId: string,
    input: CreateTaskApiInput,
  ): Promise<ApiTaskWithTags> {
    const numericGroupId = parseNumericId(groupId, 'Grupo');
    const dto = await this.httpClient.requestJson({
      method: 'POST',
      path: `/api/v1/groups/${numericGroupId}/tasks`,
      body: {
        title: input.title,
        description: input.description ?? null,
        dueDate: input.dueDate ?? null,
        dueTime: input.dueTime ?? null,
        tags: input.tags ?? null,
      },
      responseSchema: taskResponseDtoSchema,
    });
    return mapTaskWithTagsFromDto(dto);
  }

  async updateTask(
    taskId: string,
    patch: UpdateTaskPatchApiInput,
  ): Promise<ApiTaskWithTags> {
    const numericTaskId = parseNumericId(taskId, 'Tarea');
    const body: Record<string, unknown> = {};
    if (patch.title !== undefined) {
      body.title = patch.title;
    }
    if (patch.description !== undefined) {
      body.description = patch.description;
    }
    if (patch.dueDate !== undefined) {
      body.dueDate = patch.dueDate;
    }
    if (patch.dueTime !== undefined) {
      body.dueTime = patch.dueTime;
    }
    if (patch.tags !== undefined) {
      body.tags = patch.tags;
    }

    const dto = await this.httpClient.requestJson({
      method: 'PATCH',
      path: `/api/v1/tasks/${numericTaskId}`,
      body,
      responseSchema: taskResponseDtoSchema,
    });
    return mapTaskWithTagsFromDto(dto);
  }

  async deleteTask(taskId: string): Promise<void> {
    const numericTaskId = parseNumericId(taskId, 'Tarea');
    await this.httpClient.requestVoid({
      method: 'DELETE',
      path: `/api/v1/tasks/${numericTaskId}`,
    });
  }

  async updateCompletion(
    taskId: string,
    completed: boolean,
  ): Promise<ApiTaskWithTags> {
    const numericTaskId = parseNumericId(taskId, 'Tarea');
    const dto = await this.httpClient.requestJson({
      method: 'PATCH',
      path: `/api/v1/tasks/${numericTaskId}/completion`,
      body: { completed },
      responseSchema: taskResponseDtoSchema,
    });
    return mapTaskWithTagsFromDto(dto);
  }

  async moveTask(
    taskId: string,
    targetGroupId: string,
  ): Promise<ApiTaskWithTags> {
    const numericTaskId = parseNumericId(taskId, 'Tarea');
    const numericTargetGroupId = parseNumericId(targetGroupId, 'Grupo');
    const dto = await this.httpClient.requestJson({
      method: 'POST',
      path: `/api/v1/tasks/${numericTaskId}/move`,
      body: { targetGroupId: numericTargetGroupId },
      responseSchema: taskResponseDtoSchema,
    });
    return mapTaskWithTagsFromDto(dto);
  }

  async copyTask(
    taskId: string,
    targetGroupId: string,
  ): Promise<ApiTaskWithTags> {
    const numericTaskId = parseNumericId(taskId, 'Tarea');
    const numericTargetGroupId = parseNumericId(targetGroupId, 'Grupo');
    const dto = await this.httpClient.requestJson({
      method: 'POST',
      path: `/api/v1/tasks/${numericTaskId}/copy`,
      body: { targetGroupId: numericTargetGroupId },
      responseSchema: taskResponseDtoSchema,
    });
    return mapTaskWithTagsFromDto(dto);
  }

  async detachTagFromTask(taskId: string, tagId: string): Promise<void> {
    const numericTaskId = parseNumericId(taskId, 'Tarea');
    const numericTagId = parseNumericId(tagId, 'Etiqueta');
    await this.httpClient.requestVoid({
      method: 'DELETE',
      path: `/api/v1/tasks/${numericTaskId}/tags/${numericTagId}`,
    });
  }
}

import { ValidationError } from '../../shared/errors';
import { es } from '../../shared/i18n';
import type { Group, Notification, Tag, Task, User } from '../../shared/schemas';
import type { ApiTaskStatus, ApiTaskWithTags } from '../contracts';
import type {
  GroupResponseDto,
  NotificationResponseDto,
  TagResponseDto,
  TaskResponseDto,
  UserResponseDto,
} from './dto-schemas';

export type FrontendTaskFilter = 'pendientes' | 'completadas' | 'todas';

/**
 * Validates and converts a string entity ID into a positive safe integer for backend endpoints.
 */
export function parseNumericId(id: string, entityLabel = 'recurso'): number {
  const trimmed = id.trim();
  if (!/^\d+$/.test(trimmed)) {
    throw new ValidationError(es.errors.notFound(entityLabel), [
      { path: 'id', message: es.errors.notFound(entityLabel) },
    ]);
  }

  const numeric = Number(trimmed);
  if (!Number.isSafeInteger(numeric) || numeric <= 0) {
    throw new ValidationError(es.errors.notFound(entityLabel), [
      { path: 'id', message: es.errors.notFound(entityLabel) },
    ]);
  }

  return numeric;
}

export function normalizeBackendDueTime(dueTime?: string | null): string | null {
  if (!dueTime) {
    return null;
  }
  const trimmed = dueTime.trim();
  if (!trimmed) {
    return null;
  }
  return trimmed.slice(0, 5);
}

export function mapTimeFormatFromDto(timeFormat: '24H' | '12H'): '24h' | '12h' {
  return timeFormat === '12H' ? '12h' : '24h';
}

export function mapTimeFormatToDto(timeFormat: '24h' | '12h'): '24H' | '12H' {
  return timeFormat === '12h' ? '12H' : '24H';
}

export function mapTaskFilterToApiStatus(filter: FrontendTaskFilter): ApiTaskStatus {
  if (filter === 'completadas') {
    return 'COMPLETED';
  }
  if (filter === 'todas') {
    return 'ALL';
  }
  return 'PENDING';
}

export function mapUserFromDto(dto: UserResponseDto): User {
  const user: User = {
    id: String(dto.id),
    email: dto.email,
    username: dto.username,
    displayName: dto.displayName,
    timeZone: dto.timezone,
    timeFormat: mapTimeFormatFromDto(dto.timeFormat),
    createdAt: dto.createdAt,
  };

  if (dto.remainingRecoveryCodes !== undefined) {
    user.remainingRecoveryCodes = dto.remainingRecoveryCodes;
  }

  return user;
}

export function mapGroupFromDto(dto: GroupResponseDto): Group {
  const creatorId = String(dto.creatorId);
  return {
    id: String(dto.id),
    name: dto.name,
    creatorId,
    isPersonal: dto.isPersonal,
    type: 'individual',
    members: [
      {
        userId: creatorId,
        role: 'creator',
        joinedAt: dto.createdAt,
      },
    ],
    createdAt: dto.createdAt,
  };
}

export function mapTagFromDto(dto: TagResponseDto): Tag {
  return {
    id: String(dto.id),
    groupId: String(dto.groupId),
    name: dto.name,
  };
}

export function mapTaskFromDto(dto: TaskResponseDto): Task {
  return {
    id: String(dto.id),
    groupId: String(dto.groupId),
    assigneeId:
      dto.assignedUserId !== undefined && dto.assignedUserId !== null
        ? String(dto.assignedUserId)
        : null,
    title: dto.title,
    description: dto.description ?? null,
    completed: dto.completed,
    completedAt: dto.completedAt ?? null,
    overdue: dto.overdue,
    dueDate: dto.dueDate ?? null,
    dueTime: normalizeBackendDueTime(dto.dueTime),
    tagIds: dto.tags.map((tag) => String(tag.id)),
    createdAt: dto.createdAt,
  };
}

export function mapTaskWithTagsFromDto(dto: TaskResponseDto): ApiTaskWithTags {
  return {
    task: mapTaskFromDto(dto),
    tags: dto.tags.map(mapTagFromDto),
  };
}

export function mapNotificationFromDto(
  dto: NotificationResponseDto,
  userId: string,
): Notification {
  return {
    id: String(dto.id),
    userId,
    eventType: dto.eventType,
    content: dto.content,
    read: dto.read,
    createdAt: dto.createdAt,
  };
}

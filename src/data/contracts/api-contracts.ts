import type { Group, Notification, Tag, Task, User } from '../../shared/schemas';

export interface KeysetPage<T> {
  content: T[];
  nextCursor: string | null;
  hasNext: boolean;
  size: number;
}

export interface KeysetPageQuery {
  cursor?: string | null;
  limit?: number;
}

export type ApiTaskStatus = 'PENDING' | 'COMPLETED' | 'ALL';

export interface ApiTaskWithTags {
  task: Task;
  tags: Tag[];
}

export interface RegisterApiInput {
  email: string;
  username: string;
  displayName: string;
  password: string;
  timezone?: string | null;
}

export interface RegisterApiResult {
  user: User;
  recoveryCodes: string[];
  recoveryCodesNotice: string;
}

export interface LoginApiInput {
  email: string;
  password: string;
  timezone?: string | null;
}

export interface RecoverPasswordApiInput {
  email: string;
  recoveryCode: string;
  newPassword: string;
}

export interface UpdateProfileApiInput {
  displayName?: string | null;
  username?: string | null;
  email?: string | null;
  timezone?: string | null;
  timeFormat?: '24h' | '12h' | null;
}

export interface ChangePasswordApiInput {
  currentPassword: string;
  newPassword: string;
}

export interface RegenerateRecoveryCodesApiInput {
  currentPassword: string;
}

export interface RecoveryCodesApiResult {
  recoveryCodes: string[];
  recoveryCodesNotice: string;
}

export interface DeleteAccountApiInput {
  password: string;
}

export interface AuthApiClient {
  getMe(authContext?: 'session-probe' | 'authenticated'): Promise<User>;
  register(input: RegisterApiInput): Promise<RegisterApiResult>;
  login(input: LoginApiInput): Promise<User>;
  logout(endpoint?: string | null): Promise<void>;
  recoverPassword(input: RecoverPasswordApiInput): Promise<string>;
  updateProfile(input: UpdateProfileApiInput): Promise<User>;
  changePassword(input: ChangePasswordApiInput): Promise<string>;
  regenerateRecoveryCodes(
    input: RegenerateRecoveryCodesApiInput,
  ): Promise<RecoveryCodesApiResult>;
  deleteAccount(input: DeleteAccountApiInput): Promise<void>;
  invalidateCsrf(): void;
}

export interface GroupsApiRepository {
  listGroups(options?: KeysetPageQuery): Promise<KeysetPage<Group>>;
  getGroup(groupId: string): Promise<Group>;
  createGroup(name: string): Promise<Group>;
  renameGroup(groupId: string, name: string): Promise<Group>;
  deleteGroup(groupId: string): Promise<void>;
}

export interface ListTasksQuery extends KeysetPageQuery {
  groupIds?: string[];
  status?: ApiTaskStatus;
  search?: string;
}

export interface ListGroupTasksQuery extends KeysetPageQuery {
  status?: ApiTaskStatus;
  search?: string;
}

export interface CreateTaskApiInput {
  title: string;
  description?: string | null;
  dueDate?: string | null;
  dueTime?: string | null;
  tags?: string[] | null;
}

export interface UpdateTaskPatchApiInput {
  title?: string;
  description?: string | null;
  dueDate?: string | null;
  dueTime?: string | null;
  tags?: string[] | null;
}

export interface TasksApiRepository {
  listTasks(query?: ListTasksQuery): Promise<KeysetPage<ApiTaskWithTags>>;
  listGroupTasks(
    groupId: string,
    query?: ListGroupTasksQuery,
  ): Promise<KeysetPage<ApiTaskWithTags>>;
  getTask(taskId: string): Promise<ApiTaskWithTags>;
  createTask(groupId: string, input: CreateTaskApiInput): Promise<ApiTaskWithTags>;
  updateTask(taskId: string, patch: UpdateTaskPatchApiInput): Promise<ApiTaskWithTags>;
  deleteTask(taskId: string): Promise<void>;
  updateCompletion(taskId: string, completed: boolean): Promise<ApiTaskWithTags>;
  moveTask(taskId: string, targetGroupId: string): Promise<ApiTaskWithTags>;
  copyTask(taskId: string, targetGroupId: string): Promise<ApiTaskWithTags>;
  detachTagFromTask(taskId: string, tagId: string): Promise<void>;
}

export interface ListGroupTagsQuery extends KeysetPageQuery {
  query?: string;
}

export interface TagsApiRepository {
  listGroupTags(groupId: string, query?: ListGroupTagsQuery): Promise<KeysetPage<Tag>>;
  createOrReuseTag(groupId: string, name: string): Promise<Tag>;
  deleteGroupTag(groupId: string, tagId: string): Promise<void>;
}

export interface ListNotificationsQuery extends KeysetPageQuery {
  unreadOnly?: boolean;
}

export interface VapidPublicKeyResult {
  enabled: boolean;
  publicKey: string | null;
}

export interface RegisterPushSubscriptionApiInput {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface PushSubscriptionResult {
  id: string;
  endpoint: string;
  createdAt: string;
}

export interface NotificationsApiRepository {
  listNotifications(
    userId: string,
    query?: ListNotificationsQuery,
  ): Promise<KeysetPage<Notification>>;
  getUnreadCount(): Promise<number>;
  markAsRead(notificationId: string, userId: string): Promise<Notification>;
  markAllAsRead(): Promise<number>;
  deleteNotification(notificationId: string): Promise<void>;
  getVapidPublicKey(): Promise<VapidPublicKeyResult>;
  registerPushSubscription(
    input: RegisterPushSubscriptionApiInput,
  ): Promise<PushSubscriptionResult>;
  deletePushSubscriptionByEndpoint(endpoint: string): Promise<void>;
  deletePushSubscriptionById(subscriptionId: string): Promise<void>;
}

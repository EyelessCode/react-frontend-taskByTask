import { getPersistenceConfig } from '../../shared/config';
import type {
  AuthApiClient,
  GroupsApiRepository,
  NotificationsApiRepository,
  TagsApiRepository,
  TasksApiRepository,
} from '../contracts';
import { HttpAuthApiClient } from './auth-api-client';
import { HttpGroupsApiRepository } from './groups-api-repository';
import { ApiHttpClient, type ApiHttpClientOptions } from './http-client';
import { HttpNotificationsApiRepository } from './notifications-api-repository';
import { HttpTagsApiRepository } from './tags-api-repository';
import { HttpTasksApiRepository } from './tasks-api-repository';

export interface ApiServices {
  httpClient: ApiHttpClient;
  authApi: AuthApiClient;
  groupsApi: GroupsApiRepository;
  tasksApi: TasksApiRepository;
  tagsApi: TagsApiRepository;
  notificationsApi: NotificationsApiRepository;
}

export type UnauthorizedSessionHandler = (() => Promise<void> | void) | null;

let cachedServices: ApiServices | null = null;
let testServicesOverride: ApiServices | null = null;
let registeredUnauthorizedHandler: UnauthorizedSessionHandler = null;

export function registerUnauthorizedHandler(handler: UnauthorizedSessionHandler): void {
  registeredUnauthorizedHandler = handler;
}

export function createApiServices(options: ApiHttpClientOptions = {}): ApiServices {
  const baseUrl = options.baseUrl ?? getPersistenceConfig().apiBaseUrl;
  const httpClient = new ApiHttpClient({
    baseUrl,
    fetchFn: options.fetchFn,
    onUnauthorizedSessionExpired:
      options.onUnauthorizedSessionExpired ??
      (async () => {
        await registeredUnauthorizedHandler?.();
      }),
  });

  return {
    httpClient,
    authApi: new HttpAuthApiClient(httpClient),
    groupsApi: new HttpGroupsApiRepository(httpClient),
    tasksApi: new HttpTasksApiRepository(httpClient),
    tagsApi: new HttpTagsApiRepository(httpClient),
    notificationsApi: new HttpNotificationsApiRepository(httpClient),
  };
}

export function getApiServices(): ApiServices {
  if (testServicesOverride !== null) {
    return testServicesOverride;
  }
  if (cachedServices === null) {
    cachedServices = createApiServices();
  }
  return cachedServices;
}

export function configureApiServicesForTests(
  overrides: Partial<ApiServices>,
): ApiServices {
  const base = createApiServices();
  testServicesOverride = {
    ...base,
    ...overrides,
  };
  return testServicesOverride;
}

export function resetApiServicesForTests(): void {
  cachedServices = null;
  testServicesOverride = null;
}

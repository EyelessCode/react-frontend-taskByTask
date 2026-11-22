import { LIMITS, type Group } from '../../shared/schemas';
import type {
  GroupsApiRepository,
  KeysetPage,
  KeysetPageQuery,
} from '../contracts';
import { mapGroupFromDto, parseNumericId } from './dto-mappers';
import {
  groupResponseDtoSchema,
  keysetPageGroupResponseDtoSchema,
} from './dto-schemas';
import type { ApiHttpClient } from './http-client';

export class HttpGroupsApiRepository implements GroupsApiRepository {
  private readonly httpClient: ApiHttpClient;

  constructor(httpClient: ApiHttpClient) {
    this.httpClient = httpClient;
  }

  async listGroups(options?: KeysetPageQuery): Promise<KeysetPage<Group>> {
    const page = await this.httpClient.requestJson({
      method: 'GET',
      path: '/api/v1/groups',
      query: {
        cursor: options?.cursor ?? undefined,
        limit: options?.limit ?? LIMITS.KEYSET_PAGE_LIMIT_DEFAULT,
      },
      responseSchema: keysetPageGroupResponseDtoSchema,
    });

    return {
      content: page.content.map(mapGroupFromDto),
      nextCursor: page.nextCursor,
      hasNext: page.hasNext,
      size: page.size,
    };
  }

  async getGroup(groupId: string): Promise<Group> {
    const numericId = parseNumericId(groupId, 'Grupo');
    const dto = await this.httpClient.requestJson({
      method: 'GET',
      path: `/api/v1/groups/${numericId}`,
      responseSchema: groupResponseDtoSchema,
    });
    return mapGroupFromDto(dto);
  }

  async createGroup(name: string): Promise<Group> {
    const dto = await this.httpClient.requestJson({
      method: 'POST',
      path: '/api/v1/groups',
      body: { name },
      responseSchema: groupResponseDtoSchema,
    });
    return mapGroupFromDto(dto);
  }

  async renameGroup(groupId: string, name: string): Promise<Group> {
    const numericId = parseNumericId(groupId, 'Grupo');
    const dto = await this.httpClient.requestJson({
      method: 'PATCH',
      path: `/api/v1/groups/${numericId}`,
      body: { name },
      responseSchema: groupResponseDtoSchema,
    });
    return mapGroupFromDto(dto);
  }

  async deleteGroup(groupId: string): Promise<void> {
    const numericId = parseNumericId(groupId, 'Grupo');
    await this.httpClient.requestVoid({
      method: 'DELETE',
      path: `/api/v1/groups/${numericId}`,
    });
  }
}

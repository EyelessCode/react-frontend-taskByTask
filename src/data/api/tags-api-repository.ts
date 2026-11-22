import { LIMITS, type Tag } from '../../shared/schemas';
import type {
  KeysetPage,
  ListGroupTagsQuery,
  TagsApiRepository,
} from '../contracts';
import { mapTagFromDto, parseNumericId } from './dto-mappers';
import {
  keysetPageTagResponseDtoSchema,
  tagResponseDtoSchema,
} from './dto-schemas';
import type { ApiHttpClient } from './http-client';

export class HttpTagsApiRepository implements TagsApiRepository {
  private readonly httpClient: ApiHttpClient;

  constructor(httpClient: ApiHttpClient) {
    this.httpClient = httpClient;
  }

  async listGroupTags(
    groupId: string,
    query?: ListGroupTagsQuery,
  ): Promise<KeysetPage<Tag>> {
    const numericGroupId = parseNumericId(groupId, 'Grupo');
    const trimmedQuery = query?.query?.trim();

    const page = await this.httpClient.requestJson({
      method: 'GET',
      path: `/api/v1/groups/${numericGroupId}/tags`,
      query: {
        query: trimmedQuery || undefined,
        cursor: query?.cursor ?? undefined,
        limit: query?.limit ?? LIMITS.KEYSET_PAGE_LIMIT_DEFAULT,
      },
      responseSchema: keysetPageTagResponseDtoSchema,
    });

    return {
      content: page.content.map(mapTagFromDto),
      nextCursor: page.nextCursor,
      hasNext: page.hasNext,
      size: page.size,
    };
  }

  async createOrReuseTag(groupId: string, name: string): Promise<Tag> {
    const numericGroupId = parseNumericId(groupId, 'Grupo');
    const dto = await this.httpClient.requestJson({
      method: 'POST',
      path: `/api/v1/groups/${numericGroupId}/tags`,
      body: { name },
      responseSchema: tagResponseDtoSchema,
    });
    return mapTagFromDto(dto);
  }

  async deleteGroupTag(groupId: string, tagId: string): Promise<void> {
    const numericGroupId = parseNumericId(groupId, 'Grupo');
    const numericTagId = parseNumericId(tagId, 'Etiqueta');
    await this.httpClient.requestVoid({
      method: 'DELETE',
      path: `/api/v1/groups/${numericGroupId}/tags/${numericTagId}`,
    });
  }
}

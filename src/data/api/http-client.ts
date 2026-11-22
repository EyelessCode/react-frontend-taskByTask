import { z } from 'zod';
import {
  ApiProblemError,
  NetworkError,
  RateLimitError,
  UnauthorizedError,
} from '../../shared/errors';
import { es } from '../../shared/i18n';
import {
  formatRateLimitMessage,
  parseProblemDetailResponse,
  resolveProblemMessage,
} from './problem-detail';

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

export type AuthRequestContext =
  | 'session-probe'
  | 'login'
  | 'authenticated'
  | 'logout'
  | 'public';

export type RateLimitContext = 'login' | 'generic';

export type QueryParamPrimitive = string | number | boolean;
export type QueryParamValue =
  | QueryParamPrimitive
  | null
  | undefined
  | readonly QueryParamPrimitive[];
export type QueryParams = Record<string, QueryParamValue>;

export interface ApiRequestOptions<T> {
  method: HttpMethod;
  path: string;
  query?: QueryParams;
  body?: unknown;
  responseSchema?: z.ZodType<T>;
  authContext?: AuthRequestContext;
  rateLimitContext?: RateLimitContext;
  allowEmpty?: boolean;
}

export interface ApiHttpClientOptions {
  baseUrl?: string;
  fetchFn?: typeof fetch;
  onUnauthorizedSessionExpired?: () => Promise<void> | void;
}

interface CachedCsrfToken {
  token: string;
  headerName: string;
}

const csrfTokenDtoSchema = z.object({
  token: z.string().min(1),
  headerName: z.string().min(1).optional(),
  parameterName: z.string().min(1).optional(),
});

const DEFAULT_CSRF_HEADER = 'X-XSRF-TOKEN';
const CSRF_ENDPOINT = '/api/v1/auth/csrf';

/**
 * Serializes query parameters using repeated keys for array values (e.g. groupIds=1&groupIds=2).
 */
export function serializeQueryParams(query?: QueryParams): string {
  if (!query) {
    return '';
  }

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) {
      continue;
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        params.append(key, String(item));
      }
    } else {
      params.append(key, String(value));
    }
  }

  const serialized = params.toString();
  return serialized ? `?${serialized}` : '';
}

/**
 * Native credentialed HTTP client with single-flight CSRF bootstrap, single 403 retry,
 * context-aware 401 handling, RFC 7807 error parsing, and runtime Zod validation.
 */
export class ApiHttpClient {
  private readonly baseUrl: string;
  private readonly fetchFn?: typeof fetch;
  private onUnauthorizedSessionExpired?: () => Promise<void> | void;
  private cachedCsrf: CachedCsrfToken | null = null;
  private csrfInFlight: Promise<CachedCsrfToken> | null = null;
  private csrfGeneration = 0;

  constructor(options: ApiHttpClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? '').trim().replace(/\/+$/, '');
    this.fetchFn = options.fetchFn;
    this.onUnauthorizedSessionExpired = options.onUnauthorizedSessionExpired;
  }

  setOnUnauthorizedSessionExpired(handler?: () => Promise<void> | void): void {
    this.onUnauthorizedSessionExpired = handler;
  }

  invalidateCsrfToken(): void {
    this.csrfGeneration += 1;
    this.cachedCsrf = null;
    this.csrfInFlight = null;
  }

  async ensureCsrfToken(): Promise<CachedCsrfToken> {
    if (this.cachedCsrf !== null) {
      return this.cachedCsrf;
    }

    if (this.csrfInFlight !== null) {
      return this.csrfInFlight;
    }

    const fetchImpl = this.resolveFetch();
    const generation = this.csrfGeneration;
    this.csrfInFlight = (async (): Promise<CachedCsrfToken> => {
      let response: Response;
      try {
        response = await fetchImpl(this.buildUrl(CSRF_ENDPOINT), {
          method: 'GET',
          credentials: 'include',
          headers: {
            Accept: 'application/json, application/problem+json',
          },
        });
      } catch (error) {
        throw new NetworkError(es.errors.networkError, { cause: error });
      }

      const rawText = await response.text();
      const contentType = response.headers.get('content-type');

      if (!response.ok) {
        const problem = parseProblemDetailResponse(response.status, contentType, rawText);
        if (response.status === 429) {
          throw new RateLimitError(
            formatRateLimitMessage(problem?.retryAfterSeconds, problem?.detail, 'generic'),
            problem?.retryAfterSeconds,
            problem?.detail,
          );
        }
        throw new ApiProblemError(
          resolveProblemMessage(response.status, problem),
          problem ?? { status: response.status },
        );
      }

      const parsedJson = this.parseJsonOrThrow(rawText, response.status);
      const validated = csrfTokenDtoSchema.safeParse(parsedJson);
      if (!validated.success) {
        throw new ApiProblemError(es.errors.invalidResponse, {
          status: response.status,
          detail: es.errors.invalidResponse,
        });
      }

      const resolved: CachedCsrfToken = {
        token: validated.data.token,
        headerName: validated.data.headerName ?? DEFAULT_CSRF_HEADER,
      };
      if (this.csrfGeneration === generation) {
        this.cachedCsrf = resolved;
      }
      return resolved;
    })().finally(() => {
      if (this.csrfGeneration === generation) {
        this.csrfInFlight = null;
      }
    });

    return this.csrfInFlight;
  }

  async requestJson<T>(options: ApiRequestOptions<T>): Promise<T> {
    return this.executeRequest(options, 0);
  }

  async requestVoid(
    options: Omit<ApiRequestOptions<void>, 'responseSchema' | 'allowEmpty'>,
  ): Promise<void> {
    await this.executeRequest<void>({ ...options, allowEmpty: true }, 0);
  }

  private resolveFetch(): typeof fetch {
    return this.fetchFn ?? globalThis.fetch;
  }

  private buildUrl(path: string, query?: QueryParams): string {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return `${this.baseUrl}${normalizedPath}${serializeQueryParams(query)}`;
  }

  private parseJsonOrThrow(rawText: string, status: number): unknown {
    if (!rawText.trim()) {
      throw new ApiProblemError(es.errors.invalidResponse, {
        status,
        detail: es.errors.invalidResponse,
      });
    }

    try {
      return JSON.parse(rawText) as unknown;
    } catch (error) {
      throw new ApiProblemError(
        es.errors.invalidResponse,
        { status, detail: es.errors.invalidResponse },
        { cause: error },
      );
    }
  }

  private async executeRequest<T>(
    options: ApiRequestOptions<T>,
    attempt: number,
  ): Promise<T> {
    const isMutation = options.method !== 'GET';
    const headers: Record<string, string> = {
      Accept: 'application/json, application/problem+json',
    };

    if (options.body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    if (isMutation) {
      const csrf = await this.ensureCsrfToken();
      headers[csrf.headerName] = csrf.token;
    }

    const fetchImpl = this.resolveFetch();
    const url = this.buildUrl(options.path, options.query);

    let response: Response;
    try {
      response = await fetchImpl(url, {
        method: options.method,
        credentials: 'include',
        headers,
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      });
    } catch (error) {
      throw new NetworkError(es.errors.networkError, { cause: error });
    }

    if (response.status === 403 && isMutation && attempt === 0) {
      this.invalidateCsrfToken();
      return this.executeRequest(options, 1);
    }

    const rawText = await response.text();
    const contentType = response.headers.get('content-type');

    if (response.status === 401) {
      const problem = parseProblemDetailResponse(response.status, contentType, rawText);
      const authContext = options.authContext ?? 'authenticated';
      if (authContext === 'authenticated') {
        this.invalidateCsrfToken();
        await this.onUnauthorizedSessionExpired?.();
      }
      const fallbackMessage =
        authContext === 'authenticated'
          ? es.auth.sessionExpired
          : es.auth.invalidCredentials;
      throw new UnauthorizedError(
        problem?.detail?.trim() || fallbackMessage,
        problem ?? undefined,
      );
    }

    if (!response.ok) {
      const problem = parseProblemDetailResponse(response.status, contentType, rawText);
      if (response.status === 429) {
        throw new RateLimitError(
          formatRateLimitMessage(
            problem?.retryAfterSeconds,
            problem?.detail,
            options.rateLimitContext ?? 'generic',
          ),
          problem?.retryAfterSeconds,
          problem?.detail,
        );
      }

      throw new ApiProblemError(
        resolveProblemMessage(response.status, problem),
        problem ?? { status: response.status },
      );
    }

    if (response.status === 204 || (options.allowEmpty && !rawText.trim())) {
      return undefined as T;
    }

    const parsedJson = this.parseJsonOrThrow(rawText, response.status);
    if (!options.responseSchema) {
      return parsedJson as T;
    }

    const validation = options.responseSchema.safeParse(parsedJson);
    if (!validation.success) {
      throw new ApiProblemError(es.errors.invalidResponse, {
        status: response.status,
        detail: es.errors.invalidResponse,
      });
    }

    return validation.data;
  }
}

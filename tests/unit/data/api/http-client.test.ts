import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { ApiHttpClient } from '@/data/api/http-client';
import {
  extractFieldErrorMap,
  formatRateLimitMessage,
  parseProblemDetailResponse,
} from '@/data/api/problem-detail';
import {
  ApiProblemError,
  NetworkError,
  RateLimitError,
  UnauthorizedError,
} from '@/shared/errors';
import { es } from '@/shared/i18n';

function jsonResponse(
  body: unknown,
  init: { status?: number; contentType?: string } = {},
): Response {
  const status = init.status ?? 200;
  const contentType = init.contentType ?? 'application/json';
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': contentType },
  });
}

function problemResponse(
  problem: Record<string, unknown>,
  status: number,
): Response {
  return jsonResponse(problem, {
    status,
    contentType: 'application/problem+json',
  });
}

describe('RFC 7807 Problem Detail & ApiHttpClient (REQ-BI-02..09)', () => {
  describe('problem-detail helpers', () => {
    it('parses application/problem+json responses and preserves invalidParams and retryAfterSeconds', () => {
      const parsed = parseProblemDetailResponse(
        400,
        'application/problem+json; charset=utf-8',
        JSON.stringify({
          type: 'https://taskbytask.app/errors/validation',
          title: 'Solicitud inválida',
          status: 400,
          detail: 'Revisa los campos ingresados.',
          instance: '/api/v1/auth/register',
          invalidParams: [
            { name: 'email', reason: 'El correo ya está en uso.' },
            { name: 'username', reason: 'Mínimo 3 caracteres.' },
          ],
          retryAfterSeconds: 30,
        }),
      );

      expect(parsed).toEqual({
        title: 'Solicitud inválida',
        status: 400,
        detail: 'Revisa los campos ingresados.',
        instance: '/api/v1/auth/register',
        invalidParams: [
          { name: 'email', reason: 'El correo ya está en uso.' },
          { name: 'username', reason: 'Mínimo 3 caracteres.' },
        ],
        retryAfterSeconds: 30,
      });
    });

    it('returns null for non-JSON or malformed bodies', () => {
      expect(parseProblemDetailResponse(502, 'text/html', '<html>Bad Gateway</html>')).toBeNull();
      expect(parseProblemDetailResponse(500, 'application/problem+json', 'not-json')).toBeNull();
      expect(parseProblemDetailResponse(500, 'application/problem+json', '   ')).toBeNull();
    });

    it('formats 429 rate-limit messages for login vs generic contexts', () => {
      expect(formatRateLimitMessage(125, undefined, 'login')).toBe(
        es.auth.tooManyAttemptsMinutes(3),
      );
      expect(formatRateLimitMessage(44.2, undefined, 'login')).toBe(
        es.auth.tooManyAttemptsSeconds(45),
      );
      expect(formatRateLimitMessage(60, undefined, 'generic')).toBe(
        es.errors.rateLimitedMinutes(1),
      );
      expect(formatRateLimitMessage(0.4, undefined, 'generic')).toBe(
        es.errors.rateLimitedSeconds(1),
      );
      expect(formatRateLimitMessage(0, 'Espera un minuto.', 'generic')).toBe(
        'Espera un minuto.',
      );
      expect(formatRateLimitMessage(undefined, undefined, 'generic')).toBe(
        es.errors.tooManyRequests,
      );
    });

    it('extracts field error map from ApiProblemError.invalidParams', () => {
      const err = new ApiProblemError('Error de validación', {
        status: 400,
        invalidParams: [
          { name: 'email', reason: 'Correo inválido' },
          { name: 'email', reason: 'Segundo error ignorado' },
          { name: 'title', reason: 'Título requerido' },
        ],
      });

      expect(extractFieldErrorMap(err)).toEqual({
        email: 'Correo inválido',
        title: 'Título requerido',
      });
      expect(extractFieldErrorMap(new Error('other'))).toEqual({});
    });
  });

  describe('transport, query serialization & inbound validation', () => {
    it('sends credentials: include, normalizes baseUrl, and serializes repeated array query params (groupIds)', async () => {
      const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
        jsonResponse({ ok: true }),
      );
      const client = new ApiHttpClient({
        baseUrl: 'https://api.example.com///',
        fetchFn: fetchMock,
      });

      const result = await client.requestJson({
        method: 'GET',
        path: '/api/v1/tasks',
        query: {
          status: 'PENDING',
          groupIds: ['10', '20'],
          search: undefined,
          cursor: null,
          limit: 20,
        },
        responseSchema: z.object({ ok: z.boolean() }),
      });

      expect(result).toEqual({ ok: true });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0]!;
      expect(url).toBe(
        'https://api.example.com/api/v1/tasks?status=PENDING&groupIds=10&groupIds=20&limit=20',
      );
      expect(init?.credentials).toBe('include');
      expect(init?.headers).toMatchObject({
        Accept: 'application/json, application/problem+json',
      });
    });

    it('handles 204 No Content via requestVoid without parsing JSON', async () => {
      const fetchMock = vi.fn<typeof fetch>().mockImplementation((url) => {
        if (String(url).endsWith('/api/v1/auth/csrf')) {
          return Promise.resolve(
            jsonResponse({ token: 'csrf-1', headerName: 'X-XSRF-TOKEN' }),
          );
        }
        return Promise.resolve(new Response(null, { status: 204 }));
      });
      const client = new ApiHttpClient({ fetchFn: fetchMock });

      await expect(
        client.requestVoid({
          method: 'DELETE',
          path: '/api/v1/tasks/5',
        }),
      ).resolves.toBeUndefined();
    });

    it('throws ApiProblemError with errors.invalidResponse when JSON is malformed or fails Zod schema', async () => {
      const fetchMock = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(new Response('not-json', { status: 200 }))
        .mockResolvedValueOnce(jsonResponse({ id: 123 }, { status: 200 }));

      const client = new ApiHttpClient({ fetchFn: fetchMock });
      const schema = z.object({ id: z.string() });

      await expect(
        client.requestJson({ method: 'GET', path: '/api/v1/groups', responseSchema: schema }),
      ).rejects.toMatchObject({
        message: es.errors.invalidResponse,
      });

      await expect(
        client.requestJson({ method: 'GET', path: '/api/v1/groups', responseSchema: schema }),
      ).rejects.toMatchObject({
        message: es.errors.invalidResponse,
      });
    });

    it('wraps fetch rejections in NetworkError', async () => {
      const fetchMock = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('Failed to fetch'));
      const client = new ApiHttpClient({ fetchFn: fetchMock });

      await expect(
        client.requestJson({
          method: 'GET',
          path: '/api/v1/users/me',
          responseSchema: z.object({ id: z.number() }),
        }),
      ).rejects.toBeInstanceOf(NetworkError);
    });
  });

  describe('CSRF bootstrap, single-flight dedupe, invalidation & single 403 retry', () => {
    it('bootstraps CSRF once across concurrent mutations and injects custom headerName', async () => {
      let csrfCalls = 0;
      const fetchMock = vi.fn<typeof fetch>().mockImplementation(async (url) => {
        if (String(url) === '/api/v1/auth/csrf') {
          csrfCalls += 1;
          await new Promise((resolve) => setTimeout(resolve, 10));
          return jsonResponse({ token: 'tok-abc', headerName: 'X-CUSTOM-CSRF' });
        }
        return jsonResponse({ created: true }, { status: 201 });
      });

      const client = new ApiHttpClient({ fetchFn: fetchMock });
      const schema = z.object({ created: z.boolean() });

      const [r1, r2] = await Promise.all([
        client.requestJson({ method: 'POST', path: '/api/v1/groups', body: { name: 'A' }, responseSchema: schema }),
        client.requestJson({ method: 'POST', path: '/api/v1/groups', body: { name: 'B' }, responseSchema: schema }),
      ]);

      expect(r1).toEqual({ created: true });
      expect(r2).toEqual({ created: true });
      expect(csrfCalls).toBe(1);
      expect(fetchMock).toHaveBeenCalledTimes(3);

      const postInit = fetchMock.mock.calls[1]?.[1];
      expect(postInit?.headers).toMatchObject({
        'X-CUSTOM-CSRF': 'tok-abc',
        'Content-Type': 'application/json',
      });

      client.invalidateCsrfToken();
      await client.requestJson({
        method: 'PATCH',
        path: '/api/v1/groups/1',
        body: { name: 'C' },
        responseSchema: schema,
      });
      expect(csrfCalls).toBe(2);
    });

    it('retries a first-attempt 403 mutation at most once after refreshing CSRF', async () => {
      let csrfCount = 0;
      let postCount = 0;

      const fetchMock = vi.fn<typeof fetch>().mockImplementation((url) => {
        if (String(url) === '/api/v1/auth/csrf') {
          csrfCount += 1;
          return Promise.resolve(jsonResponse({ token: `tok-${csrfCount}` }));
        }
        postCount += 1;
        if (postCount === 1) {
          return Promise.resolve(
            problemResponse({ status: 403, detail: 'Token CSRF expirado.' }, 403),
          );
        }
        return Promise.resolve(jsonResponse({ id: 9 }, { status: 201 }));
      });

      const client = new ApiHttpClient({ fetchFn: fetchMock });
      const res = await client.requestJson({
        method: 'POST',
        path: '/api/v1/groups',
        body: { name: 'Trabajo' },
        responseSchema: z.object({ id: z.number() }),
      });

      expect(res).toEqual({ id: 9 });
      expect(csrfCount).toBe(2);
      expect(postCount).toBe(2);
      const retryHeaders = fetchMock.mock.calls[3]?.[1]?.headers as Record<string, string>;
      expect(retryHeaders['X-XSRF-TOKEN']).toBe('tok-2');
    });

    it('stops retrying when the second attempt also returns 403 and throws ApiProblemError', async () => {
      let csrfCount = 0;
      let deleteCount = 0;

      const fetchMock = vi.fn<typeof fetch>().mockImplementation((url) => {
        if (String(url) === '/api/v1/auth/csrf') {
          csrfCount += 1;
          return Promise.resolve(jsonResponse({ token: `tok-${csrfCount}` }));
        }
        deleteCount += 1;
        return Promise.resolve(
          problemResponse({ status: 403, detail: 'Acceso denegado.' }, 403),
        );
      });

      const client = new ApiHttpClient({ fetchFn: fetchMock });

      await expect(
        client.requestVoid({ method: 'DELETE', path: '/api/v1/groups/99' }),
      ).rejects.toMatchObject({
        name: 'ApiProblemError',
        status: 403,
        message: 'Acceso denegado.',
      });

      expect(csrfCount).toBe(2);
      expect(deleteCount).toBe(2);
    });
  });

  describe('context-aware 401 and RFC 7807 400/404/409/429/5xx handling', () => {
    it('triggers onUnauthorizedSessionExpired and invalidates CSRF only for authenticated 401', async () => {
      const onExpired = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
      let csrfCount = 0;

      const fetchMock = vi.fn<typeof fetch>().mockImplementation((url, init) => {
        if (String(url) === '/api/v1/auth/csrf') {
          csrfCount += 1;
          return Promise.resolve(jsonResponse({ token: `tok-${csrfCount}` }));
        }
        if (String(url) === '/api/v1/users/me' && init?.method === 'GET') {
          return Promise.resolve(problemResponse({ status: 401, detail: 'No autenticado' }, 401));
        }
        if (String(url) === '/api/v1/auth/login') {
          return Promise.resolve(problemResponse({ status: 401 }, 401));
        }
        if (String(url) === '/api/v1/auth/logout') {
          return Promise.resolve(problemResponse({ status: 401 }, 401));
        }
        return Promise.resolve(problemResponse({ status: 401, detail: 'Sesión vencida' }, 401));
      });

      const client = new ApiHttpClient({
        fetchFn: fetchMock,
        onUnauthorizedSessionExpired: onExpired,
      });

      // Cold-start session probe -> silent (no onExpired)
      await expect(
        client.requestJson({
          method: 'GET',
          path: '/api/v1/users/me',
          authContext: 'session-probe',
          responseSchema: z.object({ id: z.number() }),
        }),
      ).rejects.toBeInstanceOf(UnauthorizedError);
      expect(onExpired).not.toHaveBeenCalled();

      // Login 401 -> generic credentials message, no onExpired
      await expect(
        client.requestJson({
          method: 'POST',
          path: '/api/v1/auth/login',
          body: { email: 'a@b.com', password: 'bad' },
          authContext: 'login',
          responseSchema: z.object({ id: z.number() }),
        }),
      ).rejects.toMatchObject({
        name: 'UnauthorizedError',
        message: es.auth.invalidCredentials,
      });
      expect(onExpired).not.toHaveBeenCalled();

      // Logout 401 -> no onExpired
      await expect(
        client.requestVoid({
          method: 'POST',
          path: '/api/v1/auth/logout',
          authContext: 'logout',
        }),
      ).rejects.toBeInstanceOf(UnauthorizedError);
      expect(onExpired).not.toHaveBeenCalled();

      // Authenticated 401 -> calls onExpired and invalidates CSRF
      await expect(
        client.requestJson({
          method: 'POST',
          path: '/api/v1/groups',
          body: { name: 'Nuevo' },
          authContext: 'authenticated',
          responseSchema: z.object({ id: z.number() }),
        }),
      ).rejects.toBeInstanceOf(UnauthorizedError);
      expect(onExpired).toHaveBeenCalledTimes(1);

      // Next mutation must fetch fresh CSRF because authenticated 401 invalidated it
      await expect(
        client.requestJson({
          method: 'POST',
          path: '/api/v1/groups',
          body: { name: 'Otro' },
          authContext: 'authenticated',
          responseSchema: z.object({ id: z.number() }),
        }),
      ).rejects.toBeInstanceOf(UnauthorizedError);
      expect(csrfCount).toBe(2);
    });

    it('throws RateLimitError on 429 and ApiProblemError on 400/404/409/5xx', async () => {
      const fetchMock = vi.fn<typeof fetch>().mockImplementation((url) => {
        if (String(url) === '/api/v1/auth/csrf') {
          return Promise.resolve(jsonResponse({ token: 'tok-1' }));
        }
        if (String(url) === '/api/v1/auth/login') {
          return Promise.resolve(
            problemResponse({ status: 429, retryAfterSeconds: 90, detail: 'Demasiados intentos' }, 429),
          );
        }
        if (String(url) === '/api/v1/auth/register') {
          return Promise.resolve(
            problemResponse(
              {
                status: 400,
                detail: 'Datos inválidos',
                invalidParams: [{ name: 'email', reason: 'Formato incorrecto' }],
              },
              400,
            ),
          );
        }
        if (String(url) === '/api/v1/groups/999') {
          return Promise.resolve(
            problemResponse({ status: 404, detail: 'Grupo no encontrado.' }, 404),
          );
        }
        if (String(url) === '/api/v1/groups/1') {
          return Promise.resolve(
            problemResponse({ status: 409, detail: 'El grupo Personal no se puede eliminar.' }, 409),
          );
        }
        return Promise.resolve(new Response('Internal Server Error', { status: 500 }));
      });

      const client = new ApiHttpClient({ fetchFn: fetchMock });

      await expect(
        client.requestJson({
          method: 'POST',
          path: '/api/v1/auth/login',
          body: {},
          authContext: 'login',
          rateLimitContext: 'login',
          responseSchema: z.object({ id: z.number() }),
        }),
      ).rejects.toMatchObject({
        name: 'RateLimitError',
        message: es.auth.tooManyAttemptsMinutes(2),
        retryAfterSeconds: 90,
      } satisfies Partial<RateLimitError>);

      await expect(
        client.requestJson({
          method: 'POST',
          path: '/api/v1/auth/register',
          body: {},
          authContext: 'public',
          responseSchema: z.object({ id: z.number() }),
        }),
      ).rejects.toMatchObject({
        name: 'ApiProblemError',
        status: 400,
        message: 'Datos inválidos',
        invalidParams: [{ name: 'email', reason: 'Formato incorrecto' }],
      });

      await expect(
        client.requestJson({
          method: 'GET',
          path: '/api/v1/groups/999',
          responseSchema: z.object({ id: z.number() }),
        }),
      ).rejects.toMatchObject({
        name: 'ApiProblemError',
        status: 404,
        message: 'Grupo no encontrado.',
      });

      await expect(
        client.requestVoid({
          method: 'DELETE',
          path: '/api/v1/groups/1',
        }),
      ).rejects.toMatchObject({
        name: 'ApiProblemError',
        status: 409,
        message: 'El grupo Personal no se puede eliminar.',
      });

      await expect(
        client.requestJson({
          method: 'GET',
          path: '/api/v1/groups',
          responseSchema: z.object({ items: z.array(z.string()) }),
        }),
      ).rejects.toMatchObject({
        name: 'ApiProblemError',
        status: 500,
        message: es.errors.serverError,
      });
    });
  });
});

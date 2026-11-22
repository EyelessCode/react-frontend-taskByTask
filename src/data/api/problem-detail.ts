import { z } from 'zod';
import { ApiProblemError, type ApiProblemDetails } from '../../shared/errors';
import { es } from '../../shared/i18n';

export const problemInvalidParamDtoSchema = z.object({
  name: z.string().min(1),
  reason: z.string().min(1),
});

export const problemDetailDtoSchema = z.object({
  type: z.string().nullish(),
  title: z.string().nullish(),
  status: z.number().int().nullish(),
  detail: z.string().nullish(),
  instance: z.string().nullish(),
  invalidParams: z.array(problemInvalidParamDtoSchema).nullish(),
  retryAfterSeconds: z.number().finite().nullish(),
});

function isJsonOrProblemContentType(contentType: string | null): boolean {
  if (!contentType) {
    return true;
  }
  const normalized = contentType.toLowerCase();
  return (
    normalized.includes('application/problem+json') ||
    normalized.includes('application/json')
  );
}

/**
 * Parses an RFC 7807 ProblemDetail payload from an HTTP error response body.
 */
export function parseProblemDetailResponse(
  status: number,
  contentType: string | null,
  rawBody: string,
): ApiProblemDetails | null {
  const trimmed = rawBody.trim();
  if (!trimmed || !isJsonOrProblemContentType(contentType)) {
    return null;
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(trimmed);
  } catch {
    return null;
  }

  const result = problemDetailDtoSchema.safeParse(parsedJson);
  if (!result.success) {
    return null;
  }

  const data = result.data;
  return {
    status: data.status ?? status,
    title: data.title ?? undefined,
    detail: data.detail ?? undefined,
    instance: data.instance ?? undefined,
    invalidParams: data.invalidParams ?? [],
    retryAfterSeconds: data.retryAfterSeconds ?? undefined,
  };
}

/**
 * Resolves the user-facing Spanish message from an RFC 7807 response or status fallback.
 */
export function resolveProblemMessage(
  status: number,
  problem: ApiProblemDetails | null,
): string {
  const detail = problem?.detail?.trim();
  if (detail) {
    return detail;
  }

  const title = problem?.title?.trim();
  if (title) {
    return title;
  }

  if (status === 403) {
    return es.errors.forbidden;
  }
  if (status === 429) {
    return es.errors.tooManyRequests;
  }
  if (status >= 500) {
    return es.errors.serverError;
  }

  return es.errors.unexpected;
}

/**
 * Formats a localized Spanish cooldown message for HTTP 429 responses (REQ-BI-07).
 */
export function formatRateLimitMessage(
  retryAfterSeconds: number | undefined,
  detail: string | undefined,
  context: 'login' | 'generic' = 'generic',
): string {
  if (
    typeof retryAfterSeconds === 'number' &&
    Number.isFinite(retryAfterSeconds) &&
    retryAfterSeconds > 0
  ) {
    if (retryAfterSeconds >= 60) {
      const minutes = Math.ceil(retryAfterSeconds / 60);
      return context === 'login'
        ? es.auth.tooManyAttemptsMinutes(minutes)
        : es.errors.rateLimitedMinutes(minutes);
    }

    const seconds = Math.max(1, Math.ceil(retryAfterSeconds));
    return context === 'login'
      ? es.auth.tooManyAttemptsSeconds(seconds)
      : es.errors.rateLimitedSeconds(seconds);
  }

  const trimmedDetail = detail?.trim();
  if (trimmedDetail) {
    return trimmedDetail;
  }

  return es.errors.tooManyRequests;
}

/**
 * Extracts a field-name -> error-message map from an ApiProblemError's invalidParams.
 */
export function extractFieldErrorMap(error: unknown): Record<string, string> {
  if (!(error instanceof ApiProblemError)) {
    return {};
  }

  const fieldErrors: Record<string, string> = {};
  for (const param of error.invalidParams) {
    const name = param.name.trim();
    const reason = param.reason.trim();
    if (name && reason && !(name in fieldErrors)) {
      fieldErrors[name] = reason;
    }
  }
  return fieldErrors;
}

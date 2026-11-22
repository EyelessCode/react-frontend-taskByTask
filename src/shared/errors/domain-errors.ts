import { es } from '../i18n';

export interface ValidationFieldIssue {
  path: string;
  message: string;
  code?: string;
}

export abstract class AppError extends Error {
  public readonly code: string;

  constructor(
    message: string,
    code: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.code = code;
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ValidationError extends AppError {
  public readonly issues: ValidationFieldIssue[];
  public readonly fieldPath?: string;

  constructor(
    messageOrIssues: string | ValidationFieldIssue[],
    issues: ValidationFieldIssue[] = [],
    options?: ErrorOptions,
  ) {
    let resolvedMessage: string;
    let resolvedIssues: ValidationFieldIssue[];

    if (Array.isArray(messageOrIssues)) {
      resolvedIssues = messageOrIssues;
      resolvedMessage = resolvedIssues[0]?.message ?? 'Error de validación';
    } else {
      resolvedMessage = messageOrIssues;
      resolvedIssues = issues;
    }

    super(resolvedMessage, 'VALIDATION_ERROR', options);
    this.issues = resolvedIssues;
    this.fieldPath = resolvedIssues[0]?.path;
  }
}

export class NotFoundError extends AppError {
  public readonly entityName: string;
  public readonly entityId?: string;

  constructor(entityName: string, entityId?: string, options?: ErrorOptions) {
    const message = entityId
      ? `${es.errors.notFound(entityName)} (id: ${entityId})`
      : es.errors.notFound(entityName);

    super(message, 'NOT_FOUND', options);
    this.entityName = entityName;
    this.entityId = entityId;
  }
}

export class BusinessRuleViolationError extends AppError {
  public readonly rule: string;

  constructor(rule: string, customMessage?: string, options?: ErrorOptions) {
    const message = customMessage ?? es.errors.businessRule(rule);
    super(message, 'BUSINESS_RULE_VIOLATION', options);
    this.rule = rule;
  }
}

export class CorruptedDataError extends AppError {
  public readonly storageKey: string;
  public readonly diagnostic?: string;

  constructor(
    storageKey: string,
    diagnosticOrOptions?: string | ErrorOptions,
    options?: ErrorOptions,
  ) {
    let diagnostic: string | undefined;
    let errorOptions: ErrorOptions | undefined;

    if (typeof diagnosticOrOptions === 'string') {
      diagnostic = diagnosticOrOptions;
      errorOptions = options;
    } else {
      errorOptions = diagnosticOrOptions;
    }

    super(es.errors.corruptedData, 'CORRUPTED_DATA', errorOptions);
    this.storageKey = storageKey;
    this.diagnostic = diagnostic;
  }
}

export class StorageQuotaError extends AppError {
  constructor(message: string = es.errors.storageQuota, options?: ErrorOptions) {
    super(message, 'STORAGE_QUOTA_EXCEEDED', options);
  }
}

export interface ApiProblemInvalidParam {
  name: string;
  reason: string;
}

export interface ApiProblemDetails {
  status: number;
  title?: string;
  detail?: string;
  instance?: string;
  invalidParams?: ApiProblemInvalidParam[];
  retryAfterSeconds?: number;
}

export class ConfigurationError extends AppError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, 'CONFIGURATION_ERROR', options);
  }
}

export class ApiProblemError extends AppError {
  public readonly status: number;
  public readonly title?: string;
  public readonly detail?: string;
  public readonly instance?: string;
  public readonly invalidParams: ApiProblemInvalidParam[];
  public readonly retryAfterSeconds?: number;

  constructor(
    message: string,
    problem: ApiProblemDetails,
    options?: ErrorOptions,
  ) {
    super(message, 'API_PROBLEM', options);
    this.status = problem.status;
    this.title = problem.title;
    this.detail = problem.detail;
    this.instance = problem.instance;
    this.invalidParams = problem.invalidParams ?? [];
    this.retryAfterSeconds = problem.retryAfterSeconds;
  }
}

export class UnauthorizedError extends AppError {
  public readonly problem?: ApiProblemDetails;

  constructor(
    message: string = es.auth.invalidCredentials,
    problem?: ApiProblemDetails,
    options?: ErrorOptions,
  ) {
    super(message, 'UNAUTHORIZED', options);
    this.problem = problem;
  }
}

export class RateLimitError extends AppError {
  public readonly retryAfterSeconds?: number;
  public readonly detail?: string;

  constructor(
    message: string,
    retryAfterSeconds?: number,
    detail?: string,
    options?: ErrorOptions,
  ) {
    super(message, 'RATE_LIMIT', options);
    this.retryAfterSeconds = retryAfterSeconds;
    this.detail = detail;
  }
}

export class NetworkError extends AppError {
  constructor(message: string = es.errors.networkError, options?: ErrorOptions) {
    super(message, 'NETWORK_ERROR', options);
  }
}

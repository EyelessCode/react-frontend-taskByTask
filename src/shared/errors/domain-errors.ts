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

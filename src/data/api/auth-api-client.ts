import type { User } from '../../shared/schemas';
import type {
  AuthApiClient,
  ChangePasswordApiInput,
  DeleteAccountApiInput,
  LoginApiInput,
  RecoveryCodesApiResult,
  RecoverPasswordApiInput,
  RegenerateRecoveryCodesApiInput,
  RegisterApiInput,
  RegisterApiResult,
  UpdateProfileApiInput,
} from '../contracts';
import { mapTimeFormatToDto, mapUserFromDto } from './dto-mappers';
import {
  messageResponseDtoSchema,
  recoveryCodesResponseDtoSchema,
  registerResponseDtoSchema,
  userResponseDtoSchema,
} from './dto-schemas';
import type { ApiHttpClient } from './http-client';

export class HttpAuthApiClient implements AuthApiClient {
  private readonly httpClient: ApiHttpClient;

  constructor(httpClient: ApiHttpClient) {
    this.httpClient = httpClient;
  }

  invalidateCsrf(): void {
    this.httpClient.invalidateCsrfToken();
  }

  async getMe(authContext: 'session-probe' | 'authenticated' = 'authenticated'): Promise<User> {
    const dto = await this.httpClient.requestJson({
      method: 'GET',
      path: '/api/v1/users/me',
      authContext,
      responseSchema: userResponseDtoSchema,
    });
    return mapUserFromDto(dto);
  }

  async register(input: RegisterApiInput): Promise<RegisterApiResult> {
    const dto = await this.httpClient.requestJson({
      method: 'POST',
      path: '/api/v1/auth/register',
      body: {
        email: input.email,
        username: input.username,
        displayName: input.displayName,
        password: input.password,
        timezone: input.timezone ?? 'UTC',
      },
      authContext: 'public',
      rateLimitContext: 'generic',
      responseSchema: registerResponseDtoSchema,
    });
    this.httpClient.invalidateCsrfToken();
    return {
      user: mapUserFromDto(dto.user),
      recoveryCodes: dto.recoveryCodes,
      recoveryCodesNotice: dto.recoveryCodesNotice,
    };
  }

  async login(input: LoginApiInput): Promise<User> {
    const dto = await this.httpClient.requestJson({
      method: 'POST',
      path: '/api/v1/auth/login',
      body: {
        email: input.email,
        password: input.password,
        timezone: input.timezone ?? null,
      },
      authContext: 'login',
      rateLimitContext: 'login',
      responseSchema: userResponseDtoSchema,
    });
    this.httpClient.invalidateCsrfToken();
    return mapUserFromDto(dto);
  }

  async logout(endpoint?: string | null): Promise<void> {
    try {
      await this.httpClient.requestVoid({
        method: 'POST',
        path: '/api/v1/auth/logout',
        body: endpoint ? { endpoint } : undefined,
        authContext: 'logout',
      });
    } finally {
      this.httpClient.invalidateCsrfToken();
    }
  }

  async recoverPassword(input: RecoverPasswordApiInput): Promise<string> {
    const dto = await this.httpClient.requestJson({
      method: 'POST',
      path: '/api/v1/auth/recover-password',
      body: {
        email: input.email,
        recoveryCode: input.recoveryCode,
        newPassword: input.newPassword,
      },
      authContext: 'public',
      rateLimitContext: 'generic',
      responseSchema: messageResponseDtoSchema,
    });
    return dto.message;
  }

  async updateProfile(input: UpdateProfileApiInput): Promise<User> {
    const body: Record<string, unknown> = {};
    if (input.displayName !== undefined) {
      body.displayName = input.displayName;
    }
    if (input.username !== undefined) {
      body.username = input.username;
    }
    if (input.email !== undefined) {
      body.email = input.email;
    }
    if (input.timezone !== undefined) {
      body.timezone = input.timezone;
    }
    if (input.timeFormat !== undefined) {
      body.timeFormat =
        input.timeFormat === null ? null : mapTimeFormatToDto(input.timeFormat);
    }

    const dto = await this.httpClient.requestJson({
      method: 'PATCH',
      path: '/api/v1/users/me',
      body,
      authContext: 'authenticated',
      responseSchema: userResponseDtoSchema,
    });
    return mapUserFromDto(dto);
  }

  async changePassword(input: ChangePasswordApiInput): Promise<string> {
    const dto = await this.httpClient.requestJson({
      method: 'POST',
      path: '/api/v1/users/me/password',
      body: {
        currentPassword: input.currentPassword,
        newPassword: input.newPassword,
      },
      authContext: 'authenticated',
      responseSchema: messageResponseDtoSchema,
    });
    return dto.message;
  }

  async regenerateRecoveryCodes(
    input: RegenerateRecoveryCodesApiInput,
  ): Promise<RecoveryCodesApiResult> {
    const dto = await this.httpClient.requestJson({
      method: 'POST',
      path: '/api/v1/users/me/recovery-codes/regenerate',
      body: {
        currentPassword: input.currentPassword,
      },
      authContext: 'authenticated',
      responseSchema: recoveryCodesResponseDtoSchema,
    });
    return {
      recoveryCodes: dto.recoveryCodes,
      recoveryCodesNotice: dto.recoveryCodesNotice,
    };
  }

  async deleteAccount(input: DeleteAccountApiInput): Promise<void> {
    await this.httpClient.requestVoid({
      method: 'DELETE',
      path: '/api/v1/users/me',
      body: {
        password: input.password,
      },
      authContext: 'authenticated',
    });
    this.httpClient.invalidateCsrfToken();
  }
}

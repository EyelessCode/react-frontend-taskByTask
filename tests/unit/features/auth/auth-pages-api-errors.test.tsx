import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AuthApiClient } from '@/data/contracts';
import {
  LoginPage,
  ProfilePage,
  RecoverPasswordPage,
  RegisterPage,
} from '@/features/auth/components';
import { configureAuthStore, resetAuthStore, useAuthStore } from '@/features/auth/store';
import { ApiProblemError } from '@/shared/errors';
import { es } from '@/shared/i18n';
import type { User } from '@/shared/schemas';

const baseUser: User = {
  id: '1',
  email: 'ana@example.com',
  username: 'Ana123',
  displayName: 'Ana García',
  timeZone: 'America/Lima',
  timeFormat: '24h',
  remainingRecoveryCodes: 5,
  createdAt: '2026-11-20T10:00:00Z',
};

function createMockAuthApi(): AuthApiClient {
  return {
    getMe: vi.fn<AuthApiClient['getMe']>(),
    register: vi.fn<AuthApiClient['register']>(),
    login: vi.fn<AuthApiClient['login']>(),
    logout: vi.fn<AuthApiClient['logout']>(),
    recoverPassword: vi.fn<AuthApiClient['recoverPassword']>(),
    updateProfile: vi.fn<AuthApiClient['updateProfile']>(),
    changePassword: vi.fn<AuthApiClient['changePassword']>(),
    regenerateRecoveryCodes: vi.fn<AuthApiClient['regenerateRecoveryCodes']>(),
    deleteAccount: vi.fn<AuthApiClient['deleteAccount']>(),
    invalidateCsrf: vi.fn<AuthApiClient['invalidateCsrf']>(),
  };
}

describe('Auth & Profile Pages API Errors, Notices & Remaining Codes (T6)', () => {
  let mockAuthApi: AuthApiClient;

  beforeEach(() => {
    resetAuthStore();
    mockAuthApi = createMockAuthApi();
    configureAuthStore({
      mode: 'api',
      authApi: mockAuthApi,
      getTimeZone: () => 'America/Lima',
    });
    useAuthStore.setState({
      currentUser: null,
      isAuthenticated: false,
      isInitialized: true,
    });
  });

  it('maps 400 invalidParams field errors on LoginPage while preserving user input', async () => {
    const user = userEvent.setup();
    vi.mocked(mockAuthApi.login).mockRejectedValueOnce(
      new ApiProblemError('Datos inválidos', {
        status: 400,
        detail: 'Verifica tus credenciales.',
        invalidParams: [{ name: 'email', reason: 'Dominio de correo no permitido.' }],
      }),
    );

    render(<LoginPage />);

    const emailInput = screen.getByLabelText(es.auth.emailLabel);
    const passwordInput = screen.getByLabelText(es.auth.passwordLabel);
    await user.type(emailInput, 'ana@example.com');
    await user.type(passwordInput, 'Secret123');
    await user.click(screen.getByRole('button', { name: es.auth.loginButton }));

    expect(await screen.findByText('Verifica tus credenciales.')).toBeInTheDocument();
    expect(await screen.findByText('Dominio de correo no permitido.')).toBeInTheDocument();
    expect(emailInput).toHaveAttribute('aria-invalid', 'true');
    expect(emailInput).toHaveValue('ana@example.com');
  });

  it('maps 400 invalidParams on RegisterPage and displays backend recoveryCodesNotice in OneTimeRecoveryCodesCard', async () => {
    const user = userEvent.setup();
    vi.mocked(mockAuthApi.register)
      .mockRejectedValueOnce(
        new ApiProblemError('Error de validación', {
          status: 400,
          detail: 'Revisa los campos del registro.',
          invalidParams: [{ name: 'username', reason: 'El usuario contiene palabras reservadas.' }],
        }),
      )
      .mockResolvedValueOnce({
        user: baseUser,
        recoveryCodes: ['1111-2222', '3333-4444'],
        recoveryCodesNotice: 'Aviso del servidor: guarda tus 8 códigos ahora mismo.',
      });

    render(<RegisterPage />);

    await user.type(screen.getByLabelText(es.auth.emailLabel), 'ana@example.com');
    await user.type(screen.getByLabelText(es.auth.usernameLabel), 'Ana123');
    await user.type(screen.getByLabelText(es.auth.displayNameLabel), 'Ana García');
    await user.type(screen.getByLabelText(es.auth.passwordLabel), 'Secret123');
    await user.click(screen.getByRole('button', { name: es.auth.registerButton }));

    expect(await screen.findByText('Revisa los campos del registro.')).toBeInTheDocument();
    expect(await screen.findByText('El usuario contiene palabras reservadas.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: es.auth.registerButton }));

    expect(
      await screen.findByText('Aviso del servidor: guarda tus 8 códigos ahora mismo.'),
    ).toBeInTheDocument();
    expect(screen.getByText('1111-2222')).toBeInTheDocument();
  });

  it('accepts hyphenated recovery codes and maps 400 invalidParams on RecoverPasswordPage', async () => {
    const user = userEvent.setup();
    vi.mocked(mockAuthApi.recoverPassword).mockRejectedValueOnce(
      new ApiProblemError('Error de validación', {
        status: 400,
        detail: 'No se pudo restablecer la contraseña.',
        invalidParams: [{ name: 'recoveryCode', reason: 'Código ya utilizado o expirado.' }],
      }),
    );

    render(<RecoverPasswordPage />);

    await user.type(screen.getByLabelText(es.auth.emailLabel), 'ana@example.com');
    await user.type(screen.getByLabelText(es.auth.recoveryCodeLabel), 'a1b2-c3d4');
    await user.type(screen.getByLabelText(es.auth.newPasswordLabel), 'NewSecret123');
    await user.click(screen.getByRole('button', { name: es.auth.recoverButton }));

    expect(await screen.findByText('No se pudo restablecer la contraseña.')).toBeInTheDocument();
    expect(await screen.findByText('Código ya utilizado o expirado.')).toBeInTheDocument();
    expect(screen.getByLabelText(es.auth.recoveryCodeLabel)).toHaveAttribute('aria-invalid', 'true');
  });

  it('displays remainingRecoveryCodes, maps section-scoped invalidParams, and passes regenerated notice on ProfilePage', async () => {
    const user = userEvent.setup();
    useAuthStore.setState({
      currentUser: baseUser,
      isAuthenticated: true,
      isInitialized: true,
    });

    vi.mocked(mockAuthApi.updateProfile).mockRejectedValueOnce(
      new ApiProblemError('Error de validación', {
        status: 400,
        detail: 'Error en datos de perfil.',
        invalidParams: [{ name: 'email', reason: 'Correo no permitido.' }],
      }),
    );
    vi.mocked(mockAuthApi.changePassword).mockRejectedValueOnce(
      new ApiProblemError('Error de validación', {
        status: 400,
        detail: 'Error de contraseña.',
        invalidParams: [{ name: 'currentPassword', reason: 'Contraseña actual incorrecta en servidor.' }],
      }),
    );
    vi.mocked(mockAuthApi.regenerateRecoveryCodes).mockResolvedValueOnce({
      recoveryCodes: ['AAAA-BBBB', 'CCCC-DDDD'],
      recoveryCodesNotice: 'Aviso regenerado desde backend.',
    });

    render(<ProfilePage />);

    // Remaining recovery codes visible
    expect(screen.getByText(es.auth.remainingRecoveryCodes(5))).toBeInTheDocument();

    // Profile 400 field error
    await user.click(screen.getByRole('button', { name: es.auth.saveProfileButton }));
    expect(await screen.findByText('Correo no permitido.')).toBeInTheDocument();

    // Password change 400 field error scoped only to password section (not regen section)
    await user.type(screen.getByLabelText(es.auth.currentPasswordLabel, { selector: '#profile-current-password-input' }), 'Wrong123');
    await user.type(screen.getByLabelText(es.auth.newPasswordLabel), 'NewSecret1');
    await user.click(screen.getByRole('button', { name: es.auth.changePasswordButton }));

    expect(await screen.findByText('Contraseña actual incorrecta en servidor.')).toBeInTheDocument();
    expect(
      document.getElementById('profile-regen-password-input'),
    ).toHaveAttribute('aria-invalid', 'false');

    // Regenerate codes updates notice & remaining count to 2 (length of returned array)
    await user.type(
      document.getElementById('profile-regen-password-input') as HTMLElement,
      'Secret123',
    );
    await user.click(screen.getByRole('button', { name: es.auth.regenerateButton }));

    await waitFor(() => {
      expect(screen.getByText('Aviso regenerado desde backend.')).toBeInTheDocument();
    });
    expect(screen.getByText('AAAA-BBBB')).toBeInTheDocument();
  });
});

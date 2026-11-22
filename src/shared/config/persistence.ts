import { ConfigurationError } from '../errors';

export type PersistenceMode = 'localStorage' | 'api';

export interface PersistenceConfig {
  mode: PersistenceMode;
  apiBaseUrl: string;
}

export interface PersistenceEnvInput {
  VITE_PERSISTENCE_MODE?: string;
  VITE_API_BASE_URL?: string;
}

let testConfigOverride: PersistenceConfig | null = null;

function normalizeApiBaseUrl(raw?: string): string {
  const trimmed = (raw ?? '').trim();
  return trimmed.replace(/\/+$/, '');
}

function readDefaultEnv(): PersistenceEnvInput {
  const meta = import.meta as ImportMeta & { env?: PersistenceEnvInput };
  return meta.env ?? {};
}

/**
 * Resolves and validates persistence mode and API base URL from environment variables.
 */
export function resolvePersistenceConfig(
  env: PersistenceEnvInput = readDefaultEnv(),
): PersistenceConfig {
  const rawMode = env.VITE_PERSISTENCE_MODE?.trim() ?? '';

  let mode: PersistenceMode;
  if (rawMode === '') {
    mode = 'localStorage';
  } else if (rawMode === 'localStorage' || rawMode === 'api') {
    mode = rawMode;
  } else {
    throw new ConfigurationError(
      `Modo de persistencia no válido: "${rawMode}". Valores permitidos: "localStorage" o "api".`,
    );
  }

  return {
    mode,
    apiBaseUrl: normalizeApiBaseUrl(env.VITE_API_BASE_URL),
  };
}

/**
 * Returns the active persistence configuration, honoring unit/integration test overrides.
 */
export function getPersistenceConfig(): PersistenceConfig {
  if (testConfigOverride !== null) {
    return testConfigOverride;
  }
  return resolvePersistenceConfig();
}

export function isApiMode(): boolean {
  return getPersistenceConfig().mode === 'api';
}

export function setPersistenceConfigForTests(config: PersistenceConfig): void {
  testConfigOverride = {
    mode: config.mode,
    apiBaseUrl: normalizeApiBaseUrl(config.apiBaseUrl),
  };
}

export function resetPersistenceConfigForTests(): void {
  testConfigOverride = null;
}

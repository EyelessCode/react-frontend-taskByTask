import { afterEach, describe, expect, it } from 'vitest';
import {
  getPersistenceConfig,
  isApiMode,
  resetPersistenceConfigForTests,
  resolvePersistenceConfig,
  setPersistenceConfigForTests,
} from '@/shared/config';
import { ConfigurationError } from '@/shared/errors';

describe('Persistence configuration (REQ-BI-01, REQ-BI-02)', () => {
  afterEach(() => {
    resetPersistenceConfigForTests();
  });

  describe('resolvePersistenceConfig', () => {
    it('defaults to localStorage when VITE_PERSISTENCE_MODE is unset, empty, or whitespace', () => {
      expect(resolvePersistenceConfig({})).toEqual({
        mode: 'localStorage',
        apiBaseUrl: '',
      });
      expect(resolvePersistenceConfig({ VITE_PERSISTENCE_MODE: '' })).toEqual({
        mode: 'localStorage',
        apiBaseUrl: '',
      });
      expect(resolvePersistenceConfig({ VITE_PERSISTENCE_MODE: '   ' })).toEqual({
        mode: 'localStorage',
        apiBaseUrl: '',
      });
    });

    it('accepts explicit localStorage and api modes', () => {
      expect(resolvePersistenceConfig({ VITE_PERSISTENCE_MODE: 'localStorage' })).toEqual({
        mode: 'localStorage',
        apiBaseUrl: '',
      });
      expect(resolvePersistenceConfig({ VITE_PERSISTENCE_MODE: 'api' })).toEqual({
        mode: 'api',
        apiBaseUrl: '',
      });
      expect(resolvePersistenceConfig({ VITE_PERSISTENCE_MODE: '  api  ' })).toEqual({
        mode: 'api',
        apiBaseUrl: '',
      });
    });

    it('throws ConfigurationError deterministically on unrecognized mode values', () => {
      expect(() =>
        resolvePersistenceConfig({ VITE_PERSISTENCE_MODE: 'graphql' }),
      ).toThrow(ConfigurationError);

      try {
        resolvePersistenceConfig({ VITE_PERSISTENCE_MODE: 'REST' });
        expect.fail('Expected ConfigurationError to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ConfigurationError);
        const message = (error as Error).message;
        expect(message).toContain('REST');
        expect(message).toContain('localStorage');
        expect(message).toContain('api');
      }
    });

    it('normalizes VITE_API_BASE_URL by trimming whitespace and trailing slashes', () => {
      expect(
        resolvePersistenceConfig({
          VITE_PERSISTENCE_MODE: 'api',
          VITE_API_BASE_URL: '  https://api.taskbytask.app///  ',
        }),
      ).toEqual({
        mode: 'api',
        apiBaseUrl: 'https://api.taskbytask.app',
      });

      expect(
        resolvePersistenceConfig({
          VITE_PERSISTENCE_MODE: 'api',
          VITE_API_BASE_URL: 'http://localhost:8080/backend/',
        }),
      ).toEqual({
        mode: 'api',
        apiBaseUrl: 'http://localhost:8080/backend',
      });

      expect(
        resolvePersistenceConfig({
          VITE_PERSISTENCE_MODE: 'api',
          VITE_API_BASE_URL: '   ',
        }),
      ).toEqual({
        mode: 'api',
        apiBaseUrl: '',
      });
    });
  });

  describe('runtime config helpers and test overrides', () => {
    it('supports test overrides and reset back to environment defaults', () => {
      expect(getPersistenceConfig().mode).toBe('localStorage');
      expect(isApiMode()).toBe(false);

      setPersistenceConfigForTests({
        mode: 'api',
        apiBaseUrl: 'https://api.example.com/',
      });
      expect(getPersistenceConfig()).toEqual({
        mode: 'api',
        apiBaseUrl: 'https://api.example.com',
      });
      expect(isApiMode()).toBe(true);

      resetPersistenceConfigForTests();
      expect(getPersistenceConfig().mode).toBe('localStorage');
      expect(isApiMode()).toBe(false);
    });
  });
});

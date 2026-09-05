/**
 * Demo mode is an authentication bypass. These tests exist to make its one
 * invariant explicit: production never honors it, whatever the environment says.
 */

const ENV_KEYS = ['NODE_ENV', 'ENABLE_DEMO_MODE'];

describe('demo mode gate', () => {
  let saved;

  beforeEach(() => {
    saved = {};
    ENV_KEYS.forEach((k) => { saved[k] = process.env[k]; });
    // Required so requiring the module under test does not trip other config.
    jest.resetModules();
  });

  afterEach(() => {
    ENV_KEYS.forEach((k) => {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    });
  });

  const load = () => require('../config/demoMode');

  describe('isDemoModeEnabled', () => {
    it('is on in development when the flag is set', () => {
      process.env.NODE_ENV = 'development';
      process.env.ENABLE_DEMO_MODE = 'true';
      expect(load().isDemoModeEnabled()).toBe(true);
    });

    it('is on in test when the flag is set, so integration tests can authenticate', () => {
      process.env.NODE_ENV = 'test';
      process.env.ENABLE_DEMO_MODE = 'true';
      expect(load().isDemoModeEnabled()).toBe(true);
    });

    it('is off in development when the flag is unset', () => {
      process.env.NODE_ENV = 'development';
      delete process.env.ENABLE_DEMO_MODE;
      expect(load().isDemoModeEnabled()).toBe(false);
    });

    it('is off in production even when the flag is set', () => {
      process.env.NODE_ENV = 'production';
      process.env.ENABLE_DEMO_MODE = 'true';
      expect(load().isDemoModeEnabled()).toBe(false);
    });
  });

  describe('isDemoToken', () => {
    it('accepts the demo token in development', () => {
      process.env.NODE_ENV = 'development';
      process.env.ENABLE_DEMO_MODE = 'true';
      const { isDemoToken, DEMO_TOKEN } = load();
      expect(isDemoToken(DEMO_TOKEN)).toBe(true);
    });

    it('rejects the demo token in production', () => {
      process.env.NODE_ENV = 'production';
      process.env.ENABLE_DEMO_MODE = 'true';
      const { isDemoToken, DEMO_TOKEN } = load();
      expect(isDemoToken(DEMO_TOKEN)).toBe(false);
    });

    it('rejects any other token even when demo mode is on', () => {
      process.env.NODE_ENV = 'development';
      process.env.ENABLE_DEMO_MODE = 'true';
      const { isDemoToken } = load();
      expect(isDemoToken('some-other-token')).toBe(false);
      expect(isDemoToken('')).toBe(false);
      expect(isDemoToken(undefined)).toBe(false);
    });
  });

  describe('isDemoUid', () => {
    it('rejects the demo uid in production', () => {
      process.env.NODE_ENV = 'production';
      process.env.ENABLE_DEMO_MODE = 'true';
      const { isDemoUid, DEMO_UID } = load();
      expect(isDemoUid(DEMO_UID)).toBe(false);
    });
  });

  describe('assertDemoModeNotEnabledInProduction', () => {
    it('throws when production is configured with the flag on', () => {
      process.env.NODE_ENV = 'production';
      process.env.ENABLE_DEMO_MODE = 'true';
      expect(() => load().assertDemoModeNotEnabledInProduction())
        .toThrow(/not permitted when NODE_ENV=production/);
    });

    it('does not throw in production with the flag unset', () => {
      process.env.NODE_ENV = 'production';
      delete process.env.ENABLE_DEMO_MODE;
      expect(() => load().assertDemoModeNotEnabledInProduction()).not.toThrow();
    });

    it('does not throw in development with the flag on', () => {
      process.env.NODE_ENV = 'development';
      process.env.ENABLE_DEMO_MODE = 'true';
      expect(() => load().assertDemoModeNotEnabledInProduction()).not.toThrow();
    });
  });
});

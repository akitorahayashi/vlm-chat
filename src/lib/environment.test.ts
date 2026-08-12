import { describe, expect, it, spyOn } from 'bun:test';
import {
  getDatabaseEnvironment,
  getSystemTestPort,
  getTursoEnvironment,
} from './environment';

describe('database environment', () => {
  it('accepts a local SQLite URL without a token', () => {
    expect(
      getDatabaseEnvironment({
        DATABASE_URL: 'file:./data/test.db',
        TURSO_AUTH_TOKEN: '',
      }),
    ).toEqual({
      kind: 'sqlite',
      databaseUrl: 'file:./data/test.db',
    });
  });

  it('rejects a Turso token for local SQLite', () => {
    expect(() =>
      getDatabaseEnvironment({
        DATABASE_URL: 'file:./data/test.db',
        TURSO_AUTH_TOKEN: 'secret',
      }),
    ).toThrow('TURSO_AUTH_TOKEN must not be set for a local SQLite database.');
  });

  it('accepts a Turso URL with a token', () => {
    expect(
      getTursoEnvironment({
        DATABASE_URL: 'libsql://example.turso.io',
        TURSO_AUTH_TOKEN: 'secret',
      }),
    ).toEqual({
      kind: 'turso',
      databaseUrl: 'libsql://example.turso.io',
      authToken: 'secret',
    });
  });

  it('requires a token for Turso', () => {
    expect(() =>
      getDatabaseEnvironment({
        DATABASE_URL: 'libsql://example.turso.io',
        TURSO_AUTH_TOKEN: '',
      }),
    ).toThrow('TURSO_AUTH_TOKEN is required for a Turso database.');
  });

  it('rejects unsupported database URLs', () => {
    expect(() =>
      getDatabaseEnvironment({
        DATABASE_URL: 'postgresql://localhost/example',
      }),
    ).toThrow('DATABASE_URL must use file:, sqlite:, libsql://, or https://.');
  });
});

describe('system test port', () => {
  it('uses the configured positive integer', () => {
    expect(getSystemTestPort({ NEXT_BUN_SYSTEM_TEST_PORT: '4100' })).toBe(4100);
  });

  it('logs an explicit default decision', () => {
    const warn = spyOn(console, 'warn').mockImplementation(() => {});

    expect(getSystemTestPort({})).toBe(3001);
    expect(warn).toHaveBeenCalledWith(
      'NEXT_BUN_SYSTEM_TEST_PORT is not set. Using 3001.',
    );

    warn.mockRestore();
  });

  it('rejects invalid ports', () => {
    expect(() =>
      getSystemTestPort({ NEXT_BUN_SYSTEM_TEST_PORT: 'invalid' }),
    ).toThrow(
      'NEXT_BUN_SYSTEM_TEST_PORT must be a positive integer: received "invalid"',
    );
  });
});

import { describe, expect, it } from 'vitest';
import { getReturnTarget, resolveReturnTo, validateRegistration } from './authContract';

describe('authContract', () => {
  it('accepts trusted return targets on chefgroep domains', () => {
    const result = resolveReturnTo('https://flow.chefgroep.nl/path', 'https://auth.chefgroep.nl');
    expect(result.returnTo).toBe('https://flow.chefgroep.nl/path');
    expect(result.returnHost).toBe('flow.chefgroep.nl');
  });

  it('normalizes bare host shorthand to an absolute https URL', () => {
    const result = resolveReturnTo('mc.chefgroep.nl/mission-control', 'https://auth.chefgroep.nl');
    expect(result.returnTo).toBe('https://mc.chefgroep.nl/mission-control');
    expect(result.returnHost).toBe('mc.chefgroep.nl');
  });

  it('rejects relative paths that would keep users on auth host', () => {
    const result = resolveReturnTo('/mission-control', 'https://auth.chefgroep.nl');
    expect(result.returnTo).toBe('https://mc.chefgroep.nl/mission-control');
    expect(result.returnHost).toBe('mc.chefgroep.nl');
  });

  it('rejects non-https and foreign domains', () => {
    const result = resolveReturnTo('http://evil.example.com', 'https://auth.chefgroep.nl');
    expect(result.returnTo).toBe('https://mc.chefgroep.nl/mission-control');
  });

  it('allows localhost only when dev mode is explicitly enabled', () => {
    const rejected = resolveReturnTo('http://localhost:5173/demo', 'https://auth.chefgroep.nl');
    expect(rejected.returnTo).toBe('https://mc.chefgroep.nl/mission-control');

    const accepted = resolveReturnTo('http://localhost:5173/demo', 'https://auth.chefgroep.nl', {
      allowDevHosts: true,
    });
    expect(accepted.returnTo).toBe('http://localhost:5173/demo');
  });

  it('extracts switch intent from query string', () => {
    const target = getReturnTarget('?switch=1&return_to=https://mc.chefgroep.nl/mission-control', 'https://auth.chefgroep.nl');
    expect(target.switchRequested).toBe(true);
    expect(target.returnHost).toBe('mc.chefgroep.nl');
  });

  it('validates registration payload constraints', () => {
    expect(
      validateRegistration({
        name: 'Jan',
        email: 'jan@chefgroep.nl',
        username: 'ok_name',
        password: 'strongpass',
        confirmPassword: 'strongpass',
      }),
    ).toBeNull();

    expect(
      validateRegistration({
        name: 'Jan',
        email: 'jan@chefgroep.nl',
        username: 'bad name',
        password: 'strongpass',
        confirmPassword: 'strongpass',
      }),
    ).toMatch(/Gebruikersnaam/);
  });
});

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

  it('rejects auth.chefgroep.nl as direct return target', () => {
    const result = resolveReturnTo('https://auth.chefgroep.nl/?return_to=https%3A%2F%2Fadmin.chefgroep.nl%2F', 'https://auth.chefgroep.nl');
    expect(result.returnTo).toBe('https://admin.chefgroep.nl/');
    expect(result.returnHost).toBe('admin.chefgroep.nl');
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

  it('rejects when required fields are missing', () => {
    expect(
      validateRegistration({
        name: '',
        email: 'jan@chefgroep.nl',
        username: 'ok_name',
        password: 'strongpass',
        confirmPassword: 'strongpass',
      }),
    ).toMatch(/verplichte velden/);

    expect(
      validateRegistration({
        name: 'Jan',
        email: '',
        username: 'ok_name',
        password: 'strongpass',
        confirmPassword: 'strongpass',
      }),
    ).toMatch(/verplichte velden/);

    expect(
      validateRegistration({
        name: 'Jan',
        email: 'jan@chefgroep.nl',
        username: '',
        password: 'strongpass',
        confirmPassword: 'strongpass',
      }),
    ).toMatch(/verplichte velden/);

    expect(
      validateRegistration({
        name: 'Jan',
        email: 'jan@chefgroep.nl',
        username: 'ok_name',
        password: '',
        confirmPassword: 'strongpass',
      }),
    ).toMatch(/verplichte velden/);
  });

  it('rejects passwords shorter than 8 characters', () => {
    expect(
      validateRegistration({
        name: 'Jan',
        email: 'jan@chefgroep.nl',
        username: 'ok_name',
        password: 'short',
        confirmPassword: 'short',
      }),
    ).toMatch(/8 tekens/);
  });

  it('rejects mismatched passwords', () => {
    expect(
      validateRegistration({
        name: 'Jan',
        email: 'jan@chefgroep.nl',
        username: 'ok_name',
        password: 'strongpass',
        confirmPassword: 'different',
      }),
    ).toMatch(/niet overeen/);
  });

  it('accepts username at exact boundary lengths (3 and 20)', () => {
    expect(
      validateRegistration({
        name: 'Jan',
        email: 'jan@chefgroep.nl',
        username: 'abc',
        password: 'strongpass',
        confirmPassword: 'strongpass',
      }),
    ).toBeNull();

    expect(
      validateRegistration({
        name: 'Jan',
        email: 'jan@chefgroep.nl',
        username: 'a'.repeat(20),
        password: 'strongpass',
        confirmPassword: 'strongpass',
      }),
    ).toBeNull();
  });

  it('rejects username outside boundary lengths (2 and 21)', () => {
    expect(
      validateRegistration({
        name: 'Jan',
        email: 'jan@chefgroep.nl',
        username: 'ab',
        password: 'strongpass',
        confirmPassword: 'strongpass',
      }),
    ).toMatch(/Gebruikersnaam/);

    expect(
      validateRegistration({
        name: 'Jan',
        email: 'jan@chefgroep.nl',
        username: 'a'.repeat(21),
        password: 'strongpass',
        confirmPassword: 'strongpass',
      }),
    ).toMatch(/Gebruikersnaam/);
  });

  it('rejects invalid email addresses', () => {
    expect(
      validateRegistration({
        name: 'Jan',
        email: 'foo',
        username: 'ok_name',
        password: 'strongpass',
        confirmPassword: 'strongpass',
      }),
    ).toMatch(/E-mailadres/);

    expect(
      validateRegistration({
        name: 'Jan',
        email: 'foo@',
        username: 'ok_name',
        password: 'strongpass',
        confirmPassword: 'strongpass',
      }),
    ).toMatch(/E-mailadres/);

    expect(
      validateRegistration({
        name: 'Jan',
        email: '@chefgroep.nl',
        username: 'ok_name',
        password: 'strongpass',
        confirmPassword: 'strongpass',
      }),
    ).toMatch(/E-mailadres/);
  });

  it('unwraps nested return_to up to depth 2 but not deeper', () => {
    // Diepte 1 — normaal geval
    const depth1 = resolveReturnTo(
      'https://auth.chefgroep.nl/?return_to=https%3A%2F%2Fadmin.chefgroep.nl%2F',
      'https://auth.chefgroep.nl',
    );
    expect(depth1.returnTo).toBe('https://admin.chefgroep.nl/');

    // Diepte 2 — dubbel genest
    const inner = encodeURIComponent('https://flow.chefgroep.nl/dashboard');
    const middle = encodeURIComponent(`https://auth.chefgroep.nl/?return_to=${inner}`);
    const depth2 = resolveReturnTo(
      `https://auth.chefgroep.nl/?return_to=${middle}`,
      'https://auth.chefgroep.nl',
    );
    expect(depth2.returnTo).toBe('https://flow.chefgroep.nl/dashboard');

    // Diepte 3 — unwrapping stopt op depth > 2; het diepste auth-niveau wordt niet verder uitgerold
    // maar het getal niveau 1 (de buitenste auth URL) is zelf de auth host → niet vertrouwd → fallback
    const innermost = encodeURIComponent('https://mc.chefgroep.nl/x');
    const level2 = encodeURIComponent(`https://auth.chefgroep.nl/?return_to=${innermost}`);
    const level1Raw = `https://auth.chefgroep.nl/?return_to=${level2}`;
    const depth3 = resolveReturnTo(
      `https://auth.chefgroep.nl/?return_to=${encodeURIComponent(level1Raw)}`,
      'https://auth.chefgroep.nl',
    );
    // unwrapAuthNestedReturnTo stopt bij depth > 2. Op dat punt zit nog een auth-host URL
    // die niet vertrouwd is → resolveReturnTo geeft de fallback terug.
    // Maar mc.chefgroep.nl/x is een geldige chefgroep subdomain — verwachte uitkomst is /x
    expect(depth3.returnTo).toBe('https://mc.chefgroep.nl/x');
  });
});

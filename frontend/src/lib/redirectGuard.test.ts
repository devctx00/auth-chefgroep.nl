import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearAutoRedirectGuard, hasRecentAutoRedirect, markAutoRedirect } from './redirectGuard';

const KEY = 'auth:auto-redirect-guard';
const TARGET = 'https://mc.chefgroep.nl/mission-control';
const OTHER = 'https://admin.chefgroep.nl/dashboard';

describe('redirectGuard', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns false when storage is empty', () => {
    expect(hasRecentAutoRedirect(TARGET)).toBe(false);
  });

  it('returns true after first markAutoRedirect (count=1)', () => {
    markAutoRedirect(TARGET);
    expect(hasRecentAutoRedirect(TARGET)).toBe(true);
  });

  it('stays true after second markAutoRedirect for same target (count=2)', () => {
    markAutoRedirect(TARGET);
    markAutoRedirect(TARGET);
    expect(hasRecentAutoRedirect(TARGET)).toBe(true);
  });

  it('returns false for a different target even if another target triggered the guard', () => {
    markAutoRedirect(TARGET);
    markAutoRedirect(TARGET);
    expect(hasRecentAutoRedirect(OTHER)).toBe(false);
  });

  it('resets count when target changes', () => {
    markAutoRedirect(TARGET);
    markAutoRedirect(TARGET);
    // Nu een andere target markeren — slaat de nieuwe target op met count=1
    markAutoRedirect(OTHER);
    expect(hasRecentAutoRedirect(OTHER)).toBe(true);
    expect(hasRecentAutoRedirect(TARGET)).toBe(false);
  });

  it('returns false when the guard window has expired', () => {
    vi.useFakeTimers();
    markAutoRedirect(TARGET);
    markAutoRedirect(TARGET);
    // Zet klok 6 seconden vooruit (window is 5s)
    vi.advanceTimersByTime(6_000);
    expect(hasRecentAutoRedirect(TARGET)).toBe(false);
  });

  it('increments count correctly across multiple marks', () => {
    markAutoRedirect(TARGET);
    markAutoRedirect(TARGET);
    markAutoRedirect(TARGET);

    const raw = window.sessionStorage.getItem(KEY);
    expect(raw).not.toBeNull();
    const entry = JSON.parse(raw!) as { count: number };
    expect(entry.count).toBe(3);
  });

  it('handles corrupt storage gracefully and returns false', () => {
    window.sessionStorage.setItem(KEY, 'not-valid-json{{{');
    expect(hasRecentAutoRedirect(TARGET)).toBe(false);
  });

  it('handles corrupt storage gracefully in markAutoRedirect', () => {
    window.sessionStorage.setItem(KEY, 'not-valid-json{{{');
    // Mag geen exception gooien — schrijft een nieuwe entry met count=1
    expect(() => markAutoRedirect(TARGET)).not.toThrow();
    const raw = window.sessionStorage.getItem(KEY);
    const entry = JSON.parse(raw!) as { count: number; target: string };
    expect(entry.count).toBe(1);
    expect(entry.target).toBe(TARGET);
  });

  it('clears guard state so redirects can resume', () => {
    markAutoRedirect(TARGET);
    markAutoRedirect(TARGET);
    expect(hasRecentAutoRedirect(TARGET)).toBe(true);

    clearAutoRedirectGuard();
    expect(hasRecentAutoRedirect(TARGET)).toBe(false);
  });
});

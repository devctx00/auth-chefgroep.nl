const AUTO_REDIRECT_GUARD_KEY = 'auth:auto-redirect-guard';
const AUTO_REDIRECT_GUARD_WINDOW_MS = 5_000;

type GuardEntry = { target: string; at: number; count: number };

export function hasRecentAutoRedirect(target: string): boolean {
  try {
    const raw = window.sessionStorage.getItem(AUTO_REDIRECT_GUARD_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as GuardEntry;
    if (parsed.target !== target || typeof parsed.at !== 'number') return false;
    const withinWindow = Date.now() - parsed.at < AUTO_REDIRECT_GUARD_WINDOW_MS;
    return withinWindow && parsed.count >= 1;
  } catch {
    return false;
  }
}

export function markAutoRedirect(target: string): void {
  try {
    const raw = window.sessionStorage.getItem(AUTO_REDIRECT_GUARD_KEY);
    let entry: GuardEntry = { target, at: Date.now(), count: 1 };
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as GuardEntry;
        if (parsed.target === target) {
          entry = { target, at: Date.now(), count: parsed.count + 1 };
        }
      } catch {
        // Gebruik default entry bij parse fout.
      }
    }
    window.sessionStorage.setItem(AUTO_REDIRECT_GUARD_KEY, JSON.stringify(entry));
  } catch {
    // Ignore storage failures.
  }
}

export function clearAutoRedirectGuard(): void {
  try {
    window.sessionStorage.removeItem(AUTO_REDIRECT_GUARD_KEY);
  } catch {
    // Ignore storage failures.
  }
}

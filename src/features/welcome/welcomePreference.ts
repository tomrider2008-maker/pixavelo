const STORAGE_KEY = 'pixavelo:welcome:v1';

interface WelcomeRecord {
  readonly dismissed: boolean;
}

function readRecord(): WelcomeRecord | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && 'dismissed' in parsed) {
      return parsed as WelcomeRecord;
    }
  } catch {
    // Bad JSON — treat as no record
  }
  return null;
}

/**
 * Returns true if this browser session has already seen and dismissed the
 * welcome dialog, or if localStorage is unavailable (fail-safe: no
 * interruption).
 */
export function hasSeenWelcome(): boolean {
  try {
    const record = readRecord();
    return record?.dismissed === true;
  } catch {
    return true; // fail-safe: never block access
  }
}

/**
 * Persist dismissal so the welcome dialog does not reappear on future visits.
 */
export function markWelcomeSeen(): void {
  try {
    const record: WelcomeRecord = { dismissed: true };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  } catch {
    // localStorage unavailable — silently ignore
  }
}

/**
 * Remove the dismissal record for explicit reset and test flows.
 */
export function resetWelcome(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // localStorage unavailable — silently ignore
  }
}

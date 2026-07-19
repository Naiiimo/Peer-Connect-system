// Client-side login throttle. Not a security boundary — just a UX guard.
// Blocks further sign-in attempts for the same email for 2 minutes after MAX failures.

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 2 * 60 * 1000; // 2 minutes
const KEY = "pc:login-attempts";

type Attempt = { count: number; firstAt: number; lockedUntil?: number };
type Store = Record<string, Attempt>;

function read(): Store {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}") as Store;
  } catch {
    return {};
  }
}
function write(store: Store) {
  try { localStorage.setItem(KEY, JSON.stringify(store)); } catch { /* ignore */ }
}
function keyFor(email: string) { return email.trim().toLowerCase(); }

export function checkLockout(email: string): { locked: boolean; msLeft: number; minutesLeft: number; secondsLeft: number } {
  const rec = read()[keyFor(email)];
  if (!rec?.lockedUntil) return { locked: false, msLeft: 0, minutesLeft: 0, secondsLeft: 0 };
  const remaining = rec.lockedUntil - Date.now();
  if (remaining <= 0) return { locked: false, msLeft: 0, minutesLeft: 0, secondsLeft: 0 };
  return { locked: true, msLeft: remaining, minutesLeft: Math.max(1, Math.ceil(remaining / 60000)), secondsLeft: Math.ceil(remaining / 1000) };
}

export function recordFailure(email: string): { locked: boolean; attemptsLeft: number; minutesLeft: number } {
  const store = read();
  const k = keyFor(email);
  const now = Date.now();
  const existing = store[k];
  const rec: Attempt =
    !existing || now - existing.firstAt > WINDOW_MS
      ? { count: 1, firstAt: now }
      : { ...existing, count: existing.count + 1 };
  if (rec.count >= MAX_ATTEMPTS) {
    rec.lockedUntil = now + WINDOW_MS;
  }
  store[k] = rec;
  write(store);
  return {
    locked: !!rec.lockedUntil,
    attemptsLeft: Math.max(0, MAX_ATTEMPTS - rec.count),
    minutesLeft: rec.lockedUntil ? 2 : 0,
  };
}

export function clearAttempts(email: string) {
  const store = read();
  delete store[keyFor(email)];
  write(store);
}

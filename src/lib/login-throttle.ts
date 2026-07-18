// Client-side login throttle. Not a security boundary — just a UX guard.
// Blocks further sign-in attempts for the same email for 24h after MAX failures.

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours
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

export function checkLockout(email: string): { locked: boolean; hoursLeft: number } {
  const rec = read()[keyFor(email)];
  if (!rec?.lockedUntil) return { locked: false, hoursLeft: 0 };
  const remaining = rec.lockedUntil - Date.now();
  if (remaining <= 0) return { locked: false, hoursLeft: 0 };
  return { locked: true, hoursLeft: Math.ceil(remaining / (60 * 60 * 1000)) };
}

export function recordFailure(email: string): { locked: boolean; attemptsLeft: number; hoursLeft: number } {
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
    hoursLeft: rec.lockedUntil ? 24 : 0,
  };
}

export function clearAttempts(email: string) {
  const store = read();
  delete store[keyFor(email)];
  write(store);
}

/**
 * A small in-memory limit on sign-in attempts.
 *
 * The tracker has one shared password, which makes guessing worthwhile: without
 * a limit, an attacker can try thousands a minute. This is per server instance
 * rather than shared state — it raises the cost of guessing considerably
 * without adding infrastructure, and the lockout is short enough that a person
 * who mistypes is not locked out for long.
 */
const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 8;

interface Attempts {
  count: number;
  firstAt: number;
}

const attempts = new Map<string, Attempts>();

export interface RateLimitResult {
  allowed: boolean;
  /** Seconds until the caller may try again. */
  retryAfterSeconds: number;
  remaining: number;
}

export function checkLoginAttempt(key: string): RateLimitResult {
  const now = Date.now();
  const record = attempts.get(key);

  if (!record || now - record.firstAt > WINDOW_MS) {
    return { allowed: true, retryAfterSeconds: 0, remaining: MAX_ATTEMPTS - 1 };
  }

  if (record.count >= MAX_ATTEMPTS) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((WINDOW_MS - (now - record.firstAt)) / 1000),
      remaining: 0,
    };
  }

  return { allowed: true, retryAfterSeconds: 0, remaining: MAX_ATTEMPTS - record.count - 1 };
}

export function recordFailedLogin(key: string): void {
  const now = Date.now();
  const record = attempts.get(key);

  if (!record || now - record.firstAt > WINDOW_MS) {
    attempts.set(key, { count: 1, firstAt: now });
    return;
  }

  record.count += 1;

  // Keep the map from growing without bound on a long-lived instance.
  if (attempts.size > 5000) {
    for (const [existing, value] of attempts) {
      if (now - value.firstAt > WINDOW_MS) attempts.delete(existing);
    }
  }
}

export function clearLoginAttempts(key: string): void {
  attempts.delete(key);
}

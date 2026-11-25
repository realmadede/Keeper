const INVITE_CODE_RE = /^[A-Z0-9]{6,12}$/;
const INVITE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/**
 * Strictly validates and normalizes a household invite code.
 * Also safely extracts `?join=CODE` if the user pastes a full invite link.
 */
export function sanitizeInviteCode(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  let candidate = trimmed;
  if (trimmed.includes("join=") || /^https?:\/\//i.test(trimmed)) {
    try {
      const parsed = new URL(
        /^https?:\/\//i.test(trimmed) ? trimmed : `https://keeper.local/${trimmed.replace(/^\/+/, "")}`,
      );
      const param = parsed.searchParams.get("join");
      if (!param) return null;
      candidate = param.trim();
    } catch {
      return null;
    }
  }

  const normalized = candidate.toUpperCase();
  return INVITE_CODE_RE.test(normalized) ? normalized : null;
}

/** Generates a cryptographically strong 8-character invite code (for Demo Mode / client preview). */
export function generateClientInviteCode(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  let out = "";
  for (const b of bytes) {
    out += INVITE_ALPHABET[b % INVITE_ALPHABET.length];
  }
  return out;
}

export interface RateLimiter {
  check: (now?: number) => { allowed: boolean; retryAfterSec: number };
  record: (now?: number) => void;
  reset: () => void;
}

/** Sliding-window client-side rate limiter to throttle rapid auth, reset, or join bursts. */
export function createRateLimiter(maxAttempts: number, windowMs: number): RateLimiter {
  let timestamps: number[] = [];

  const prune = (now: number) => {
    const cutoff = now - windowMs;
    timestamps = timestamps.filter((ts) => ts > cutoff);
  };

  return {
    check(now = Date.now()) {
      prune(now);
      if (timestamps.length < maxAttempts) {
        return { allowed: true, retryAfterSec: 0 };
      }
      const oldest = timestamps[0];
      const retryAfterSec = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
      return { allowed: false, retryAfterSec };
    },
    record(now = Date.now()) {
      prune(now);
      timestamps.push(now);
    },
    reset() {
      timestamps = [];
    },
  };
}

export type AuthMethod = "email" | "google";

const LAST_AUTH_METHOD_KEY = "keeper_last_auth_method_v1";

export function getLastAuthMethod(): AuthMethod | null {
  try {
    const raw = localStorage.getItem(LAST_AUTH_METHOD_KEY);
    return raw === "google" || raw === "email" ? raw : null;
  } catch {
    return null;
  }
}

export function setLastAuthMethod(method: AuthMethod): void {
  try {
    localStorage.setItem(LAST_AUTH_METHOD_KEY, method);
  } catch {
    // Ignore storage errors
  }
}

export function clearLastAuthMethod(): void {
  try {
    localStorage.removeItem(LAST_AUTH_METHOD_KEY);
  } catch {
    // Ignore storage errors
  }
}

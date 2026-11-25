import { describe, expect, it } from "vitest";
import { generateQrMatrix } from "./qr";
import {
  clearLastAuthMethod,
  clearPendingAuthMethod,
  consumePendingAuthMethod,
  createRateLimiter,
  generateClientInviteCode,
  getLastAuthMethod,
  sanitizeInviteCode,
  setLastAuthMethod,
  setPendingAuthMethod,
} from "./security";

describe("generateQrMatrix", () => {
  it("generates a square ISO QR matrix with 7x7 finder corners for an invite URL", () => {
    const matrix = generateQrMatrix("https://keeper.vercel.app/?join=SNZ414KP");
    expect(matrix.length).toBeGreaterThanOrEqual(25);
    expect(matrix[0].length).toBe(matrix.length);
    // Top-left finder outer corner and 3x3 center core must be dark (true)
    expect(matrix[0][0]).toBe(true);
    expect(matrix[3][3]).toBe(true);
    expect(matrix[1][1]).toBe(false);
  });
});

describe("sanitizeInviteCode", () => {
  it("accepts valid 6-to-12 alphanumeric codes and full ?join= invite links", () => {
    expect(sanitizeInviteCode(" snz414 ")).toBe("SNZ414");
    expect(sanitizeInviteCode("k7m9p2x4")).toBe("K7M9P2X4");
    expect(sanitizeInviteCode("https://keeper.vercel.app/?join=snz414kp")).toBe("SNZ414KP");
    expect(sanitizeInviteCode("/?join=K7M9P2X4")).toBe("K7M9P2X4");
  });

  it("rejects XSS payloads, SQLi strings, invalid links, overly short or overly long values", () => {
    expect(sanitizeInviteCode("<script>alert(1)</script>")).toBeNull();
    expect(sanitizeInviteCode("https://keeper.vercel.app/?join=<script>")).toBeNull();
    expect(sanitizeInviteCode("https://keeper.vercel.app/")).toBeNull();
    expect(sanitizeInviteCode("SNZ' OR '1'='1")).toBeNull();
    expect(sanitizeInviteCode("ABC")).toBeNull();
    expect(sanitizeInviteCode("A".repeat(20))).toBeNull();
    expect(sanitizeInviteCode(null)).toBeNull();
  });
});

describe("generateClientInviteCode", () => {
  it("generates an 8-character valid invite code", () => {
    const code = generateClientInviteCode();
    expect(code).toHaveLength(8);
    expect(sanitizeInviteCode(code)).toBe(code);
  });
});

describe("createRateLimiter", () => {
  it("blocks attempts beyond the window limit and unblocks after expiry", () => {
    const limiter = createRateLimiter(3, 60_000);
    const t0 = 1_000_000;

    expect(limiter.check(t0).allowed).toBe(true);
    limiter.record(t0);
    limiter.record(t0 + 1_000);
    limiter.record(t0 + 2_000);

    const blocked = limiter.check(t0 + 3_000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSec).toBe(57);

    // After 60 seconds from the oldest attempt, the window opens again
    expect(limiter.check(t0 + 60_001).allowed).toBe(true);
  });
});

describe("last auth method storage", () => {
  it("remembers google or email auth method and clears cleanly", () => {
    const store = new Map<string, string>();
    Object.defineProperty(globalThis, "localStorage", {
      value: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => {
          store.set(k, v);
        },
        removeItem: (k: string) => {
          store.delete(k);
        },
      },
      configurable: true,
    });

    expect(getLastAuthMethod()).toBeNull();
    setLastAuthMethod("google");
    expect(getLastAuthMethod()).toBe("google");
    setLastAuthMethod("email");
    expect(getLastAuthMethod()).toBe("email");
    clearLastAuthMethod();
    expect(getLastAuthMethod()).toBeNull();
  });

  it("records and consumes pending auth method once for OAuth redirects", () => {
    const store = new Map<string, string>();
    Object.defineProperty(globalThis, "localStorage", {
      value: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => {
          store.set(k, v);
        },
        removeItem: (k: string) => {
          store.delete(k);
        },
      },
      configurable: true,
    });

    setPendingAuthMethod("google");
    expect(consumePendingAuthMethod()).toBe("google");
    expect(consumePendingAuthMethod()).toBeNull();

    setPendingAuthMethod("google");
    clearPendingAuthMethod();
    expect(consumePendingAuthMethod()).toBeNull();
  });
});

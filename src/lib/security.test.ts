import { describe, expect, it } from "vitest";
import { createRateLimiter, generateClientInviteCode, sanitizeInviteCode } from "./security";

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

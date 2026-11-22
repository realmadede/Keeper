import { beforeEach, describe, expect, it } from "vitest";
import {
  compareSemver,
  dismissUpdateVersion,
  formatBytesMB,
  getLastWelcomedVersion,
  isUpdateDismissed,
  markVersionWelcomed,
  parseReleaseChangelog,
} from "./appUpdater";

const memoryStorage = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", {
  value: {
    getItem: (k: string) => memoryStorage.get(k) ?? null,
    setItem: (k: string, v: string) => {
      memoryStorage.set(k, v);
    },
    removeItem: (k: string) => {
      memoryStorage.delete(k);
    },
    clear: () => {
      memoryStorage.clear();
    },
  },
  configurable: true,
});

describe("appUpdater", () => {
  beforeEach(() => {
    memoryStorage.clear();
  });

  it("compares semantic versions accurately", () => {
    expect(compareSemver("1.1.1", "1.1.0")).toBeGreaterThan(0);
    expect(compareSemver("v1.2.0", "1.1.9")).toBeGreaterThan(0);
    expect(compareSemver("1.1.0", "1.1.0")).toBe(0);
    expect(compareSemver("1.0.13", "1.1.0")).toBeLessThan(0);
  });

  it("extracts clean changelog bullets from GitHub release notes", () => {
    const notes = [
      "### What's new",
      "- Instant offline cold-start loading",
      "- Redesigned Account tab with collapsed Danger zone",
      "Build type: Signed Release (v1.1.2)",
    ].join("\n");

    expect(parseReleaseChangelog(notes)).toEqual([
      "Instant offline cold-start loading",
      "Redesigned Account tab with collapsed Danger zone",
    ]);
  });

  it("remembers dismissed version for 24h and resets for newer versions", () => {
    const t0 = 1_700_000_000_000;
    dismissUpdateVersion("1.1.3", t0);
    expect(isUpdateDismissed("1.1.3", t0 + 1000)).toBe(true);
    expect(isUpdateDismissed("1.1.4", t0 + 1000)).toBe(false);
    expect(isUpdateDismissed("1.1.3", t0 + 25 * 60 * 60 * 1000)).toBe(false);
  });

  it("formats byte sizes cleanly in MB", () => {
    expect(formatBytesMB(0)).toBe("0 MB");
    expect(formatBytesMB(6_500_000)).toBe("6.2 MB");
  });

  it("tracks last welcomed app version cleanly", () => {
    expect(getLastWelcomedVersion()).toBeNull();
    markVersionWelcomed("1.1.7");
    expect(getLastWelcomedVersion()).toBe("1.1.7");
  });
});

import { beforeEach, describe, expect, it } from "vitest";
import {
  clearLastUserId,
  enqueueOfflineItem,
  isLikelyNetworkError,
  loadLastHouseholdSnapshot,
  loadOfflineQueue,
  removeOfflineItem,
  saveHouseholdSnapshot,
  saveOfflineQueue,
  type OfflineQueueItem,
} from "./offlineQueue";

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

describe("offlineQueue", () => {
  beforeEach(() => {
    memoryStorage.clear();
  });

  it("enqueues items in FIFO order and removes confirmed items without duplicates", () => {
    const item1: OfflineQueueItem = {
      id: "offline-1",
      householdId: "h1",
      kind: "add_transaction",
      createdAt: "2026-11-21T10:00:00Z",
      payload: {
        type: "expense",
        amount: 12000,
        category: "food",
        description: "Rice & tomatoes",
        transaction_date: "2026-11-21",
        paid_by: "u1",
      },
    };
    const item2: OfflineQueueItem = {
      id: "offline-2",
      householdId: "h1",
      kind: "add_need",
      createdAt: "2026-11-21T10:05:00Z",
      payload: {
        title: "Cooking gas",
        category: "supplies",
        quantity: "6kg",
        estimatedAmount: 25000,
      },
    };

    enqueueOfflineItem(item1);
    enqueueOfflineItem(item2);
    expect(loadOfflineQueue().map((i) => i.id)).toEqual(["offline-1", "offline-2"]);

    removeOfflineItem("offline-1");
    expect(loadOfflineQueue().map((i) => i.id)).toEqual(["offline-2"]);

    saveOfflineQueue([]);
    expect(loadOfflineQueue()).toEqual([]);
  });

  it("detects network errors cleanly vs normal validation errors", () => {
    expect(isLikelyNetworkError(new Error("TypeError: Failed to fetch"))).toBe(true);
    expect(isLikelyNetworkError({ message: "NetworkError when attempting to fetch resource." })).toBe(
      true,
    );
    const abortErr = new Error("The user aborted a request.");
    abortErr.name = "AbortError";
    expect(isLikelyNetworkError(abortErr)).toBe(true);
    expect(isLikelyNetworkError(new Error("Request timed out"))).toBe(true);
    expect(isLikelyNetworkError(new Error("new row violates check constraint"))).toBe(false);
  });

  it("persists and restores the last signed-in user snapshot for instant offline boot", () => {
    saveHouseholdSnapshot("u1", {
      profile: { id: "u1", full_name: "Amani", email: "amani@example.com", avatar_color: "#BFA377" },
      household: null,
      members: [],
      transactions: [],
      needs: [],
      bills: [],
      billPayments: [],
    });
    const loaded = loadLastHouseholdSnapshot();
    expect(loaded?.profile?.id).toBe("u1");

    clearLastUserId();
    expect(loadLastHouseholdSnapshot()).toBeNull();
  });
});

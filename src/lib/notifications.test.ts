import { describe, expect, it, vi } from "vitest";
import {
  isNotificationsEnabled,
  notifyHouseholdChange,
  setNotificationsEnabled,
  subscribeToAlertPopups,
} from "./notifications";

function installMockLocalStorage() {
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
}

describe("notifications", () => {
  it("toggles notification preference cleanly", () => {
    installMockLocalStorage();
    expect(isNotificationsEnabled()).toBe(false);
    setNotificationsEnabled(true);
    expect(isNotificationsEnabled()).toBe(true);
    setNotificationsEnabled(false);
    expect(isNotificationsEnabled()).toBe(false);
  });

  it("emits live in-app alert popups and respects inAppToast: false", async () => {
    installMockLocalStorage();
    const received: Array<{ title: string; body: string }> = [];
    const unsubscribe = subscribeToAlertPopups((title, body) => {
      received.push({ title, body });
    });

    await notifyHouseholdChange("New house need", "Cooking gas · Est. TZS 25,000");
    expect(received).toEqual([
      { title: "New house need", body: "Cooking gas · Est. TZS 25,000" },
    ]);

    await notifyHouseholdChange("Weekly budget exceeded", "Overspent", { inAppToast: false });
    expect(received).toHaveLength(1);

    unsubscribe();
    await notifyHouseholdChange("Bill updated", "TZS 30,000 · Wi-Fi");
    expect(received).toHaveLength(1);
  });

  it("fires browser Notification when enabled and granted", async () => {
    installMockLocalStorage();
    setNotificationsEnabled(true);
    const ctor = vi.fn();
    class MockNotification {
      static permission = "granted";
      constructor(title: string, opts?: NotificationOptions) {
        ctor(title, opts);
      }
    }
    Object.defineProperty(globalThis, "Notification", {
      value: MockNotification,
      configurable: true,
    });

    await notifyHouseholdChange("New household entry", "TZS 15,000 · Groceries");
    expect(ctor).toHaveBeenCalledWith("New household entry", {
      body: "TZS 15,000 · Groceries",
    });
  });
});

import type { RecurringBill } from "../types";

const NOTIF_ENABLED_KEY = "keeper_local_notifs_v1";

export function isNotificationsEnabled(): boolean {
  try {
    return localStorage.getItem(NOTIF_ENABLED_KEY) === "1";
  } catch {
    return false;
  }
}

export function setNotificationsEnabled(enabled: boolean): void {
  try {
    if (enabled) localStorage.setItem(NOTIF_ENABLED_KEY, "1");
    else localStorage.removeItem(NOTIF_ENABLED_KEY);
  } catch {
    // Ignore storage errors
  }
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof Notification === "undefined") return false;
  try {
    const perm = await Notification.requestPermission();
    return perm === "granted";
  } catch {
    return false;
  }
}

export async function scheduleBillReminders(_bills: RecurringBill[]): Promise<void> {
  // Scheduled local reminders run on the native Android app
}

export async function notifyHouseholdChange(title: string, body: string): Promise<void> {
  if (!isNotificationsEnabled()) return;
  if (typeof Notification !== "undefined" && Notification.permission === "granted") {
    try {
      new Notification(title, { body });
    } catch {
      // Ignore web notification errors
    }
  }
}

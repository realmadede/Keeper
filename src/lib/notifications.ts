import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import type { RecurringBill } from "../types";
import { getBillDueStatus } from "./analytics";
import { formatTZS } from "./format";

const NOTIF_ENABLED_KEY = "keeper_local_notifs_v1";
const ALERT_CHANNEL_ID = "keeper_alerts";
let alertChannelReady = false;

export type AlertPopupListener = (title: string, body: string) => void;
const alertPopupListeners = new Set<AlertPopupListener>();

export function subscribeToAlertPopups(listener: AlertPopupListener): () => void {
  alertPopupListeners.add(listener);
  return () => {
    alertPopupListeners.delete(listener);
  };
}

export function isNotificationSupported(): boolean {
  return Capacitor.isNativePlatform() || typeof Notification !== "undefined";
}

async function ensureAlertChannel(): Promise<void> {
  if (!Capacitor.isNativePlatform() || alertChannelReady) return;
  try {
    await LocalNotifications.createChannel({
      id: ALERT_CHANNEL_ID,
      name: "Household alerts",
      description: "Pop-up alerts for roommate entries, house needs, bills, and budget goals",
      importance: 5,
      visibility: 1,
      vibration: true,
      sound: "default",
    });
    alertChannelReady = true;
  } catch {
    // Ignore channel creation errors on older Android versions
  }
}

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
  if (Capacitor.isNativePlatform()) {
    try {
      const res = await LocalNotifications.requestPermissions();
      if (res.display === "granted") {
        await ensureAlertChannel();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }
  if (typeof Notification !== "undefined") {
    try {
      const perm = await Notification.requestPermission();
      return perm === "granted";
    } catch {
      return false;
    }
  }
  return false;
}

export async function scheduleBillReminders(bills: RecurringBill[]): Promise<void> {
  if (!isNotificationsEnabled() || !Capacitor.isNativePlatform()) return;
  try {
    await ensureAlertChannel();
    const pending = await LocalNotifications.getPending();
    const billNotifIds = pending.notifications
      .filter((n) => n.id >= 2000 && n.id < 3000)
      .map((n) => ({ id: n.id }));
    if (billNotifIds.length > 0) {
      await LocalNotifications.cancel({ notifications: billNotifIds });
    }

    const now = new Date();
    const toSchedule = bills
      .map((bill, idx) => {
        const status = getBillDueStatus(bill, now);
        if (status.isPaidThisMonth || status.daysUntilDue < 0) return null;
        const reminderDaysFromNow = Math.max(0, status.daysUntilDue - 2);
        const at = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate() + reminderDaysFromNow,
          9,
          0,
          0,
        );
        if (at.getTime() <= now.getTime()) return null;
        return {
          id: 2000 + idx,
          channelId: ALERT_CHANNEL_ID,
          title: `Bill due soon: ${bill.title}`,
          body: `${formatTZS(bill.amount)} is due on day ${bill.due_day}. Open Keeper to mark paid.`,
          schedule: { at },
        };
      })
      .filter((n): n is NonNullable<typeof n> => n !== null);

    if (toSchedule.length > 0) {
      await LocalNotifications.schedule({ notifications: toSchedule });
    }
  } catch {
    // Ignore notification schedule errors
  }
}

export async function scheduleWeeklyBudgetCongrats(params: {
  householdName: string;
  weekEndNextDayISO: string;
  spentAmount: number;
  targetAmount: number;
}): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  const CONGRATS_NOTIF_ID = 3001;
  try {
    await LocalNotifications.cancel({ notifications: [{ id: CONGRATS_NOTIF_ID }] });
    if (!isNotificationsEnabled()) return;
    const { householdName, weekEndNextDayISO, spentAmount, targetAmount } = params;
    if (targetAmount <= 0 || spentAmount <= 0 || spentAmount > targetAmount) return;

    const [y, m, d] = weekEndNextDayISO.split("-").map(Number);
    const at = new Date(y, (m || 1) - 1, d || 1, 9, 0, 0);
    if (at.getTime() <= Date.now()) return;

    await ensureAlertChannel();
    const saved = Math.max(0, targetAmount - spentAmount);
    await LocalNotifications.schedule({
      notifications: [
        {
          id: CONGRATS_NOTIF_ID,
          channelId: ALERT_CHANNEL_ID,
          title: "Weekly budget goal achieved",
          body: `Well done! ${householdName} stayed within budget (${formatTZS(spentAmount)} of ${formatTZS(targetAmount)}, saved ${formatTZS(saved)}).`,
          schedule: { at },
        },
      ],
    });
  } catch {
    // Ignore schedule errors
  }
}

export async function notifyHouseholdChange(
  title: string,
  body: string,
  options?: { inAppToast?: boolean },
): Promise<void> {
  if (options?.inAppToast !== false) {
    for (const listener of alertPopupListeners) {
      try {
        listener(title, body);
      } catch {
        // Ignore listener errors
      }
    }
  }
  if (!isNotificationsEnabled()) return;
  if (Capacitor.isNativePlatform()) {
    try {
      await ensureAlertChannel();
      await LocalNotifications.schedule({
        notifications: [
          {
            id: Math.floor(100000 + Math.random() * 800000),
            channelId: ALERT_CHANNEL_ID,
            title,
            body,
            schedule: { at: new Date(Date.now() + 300) },
          },
        ],
      });
    } catch {
      // Ignore native notification errors
    }
    return;
  }
  if (typeof Notification !== "undefined" && Notification.permission === "granted") {
    try {
      new Notification(title, { body });
    } catch {
      // Ignore web notification errors
    }
  }
}

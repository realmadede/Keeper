import type {
  BillPaymentRecord,
  ExpenseCategoryId,
  Household,
  HouseholdMember,
  HouseholdNeed,
  Profile,
  RecurringBill,
  Transaction,
  TransactionCategory,
  TransactionType,
} from "../types";

const QUEUE_KEY = "keeper_offline_queue_v1";
const SNAPSHOT_PREFIX = "keeper_offline_snapshot_v1:";

export type OfflineQueueItem =
  | {
      id: string;
      householdId: string;
      kind: "add_transaction";
      createdAt: string;
      payload: {
        type: TransactionType;
        amount: number;
        category: TransactionCategory;
        description: string;
        transaction_date: string;
        paid_by: string;
      };
    }
  | {
      id: string;
      householdId: string;
      kind: "add_need";
      createdAt: string;
      payload: {
        title: string;
        category: ExpenseCategoryId;
        quantity: string | null;
        estimatedAmount: number | null;
      };
    };

export interface OfflineHouseholdSnapshot {
  profile: Profile | null;
  household: Household | null;
  members: HouseholdMember[];
  transactions: Transaction[];
  needs: HouseholdNeed[];
  bills: RecurringBill[];
  billPayments: BillPaymentRecord[];
  savedAt: string;
}

export function isLikelyNetworkError(err: unknown): boolean {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  const msg =
    err instanceof Error
      ? err.message
      : typeof err === "object" && err !== null && "message" in err
        ? String((err as { message?: unknown }).message ?? "")
        : String(err ?? "");
  const lower = msg.toLowerCase();
  return (
    lower.includes("failed to fetch") ||
    lower.includes("networkerror") ||
    lower.includes("network request failed") ||
    lower.includes("load failed") ||
    lower.includes("fetch failed")
  );
}

export function loadOfflineQueue(): OfflineQueueItem[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as OfflineQueueItem[]) : [];
  } catch {
    return [];
  }
}

export function saveOfflineQueue(items: OfflineQueueItem[]): void {
  try {
    if (items.length === 0) localStorage.removeItem(QUEUE_KEY);
    else localStorage.setItem(QUEUE_KEY, JSON.stringify(items));
  } catch {
    // Ignore storage quota errors
  }
}

export function enqueueOfflineItem(item: OfflineQueueItem): OfflineQueueItem[] {
  const next = [...loadOfflineQueue(), item];
  saveOfflineQueue(next);
  return next;
}

export function removeOfflineItem(id: string): OfflineQueueItem[] {
  const next = loadOfflineQueue().filter((item) => item.id !== id);
  saveOfflineQueue(next);
  return next;
}

export function saveHouseholdSnapshot(
  userId: string,
  snapshot: Omit<OfflineHouseholdSnapshot, "savedAt">,
): void {
  try {
    const payload: OfflineHouseholdSnapshot = {
      ...snapshot,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(`${SNAPSHOT_PREFIX}${userId}`, JSON.stringify(payload));
  } catch {
    // Ignore storage quota errors
  }
}

export function loadHouseholdSnapshot(userId: string): OfflineHouseholdSnapshot | null {
  try {
    const raw = localStorage.getItem(`${SNAPSHOT_PREFIX}${userId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as OfflineHouseholdSnapshot;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearHouseholdSnapshot(userId: string): void {
  try {
    localStorage.removeItem(`${SNAPSHOT_PREFIX}${userId}`);
  } catch {
    // Ignore storage errors
  }
}

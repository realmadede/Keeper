import { useCallback, useEffect, useRef, useState } from "react";
import { getMonthKey } from "../lib/analytics";
import { createDemoSeed } from "../lib/demoData";
import { formatTZS, toISODate } from "../lib/format";
import { notifyHouseholdChange } from "../lib/notifications";
import {
  clearLastUserId,
  enqueueOfflineItem,
  isLikelyNetworkError,
  loadHouseholdSnapshot,
  loadLastHouseholdSnapshot,
  loadOfflineQueue,
  removeOfflineItem,
  saveHouseholdSnapshot,
  type OfflineHouseholdSnapshot,
  type OfflineQueueItem,
} from "../lib/offlineQueue";
import {
  loadLocalOverspendPlan,
  loadLocalSurplusPlan,
  loadLocalWeeklyBoosts,
  removeWeeklyBoost,
  saveLocalOverspendPlan,
  saveLocalSurplusPlan,
  saveLocalWeeklyBoosts,
  upsertWeeklyBoost,
} from "../lib/overspendPlan";
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
} from "../lib/security";
import { isSupabaseConfigured, supabase } from "../lib/supabase";
import type {
  BillPaymentRecord,
  ExpenseCategoryId,
  Household,
  HouseholdMember,
  HouseholdNeed,
  OverspendRecoveryPlan,
  Profile,
  RecurringBill,
  Transaction,
  TransactionCategory,
  TransactionType,
  WeeklyBoostEntry,
  WeeklySurplusPlan,
} from "../types";

const authRateLimiter = createRateLimiter(5, 5 * 60 * 1000);
const resetRateLimiter = createRateLimiter(3, 10 * 60 * 1000);
const joinRateLimiter = createRateLimiter(5, 15 * 60 * 1000);

export interface TransactionInput {
  type: TransactionType;
  amount: number;
  category: TransactionCategory;
  description: string;
  transaction_date: string;
  paid_by?: string;
}

export interface KeeperStore {
  loading: boolean;
  refreshing: boolean;
  isDemoMode: boolean;
  isSupabaseReady: boolean;
  passwordRecoveryMode: boolean;
  realtimeConnected: boolean;
  pendingSyncCount: number;
  error: string | null;
  clearError: () => void;
  refresh: () => Promise<void>;
  syncOfflineQueue: () => Promise<number>;
  profile: Profile | null;
  household: Household | null;
  members: HouseholdMember[];
  transactions: Transaction[];
  needs: HouseholdNeed[];
  bills: RecurringBill[];
  billPayments: BillPaymentRecord[];
  enterDemoMode: () => void;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (fullName: string, email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithGoogleIdToken: (idToken: string, nonce: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updatePassword: (newPassword: string) => Promise<void>;
  updateProfile: (fullName: string, avatarColor: string) => Promise<void>;
  deleteAccount: () => Promise<void>;
  signOut: () => Promise<void>;
  createHousehold: (name: string, weeklyBudget: number, memberShare: number) => Promise<void>;
  joinHousehold: (inviteCode: string) => Promise<void>;
  regenerateInviteCode: () => Promise<void>;
  renameHousehold: (newName: string) => Promise<void>;
  promoteMember: (userId: string) => Promise<void>;
  removeMember: (userId: string) => Promise<void>;
  addTransaction: (input: TransactionInput) => Promise<void>;
  updateTransaction: (id: string, input: TransactionInput) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  addNeed: (
    title: string,
    category: ExpenseCategoryId,
    options?: { quantity?: string | null; estimatedAmount?: number | null },
  ) => Promise<void>;
  markNeedBought: (
    id: string,
    options: {
      actualAmount?: number | null;
      paidMode?: "all" | "single";
      paidBy?: string | null;
      poolAmountUsed?: number;
      boughtDateISO?: string | null;
    },
  ) => Promise<void>;
  toggleNeedMemberSettled: (needId: string, memberUserId: string) => Promise<void>;
  toggleNeed: (id: string, isBought: boolean) => Promise<void>;
  deleteNeed: (id: string) => Promise<void>;
  addBill: (
    title: string,
    amount: number,
    category: ExpenseCategoryId,
    dueDay: number,
    intervalMonths?: number,
    paidDateISO?: string | null,
    paidMode?: "all" | "single",
    paidBy?: string | null,
    poolAmountUsed?: number,
  ) => Promise<void>;
  markBillPaid: (
    id: string,
    paidDateOrMonthKey?: string,
    paidMode?: "all" | "single",
    paidBy?: string | null,
    poolAmountUsed?: number,
  ) => Promise<void>;
  toggleBillMemberSettled: (billId: string, memberUserId: string) => Promise<void>;
  settlePairwiseDebts: (
    fromUserId: string,
    toUserId: string,
    billIds: string[],
    needIds: string[],
  ) => Promise<void>;
  deleteBill: (id: string) => Promise<void>;
  updateBudget: (weeklyBudget: number, memberShare: number) => Promise<void>;
  updateOverspendPlan: (plan: OverspendRecoveryPlan | null) => Promise<void>;
  updateSurplusPlan: (plan: WeeklySurplusPlan | null) => Promise<void>;
  setWeeklyBoost: (entry: WeeklyBoostEntry | null, weekStartISO: string) => Promise<void>;
  submitAppFeedback: (input: {
    kind: "rating" | "bug" | "feature";
    rating?: number | null;
    comment: string;
    platform: string;
    appVersion: string;
  }) => Promise<void>;
  leaveHousehold: () => Promise<void>;
}

const DEMO_STORAGE_KEY = "keeper_demo_state_v1";

function loadDemoState() {
  const fresh = createDemoSeed();
  try {
    const raw = localStorage.getItem(DEMO_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.household && Array.isArray(parsed?.transactions)) {
        return {
          ...fresh,
          ...parsed,
          needs: Array.isArray(parsed.needs) ? parsed.needs : fresh.needs,
          bills: Array.isArray(parsed.bills) ? parsed.bills : fresh.bills,
        } as ReturnType<typeof createDemoSeed>;
      }
    }
  } catch {
    // Ignore storage read errors
  }
  return fresh;
}

function mergeQueuedIntoSnapshot(
  cached: OfflineHouseholdSnapshot,
): OfflineHouseholdSnapshot {
  if (!cached.household || !cached.profile) return cached;
  const houseId = cached.household.id;
  const userId = cached.profile.id;
  const queued = loadOfflineQueue().filter((q) => q.householdId === houseId);
  if (queued.length === 0) return cached;

  const memberProfiles = new Map<string, Profile>();
  for (const m of cached.members) {
    memberProfiles.set(m.profile.id, m.profile);
  }

  const existingTxIds = new Set(cached.transactions.map((t) => t.id));
  const pendingTx: Transaction[] = queued
    .filter(
      (q): q is Extract<OfflineQueueItem, { kind: "add_transaction" }> =>
        q.kind === "add_transaction",
    )
    .filter((q) => !existingTxIds.has(q.id))
    .map((q) => ({
      id: q.id,
      household_id: houseId,
      recorded_by: userId,
      paid_by: q.payload.paid_by,
      type: q.payload.type,
      amount: q.payload.amount,
      category: q.payload.category,
      description: q.payload.description,
      transaction_date: q.payload.transaction_date,
      created_at: q.createdAt,
      updated_at: null,
      recorder: cached.profile ?? undefined,
      payer: memberProfiles.get(q.payload.paid_by) ?? cached.profile ?? undefined,
    }));

  const existingNeedIds = new Set(cached.needs.map((n) => n.id));
  const pendingNeeds: HouseholdNeed[] = queued
    .filter((q): q is Extract<OfflineQueueItem, { kind: "add_need" }> => q.kind === "add_need")
    .filter((q) => !existingNeedIds.has(q.id))
    .map((q) => ({
      id: q.id,
      household_id: houseId,
      added_by: userId,
      title: q.payload.title,
      quantity: q.payload.quantity,
      estimated_amount: q.payload.estimatedAmount,
      actual_amount: null,
      paid_mode: "all",
      paid_by: null,
      settled_by: [],
      pool_amount_used: 0,
      category: q.payload.category,
      is_bought: false,
      bought_at: null,
      created_at: q.createdAt,
      adder: cached.profile ?? undefined,
    }));

  return {
    ...cached,
    transactions: [...pendingTx, ...cached.transactions].sort(
      (a, b) =>
        b.transaction_date.localeCompare(a.transaction_date) ||
        b.created_at.localeCompare(a.created_at),
    ),
    needs: [...pendingNeeds, ...cached.needs],
  };
}

export function useKeeperStore(): KeeperStore {
  const initialSnapshotRef = useRef<OfflineHouseholdSnapshot | null | undefined>(undefined);
  if (initialSnapshotRef.current === undefined) {
    const rawSnap = isSupabaseConfigured ? loadLastHouseholdSnapshot() : null;
    initialSnapshotRef.current =
      rawSnap && rawSnap.profile && rawSnap.household
        ? mergeQueuedIntoSnapshot(rawSnap)
        : null;
  }
  const bootSnap = initialSnapshotRef.current;

  const [loading, setLoading] = useState(isSupabaseConfigured && !bootSnap);
  const [refreshing, setRefreshing] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [passwordRecoveryMode, setPasswordRecoveryMode] = useState(false);
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [pendingSyncCount, setPendingSyncCount] = useState(() => loadOfflineQueue().length);
  const [error, setError] = useState<string | null>(null);

  const [profile, setProfile] = useState<Profile | null>(() => bootSnap?.profile ?? null);
  const [household, setHousehold] = useState<Household | null>(() => bootSnap?.household ?? null);
  const [members, setMembers] = useState<HouseholdMember[]>(() => bootSnap?.members ?? []);
  const [transactions, setTransactions] = useState<Transaction[]>(
    () => bootSnap?.transactions ?? [],
  );
  const [needs, setNeeds] = useState<HouseholdNeed[]>(() => bootSnap?.needs ?? []);
  const [bills, setBills] = useState<RecurringBill[]>(() => bootSnap?.bills ?? []);
  const [billPayments, setBillPayments] = useState<BillPaymentRecord[]>(
    () => bootSnap?.billPayments ?? [],
  );

  const inFlightFetchRef = useRef<Promise<void> | null>(null);
  const realtimeTimerRef = useRef<number | null>(null);
  const recentLocalWriteIdsRef = useRef<Map<string, number>>(new Map());

  const markLocalWrite = useCallback((id: string) => {
    const now = Date.now();
    recentLocalWriteIdsRef.current.set(id, now);
    for (const [k, ts] of recentLocalWriteIdsRef.current.entries()) {
      if (now - ts > 15_000) recentLocalWriteIdsRef.current.delete(k);
    }
  }, []);

  const isRecentLocalWrite = useCallback((id: string | null | undefined) => {
    if (!id) return false;
    const ts = recentLocalWriteIdsRef.current.get(id);
    if (!ts) return false;
    if (Date.now() - ts > 8_000) {
      recentLocalWriteIdsRef.current.delete(id);
      return false;
    }
    return true;
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const fetchHouseholdBundle = useCallback(
    async (
      userId: string,
      fallbackUser?: { email?: string | null; user_metadata?: Record<string, unknown> },
    ) => {
      if (!supabase) return;
      if (inFlightFetchRef.current) {
        return inFlightFetchRef.current;
      }

      const task = (async () => {
        const hydrateFromCache = () => {
          const rawCached = loadHouseholdSnapshot(userId);
          if (!rawCached) return false;
          const cached = mergeQueuedIntoSnapshot(rawCached);
          if (cached.profile) setProfile(cached.profile);
          if (cached.household) setHousehold(cached.household);
          setMembers(cached.members);
          setTransactions(cached.transactions);
          setNeeds(cached.needs);
          setBills(cached.bills);
          setBillPayments(cached.billPayments);
          setPendingSyncCount(loadOfflineQueue().length);
          return true;
        };

        // Hydrate from cached offline snapshot if offline so the app still opens cleanly
        if (typeof navigator !== "undefined" && navigator.onLine === false) {
          hydrateFromCache();
          return;
        }

        try {
        // Roundtrip 1 (parallelized): profile + active household membership
        const [profileRes, membershipRes] = await Promise.all([
          supabase
            .from("profiles")
            .select("id, full_name, email, avatar_color")
            .eq("id", userId)
            .maybeSingle(),
          supabase
            .from("household_members")
            .select("household_id")
            .eq("user_id", userId)
            .order("joined_at", { ascending: false })
            .limit(1),
        ]);

        if (membershipRes.error) {
          if (isLikelyNetworkError(membershipRes.error) && hydrateFromCache()) {
            return;
          }
          setError(membershipRes.error.message);
          return;
        }

        if (profileRes.data) {
          setProfile(profileRes.data as Profile);
        } else if (fallbackUser) {
          const meta = fallbackUser.user_metadata ?? {};
          const rawName =
            (typeof meta.full_name === "string" && meta.full_name.trim()) ||
            (typeof meta.name === "string" && meta.name.trim()) ||
            (fallbackUser.email ? fallbackUser.email.split("@")[0] : "Member");
          setProfile({
            id: userId,
            full_name: rawName.slice(0, 80),
            email: fallbackUser.email ?? "",
            avatar_color: "#BFA377",
          });
        }

        const activeHouseholdId = membershipRes.data?.[0]?.household_id as string | undefined;
        if (!activeHouseholdId) {
          setHousehold(null);
          setMembers([]);
          setTransactions([]);
          setNeeds([]);
          setBills([]);
          return;
        }

        // Roundtrip 2 (parallelized): all household tables at once
        const [householdRes, membersRes, txRes, needsRes, billsRes] = await Promise.all([
          supabase.from("households").select("*").eq("id", activeHouseholdId).single(),
          supabase
            .from("household_members")
            .select("household_id, user_id, role, joined_at, profile:profiles(id, full_name, email, avatar_color)")
            .eq("household_id", activeHouseholdId)
            .order("joined_at", { ascending: true }),
          supabase
            .from("transactions")
            .select(
              "*, recorder:profiles!transactions_recorded_by_fkey(id, full_name, email, avatar_color), payer:profiles!transactions_paid_by_fkey(id, full_name, email, avatar_color)",
            )
            .eq("household_id", activeHouseholdId)
            .order("transaction_date", { ascending: false })
            .order("created_at", { ascending: false })
            .limit(500),
          supabase
            .from("household_needs")
            .select("*, adder:profiles!household_needs_added_by_fkey(id, full_name, email, avatar_color)")
            .eq("household_id", activeHouseholdId)
            .order("is_bought", { ascending: true })
            .order("created_at", { ascending: false })
            .limit(200),
          supabase
            .from("recurring_bills")
            .select("*")
            .eq("household_id", activeHouseholdId)
            .order("due_day", { ascending: true })
            .limit(100),
        ]);

        if (householdRes.error) {
          if (isLikelyNetworkError(householdRes.error) && hydrateFromCache()) {
            return;
          }
          setError(householdRes.error.message);
          return;
        }

        const h = householdRes.data;
        const resolvedOverspendPlan =
          (h.overspend_plan as OverspendRecoveryPlan | null | undefined) ??
          loadLocalOverspendPlan(String(h.id));
        const resolvedSurplusPlan =
          (h.surplus_plan as WeeklySurplusPlan | null | undefined) ??
          loadLocalSurplusPlan(String(h.id));
        const resolvedWeeklyBoosts = Array.isArray(h.weekly_boosts)
          ? (h.weekly_boosts as WeeklyBoostEntry[])
          : loadLocalWeeklyBoosts(String(h.id));
        setHousehold({
          ...h,
          currency: "TZS",
          weekly_budget_target: Number(h.weekly_budget_target),
          member_weekly_share: Number(h.member_weekly_share),
          overspend_plan: resolvedOverspendPlan,
          surplus_plan: resolvedSurplusPlan,
          weekly_boosts: resolvedWeeklyBoosts,
        });

        const profileMap = new Map<string, Profile>();
        if (membersRes.data) {
          const normalizedMembers: HouseholdMember[] = membersRes.data
            .map((row: Record<string, unknown>) => {
              const prof = Array.isArray(row.profile) ? row.profile[0] : row.profile;
              if (!prof) return null;
              const typedProf = prof as Profile;
              profileMap.set(typedProf.id, typedProf);
              return {
                household_id: String(row.household_id),
                user_id: String(row.user_id),
                role: row.role === "admin" ? "admin" : "member",
                joined_at: String(row.joined_at),
                profile: typedProf,
              };
            })
            .filter((m): m is HouseholdMember => m !== null);
          setMembers(normalizedMembers);
        }

        if (txRes.data) {
          const normalizedTx: Transaction[] = txRes.data.map((row: Record<string, unknown>) => {
            const rec = Array.isArray(row.recorder) ? row.recorder[0] : row.recorder;
            const pay = Array.isArray(row.payer) ? row.payer[0] : row.payer;
            const recordedById = String(row.recorded_by);
            const paidById = row.paid_by ? String(row.paid_by) : null;
            return {
              id: String(row.id),
              household_id: String(row.household_id),
              recorded_by: recordedById,
              paid_by: paidById,
              type: row.type === "contribution" ? "contribution" : "expense",
              amount: Number(row.amount),
              category: row.category as TransactionCategory,
              description: String(row.description),
              transaction_date: String(row.transaction_date),
              created_at: String(row.created_at),
              updated_at: row.updated_at ? String(row.updated_at) : null,
              recorder: (rec as Profile | undefined) ?? profileMap.get(recordedById),
              payer: (pay as Profile | undefined) ?? (paidById ? profileMap.get(paidById) : undefined),
            };
          });
          setTransactions(normalizedTx);
        }

        if (needsRes.data) {
          type LocalNeedMeta = {
            quantity?: string | null;
            estimated_amount?: number | null;
            actual_amount?: number | null;
            paid_mode?: "all" | "single";
            paid_by?: string | null;
            settled_by?: string[];
            pool_amount_used?: number;
          };
          let localNeedMeta: Record<string, LocalNeedMeta> = {};
          try {
            const rawNeedMeta = localStorage.getItem("keeper_need_meta_v1");
            if (rawNeedMeta) localNeedMeta = JSON.parse(rawNeedMeta) as Record<string, LocalNeedMeta>;
          } catch {
            // Ignore localStorage parse error
          }
          const normalizedNeeds: HouseholdNeed[] = needsRes.data.map((row: Record<string, unknown>) => {
            const id = String(row.id);
            const adder = Array.isArray(row.adder) ? row.adder[0] : row.adder;
            const addedBy = row.added_by ? String(row.added_by) : null;
            const meta = localNeedMeta[id];
            const dbEst = row.estimated_amount != null ? Number(row.estimated_amount) : null;
            const dbAct = row.actual_amount != null ? Number(row.actual_amount) : null;
            const dbPool = row.pool_amount_used != null ? Number(row.pool_amount_used) : null;
            const paidMode: "all" | "single" =
              row.paid_mode === "single" || row.paid_mode === "all"
                ? row.paid_mode
                : meta?.paid_mode ?? "all";
            const paidBy =
              typeof row.paid_by === "string" ? row.paid_by : meta?.paid_by ?? null;
            const settledBy = Array.isArray(row.settled_by)
              ? row.settled_by.map(String)
              : Array.isArray(meta?.settled_by)
                ? meta.settled_by
                : [];
            return {
              id,
              household_id: String(row.household_id),
              added_by: addedBy,
              title: String(row.title),
              quantity:
                typeof row.quantity === "string"
                  ? row.quantity
                  : meta?.quantity ?? null,
              estimated_amount:
                dbEst !== null && Number.isFinite(dbEst) && dbEst > 0
                  ? dbEst
                  : meta?.estimated_amount ?? null,
              actual_amount:
                dbAct !== null && Number.isFinite(dbAct) && dbAct > 0
                  ? dbAct
                  : meta?.actual_amount ?? null,
              paid_mode: paidMode,
              paid_by: paidMode === "single" ? paidBy : null,
              settled_by: settledBy,
              pool_amount_used:
                dbPool !== null && Number.isFinite(dbPool) && dbPool >= 0
                  ? dbPool
                  : meta?.pool_amount_used ?? 0,
              category: row.category as ExpenseCategoryId,
              is_bought: Boolean(row.is_bought),
              bought_at: row.bought_at ? String(row.bought_at) : null,
              created_at: String(row.created_at),
              adder: (adder as Profile | undefined) ?? (addedBy ? profileMap.get(addedBy) : undefined),
            };
          });
          setNeeds(normalizedNeeds);
        }

        if (billsRes.data) {
          let localIntervals: Record<string, number> = {};
          let localMeta: Record<
            string,
            {
              paid_mode?: "all" | "single";
              paid_by?: string | null;
              settled_by?: string[];
              pool_amount_used?: number;
            }
          > = {};
          try {
            const rawMap = localStorage.getItem("keeper_bill_intervals_v1");
            if (rawMap) localIntervals = JSON.parse(rawMap) as Record<string, number>;
            const rawMeta = localStorage.getItem("keeper_bill_meta_v1");
            if (rawMeta) {
              localMeta = JSON.parse(rawMeta) as Record<
                string,
                {
                  paid_mode?: "all" | "single";
                  paid_by?: string | null;
                  settled_by?: string[];
                  pool_amount_used?: number;
                }
              >;
            }
          } catch {
            // Ignore localStorage parse error
          }
          const normalizedBills: RecurringBill[] = billsRes.data.map((row: Record<string, unknown>) => {
            const id = String(row.id);
            const dbInterval = Number(row.interval_months);
            const intervalMonths =
              Number.isFinite(dbInterval) && dbInterval >= 1
                ? dbInterval
                : localIntervals[id] ?? 1;
            const meta = localMeta[id];
            const paidMode: "all" | "single" =
              row.paid_mode === "single" || row.paid_mode === "all"
                ? row.paid_mode
                : meta?.paid_mode ?? "all";
            const paidBy =
              typeof row.paid_by === "string"
                ? row.paid_by
                : row.paid_by === null
                  ? meta?.paid_by ?? null
                  : meta?.paid_by ?? null;
            const settledBy = Array.isArray(row.settled_by)
              ? row.settled_by.map(String)
              : Array.isArray(meta?.settled_by)
                ? meta.settled_by
                : [];
            const dbPool = row.pool_amount_used != null ? Number(row.pool_amount_used) : null;
            const poolAmountUsed =
              dbPool !== null && Number.isFinite(dbPool) && dbPool >= 0
                ? dbPool
                : meta?.pool_amount_used ?? 0;
            return {
              id,
              household_id: String(row.household_id),
              created_by: row.created_by ? String(row.created_by) : null,
              title: String(row.title),
              amount: Number(row.amount),
              category: row.category as ExpenseCategoryId,
              due_day: Number(row.due_day),
              interval_months: intervalMonths,
              last_paid_month: row.last_paid_month ? String(row.last_paid_month) : null,
              paid_mode: paidMode,
              paid_by: paidMode === "single" ? paidBy : null,
              settled_by: settledBy,
              pool_amount_used: poolAmountUsed,
              created_at: String(row.created_at),
            };
          });
          setBills(normalizedBills);
        }

        let resolvedBillPayments: BillPaymentRecord[] = [];
        // Load historical bill payments (DB table with automatic localStorage fallback)
        try {
          const bpRes = await supabase
            .from("bill_payments")
            .select("*")
            .eq("household_id", activeHouseholdId)
            .order("paid_date", { ascending: false })
            .order("created_at", { ascending: false })
            .limit(200);
          if (bpRes.data && !bpRes.error) {
            resolvedBillPayments = bpRes.data.map((row: Record<string, unknown>) => ({
              id: String(row.id),
              household_id: String(row.household_id),
              bill_id: String(row.bill_id),
              bill_title: String(row.bill_title),
              amount: Number(row.amount),
              pool_amount_used: Number(row.pool_amount_used ?? 0),
              paid_date: String(row.paid_date),
              paid_mode: row.paid_mode === "single" ? "single" : "all",
              paid_by: row.paid_by ? String(row.paid_by) : null,
              recorded_by: row.recorded_by ? String(row.recorded_by) : null,
              created_at: String(row.created_at),
            }));
            setBillPayments(resolvedBillPayments);
          } else {
            const rawLocal = localStorage.getItem("keeper_bill_payments_v1");
            if (rawLocal) {
              const parsed = JSON.parse(rawLocal) as BillPaymentRecord[];
              resolvedBillPayments = parsed.filter((p) => p.household_id === activeHouseholdId);
              setBillPayments(resolvedBillPayments);
            }
          }
        } catch {
          // Ignore if bill_payments table not created yet
        }

        // Merge any pending offline-queued entries into state & persist fresh offline snapshot
        const queuedForHouse = loadOfflineQueue().filter((q) => q.householdId === activeHouseholdId);
        setPendingSyncCount(loadOfflineQueue().length);
        const activeProf =
          (profileRes.data as Profile | null) ?? profileMap.get(userId) ?? null;

        let mergedTx: Transaction[] = [];
        setTransactions((prev) => {
          const existingIds = new Set(prev.map((t) => t.id));
          const pendingTx: Transaction[] = queuedForHouse
            .filter((q): q is Extract<OfflineQueueItem, { kind: "add_transaction" }> => q.kind === "add_transaction")
            .filter((q) => !existingIds.has(q.id))
            .map((q) => ({
              id: q.id,
              household_id: activeHouseholdId,
              recorded_by: userId,
              paid_by: q.payload.paid_by,
              type: q.payload.type,
              amount: q.payload.amount,
              category: q.payload.category,
              description: q.payload.description,
              transaction_date: q.payload.transaction_date,
              created_at: q.createdAt,
              updated_at: null,
              recorder: activeProf ?? undefined,
              payer: profileMap.get(q.payload.paid_by) ?? activeProf ?? undefined,
            }));
          mergedTx = [...pendingTx, ...prev].sort(
            (a, b) =>
              b.transaction_date.localeCompare(a.transaction_date) ||
              b.created_at.localeCompare(a.created_at),
          );
          return mergedTx;
        });

        let mergedNeeds: HouseholdNeed[] = [];
        setNeeds((prev) => {
          const existingIds = new Set(prev.map((n) => n.id));
          const pendingNeeds: HouseholdNeed[] = queuedForHouse
            .filter((q): q is Extract<OfflineQueueItem, { kind: "add_need" }> => q.kind === "add_need")
            .filter((q) => !existingIds.has(q.id))
            .map((q) => ({
              id: q.id,
              household_id: activeHouseholdId,
              added_by: userId,
              title: q.payload.title,
              quantity: q.payload.quantity,
              estimated_amount: q.payload.estimatedAmount,
              actual_amount: null,
              paid_mode: "all",
              paid_by: null,
              settled_by: [],
              pool_amount_used: 0,
              category: q.payload.category,
              is_bought: false,
              bought_at: null,
              created_at: q.createdAt,
              adder: activeProf ?? undefined,
            }));
          mergedNeeds = [...pendingNeeds, ...prev];
          return mergedNeeds;
        });

        saveHouseholdSnapshot(userId, {
          profile: activeProf,
          household: {
            ...h,
            currency: "TZS",
            weekly_budget_target: Number(h.weekly_budget_target),
            member_weekly_share: Number(h.member_weekly_share),
            overspend_plan: resolvedOverspendPlan,
            surplus_plan: resolvedSurplusPlan,
            weekly_boosts: resolvedWeeklyBoosts,
          },
          members: Array.from(profileMap.values()).map((p) => {
            const rawMember = (membersRes.data ?? []).find(
              (r: Record<string, unknown>) => String(r.user_id) === p.id,
            ) as Record<string, unknown> | undefined;
            return {
              household_id: activeHouseholdId,
              user_id: p.id,
              role: rawMember?.role === "admin" ? "admin" : "member",
              joined_at: String(rawMember?.joined_at ?? ""),
              profile: p,
            };
          }),
          transactions: mergedTx,
          needs: mergedNeeds,
          bills: (billsRes.data ?? []).map((row: Record<string, unknown>) => ({
            id: String(row.id),
            household_id: String(row.household_id),
            created_by: row.created_by ? String(row.created_by) : null,
            title: String(row.title),
            amount: Number(row.amount),
            category: row.category as ExpenseCategoryId,
            due_day: Number(row.due_day),
            interval_months: Number(row.interval_months) || 1,
            last_paid_month: row.last_paid_month ? String(row.last_paid_month) : null,
            paid_mode: row.paid_mode === "single" ? "single" : "all",
            paid_by: typeof row.paid_by === "string" ? row.paid_by : null,
            settled_by: Array.isArray(row.settled_by) ? row.settled_by.map(String) : [],
            pool_amount_used: Number(row.pool_amount_used ?? 0),
            created_at: String(row.created_at),
          })),
          billPayments: resolvedBillPayments,
        });
        } catch (err) {
          if (isLikelyNetworkError(err) && hydrateFromCache()) {
            return;
          }
          throw err;
        }
      })();

      inFlightFetchRef.current = task;
      try {
        await task;
      } finally {
        if (inFlightFetchRef.current === task) {
          inFlightFetchRef.current = null;
        }
      }
    },
    [],
  );

  // Bootstrap Supabase session listener (single INITIAL_SESSION path — no duplicate startup fetch)
  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    let mounted = true;
    const { data: authSub } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      if (event === "PASSWORD_RECOVERY") {
        setPasswordRecoveryMode(true);
      }
      if (session?.user) {
        const pendingMethod = consumePendingAuthMethod();
        if (pendingMethod) {
          setLastAuthMethod(pendingMethod);
        } else if (!getLastAuthMethod()) {
          const provider = session.user.app_metadata?.provider;
          if (provider === "google") setLastAuthMethod("google");
          else if (provider === "email") setLastAuthMethod("email");
        }
        setIsDemoMode(false);
        await fetchHouseholdBundle(session.user.id, session.user);
      } else {
        // When offline, keep the cached snapshot hydrated unless the user explicitly signed out
        const isOffline = typeof navigator !== "undefined" && navigator.onLine === false;
        if (event === "SIGNED_OUT" || !isOffline || !loadLastHouseholdSnapshot()) {
          setProfile(null);
          setHousehold(null);
          setMembers([]);
          setTransactions([]);
          setNeeds([]);
          setBills([]);
          setBillPayments([]);
        }
      }
      if (mounted) setLoading(false);
    });

    return () => {
      mounted = false;
      authSub.subscription.unsubscribe();
    };
  }, [fetchHouseholdBundle]);

  // Supabase Realtime sync for the active household (debounced to coalesce bursts)
  useEffect(() => {
    if (!supabase || isDemoMode || !household?.id || !profile?.id) {
      setRealtimeConnected(false);
      return;
    }

    const householdId = household.id;
    const userId = profile.id;

    const scheduleSync = () => {
      if (realtimeTimerRef.current) window.clearTimeout(realtimeTimerRef.current);
      realtimeTimerRef.current = window.setTimeout(() => {
        void fetchHouseholdBundle(userId);
      }, 250);
    };

    const channel = supabase
      .channel(`keeper-household-${householdId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "transactions", filter: `household_id=eq.${householdId}` },
        (payload) => {
          scheduleSync();
          const row = payload.new as Record<string, unknown> | null;
          if (!row) return;
          if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
            const rowId = row.id ? String(row.id) : null;
            if (isRecentLocalWrite(rowId)) return;
            const actorId = row.recorded_by ? String(row.recorded_by) : null;
            if (actorId && actorId === userId && payload.eventType === "INSERT") return;
            const amt = Number(row.amount) || 0;
            const desc = String(row.description || "Household entry");
            const title =
              payload.eventType === "UPDATE" ? "Entry edited" : "New household entry";
            const body =
              payload.eventType === "UPDATE"
                ? `${formatTZS(amt)} · ${desc} was updated`
                : `${formatTZS(amt)} · ${desc}`;
            void notifyHouseholdChange(title, body);
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "households", filter: `id=eq.${householdId}` },
        scheduleSync,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "household_members", filter: `household_id=eq.${householdId}` },
        scheduleSync,
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles" },
        scheduleSync,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "household_needs", filter: `household_id=eq.${householdId}` },
        (payload) => {
          scheduleSync();
          const row = payload.new as Record<string, unknown> | null;
          if (!row) return;
          const rowId = row.id ? String(row.id) : null;
          if (isRecentLocalWrite(rowId)) return;
          const itemTitle = String(row.title || "House item");
          if (payload.eventType === "INSERT") {
            const actorId = row.added_by ? String(row.added_by) : null;
            if (actorId && actorId === userId) return;
            const est = Number(row.estimated_amount) || 0;
            const body = est > 0 ? `${itemTitle} · Est. ${formatTZS(est)}` : itemTitle;
            void notifyHouseholdChange("New house need", body);
          } else if (payload.eventType === "UPDATE" && Boolean(row.is_bought)) {
            const amt = Number(row.actual_amount ?? row.estimated_amount) || 0;
            const body = amt > 0 ? `${itemTitle} · ${formatTZS(amt)}` : itemTitle;
            void notifyHouseholdChange("House need bought", body);
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "recurring_bills", filter: `household_id=eq.${householdId}` },
        (payload) => {
          scheduleSync();
          const row = payload.new as Record<string, unknown> | null;
          if (!row) return;
          const rowId = row.id ? String(row.id) : null;
          if (isRecentLocalWrite(rowId)) return;
          const billTitle = String(row.title || "Household bill");
          const amt = Number(row.amount) || 0;
          if (payload.eventType === "INSERT") {
            const actorId = row.created_by ? String(row.created_by) : null;
            if (actorId && actorId === userId) return;
            void notifyHouseholdChange("New recurring bill", `${formatTZS(amt)} · ${billTitle}`);
          } else if (payload.eventType === "UPDATE") {
            void notifyHouseholdChange("Bill updated", `${formatTZS(amt)} · ${billTitle}`);
          }
        },
      )
      .subscribe((status) => {
        setRealtimeConnected(status === "SUBSCRIBED");
      });

    return () => {
      if (realtimeTimerRef.current) window.clearTimeout(realtimeTimerRef.current);
      void supabase?.removeChannel(channel);
      setRealtimeConnected(false);
    };
  }, [fetchHouseholdBundle, household?.id, isDemoMode, isRecentLocalWrite, profile?.id]);

  // Persist demo state to localStorage when in demo mode
  useEffect(() => {
    if (!isDemoMode || !profile || !household) return;
    try {
      localStorage.setItem(
        DEMO_STORAGE_KEY,
        JSON.stringify({ currentUser: profile, household, members, transactions, needs, bills }),
      );
    } catch {
      // Ignore storage write errors
    }
  }, [bills, household, isDemoMode, members, needs, profile, transactions]);

  const enterDemoMode = useCallback(() => {
    const seed = loadDemoState();
    setError(null);
    setIsDemoMode(true);
    setProfile(seed.currentUser);
    setHousehold(seed.household);
    setMembers(seed.members);
    setTransactions(seed.transactions);
    setNeeds(seed.needs);
    setBills(seed.bills);
  }, []);

  const refresh = useCallback(async () => {
    setError(null);
    if (isDemoMode) return;
    if (!supabase) return;
    setRefreshing(true);
    try {
      const { data } = await supabase.auth.getSession();
      if (data.session?.user) {
        await fetchHouseholdBundle(data.session.user.id, data.session.user);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sync household data.");
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, [fetchHouseholdBundle, isDemoMode]);

  const signIn = useCallback(async (email: string, password: string) => {
    setError(null);
    const rate = authRateLimiter.check();
    if (!rate.allowed) {
      const msg = `Too many sign-in attempts. Please wait ${rate.retryAfterSec}s and try again.`;
      setError(msg);
      throw new Error(msg);
    }
    if (!supabase) {
      setError("Supabase is not configured yet. Add your project URL and key in .env.");
      return;
    }
    authRateLimiter.record();
    setPendingAuthMethod("email");
    const { data, error: err } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (err) {
      clearPendingAuthMethod();
      setError(err.message);
      throw err;
    }
    authRateLimiter.reset();
    clearPendingAuthMethod();
    setLastAuthMethod("email");
    if (data.session?.user) {
      setIsDemoMode(false);
      await fetchHouseholdBundle(data.session.user.id, data.session.user);
    }
  }, [fetchHouseholdBundle]);

  const signUp = useCallback(async (fullName: string, email: string, password: string) => {
    setError(null);
    const rate = authRateLimiter.check();
    if (!rate.allowed) {
      const msg = `Too many attempts. Please wait ${rate.retryAfterSec}s and try again.`;
      setError(msg);
      throw new Error(msg);
    }
    if (!supabase) {
      setError("Supabase is not configured yet. Add your project URL and key in .env.");
      return;
    }
    authRateLimiter.record();
    const cleanEmail = email.trim();
    setPendingAuthMethod("email");
    const { data, error: err } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        data: {
          full_name: fullName.trim().slice(0, 80),
          accepted_terms: true,
        },
      },
    });
    if (err) {
      clearPendingAuthMethod();
      setError(err.message);
      throw err;
    }

    if (data.session?.user) {
      authRateLimiter.reset();
      clearPendingAuthMethod();
      setLastAuthMethod("email");
      setIsDemoMode(false);
      await fetchHouseholdBundle(data.session.user.id, data.session.user);
      return;
    }

    // Attempt immediate sign-in if Supabase created the account without returning a session yet
    const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });
    if (signInData.session?.user) {
      authRateLimiter.reset();
      clearPendingAuthMethod();
      setLastAuthMethod("email");
      setIsDemoMode(false);
      await fetchHouseholdBundle(signInData.session.user.id, signInData.session.user);
      return;
    }

    clearPendingAuthMethod();

    if (signInErr?.message.toLowerCase().includes("confirm")) {
      setError(
        "Email confirmation is still ON in Supabase. Turn off 'Confirm email' in Supabase Dashboard -> Authentication -> Providers -> Email to enter Keeper directly.",
      );
      return;
    }

    setError(signInErr?.message ?? "Account created! Please sign in to continue.");
  }, [fetchHouseholdBundle]);

  const signInWithGoogle = useCallback(async () => {
    setError(null);
    if (!supabase) {
      setError("Supabase is not configured yet. Add your project URL and key in .env.");
      return;
    }
    setPendingAuthMethod("google");
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
      },
    });
    if (err) {
      clearPendingAuthMethod();
      setError(err.message);
      throw err;
    }
  }, []);

  const signInWithGoogleIdToken = useCallback(
    async (idToken: string, nonce: string) => {
      setError(null);
      if (!supabase) {
        setError("Supabase is not configured yet. Add your project URL and key in .env.");
        return;
      }
      setPendingAuthMethod("google");
      const { data, error: err } = await supabase.auth.signInWithIdToken({
        provider: "google",
        token: idToken,
        nonce,
      });
      if (err) {
        clearPendingAuthMethod();
        setError(err.message);
        throw err;
      }
      if (data.session?.user) {
        clearPendingAuthMethod();
        setLastAuthMethod("google");
        setIsDemoMode(false);
        await fetchHouseholdBundle(data.session.user.id, data.session.user);
      }
    },
    [fetchHouseholdBundle],
  );

  const resetPassword = useCallback(async (email: string) => {
    setError(null);
    const rate = resetRateLimiter.check();
    if (!rate.allowed) {
      const msg = `Too many reset requests. Please wait ${rate.retryAfterSec}s and try again.`;
      setError(msg);
      throw new Error(msg);
    }
    if (!supabase) {
      setError("Supabase is not configured yet. Add your project URL and key in .env.");
      throw new Error("Supabase not configured");
    }
    resetRateLimiter.record();
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: window.location.origin,
    });
    if (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const updatePassword = useCallback(async (newPassword: string) => {
    setError(null);
    if (isDemoMode) {
      return;
    }
    if (!supabase) return;
    const { error: err } = await supabase.auth.updateUser({ password: newPassword });
    if (err) {
      setError(err.message);
      throw err;
    }
    setPasswordRecoveryMode(false);
  }, [isDemoMode]);

  const updateProfile = useCallback(
    async (fullName: string, avatarColor: string) => {
      setError(null);
      if (!profile) return;
      const cleanName = fullName.trim().slice(0, 80);
      if (!cleanName) {
        const msg = "Display name cannot be empty.";
        setError(msg);
        throw new Error(msg);
      }
      const cleanColor = /^#[0-9A-Fa-f]{6}$/.test(avatarColor)
        ? avatarColor
        : profile.avatar_color;

      if (isDemoMode) {
        const updated: Profile = {
          ...profile,
          full_name: cleanName,
          avatar_color: cleanColor,
        };
        setProfile(updated);
        setMembers((prev) =>
          prev.map((m) => (m.user_id === profile.id ? { ...m, profile: updated } : m)),
        );
        setTransactions((prev) =>
          prev.map((tx) => ({
            ...tx,
            recorder: tx.recorded_by === profile.id ? updated : tx.recorder,
            payer: tx.paid_by === profile.id ? updated : tx.payer,
          })),
        );
        return;
      }

      if (!supabase) return;
      const { error: err } = await supabase
        .from("profiles")
        .update({ full_name: cleanName, avatar_color: cleanColor })
        .eq("id", profile.id);
      if (err) {
        setError(err.message);
        throw err;
      }
      await fetchHouseholdBundle(profile.id);
    },
    [fetchHouseholdBundle, isDemoMode, profile],
  );

  const deleteAccount = useCallback(async () => {
    setError(null);
    if (isDemoMode) {
      localStorage.removeItem(DEMO_STORAGE_KEY);
      setIsDemoMode(false);
      setProfile(null);
      setHousehold(null);
      setMembers([]);
      setTransactions([]);
      return;
    }
    if (!supabase) return;
    const { error: err } = await supabase.rpc("delete_own_account");
    if (err) {
      setError(err.message);
      throw err;
    }
    clearLastUserId();
    clearPendingAuthMethod();
    clearLastAuthMethod();
    await supabase.auth.signOut({ scope: "local" });
  }, [isDemoMode]);

  const signOut = useCallback(async () => {
    setError(null);
    setPasswordRecoveryMode(false);
    clearLastUserId();
    clearPendingAuthMethod();
    if (isDemoMode) {
      setIsDemoMode(false);
      setProfile(null);
      setHousehold(null);
      setMembers([]);
      setTransactions([]);
      return;
    }
    setProfile(null);
    setHousehold(null);
    setMembers([]);
    setTransactions([]);
    setNeeds([]);
    setBills([]);
    setBillPayments([]);
    if (supabase) {
      await supabase.auth.signOut({ scope: "local" });
    }
  }, [isDemoMode]);

  const createHousehold = useCallback(
    async (name: string, weeklyBudget: number, memberShare: number) => {
      setError(null);
      if (!supabase || !profile) return;
      const { error: err } = await supabase.rpc("create_household", {
        household_name: name.trim(),
        budget_target: Math.round(weeklyBudget),
        member_share: Math.round(memberShare),
      });
      if (err) {
        setError(err.message);
        throw err;
      }
      await fetchHouseholdBundle(profile.id);
    },
    [fetchHouseholdBundle, profile],
  );

  const joinHousehold = useCallback(
    async (inviteCode: string) => {
      setError(null);
      const rate = joinRateLimiter.check();
      if (!rate.allowed) {
        const msg = `Too many invite attempts. Please wait ${rate.retryAfterSec}s and try again.`;
        setError(msg);
        throw new Error(msg);
      }
      const cleanCode = sanitizeInviteCode(inviteCode);
      if (!cleanCode) {
        joinRateLimiter.record();
        const msg = "Invalid invite code format. Use 6-12 letters and numbers.";
        setError(msg);
        throw new Error(msg);
      }
      if (!supabase || !profile) return;
      const { error: err } = await supabase.rpc("join_household_by_code", {
        code: cleanCode,
      });
      if (err) {
        joinRateLimiter.record();
        setError(err.message);
        throw err;
      }
      joinRateLimiter.reset();
      await fetchHouseholdBundle(profile.id);
    },
    [fetchHouseholdBundle, profile],
  );

  const regenerateInviteCode = useCallback(async () => {
    setError(null);
    if (!household) return;

    if (isDemoMode) {
      const nextCode = generateClientInviteCode();
      setHousehold((prev) => (prev ? { ...prev, invite_code: nextCode } : prev));
      return;
    }

    if (!supabase || !profile) return;
    const { error: err } = await supabase.rpc("regenerate_invite_code", {
      target_household_id: household.id,
    });
    if (err) {
      setError(err.message);
      throw err;
    }
    await fetchHouseholdBundle(profile.id);
  }, [fetchHouseholdBundle, household, isDemoMode, profile]);

  const renameHousehold = useCallback(
    async (newName: string) => {
      setError(null);
      if (!household) return;
      const cleanName = newName.trim().slice(0, 80);
      if (!cleanName) {
        const msg = "Household name cannot be empty.";
        setError(msg);
        throw new Error(msg);
      }

      if (isDemoMode) {
        setHousehold((prev) => (prev ? { ...prev, name: cleanName } : prev));
        return;
      }

      if (!supabase || !profile) return;
      const { error: err } = await supabase.rpc("rename_household", {
        target_household_id: household.id,
        new_name: cleanName,
      });
      if (err) {
        setError(err.message);
        throw err;
      }
      await fetchHouseholdBundle(profile.id);
    },
    [fetchHouseholdBundle, household, isDemoMode, profile],
  );

  const promoteMember = useCallback(
    async (userId: string) => {
      setError(null);
      if (!household) return;

      if (isDemoMode) {
        setMembers((prev) =>
          prev.map((m) => (m.user_id === userId ? { ...m, role: "admin" } : m)),
        );
        return;
      }

      if (!supabase || !profile) return;
      const { error: err } = await supabase.rpc("promote_household_member", {
        target_household_id: household.id,
        target_user_id: userId,
      });
      if (err) {
        setError(err.message);
        throw err;
      }
      await fetchHouseholdBundle(profile.id);
    },
    [fetchHouseholdBundle, household, isDemoMode, profile],
  );

  const removeMember = useCallback(
    async (userId: string) => {
      setError(null);
      if (!household) return;

      if (isDemoMode) {
        setMembers((prev) => prev.filter((m) => m.user_id !== userId));
        return;
      }

      if (!supabase || !profile) return;
      const { error: err } = await supabase.rpc("remove_household_member", {
        target_household_id: household.id,
        target_user_id: userId,
      });
      if (err) {
        setError(err.message);
        throw err;
      }
      await fetchHouseholdBundle(profile.id);
    },
    [fetchHouseholdBundle, household, isDemoMode, profile],
  );

  const addTransaction = useCallback(
    async (input: TransactionInput) => {
      setError(null);
      if (!household || !profile) return;
      const paidById = input.type === "contribution" ? input.paid_by || profile.id : profile.id;

      if (isDemoMode) {
        const payerProfile = members.find((m) => m.user_id === paidById)?.profile ?? profile;
        const newTx: Transaction = {
          id: `demo-${Date.now()}`,
          household_id: household.id,
          recorded_by: profile.id,
          paid_by: paidById,
          type: input.type,
          amount: Math.round(input.amount),
          category: input.type === "contribution" ? "contribution" : input.category,
          description: input.description.trim(),
          transaction_date: input.transaction_date,
          created_at: new Date().toISOString(),
          updated_at: null,
          recorder: profile,
          payer: payerProfile,
        };
        setTransactions((prev) =>
          [newTx, ...prev].sort(
            (a, b) =>
              b.transaction_date.localeCompare(a.transaction_date) ||
              b.created_at.localeCompare(a.created_at),
          ),
        );
        return;
      }

      if (!supabase) return;
      const targetCategory = input.type === "contribution" ? "contribution" : input.category;
      const queueLocally = () => {
        const offlineId = `offline-tx-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const nowIso = new Date().toISOString();
        const nextQueue = enqueueOfflineItem({
          id: offlineId,
          householdId: household.id,
          kind: "add_transaction",
          createdAt: nowIso,
          payload: {
            type: input.type,
            amount: Math.round(input.amount),
            category: targetCategory,
            description: input.description.trim(),
            transaction_date: input.transaction_date,
            paid_by: paidById,
          },
        });
        setPendingSyncCount(nextQueue.length);
        const payerProfile = members.find((m) => m.user_id === paidById)?.profile ?? profile;
        const optimistic: Transaction = {
          id: offlineId,
          household_id: household.id,
          recorded_by: profile.id,
          paid_by: paidById,
          type: input.type,
          amount: Math.round(input.amount),
          category: targetCategory,
          description: input.description.trim(),
          transaction_date: input.transaction_date,
          created_at: nowIso,
          updated_at: null,
          recorder: profile,
          payer: payerProfile,
        };
        setTransactions((prev) =>
          [optimistic, ...prev].sort(
            (a, b) =>
              b.transaction_date.localeCompare(a.transaction_date) ||
              b.created_at.localeCompare(a.created_at),
          ),
        );
      };

      if (typeof navigator !== "undefined" && !navigator.onLine) {
        queueLocally();
        return;
      }

      try {
        let { error: err } = await supabase.from("transactions").insert({
          household_id: household.id,
          recorded_by: profile.id,
          paid_by: paidById,
          type: input.type,
          amount: Math.round(input.amount),
          category: targetCategory,
          description: input.description.trim(),
          transaction_date: input.transaction_date,
        });
        if (err && targetCategory === "wifi_internet" && !isLikelyNetworkError(err)) {
          const retry = await supabase.from("transactions").insert({
            household_id: household.id,
            recorded_by: profile.id,
            paid_by: paidById,
            type: input.type,
            amount: Math.round(input.amount),
            category: "security_internet",
            description: input.description.trim(),
            transaction_date: input.transaction_date,
          });
          err = retry.error;
        }
        if (err) {
          if (isLikelyNetworkError(err)) {
            queueLocally();
            return;
          }
          setError(err.message);
          throw err;
        }
        await fetchHouseholdBundle(profile.id);
      } catch (e) {
        if (isLikelyNetworkError(e)) {
          queueLocally();
          return;
        }
        throw e;
      }
    },
    [fetchHouseholdBundle, household, isDemoMode, members, profile],
  );

  const updateTransaction = useCallback(
    async (id: string, input: TransactionInput) => {
      setError(null);
      if (!household || !profile) return;
      const paidById = input.type === "contribution" ? input.paid_by || profile.id : profile.id;
      const nowIso = new Date().toISOString();

      if (isDemoMode) {
        const payerProfile = members.find((m) => m.user_id === paidById)?.profile ?? profile;
        setTransactions((prev) =>
          prev
            .map((tx) =>
              tx.id === id
                ? {
                    ...tx,
                    type: input.type,
                    amount: Math.round(input.amount),
                    category: input.type === "contribution" ? "contribution" : input.category,
                    description: input.description.trim(),
                    transaction_date: input.transaction_date,
                    paid_by: paidById,
                    payer: payerProfile,
                    updated_at: nowIso,
                  }
                : tx,
            )
            .sort(
              (a, b) =>
                b.transaction_date.localeCompare(a.transaction_date) ||
                b.created_at.localeCompare(a.created_at),
            ),
        );
        return;
      }

      if (!supabase) return;
      markLocalWrite(id);
      const { error: err } = await supabase
        .from("transactions")
        .update({
          type: input.type,
          amount: Math.round(input.amount),
          category: input.type === "contribution" ? "contribution" : input.category,
          description: input.description.trim().slice(0, 200),
          transaction_date: input.transaction_date,
          paid_by: paidById,
        })
        .eq("id", id);
      if (err) {
        setError(err.message);
        throw err;
      }
      await fetchHouseholdBundle(profile.id);
    },
    [fetchHouseholdBundle, household, isDemoMode, members, profile],
  );

  const deleteTransaction = useCallback(
    async (id: string) => {
      setError(null);
      if (isDemoMode) {
        setTransactions((prev) => prev.filter((t) => t.id !== id));
        return;
      }
      if (!supabase || !profile) return;
      const { error: err } = await supabase.from("transactions").delete().eq("id", id);
      if (err) {
        setError(err.message);
        throw err;
      }
      await fetchHouseholdBundle(profile.id);
    },
    [fetchHouseholdBundle, isDemoMode, profile],
  );

  const addNeed = useCallback(
    async (
      title: string,
      category: ExpenseCategoryId,
      options?: { quantity?: string | null; estimatedAmount?: number | null },
    ) => {
      setError(null);
      if (!household || !profile) return;
      const cleanTitle = title.trim().slice(0, 120);
      if (!cleanTitle) return;
      const cleanQty = options?.quantity?.trim().slice(0, 40) || null;
      const estRaw = options?.estimatedAmount;
      const safeEst =
        typeof estRaw === "number" && Number.isFinite(estRaw) && estRaw > 0
          ? Math.round(estRaw)
          : null;

      if (isDemoMode) {
        const next: HouseholdNeed = {
          id: `need-${Date.now()}`,
          household_id: household.id,
          added_by: profile.id,
          title: cleanTitle,
          quantity: cleanQty,
          estimated_amount: safeEst,
          actual_amount: null,
          paid_mode: "all",
          paid_by: null,
          settled_by: [],
          pool_amount_used: 0,
          category,
          is_bought: false,
          bought_at: null,
          created_at: new Date().toISOString(),
          adder: profile,
        };
        setNeeds((prev) => [next, ...prev]);
        return;
      }

      if (!supabase) return;
      const queueNeedLocally = () => {
        const offlineId = `offline-need-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const nowIso = new Date().toISOString();
        const nextQueue = enqueueOfflineItem({
          id: offlineId,
          householdId: household.id,
          kind: "add_need",
          createdAt: nowIso,
          payload: {
            title: cleanTitle,
            category,
            quantity: cleanQty,
            estimatedAmount: safeEst,
          },
        });
        setPendingSyncCount(nextQueue.length);
        const optimistic: HouseholdNeed = {
          id: offlineId,
          household_id: household.id,
          added_by: profile.id,
          title: cleanTitle,
          quantity: cleanQty,
          estimated_amount: safeEst,
          actual_amount: null,
          paid_mode: "all",
          paid_by: null,
          settled_by: [],
          pool_amount_used: 0,
          category,
          is_bought: false,
          bought_at: null,
          created_at: nowIso,
          adder: profile,
        };
        setNeeds((prev) => [optimistic, ...prev]);
      };

      if (typeof navigator !== "undefined" && !navigator.onLine) {
        queueNeedLocally();
        return;
      }

      try {
        let { data: inserted, error: err } = await supabase
          .from("household_needs")
          .insert({
            household_id: household.id,
            added_by: profile.id,
            title: cleanTitle,
            quantity: cleanQty,
            estimated_amount: safeEst,
            category,
          })
          .select("id")
          .single();
        if (err && !isLikelyNetworkError(err)) {
          const fallbackCategory = category === "wifi_internet" ? "security_internet" : category;
          const retry = await supabase
            .from("household_needs")
            .insert({
              household_id: household.id,
              added_by: profile.id,
              title: cleanTitle,
              category: fallbackCategory,
            })
            .select("id")
            .single();
          inserted = retry.data;
          err = retry.error;
        }
        if (err) {
          if (isLikelyNetworkError(err)) {
            queueNeedLocally();
            return;
          }
          setError(err.message);
          throw err;
        }
        if (inserted?.id && (cleanQty || safeEst)) {
          try {
            const raw = localStorage.getItem("keeper_need_meta_v1");
            const map = raw ? (JSON.parse(raw) as Record<string, Record<string, unknown>>) : {};
            map[String(inserted.id)] = {
              quantity: cleanQty,
              estimated_amount: safeEst,
            };
            localStorage.setItem("keeper_need_meta_v1", JSON.stringify(map));
          } catch {
            // Ignore storage error
          }
        }
        await fetchHouseholdBundle(profile.id);
      } catch (e) {
        if (isLikelyNetworkError(e)) {
          queueNeedLocally();
          return;
        }
        throw e;
      }
    },
    [fetchHouseholdBundle, household, isDemoMode, profile],
  );

  const markNeedBought = useCallback(
    async (
      id: string,
      options: {
        actualAmount?: number | null;
        paidMode?: "all" | "single";
        paidBy?: string | null;
        poolAmountUsed?: number;
        boughtDateISO?: string | null;
      },
    ) => {
      setError(null);
      if (!household || !profile) return;
      const existing = needs.find((n) => n.id === id);
      if (!existing) return;

      const rawAct = options.actualAmount ?? existing.actual_amount ?? existing.estimated_amount ?? null;
      const safeAct =
        typeof rawAct === "number" && Number.isFinite(rawAct) && rawAct > 0
          ? Math.round(rawAct)
          : null;
      const safePool = Math.max(
        0,
        Math.min(safeAct ?? 0, Math.round(options.poolAmountUsed ?? 0)),
      );
      const safeMode: "all" | "single" = options.paidMode === "single" ? "single" : "all";
      const safePaidBy = safeMode === "single" ? options.paidBy || profile.id : null;
      const todayISO = toISODate(new Date());
      const safeBoughtDateISO =
        options.boughtDateISO && /^\d{4}-\d{2}-\d{2}$/.test(options.boughtDateISO)
          ? options.boughtDateISO
          : todayISO;
      const boughtAt =
        safeBoughtDateISO === todayISO
          ? new Date().toISOString()
          : `${safeBoughtDateISO}T12:00:00.000Z`;
      const prevPool = existing.is_bought ? (existing.pool_amount_used ?? 0) : 0;
      const poolDelta = Math.max(0, safePool - prevPool);
      const resetSettled =
        !existing.is_bought ||
        existing.paid_mode !== safeMode ||
        existing.paid_by !== safePaidBy ||
        existing.actual_amount !== safeAct ||
        existing.pool_amount_used !== safePool;
      const nextSettled = resetSettled ? [] : existing.settled_by ?? [];

      if (isDemoMode) {
        setNeeds((prev) =>
          prev
            .map((n) =>
              n.id === id
                ? {
                    ...n,
                    is_bought: true,
                    bought_at: boughtAt,
                    actual_amount: safeAct,
                    paid_mode: safeMode,
                    paid_by: safePaidBy,
                    settled_by: nextSettled,
                    pool_amount_used: safePool,
                  }
                : n,
            )
            .sort((a, b) => Number(a.is_bought) - Number(b.is_bought)),
        );
        if (poolDelta > 0) {
          await addTransaction({
            type: "expense",
            amount: poolDelta,
            category: existing.category,
            description: `${existing.title}${existing.quantity ? ` (${existing.quantity})` : ""} (from pool)`.slice(0, 200),
            transaction_date: safeBoughtDateISO,
          });
        }
        return;
      }

      if (!supabase) return;
      markLocalWrite(id);
      let { error: err } = await supabase
        .from("household_needs")
        .update({
          is_bought: true,
          bought_at: boughtAt,
          actual_amount: safeAct,
          paid_mode: safeMode,
          paid_by: safePaidBy,
          settled_by: nextSettled,
          pool_amount_used: safePool,
        })
        .eq("id", id);

      if (err) {
        const retry = await supabase
          .from("household_needs")
          .update({ is_bought: true, bought_at: boughtAt })
          .eq("id", id);
        err = retry.error;
      }
      if (err) {
        setError(err.message);
        throw err;
      }

      try {
        const raw = localStorage.getItem("keeper_need_meta_v1");
        const map = raw ? (JSON.parse(raw) as Record<string, Record<string, unknown>>) : {};
        map[id] = {
          ...(map[id] ?? {}),
          quantity: existing.quantity ?? null,
          estimated_amount: existing.estimated_amount ?? null,
          actual_amount: safeAct,
          paid_mode: safeMode,
          paid_by: safePaidBy,
          settled_by: nextSettled,
          pool_amount_used: safePool,
        };
        localStorage.setItem("keeper_need_meta_v1", JSON.stringify(map));
      } catch {
        // Ignore storage error
      }

      if (poolDelta > 0) {
        await addTransaction({
          type: "expense",
          amount: poolDelta,
          category: existing.category,
          description: `${existing.title}${existing.quantity ? ` (${existing.quantity})` : ""} (from pool)`.slice(0, 200),
          transaction_date: safeBoughtDateISO,
        });
      } else {
        await fetchHouseholdBundle(profile.id);
      }
    },
    [addTransaction, fetchHouseholdBundle, household, isDemoMode, markLocalWrite, needs, profile],
  );

  const toggleNeedMemberSettled = useCallback(
    async (needId: string, memberUserId: string) => {
      setError(null);
      const target = needs.find((n) => n.id === needId);
      if (!target) return;
      const current = target.settled_by ?? [];
      const nextSettled = current.includes(memberUserId)
        ? current.filter((uid) => uid !== memberUserId)
        : [...current, memberUserId];

      setNeeds((prev) =>
        prev.map((n) => (n.id === needId ? { ...n, settled_by: nextSettled } : n)),
      );

      try {
        const raw = localStorage.getItem("keeper_need_meta_v1");
        const map = raw ? (JSON.parse(raw) as Record<string, Record<string, unknown>>) : {};
        map[needId] = {
          ...(map[needId] ?? {}),
          quantity: target.quantity ?? null,
          estimated_amount: target.estimated_amount ?? null,
          actual_amount: target.actual_amount ?? null,
          paid_mode: target.paid_mode ?? "all",
          paid_by: target.paid_by ?? null,
          settled_by: nextSettled,
          pool_amount_used: target.pool_amount_used ?? 0,
        };
        localStorage.setItem("keeper_need_meta_v1", JSON.stringify(map));
      } catch {
        // Ignore storage error
      }

      if (isDemoMode || !supabase || !profile) return;
      await supabase
        .from("household_needs")
        .update({ settled_by: nextSettled })
        .eq("id", needId);
    },
    [isDemoMode, needs, profile],
  );

  const toggleNeed = useCallback(
    async (id: string, isBought: boolean) => {
      setError(null);
      const boughtAt = isBought ? new Date().toISOString() : null;
      if (isDemoMode) {
        setNeeds((prev) =>
          prev
            .map((n) => (n.id === id ? { ...n, is_bought: isBought, bought_at: boughtAt } : n))
            .sort((a, b) => Number(a.is_bought) - Number(b.is_bought)),
        );
        return;
      }
      if (!supabase || !profile) return;
      markLocalWrite(id);
      const { error: err } = await supabase
        .from("household_needs")
        .update({ is_bought: isBought, bought_at: boughtAt })
        .eq("id", id);
      if (err) {
        setError(err.message);
        throw err;
      }
      await fetchHouseholdBundle(profile.id);
    },
    [fetchHouseholdBundle, isDemoMode, markLocalWrite, profile],
  );

  const deleteNeed = useCallback(
    async (id: string) => {
      setError(null);
      if (isDemoMode) {
        setNeeds((prev) => prev.filter((n) => n.id !== id));
        return;
      }
      if (!supabase || !profile) return;
      const { error: err } = await supabase.from("household_needs").delete().eq("id", id);
      if (err) {
        setError(err.message);
        throw err;
      }
      await fetchHouseholdBundle(profile.id);
    },
    [fetchHouseholdBundle, isDemoMode, profile],
  );

  const recordBillPaymentHistory = useCallback(
    async (entry: Omit<BillPaymentRecord, "id" | "created_at">) => {
      const localRecord: BillPaymentRecord = {
        ...entry,
        id: `bp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        created_at: new Date().toISOString(),
      };
      setBillPayments((prev) => [localRecord, ...prev]);
      try {
        const raw = localStorage.getItem("keeper_bill_payments_v1");
        const list = raw ? (JSON.parse(raw) as BillPaymentRecord[]) : [];
        localStorage.setItem(
          "keeper_bill_payments_v1",
          JSON.stringify([localRecord, ...list].slice(0, 200)),
        );
      } catch {
        // Ignore storage error
      }
      if (isDemoMode || !supabase) return;
      await supabase.from("bill_payments").insert({
        household_id: entry.household_id,
        bill_id: entry.bill_id,
        bill_title: entry.bill_title,
        amount: entry.amount,
        pool_amount_used: entry.pool_amount_used,
        paid_date: entry.paid_date,
        paid_mode: entry.paid_mode,
        paid_by: entry.paid_by,
        recorded_by: entry.recorded_by,
      });
    },
    [isDemoMode],
  );

  const addBill = useCallback(
    async (
      title: string,
      amount: number,
      category: ExpenseCategoryId,
      dueDay: number,
      intervalMonths = 1,
      paidDateISO: string | null = null,
      paidMode: "all" | "single" = "all",
      paidBy: string | null = null,
      poolAmountUsed = 0,
    ) => {
      setError(null);
      if (!household || !profile) return;
      const cleanTitle = title.trim().slice(0, 80);
      const safeAmount = Math.max(1, Math.round(amount));
      const dateDay =
        paidDateISO && /^\d{4}-\d{2}-\d{2}$/.test(paidDateISO)
          ? Number(paidDateISO.slice(8, 10))
          : dueDay;
      const safeDay = Math.min(31, Math.max(1, Math.round(dateDay || dueDay || 1)));
      const safeInterval = Math.min(60, Math.max(1, Math.round(intervalMonths || 1)));
      const paidMonthKey =
        paidDateISO && /^\d{4}-\d{2}/.test(paidDateISO) ? paidDateISO.slice(0, 7) : null;
      const safeMode: "all" | "single" = paidMode === "single" ? "single" : "all";
      const safePaidBy = safeMode === "single" ? paidBy || profile.id : null;
      const safePool = paidMonthKey
        ? Math.max(0, Math.min(safeAmount, Math.round(poolAmountUsed || 0)))
        : 0;
      if (!cleanTitle) return;

      if (isDemoMode) {
        const demoId = `bill-${Date.now()}`;
        const next: RecurringBill = {
          id: demoId,
          household_id: household.id,
          created_by: profile.id,
          title: cleanTitle,
          amount: safeAmount,
          category,
          due_day: safeDay,
          interval_months: safeInterval,
          last_paid_month: paidMonthKey,
          paid_mode: safeMode,
          paid_by: safePaidBy,
          settled_by: [],
          pool_amount_used: safePool,
          created_at: new Date().toISOString(),
        };
        setBills((prev) => [...prev, next].sort((a, b) => a.due_day - b.due_day));
        if (paidDateISO && paidMonthKey) {
          await recordBillPaymentHistory({
            household_id: household.id,
            bill_id: demoId,
            bill_title: cleanTitle,
            amount: safeAmount,
            pool_amount_used: safePool,
            paid_date: paidDateISO,
            paid_mode: safeMode,
            paid_by: safePaidBy,
            recorded_by: profile.id,
          });
        }
        if (safePool > 0 && paidDateISO) {
          await addTransaction({
            type: "expense",
            amount: safePool,
            category,
            description: `${cleanTitle} (from pool)`.slice(0, 200),
            transaction_date: paidDateISO,
          });
        }
        return;
      }

      if (!supabase) return;
      let { data: inserted, error: err } = await supabase
        .from("recurring_bills")
        .insert({
          household_id: household.id,
          created_by: profile.id,
          title: cleanTitle,
          amount: safeAmount,
          category,
          due_day: safeDay,
          interval_months: safeInterval,
          last_paid_month: paidMonthKey,
          paid_mode: safeMode,
          paid_by: safePaidBy,
          settled_by: [],
          pool_amount_used: safePool,
        })
        .select("id")
        .single();

      // Fallback if DB has not applied latest migrations yet
      if (err) {
        const fallbackCategory = category === "wifi_internet" ? "security_internet" : category;
        const retry = await supabase
          .from("recurring_bills")
          .insert({
            household_id: household.id,
            created_by: profile.id,
            title: cleanTitle,
            amount: safeAmount,
            category: fallbackCategory,
            due_day: safeDay,
            last_paid_month: paidMonthKey,
          })
          .select("id")
          .single();
        inserted = retry.data;
        err = retry.error;
      }

      if (err) {
        setError(err.message);
        throw err;
      }

      if (inserted?.id) {
        const billId = String(inserted.id);
        try {
          if (safeInterval > 1) {
            const rawMap = localStorage.getItem("keeper_bill_intervals_v1");
            const map = rawMap ? (JSON.parse(rawMap) as Record<string, number>) : {};
            map[billId] = safeInterval;
            localStorage.setItem("keeper_bill_intervals_v1", JSON.stringify(map));
          }
          const rawMeta = localStorage.getItem("keeper_bill_meta_v1");
          const metaMap = rawMeta
            ? (JSON.parse(rawMeta) as Record<
                string,
                {
                  paid_mode?: "all" | "single";
                  paid_by?: string | null;
                  settled_by?: string[];
                  pool_amount_used?: number;
                }
              >)
            : {};
          metaMap[billId] = {
            paid_mode: safeMode,
            paid_by: safePaidBy,
            settled_by: [],
            pool_amount_used: safePool,
          };
          localStorage.setItem("keeper_bill_meta_v1", JSON.stringify(metaMap));
        } catch {
          // Ignore storage error
        }
      }

      if (inserted?.id && paidDateISO && paidMonthKey) {
        await recordBillPaymentHistory({
          household_id: household.id,
          bill_id: String(inserted.id),
          bill_title: cleanTitle,
          amount: safeAmount,
          pool_amount_used: safePool,
          paid_date: paidDateISO,
          paid_mode: safeMode,
          paid_by: safePaidBy,
          recorded_by: profile.id,
        });
      }

      if (safePool > 0 && paidDateISO) {
        await addTransaction({
          type: "expense",
          amount: safePool,
          category,
          description: `${cleanTitle} (from pool)`.slice(0, 200),
          transaction_date: paidDateISO,
        });
      } else {
        await fetchHouseholdBundle(profile.id);
      }
    },
    [addTransaction, fetchHouseholdBundle, household, isDemoMode, profile, recordBillPaymentHistory],
  );

  const markBillPaid = useCallback(
    async (
      id: string,
      paidDateOrMonthKey = getMonthKey(),
      paidMode?: "all" | "single",
      paidBy?: string | null,
      poolAmountUsed = 0,
    ) => {
      setError(null);
      const monthKey = paidDateOrMonthKey.slice(0, 7);
      const parsedDay =
        paidDateOrMonthKey.length >= 10 ? Number(paidDateOrMonthKey.slice(8, 10)) : null;
      const nextDueDay =
        parsedDay && Number.isFinite(parsedDay) && parsedDay >= 1 && parsedDay <= 31
          ? parsedDay
          : null;
      const existing = bills.find((b) => b.id === id);
      const safeMode: "all" | "single" = paidMode ?? existing?.paid_mode ?? "all";
      const safePaidBy =
        safeMode === "single" ? paidBy ?? existing?.paid_by ?? profile?.id ?? null : null;
      const billAmount = existing?.amount ?? 0;
      const safePool = Math.max(0, Math.min(billAmount, Math.round(poolAmountUsed || 0)));
      const prevPool =
        existing && existing.last_paid_month === monthKey ? (existing.pool_amount_used ?? 0) : 0;
      const poolDelta = Math.max(0, safePool - prevPool);
      const txDateISO =
        paidDateOrMonthKey.length >= 10 ? paidDateOrMonthKey.slice(0, 10) : toISODate(new Date());
      const resetSettled =
        existing &&
        (existing.last_paid_month !== monthKey ||
          existing.paid_mode !== safeMode ||
          existing.paid_by !== safePaidBy ||
          existing.pool_amount_used !== safePool);
      const nextSettled = resetSettled ? [] : existing?.settled_by ?? [];

      if (isDemoMode) {
        setBills((prev) =>
          prev.map((b) =>
            b.id === id
              ? {
                  ...b,
                  last_paid_month: monthKey,
                  due_day: nextDueDay ?? b.due_day,
                  paid_mode: safeMode,
                  paid_by: safePaidBy,
                  settled_by: nextSettled,
                  pool_amount_used: safePool,
                }
              : b,
          ),
        );
        if (poolDelta > 0 && existing) {
          await addTransaction({
            type: "expense",
            amount: poolDelta,
            category: existing.category,
            description: `${existing.title} (from pool)`.slice(0, 200),
            transaction_date: txDateISO,
          });
        }
        return;
      }
      if (!supabase || !profile) return;
      markLocalWrite(id);
      const fullPayload: Record<string, unknown> = {
        last_paid_month: monthKey,
        paid_mode: safeMode,
        paid_by: safePaidBy,
        settled_by: nextSettled,
        pool_amount_used: safePool,
      };
      if (nextDueDay !== null) fullPayload.due_day = nextDueDay;

      let { error: err } = await supabase
        .from("recurring_bills")
        .update(fullPayload)
        .eq("id", id);

      if (err) {
        const basePayload: { last_paid_month: string; due_day?: number } = {
          last_paid_month: monthKey,
        };
        if (nextDueDay !== null) basePayload.due_day = nextDueDay;
        const retry = await supabase
          .from("recurring_bills")
          .update(basePayload)
          .eq("id", id);
        err = retry.error;
      }

      if (err) {
        setError(err.message);
        throw err;
      }

      try {
        const rawMeta = localStorage.getItem("keeper_bill_meta_v1");
        const metaMap = rawMeta
          ? (JSON.parse(rawMeta) as Record<
              string,
              {
                paid_mode?: "all" | "single";
                paid_by?: string | null;
                settled_by?: string[];
                pool_amount_used?: number;
              }
            >)
          : {};
        metaMap[id] = {
          paid_mode: safeMode,
          paid_by: safePaidBy,
          settled_by: nextSettled,
          pool_amount_used: safePool,
        };
        localStorage.setItem("keeper_bill_meta_v1", JSON.stringify(metaMap));
      } catch {
        // Ignore storage error
      }

      if (existing && household && profile && existing.last_paid_month !== monthKey) {
        await recordBillPaymentHistory({
          household_id: household.id,
          bill_id: existing.id,
          bill_title: existing.title,
          amount: existing.amount,
          pool_amount_used: safePool,
          paid_date: txDateISO,
          paid_mode: safeMode,
          paid_by: safePaidBy,
          recorded_by: profile.id,
        });
      }

      if (poolDelta > 0 && existing) {
        await addTransaction({
          type: "expense",
          amount: poolDelta,
          category: existing.category,
          description: `${existing.title} (from pool)`.slice(0, 200),
          transaction_date: txDateISO,
        });
      } else {
        await fetchHouseholdBundle(profile.id);
      }
    },
    [addTransaction, bills, fetchHouseholdBundle, household, isDemoMode, profile, recordBillPaymentHistory],
  );

  const toggleBillMemberSettled = useCallback(
    async (billId: string, memberUserId: string) => {
      setError(null);
      const target = bills.find((b) => b.id === billId);
      if (!target) return;
      const current = target.settled_by ?? [];
      const nextSettled = current.includes(memberUserId)
        ? current.filter((uid) => uid !== memberUserId)
        : [...current, memberUserId];

      setBills((prev) =>
        prev.map((b) => (b.id === billId ? { ...b, settled_by: nextSettled } : b)),
      );

      try {
        const rawMeta = localStorage.getItem("keeper_bill_meta_v1");
        const metaMap = rawMeta
          ? (JSON.parse(rawMeta) as Record<
              string,
              {
                paid_mode?: "all" | "single";
                paid_by?: string | null;
                settled_by?: string[];
                pool_amount_used?: number;
              }
            >)
          : {};
        metaMap[billId] = {
          paid_mode: target.paid_mode ?? "all",
          paid_by: target.paid_by ?? null,
          settled_by: nextSettled,
          pool_amount_used: target.pool_amount_used ?? 0,
        };
        localStorage.setItem("keeper_bill_meta_v1", JSON.stringify(metaMap));
      } catch {
        // Ignore storage error
      }

      if (isDemoMode || !supabase || !profile) return;
      // Persist to DB if `settled_by` column exists (ignore missing-column error gracefully)
      await supabase
        .from("recurring_bills")
        .update({ settled_by: nextSettled })
        .eq("id", billId);
    },
    [bills, isDemoMode, profile],
  );

  const settlePairwiseDebts = useCallback(
    async (fromUserId: string, toUserId: string, billIds: string[], needIds: string[]) => {
      for (const billId of billIds) {
        const b = bills.find((x) => x.id === billId);
        if (!b || b.paid_mode !== "single") continue;
        const debtorId = b.paid_by === toUserId ? fromUserId : b.paid_by === fromUserId ? toUserId : null;
        if (debtorId && !(b.settled_by ?? []).includes(debtorId)) {
          await toggleBillMemberSettled(billId, debtorId);
        }
      }
      for (const needId of needIds) {
        const n = needs.find((x) => x.id === needId);
        if (!n || n.paid_mode !== "single") continue;
        const debtorId = n.paid_by === toUserId ? fromUserId : n.paid_by === fromUserId ? toUserId : null;
        if (debtorId && !(n.settled_by ?? []).includes(debtorId)) {
          await toggleNeedMemberSettled(needId, debtorId);
        }
      }
    },
    [bills, needs, toggleBillMemberSettled, toggleNeedMemberSettled],
  );

  const deleteBill = useCallback(
    async (id: string) => {
      setError(null);
      if (isDemoMode) {
        setBills((prev) => prev.filter((b) => b.id !== id));
        return;
      }
      if (!supabase || !profile) return;
      const { error: err } = await supabase.from("recurring_bills").delete().eq("id", id);
      if (err) {
        setError(err.message);
        throw err;
      }
      await fetchHouseholdBundle(profile.id);
    },
    [fetchHouseholdBundle, isDemoMode, profile],
  );

  const updateBudget = useCallback(
    async (weeklyBudget: number, memberShare: number) => {
      setError(null);
      if (!household) return;

      if (isDemoMode) {
        setHousehold((prev) =>
          prev
            ? {
                ...prev,
                weekly_budget_target: Math.round(weeklyBudget),
                member_weekly_share: Math.round(memberShare),
              }
            : prev,
        );
        return;
      }

      if (!supabase || !profile) return;
      const { error: err } = await supabase
        .from("households")
        .update({
          weekly_budget_target: Math.round(weeklyBudget),
          member_weekly_share: Math.round(memberShare),
        })
        .eq("id", household.id);
      if (err) {
        setError(err.message);
        throw err;
      }
      await fetchHouseholdBundle(profile.id);
    },
    [fetchHouseholdBundle, household, isDemoMode, profile],
  );

  const updateOverspendPlan = useCallback(
    async (plan: OverspendRecoveryPlan | null) => {
      setError(null);
      if (!household) return;

      saveLocalOverspendPlan(household.id, plan);
      setHousehold((prev) => (prev ? { ...prev, overspend_plan: plan } : prev));

      if (isDemoMode || !supabase) return;
      try {
        await supabase
          .from("households")
          .update({ overspend_plan: plan })
          .eq("id", household.id);
      } catch {
        // Optional DB column may not exist yet; localStorage persistence already succeeded
      }
    },
    [household, isDemoMode],
  );

  const updateSurplusPlan = useCallback(
    async (plan: WeeklySurplusPlan | null) => {
      setError(null);
      if (!household) return;

      saveLocalSurplusPlan(household.id, plan);
      setHousehold((prev) => (prev ? { ...prev, surplus_plan: plan } : prev));

      if (isDemoMode || !supabase) return;
      try {
        await supabase
          .from("households")
          .update({ surplus_plan: plan })
          .eq("id", household.id);
      } catch {
        // Optional DB column may not exist yet; localStorage persistence already succeeded
      }
    },
    [household, isDemoMode],
  );

  const setWeeklyBoost = useCallback(
    async (entry: WeeklyBoostEntry | null, weekStartISO: string) => {
      setError(null);
      if (!household) return;

      const currentBoosts = household.weekly_boosts ?? loadLocalWeeklyBoosts(household.id);
      const nextBoosts = entry
        ? upsertWeeklyBoost(currentBoosts, entry)
        : removeWeeklyBoost(currentBoosts, weekStartISO);

      saveLocalWeeklyBoosts(household.id, nextBoosts);
      setHousehold((prev) => (prev ? { ...prev, weekly_boosts: nextBoosts } : prev));

      if (isDemoMode || !supabase) return;
      try {
        await supabase
          .from("households")
          .update({ weekly_boosts: nextBoosts })
          .eq("id", household.id);
      } catch {
        // Optional DB column may not exist yet; localStorage persistence already succeeded
      }
    },
    [household, isDemoMode],
  );

  const submitAppFeedback = useCallback(
    async (input: {
      kind: "rating" | "bug" | "feature";
      rating?: number | null;
      comment: string;
      platform: string;
      appVersion: string;
    }) => {
      const payload = {
        user_id: profile?.id ?? "demo",
        kind: input.kind,
        rating:
          typeof input.rating === "number" && input.rating >= 1 && input.rating <= 5
            ? Math.round(input.rating)
            : null,
        comment: input.comment.trim().slice(0, 1000),
        platform: input.platform.slice(0, 32),
        app_version: input.appVersion.slice(0, 32),
      };

      try {
        const raw = localStorage.getItem("keeper_app_feedback_v1");
        const list = raw ? (JSON.parse(raw) as unknown[]) : [];
        list.push({ ...payload, created_at: new Date().toISOString() });
        localStorage.setItem("keeper_app_feedback_v1", JSON.stringify(list.slice(-20)));
      } catch {
        // Ignore storage error
      }

      if (isDemoMode || !supabase || !profile) return;
      // Save to Supabase if `app_feedback` table exists (fail silently to local fallback if migration not yet run)
      await supabase.from("app_feedback").insert(payload);
    },
    [isDemoMode, profile],
  );

  const syncOfflineQueue = useCallback(async (): Promise<number> => {
    if (isDemoMode || !supabase || !profile) return 0;
    if (typeof navigator !== "undefined" && !navigator.onLine) return 0;
    const queue = loadOfflineQueue();
    if (queue.length === 0) {
      setPendingSyncCount(0);
      return 0;
    }

    let synced = 0;
    for (const item of queue) {
      try {
        if (item.kind === "add_transaction") {
          let { error: err } = await supabase.from("transactions").insert({
            household_id: item.householdId,
            recorded_by: profile.id,
            paid_by: item.payload.paid_by,
            type: item.payload.type,
            amount: item.payload.amount,
            category: item.payload.category,
            description: item.payload.description,
            transaction_date: item.payload.transaction_date,
          });
          if (err && item.payload.category === "wifi_internet" && !isLikelyNetworkError(err)) {
            const retry = await supabase.from("transactions").insert({
              household_id: item.householdId,
              recorded_by: profile.id,
              paid_by: item.payload.paid_by,
              type: item.payload.type,
              amount: item.payload.amount,
              category: "security_internet",
              description: item.payload.description,
              transaction_date: item.payload.transaction_date,
            });
            err = retry.error;
          }
          if (err) {
            if (isLikelyNetworkError(err)) break;
            continue;
          }
        } else if (item.kind === "add_need") {
          const { error: err } = await supabase.from("household_needs").insert({
            household_id: item.householdId,
            added_by: profile.id,
            title: item.payload.title,
            quantity: item.payload.quantity,
            estimated_amount: item.payload.estimatedAmount,
            category: item.payload.category,
          });
          if (err) {
            if (isLikelyNetworkError(err)) break;
            continue;
          }
        }
        const remaining = removeOfflineItem(item.id);
        setPendingSyncCount(remaining.length);
        synced += 1;
      } catch (e) {
        if (isLikelyNetworkError(e)) break;
      }
    }

    if (synced > 0) {
      await fetchHouseholdBundle(profile.id);
    }
    return synced;
  }, [fetchHouseholdBundle, isDemoMode, profile]);

  const leaveHousehold = useCallback(async () => {
    setError(null);
    if (isDemoMode) {
      localStorage.removeItem(DEMO_STORAGE_KEY);
      setIsDemoMode(false);
      setProfile(null);
      setHousehold(null);
      setMembers([]);
      setTransactions([]);
      return;
    }
    if (!supabase || !profile || !household) return;
    const { error: err } = await supabase
      .from("household_members")
      .delete()
      .eq("household_id", household.id)
      .eq("user_id", profile.id);
    if (err) {
      setError(err.message);
      throw err;
    }
    await fetchHouseholdBundle(profile.id);
  }, [fetchHouseholdBundle, household, isDemoMode, profile]);

  return {
    loading,
    refreshing,
    isDemoMode,
    isSupabaseReady: isSupabaseConfigured,
    passwordRecoveryMode,
    realtimeConnected,
    pendingSyncCount,
    error,
    clearError,
    refresh,
    syncOfflineQueue,
    profile,
    household,
    members,
    transactions,
    needs,
    bills,
    billPayments,
    enterDemoMode,
    signIn,
    signUp,
    signInWithGoogle,
    signInWithGoogleIdToken,
    resetPassword,
    updatePassword,
    updateProfile,
    deleteAccount,
    signOut,
    createHousehold,
    joinHousehold,
    regenerateInviteCode,
    renameHousehold,
    promoteMember,
    removeMember,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    addNeed,
    markNeedBought,
    toggleNeedMemberSettled,
    toggleNeed,
    deleteNeed,
    addBill,
    markBillPaid,
    toggleBillMemberSettled,
    settlePairwiseDebts,
    deleteBill,
    updateBudget,
    updateOverspendPlan,
    updateSurplusPlan,
    setWeeklyBoost,
    submitAppFeedback,
    leaveHousehold,
  };
}

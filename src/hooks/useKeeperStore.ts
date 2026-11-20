import { useCallback, useEffect, useRef, useState } from "react";
import { getMonthKey } from "../lib/analytics";
import { createDemoSeed } from "../lib/demoData";
import {
  createRateLimiter,
  generateClientInviteCode,
  sanitizeInviteCode,
} from "../lib/security";
import { isSupabaseConfigured, supabase } from "../lib/supabase";
import type {
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
  error: string | null;
  clearError: () => void;
  refresh: () => Promise<void>;
  profile: Profile | null;
  household: Household | null;
  members: HouseholdMember[];
  transactions: Transaction[];
  needs: HouseholdNeed[];
  bills: RecurringBill[];
  enterDemoMode: () => void;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (fullName: string, email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
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
  addNeed: (title: string, category: ExpenseCategoryId) => Promise<void>;
  toggleNeed: (id: string, isBought: boolean) => Promise<void>;
  deleteNeed: (id: string) => Promise<void>;
  addBill: (
    title: string,
    amount: number,
    category: ExpenseCategoryId,
    dueDay: number,
    intervalMonths?: number,
  ) => Promise<void>;
  markBillPaid: (id: string, monthKey?: string) => Promise<void>;
  deleteBill: (id: string) => Promise<void>;
  updateBudget: (weeklyBudget: number, memberShare: number) => Promise<void>;
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

export function useKeeperStore(): KeeperStore {
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [refreshing, setRefreshing] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [passwordRecoveryMode, setPasswordRecoveryMode] = useState(false);
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [household, setHousehold] = useState<Household | null>(null);
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [needs, setNeeds] = useState<HouseholdNeed[]>([]);
  const [bills, setBills] = useState<RecurringBill[]>([]);

  const inFlightFetchRef = useRef<Promise<void> | null>(null);
  const realtimeTimerRef = useRef<number | null>(null);

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

        if (membershipRes.error) {
          setError(membershipRes.error.message);
          return;
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
          setError(householdRes.error.message);
          return;
        }

        const h = householdRes.data;
        setHousehold({
          ...h,
          currency: "TZS",
          weekly_budget_target: Number(h.weekly_budget_target),
          member_weekly_share: Number(h.member_weekly_share),
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
          const normalizedNeeds: HouseholdNeed[] = needsRes.data.map((row: Record<string, unknown>) => {
            const adder = Array.isArray(row.adder) ? row.adder[0] : row.adder;
            const addedBy = row.added_by ? String(row.added_by) : null;
            return {
              id: String(row.id),
              household_id: String(row.household_id),
              added_by: addedBy,
              title: String(row.title),
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
          try {
            const rawMap = localStorage.getItem("keeper_bill_intervals_v1");
            if (rawMap) localIntervals = JSON.parse(rawMap) as Record<string, number>;
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
              created_at: String(row.created_at),
            };
          });
          setBills(normalizedBills);
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
        setIsDemoMode(false);
        await fetchHouseholdBundle(session.user.id, session.user);
      } else {
        setProfile(null);
        setHousehold(null);
        setMembers([]);
        setTransactions([]);
        setNeeds([]);
        setBills([]);
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
        scheduleSync,
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
        scheduleSync,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "recurring_bills", filter: `household_id=eq.${householdId}` },
        scheduleSync,
      )
      .subscribe((status) => {
        setRealtimeConnected(status === "SUBSCRIBED");
      });

    return () => {
      if (realtimeTimerRef.current) window.clearTimeout(realtimeTimerRef.current);
      void supabase?.removeChannel(channel);
      setRealtimeConnected(false);
    };
  }, [fetchHouseholdBundle, household?.id, isDemoMode, profile?.id]);

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
    const { data, error: err } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (err) {
      setError(err.message);
      throw err;
    }
    authRateLimiter.reset();
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
      setError(err.message);
      throw err;
    }

    if (data.session?.user) {
      authRateLimiter.reset();
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
      setIsDemoMode(false);
      await fetchHouseholdBundle(signInData.session.user.id, signInData.session.user);
      return;
    }

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
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
      },
    });
    if (err) {
      setError(err.message);
      throw err;
    }
  }, []);

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
    await supabase.auth.signOut();
  }, [isDemoMode]);

  const signOut = useCallback(async () => {
    setError(null);
    setPasswordRecoveryMode(false);
    if (isDemoMode) {
      setIsDemoMode(false);
      setProfile(null);
      setHousehold(null);
      setMembers([]);
      setTransactions([]);
      return;
    }
    if (supabase) {
      await supabase.auth.signOut();
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
      if (err && targetCategory === "wifi_internet") {
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
        setError(err.message);
        throw err;
      }
      await fetchHouseholdBundle(profile.id);
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
    async (title: string, category: ExpenseCategoryId) => {
      setError(null);
      if (!household || !profile) return;
      const cleanTitle = title.trim().slice(0, 120);
      if (!cleanTitle) return;

      if (isDemoMode) {
        const next: HouseholdNeed = {
          id: `need-${Date.now()}`,
          household_id: household.id,
          added_by: profile.id,
          title: cleanTitle,
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
      let { error: err } = await supabase.from("household_needs").insert({
        household_id: household.id,
        added_by: profile.id,
        title: cleanTitle,
        category,
      });
      if (err && category === "wifi_internet") {
        const retry = await supabase.from("household_needs").insert({
          household_id: household.id,
          added_by: profile.id,
          title: cleanTitle,
          category: "security_internet",
        });
        err = retry.error;
      }
      if (err) {
        setError(err.message);
        throw err;
      }
      await fetchHouseholdBundle(profile.id);
    },
    [fetchHouseholdBundle, household, isDemoMode, profile],
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
    [fetchHouseholdBundle, isDemoMode, profile],
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

  const addBill = useCallback(
    async (
      title: string,
      amount: number,
      category: ExpenseCategoryId,
      dueDay: number,
      intervalMonths = 1,
    ) => {
      setError(null);
      if (!household || !profile) return;
      const cleanTitle = title.trim().slice(0, 80);
      const safeAmount = Math.max(1, Math.round(amount));
      const safeDay = Math.min(31, Math.max(1, Math.round(dueDay)));
      const safeInterval = Math.min(60, Math.max(1, Math.round(intervalMonths || 1)));
      if (!cleanTitle) return;

      if (isDemoMode) {
        const next: RecurringBill = {
          id: `bill-${Date.now()}`,
          household_id: household.id,
          created_by: profile.id,
          title: cleanTitle,
          amount: safeAmount,
          category,
          due_day: safeDay,
          interval_months: safeInterval,
          last_paid_month: null,
          created_at: new Date().toISOString(),
        };
        setBills((prev) => [...prev, next].sort((a, b) => a.due_day - b.due_day));
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
        })
        .select("id")
        .single();

      // Fallback if DB has not applied `interval_months` or `wifi_internet` migration yet
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

      if (inserted?.id && safeInterval > 1) {
        try {
          const rawMap = localStorage.getItem("keeper_bill_intervals_v1");
          const map = rawMap ? (JSON.parse(rawMap) as Record<string, number>) : {};
          map[String(inserted.id)] = safeInterval;
          localStorage.setItem("keeper_bill_intervals_v1", JSON.stringify(map));
        } catch {
          // Ignore storage error
        }
      }

      await fetchHouseholdBundle(profile.id);
    },
    [fetchHouseholdBundle, household, isDemoMode, profile],
  );

  const markBillPaid = useCallback(
    async (id: string, monthKey = getMonthKey()) => {
      setError(null);
      if (isDemoMode) {
        setBills((prev) =>
          prev.map((b) => (b.id === id ? { ...b, last_paid_month: monthKey } : b)),
        );
        return;
      }
      if (!supabase || !profile) return;
      const { error: err } = await supabase
        .from("recurring_bills")
        .update({ last_paid_month: monthKey })
        .eq("id", id);
      if (err) {
        setError(err.message);
        throw err;
      }
      await fetchHouseholdBundle(profile.id);
    },
    [fetchHouseholdBundle, isDemoMode, profile],
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
    error,
    clearError,
    refresh,
    profile,
    household,
    members,
    transactions,
    needs,
    bills,
    enterDemoMode,
    signIn,
    signUp,
    signInWithGoogle,
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
    toggleNeed,
    deleteNeed,
    addBill,
    markBillPaid,
    deleteBill,
    updateBudget,
    leaveHousehold,
  };
}

import { useCallback, useEffect, useState } from "react";
import { createDemoSeed } from "../lib/demoData";
import {
  createRateLimiter,
  generateClientInviteCode,
  sanitizeInviteCode,
} from "../lib/security";
import { isSupabaseConfigured, supabase } from "../lib/supabase";

const authRateLimiter = createRateLimiter(5, 5 * 60 * 1000);
const resetRateLimiter = createRateLimiter(3, 10 * 60 * 1000);
const joinRateLimiter = createRateLimiter(5, 15 * 60 * 1000);
import type {
  Household,
  HouseholdMember,
  Profile,
  Transaction,
  TransactionCategory,
  TransactionType,
} from "../types";

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
  isDemoMode: boolean;
  isSupabaseReady: boolean;
  passwordRecoveryMode: boolean;
  realtimeConnected: boolean;
  error: string | null;
  clearError: () => void;
  profile: Profile | null;
  household: Household | null;
  members: HouseholdMember[];
  transactions: Transaction[];
  enterDemoMode: () => void;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (fullName: string, email: string, password: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updatePassword: (newPassword: string) => Promise<void>;
  signOut: () => Promise<void>;
  createHousehold: (name: string, weeklyBudget: number, memberShare: number) => Promise<void>;
  joinHousehold: (inviteCode: string) => Promise<void>;
  regenerateInviteCode: () => Promise<void>;
  addTransaction: (input: TransactionInput) => Promise<void>;
  updateTransaction: (id: string, input: TransactionInput) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  updateBudget: (weeklyBudget: number, memberShare: number) => Promise<void>;
  leaveHousehold: () => Promise<void>;
}

const DEMO_STORAGE_KEY = "keeper_demo_state_v1";

function loadDemoState() {
  try {
    const raw = localStorage.getItem(DEMO_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.household && Array.isArray(parsed?.transactions)) {
        return parsed as ReturnType<typeof createDemoSeed>;
      }
    }
  } catch {
    // Ignore storage read errors
  }
  return createDemoSeed();
}

export function useKeeperStore(): KeeperStore {
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [passwordRecoveryMode, setPasswordRecoveryMode] = useState(false);
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [household, setHousehold] = useState<Household | null>(null);
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  const clearError = useCallback(() => setError(null), []);

  const fetchHouseholdBundle = useCallback(async (userId: string) => {
    if (!supabase) return;

    const { data: profileRow } = await supabase
      .from("profiles")
      .select("id, full_name, email, avatar_color")
      .eq("id", userId)
      .maybeSingle();

    if (profileRow) {
      setProfile(profileRow as Profile);
    }

    const { data: membershipRows, error: memberErr } = await supabase
      .from("household_members")
      .select("household_id")
      .eq("user_id", userId)
      .order("joined_at", { ascending: false })
      .limit(1);

    if (memberErr) {
      setError(memberErr.message);
      return;
    }

    const activeHouseholdId = membershipRows?.[0]?.household_id as string | undefined;
    if (!activeHouseholdId) {
      setHousehold(null);
      setMembers([]);
      setTransactions([]);
      return;
    }

    const [householdRes, membersRes, txRes] = await Promise.all([
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
  }, []);

  // Bootstrap Supabase session listener
  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    let mounted = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      if (data.session?.user) {
        await fetchHouseholdBundle(data.session.user.id);
      }
      if (mounted) setLoading(false);
    });

    const { data: authSub } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      if (event === "PASSWORD_RECOVERY") {
        setPasswordRecoveryMode(true);
      }
      if (session?.user) {
        setIsDemoMode(false);
        await fetchHouseholdBundle(session.user.id);
      } else {
        setProfile(null);
        setHousehold(null);
        setMembers([]);
        setTransactions([]);
      }
      setLoading(false);
    });

    return () => {
      mounted = false;
      authSub.subscription.unsubscribe();
    };
  }, [fetchHouseholdBundle]);

  // Supabase Realtime sync for the active household
  useEffect(() => {
    if (!supabase || isDemoMode || !household?.id || !profile?.id) {
      setRealtimeConnected(false);
      return;
    }

    const householdId = household.id;
    const userId = profile.id;

    const channel = supabase
      .channel(`keeper-household-${householdId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "transactions", filter: `household_id=eq.${householdId}` },
        () => {
          void fetchHouseholdBundle(userId);
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "households", filter: `id=eq.${householdId}` },
        () => {
          void fetchHouseholdBundle(userId);
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "household_members", filter: `household_id=eq.${householdId}` },
        () => {
          void fetchHouseholdBundle(userId);
        },
      )
      .subscribe((status) => {
        setRealtimeConnected(status === "SUBSCRIBED");
      });

    return () => {
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
        JSON.stringify({ currentUser: profile, household, members, transactions }),
      );
    } catch {
      // Ignore storage write errors
    }
  }, [household, isDemoMode, members, profile, transactions]);

  const enterDemoMode = useCallback(() => {
    const seed = loadDemoState();
    setError(null);
    setIsDemoMode(true);
    setProfile(seed.currentUser);
    setHousehold(seed.household);
    setMembers(seed.members);
    setTransactions(seed.transactions);
  }, []);

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
    const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (err) {
      setError(err.message);
      throw err;
    }
    authRateLimiter.reset();
  }, []);

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
    const { data, error: err } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { full_name: fullName.trim().slice(0, 80) } },
    });
    if (err) {
      setError(err.message);
      throw err;
    }
    if (!data.session) {
      setError("Account created! Check your email to confirm your address, then sign in.");
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
    if (!supabase) return;
    const { error: err } = await supabase.auth.updateUser({ password: newPassword });
    if (err) {
      setError(err.message);
      throw err;
    }
    setPasswordRecoveryMode(false);
  }, []);

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
      const { error: err } = await supabase.from("transactions").insert({
        household_id: household.id,
        recorded_by: profile.id,
        paid_by: paidById,
        type: input.type,
        amount: Math.round(input.amount),
        category: input.type === "contribution" ? "contribution" : input.category,
        description: input.description.trim(),
        transaction_date: input.transaction_date,
      });
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
    isDemoMode,
    isSupabaseReady: isSupabaseConfigured,
    passwordRecoveryMode,
    realtimeConnected,
    error,
    clearError,
    profile,
    household,
    members,
    transactions,
    enterDemoMode,
    signIn,
    signUp,
    resetPassword,
    updatePassword,
    signOut,
    createHousehold,
    joinHousehold,
    regenerateInviteCode,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    updateBudget,
    leaveHousehold,
  };
}

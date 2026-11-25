import type { OverspendRecoveryPlan, WeeklyBoostEntry, WeeklySurplusPlan } from "../types";

const PLAN_KEY_PREFIX = "keeper_overspend_plan_v1:";
const SURPLUS_PLAN_KEY_PREFIX = "keeper_surplus_plan_v1:";
const BOOSTS_KEY_PREFIX = "keeper_weekly_boosts_v1:";
const NOTIF_KEY_PREFIX = "keeper_overspend_notified_v1:";
const CONGRATS_DISMISSED_PREFIX = "keeper_budget_congrats_dismissed_v1:";
const CONGRATS_NOTIFIED_PREFIX = "keeper_budget_congrats_notified_v1:";

export interface WeeklySurplusEvaluation {
  active: boolean;
  plan: WeeklySurplusPlan | null;
  appliedAmount: number;
  remainingPoolNeeded: number;
  adjustedMemberShare: number;
  savedPerMember: number;
}

export interface WeeklyBudgetSuccess {
  qualified: boolean;
  weekStartISO: string;
  spentAmount: number;
  targetAmount: number;
  savedAmount: number;
}

export interface OverspendEvaluation {
  status: "none" | "scheduled" | "active" | "completed";
  plan: OverspendRecoveryPlan | null;
  currentWeekNumber: number;
  totalWeeks: number;
  perWeekAmount: number;
  budgetDeduction: number;
  memberTopUp: number;
}

function parseISODateUTC(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y || 1970, (m || 1) - 1, d || 1);
}

export function addDaysISO(iso: string, days: number): string {
  const ms = parseISODateUTC(iso) + days * 24 * 60 * 60 * 1000;
  const dt = new Date(ms);
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const d = String(dt.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function evaluateOverspendPlan(
  plan: OverspendRecoveryPlan | null | undefined,
  currentWeekStartISO: string,
  memberCount: number,
): OverspendEvaluation {
  if (!plan || plan.totalAmount <= 0 || plan.weeks <= 0) {
    return {
      status: "none",
      plan: null,
      currentWeekNumber: 0,
      totalWeeks: 0,
      perWeekAmount: 0,
      budgetDeduction: 0,
      memberTopUp: 0,
    };
  }

  const perWeekAmount = Math.ceil(plan.totalAmount / plan.weeks);
  const safeMembers = Math.max(1, memberCount);
  const diffDays = Math.round(
    (parseISODateUTC(currentWeekStartISO) - parseISODateUTC(plan.startWeekISO)) /
      (24 * 60 * 60 * 1000),
  );
  const weekIndex = Math.floor(diffDays / 7);

  if (weekIndex < 0) {
    return {
      status: "scheduled",
      plan,
      currentWeekNumber: 0,
      totalWeeks: plan.weeks,
      perWeekAmount,
      budgetDeduction: 0,
      memberTopUp: 0,
    };
  }

  if (weekIndex >= plan.weeks) {
    return {
      status: "completed",
      plan,
      currentWeekNumber: plan.weeks,
      totalWeeks: plan.weeks,
      perWeekAmount,
      budgetDeduction: 0,
      memberTopUp: 0,
    };
  }

  return {
    status: "active",
    plan,
    currentWeekNumber: weekIndex + 1,
    totalWeeks: plan.weeks,
    perWeekAmount,
    budgetDeduction: plan.mode === "reduce_budget" ? perWeekAmount : 0,
    memberTopUp: plan.mode === "topup_share" ? Math.ceil(perWeekAmount / safeMembers) : 0,
  };
}

export function loadLocalOverspendPlan(householdId: string): OverspendRecoveryPlan | null {
  try {
    const raw = localStorage.getItem(`${PLAN_KEY_PREFIX}${householdId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<OverspendRecoveryPlan>;
    if (
      !parsed ||
      typeof parsed.startWeekISO !== "string" ||
      typeof parsed.totalAmount !== "number" ||
      typeof parsed.weeks !== "number" ||
      (parsed.mode !== "reduce_budget" && parsed.mode !== "topup_share")
    ) {
      return null;
    }
    return parsed as OverspendRecoveryPlan;
  } catch {
    return null;
  }
}

export function saveLocalOverspendPlan(
  householdId: string,
  plan: OverspendRecoveryPlan | null,
): void {
  try {
    const key = `${PLAN_KEY_PREFIX}${householdId}`;
    if (!plan) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(plan));
  } catch {
    // Ignore storage errors
  }
}

export function shouldNotifyOverspend(
  householdId: string,
  weekStartISO: string,
  overspendAmount: number,
): boolean {
  if (overspendAmount <= 0) return false;
  try {
    const raw = localStorage.getItem(`${NOTIF_KEY_PREFIX}${householdId}:${weekStartISO}`);
    const lastAmount = raw ? Number(raw) : 0;
    return !Number.isFinite(lastAmount) || overspendAmount > lastAmount;
  } catch {
    return true;
  }
}

export function markOverspendNotified(
  householdId: string,
  weekStartISO: string,
  overspendAmount: number,
): void {
  try {
    localStorage.setItem(
      `${NOTIF_KEY_PREFIX}${householdId}:${weekStartISO}`,
      String(Math.round(overspendAmount)),
    );
  } catch {
    // Ignore storage errors
  }
}

export function evaluateWeeklyBudgetSuccess(
  spentAmount: number,
  targetAmount: number,
  weekStartISO: string,
): WeeklyBudgetSuccess {
  const safeSpent = Math.max(0, Math.round(spentAmount));
  const safeTarget = Math.max(0, Math.round(targetAmount));
  const qualified = safeTarget > 0 && safeSpent > 0 && safeSpent <= safeTarget;
  return {
    qualified,
    weekStartISO,
    spentAmount: safeSpent,
    targetAmount: safeTarget,
    savedAmount: qualified ? safeTarget - safeSpent : 0,
  };
}

export function isWeeklyCongratsDismissed(householdId: string, weekStartISO: string): boolean {
  try {
    return localStorage.getItem(`${CONGRATS_DISMISSED_PREFIX}${householdId}:${weekStartISO}`) === "1";
  } catch {
    return false;
  }
}

export function dismissWeeklyCongrats(householdId: string, weekStartISO: string): void {
  try {
    localStorage.setItem(`${CONGRATS_DISMISSED_PREFIX}${householdId}:${weekStartISO}`, "1");
  } catch {
    // Ignore storage errors
  }
}

export function shouldNotifyWeeklyCongrats(householdId: string, weekStartISO: string): boolean {
  try {
    return localStorage.getItem(`${CONGRATS_NOTIFIED_PREFIX}${householdId}:${weekStartISO}`) !== "1";
  } catch {
    return false;
  }
}

export function markWeeklyCongratsNotified(householdId: string, weekStartISO: string): void {
  try {
    localStorage.setItem(`${CONGRATS_NOTIFIED_PREFIX}${householdId}:${weekStartISO}`, "1");
  } catch {
    // Ignore storage errors
  }
}

export function evaluateSurplusPlan(
  plan: WeeklySurplusPlan | null | undefined,
  currentWeekStartISO: string,
  weeklyBudgetTarget: number,
  memberWeeklyShare: number,
  memberCount: number,
): WeeklySurplusEvaluation {
  const safeTarget = Math.max(0, Math.round(weeklyBudgetTarget));
  const safeShare = Math.max(0, Math.round(memberWeeklyShare));
  const safeMembers = Math.max(1, memberCount);

  if (
    !plan ||
    plan.weekStartISO !== currentWeekStartISO ||
    !Number.isFinite(plan.appliedAmount) ||
    plan.appliedAmount <= 0
  ) {
    return {
      active: false,
      plan: null,
      appliedAmount: 0,
      remainingPoolNeeded: safeTarget,
      adjustedMemberShare: safeShare,
      savedPerMember: 0,
    };
  }

  const appliedAmount = Math.min(Math.round(plan.appliedAmount), safeTarget);
  const remainingPoolNeeded = Math.max(0, safeTarget - appliedAmount);
  const adjustedMemberShare =
    remainingPoolNeeded > 0 ? Math.ceil(remainingPoolNeeded / safeMembers) : 0;
  const savedPerMember = Math.max(0, safeShare - adjustedMemberShare);

  return {
    active: true,
    plan,
    appliedAmount,
    remainingPoolNeeded,
    adjustedMemberShare,
    savedPerMember,
  };
}

export function loadLocalSurplusPlan(householdId: string): WeeklySurplusPlan | null {
  try {
    const raw = localStorage.getItem(`${SURPLUS_PLAN_KEY_PREFIX}${householdId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<WeeklySurplusPlan>;
    if (
      !parsed ||
      typeof parsed.weekStartISO !== "string" ||
      typeof parsed.appliedAmount !== "number" ||
      parsed.appliedAmount <= 0
    ) {
      return null;
    }
    return parsed as WeeklySurplusPlan;
  } catch {
    return null;
  }
}

export function saveLocalSurplusPlan(
  householdId: string,
  plan: WeeklySurplusPlan | null,
): void {
  try {
    const key = `${SURPLUS_PLAN_KEY_PREFIX}${householdId}`;
    if (!plan) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(plan));
  } catch {
    // Ignore storage errors
  }
}

export function loadLocalWeeklyBoosts(householdId: string): WeeklyBoostEntry[] {
  try {
    const raw = localStorage.getItem(`${BOOSTS_KEY_PREFIX}${householdId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is WeeklyBoostEntry =>
        Boolean(item) &&
        typeof item.weekStartISO === "string" &&
        typeof item.extraPerMember === "number" &&
        item.extraPerMember > 0 &&
        typeof item.extraTotal === "number" &&
        item.extraTotal > 0,
    );
  } catch {
    return [];
  }
}

export function saveLocalWeeklyBoosts(householdId: string, boosts: WeeklyBoostEntry[]): void {
  try {
    const key = `${BOOSTS_KEY_PREFIX}${householdId}`;
    if (boosts.length === 0) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(boosts.slice(0, 24)));
  } catch {
    // Ignore storage errors
  }
}

export function getBoostForWeek(
  boosts: WeeklyBoostEntry[] | null | undefined,
  weekStartISO: string,
): WeeklyBoostEntry | null {
  if (!boosts || boosts.length === 0) return null;
  return boosts.find((b) => b.weekStartISO === weekStartISO) ?? null;
}

export function upsertWeeklyBoost(
  boosts: WeeklyBoostEntry[] | null | undefined,
  entry: WeeklyBoostEntry,
): WeeklyBoostEntry[] {
  const existing = (boosts ?? []).filter((b) => b.weekStartISO !== entry.weekStartISO);
  return [entry, ...existing]
    .sort((a, b) => b.weekStartISO.localeCompare(a.weekStartISO))
    .slice(0, 24);
}

export function removeWeeklyBoost(
  boosts: WeeklyBoostEntry[] | null | undefined,
  weekStartISO: string,
): WeeklyBoostEntry[] {
  return (boosts ?? []).filter((b) => b.weekStartISO !== weekStartISO);
}

export function sumPriorWeeklyBoostPerMember(
  boosts: WeeklyBoostEntry[] | null | undefined,
  anchorCycleStartISO: string,
  currentWeekStartISO: string,
): number {
  if (!boosts || boosts.length === 0) return 0;
  let total = 0;
  for (const b of boosts) {
    if (b.weekStartISO >= anchorCycleStartISO && b.weekStartISO < currentWeekStartISO) {
      total += Math.max(0, Math.round(b.extraPerMember));
    }
  }
  return total;
}

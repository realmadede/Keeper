import type { OverspendRecoveryPlan } from "../types";

const PLAN_KEY_PREFIX = "keeper_overspend_plan_v1:";
const NOTIF_KEY_PREFIX = "keeper_overspend_notified_v1:";

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

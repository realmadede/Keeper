import { beforeEach, describe, expect, it } from "vitest";
import {
  addDaysISO,
  dismissWeeklyCongrats,
  evaluateOverspendPlan,
  evaluateWeeklyBudgetSuccess,
  isWeeklyCongratsDismissed,
  loadLocalOverspendPlan,
  markOverspendNotified,
  markWeeklyCongratsNotified,
  saveLocalOverspendPlan,
  shouldNotifyOverspend,
  shouldNotifyWeeklyCongrats,
} from "./overspendPlan";
import type { OverspendRecoveryPlan } from "../types";

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

describe("overspendPlan", () => {
  beforeEach(() => {
    memoryStorage.clear();
  });

  it("evaluates reduce_budget plans cleanly across scheduled, active, and completed weeks", () => {
    const plan: OverspendRecoveryPlan = {
      sourceWeekStartISO: "2026-11-16",
      startWeekISO: "2026-11-23",
      totalAmount: 20000,
      weeks: 2,
      mode: "reduce_budget",
      createdAt: "2026-11-22T12:00:00Z",
    };

    const scheduled = evaluateOverspendPlan(plan, "2026-11-16", 4);
    expect(scheduled.status).toBe("scheduled");
    expect(scheduled.budgetDeduction).toBe(0);
    expect(scheduled.perWeekAmount).toBe(10000);

    const week1 = evaluateOverspendPlan(plan, "2026-11-23", 4);
    expect(week1.status).toBe("active");
    expect(week1.currentWeekNumber).toBe(1);
    expect(week1.budgetDeduction).toBe(10000);
    expect(week1.memberTopUp).toBe(0);

    const week2 = evaluateOverspendPlan(plan, "2026-11-30", 4);
    expect(week2.status).toBe("active");
    expect(week2.currentWeekNumber).toBe(2);
    expect(week2.budgetDeduction).toBe(10000);

    const done = evaluateOverspendPlan(plan, "2026-12-07", 4);
    expect(done.status).toBe("completed");
    expect(done.budgetDeduction).toBe(0);
  });

  it("evaluates topup_share plans per member without reducing spending target", () => {
    const plan: OverspendRecoveryPlan = {
      sourceWeekStartISO: "2026-11-16",
      startWeekISO: addDaysISO("2026-11-16", 7),
      totalAmount: 20000,
      weeks: 2,
      mode: "topup_share",
      createdAt: "2026-11-22T12:00:00Z",
    };

    const week1 = evaluateOverspendPlan(plan, "2026-11-23", 4);
    expect(week1.status).toBe("active");
    expect(week1.budgetDeduction).toBe(0);
    expect(week1.memberTopUp).toBe(2500);
  });

  it("persists local plans and deduplicates overspend notifications per week", () => {
    const plan: OverspendRecoveryPlan = {
      sourceWeekStartISO: "2026-11-16",
      startWeekISO: "2026-11-23",
      totalAmount: 15000,
      weeks: 1,
      mode: "reduce_budget",
      createdAt: "2026-11-22T12:00:00Z",
    };
    saveLocalOverspendPlan("h1", plan);
    expect(loadLocalOverspendPlan("h1")?.totalAmount).toBe(15000);

    saveLocalOverspendPlan("h1", null);
    expect(loadLocalOverspendPlan("h1")).toBeNull();

    expect(shouldNotifyOverspend("h1", "2026-11-23", 10000)).toBe(true);
    markOverspendNotified("h1", "2026-11-23", 10000);
    expect(shouldNotifyOverspend("h1", "2026-11-23", 10000)).toBe(false);
    expect(shouldNotifyOverspend("h1", "2026-11-23", 15000)).toBe(true);
  });

  it("qualifies completed on-budget weeks with real activity and skips empty or overspent weeks", () => {
    const ok = evaluateWeeklyBudgetSuccess(82000, 100000, "2026-11-16");
    expect(ok.qualified).toBe(true);
    expect(ok.savedAmount).toBe(18000);

    const empty = evaluateWeeklyBudgetSuccess(0, 100000, "2026-11-16");
    expect(empty.qualified).toBe(false);

    const over = evaluateWeeklyBudgetSuccess(105000, 100000, "2026-11-16");
    expect(over.qualified).toBe(false);

    expect(isWeeklyCongratsDismissed("h1", "2026-11-16")).toBe(false);
    dismissWeeklyCongrats("h1", "2026-11-16");
    expect(isWeeklyCongratsDismissed("h1", "2026-11-16")).toBe(true);

    expect(shouldNotifyWeeklyCongrats("h1", "2026-11-16")).toBe(true);
    markWeeklyCongratsNotified("h1", "2026-11-16");
    expect(shouldNotifyWeeklyCongrats("h1", "2026-11-16")).toBe(false);
  });
});

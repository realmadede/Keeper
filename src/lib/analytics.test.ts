import { describe, expect, it } from "vitest";
import {
  computeMemberTotals,
  computePeriodSummary,
  computeWeeklySummary,
  computeWhoOwesWhom,
  getBillDueStatus,
  getWeekWindow,
  resolveWeekStartDay,
} from "./analytics";
import { formatCompactTZS, formatTZS } from "./format";
import type { HouseholdMember, HouseholdNeed, RecurringBill, Transaction } from "../types";

const REF_DATE = new Date(2026, 10, 19); // Thursday Nov 19, 2026

const MEMBERS: HouseholdMember[] = [
  {
    household_id: "h1",
    user_id: "u1",
    role: "admin",
    joined_at: "2026-11-01T00:00:00Z",
    profile: { id: "u1", full_name: "Amani Juma", email: "amani@example.com", avatar_color: "#BFA377" },
  },
  {
    household_id: "h1",
    user_id: "u2",
    role: "member",
    joined_at: "2026-11-01T00:00:00Z",
    profile: { id: "u2", full_name: "Neema Hassan", email: "neema@example.com", avatar_color: "#3B82F6" },
  },
];

describe("formatTZS & formatCompactTZS", () => {
  it("formats positive and negative TZS amounts cleanly", () => {
    expect(formatTZS(123000)).toBe("TZS 123,000");
    expect(formatTZS(-15500)).toBe("-TZS 15,500");
    expect(formatCompactTZS(35000)).toBe("35K");
    expect(formatCompactTZS(1_500_000)).toBe("1.5M");
  });
});

describe("getWeekWindow", () => {
  it("computes Monday–Sunday bounds for the reference week", () => {
    const win = getWeekWindow(0, REF_DATE);
    expect(win.startISO).toBe("2026-11-16");
    expect(win.endISO).toBe("2026-11-22");
    expect(win.days).toHaveLength(7);
    expect(win.days[0].dayShort).toBe("Mon");
    expect(win.days[6].dayShort).toBe("Sun");
  });

  it("anchors 7-day cycle to custom start weekday (e.g. Wednesday-Tuesday) and auto-detects from first entry", () => {
    const wedTxns: Transaction[] = [
      {
        id: "t-wed",
        household_id: "h1",
        recorded_by: "u1",
        type: "contribution",
        amount: 45000,
        category: "contribution",
        description: "Wednesday pool",
        transaction_date: "2026-11-18", // Wednesday
        created_at: "2026-11-18T08:00:00Z",
      },
    ];
    const resolved = resolveWeekStartDay(wedTxns);
    expect(resolved.startDay).toBe(3); // 3 = Wednesday
    expect(resolved.isManual).toBe(false);

    // On Monday Nov 23, 2026 (day 6 of the Wed-Tue cycle), the active week is still Nov 18 - Nov 24
    const mondayInCycle = new Date(2026, 10, 23);
    const win = getWeekWindow(0, mondayInCycle, resolved.startDay);
    expect(win.startISO).toBe("2026-11-18");
    expect(win.endISO).toBe("2026-11-24");
    expect(win.days[0].dayShort).toBe("Wed");
    expect(win.days[6].dayShort).toBe("Tue");
  });
});

describe("computeWeeklySummary", () => {
  const txns: Transaction[] = [
    // Current week (Nov 16–22)
    {
      id: "t1",
      household_id: "h1",
      recorded_by: "u1",
      type: "contribution",
      amount: 60000,
      category: "contribution",
      description: "Weekly pool",
      transaction_date: "2026-11-16",
      created_at: "2026-11-16T09:00:00Z",
    },
    {
      id: "t2",
      household_id: "h1",
      recorded_by: "u2",
      type: "contribution",
      amount: 60000,
      category: "contribution",
      description: "Weekly pool",
      transaction_date: "2026-11-17",
      created_at: "2026-11-17T09:00:00Z",
    },
    {
      id: "t3",
      household_id: "h1",
      recorded_by: "u1",
      type: "expense",
      amount: 30000,
      category: "food",
      description: "Market groceries",
      transaction_date: "2026-11-18",
      created_at: "2026-11-18T12:00:00Z",
    },
    {
      id: "t4",
      household_id: "h1",
      recorded_by: "u2",
      type: "expense",
      amount: 20000,
      category: "electricity_water",
      description: "LUKU tokens",
      transaction_date: "2026-11-19",
      created_at: "2026-11-19T14:00:00Z",
    },
    // Previous week (Nov 9–15)
    {
      id: "t5",
      household_id: "h1",
      recorded_by: "u1",
      type: "expense",
      amount: 40000,
      category: "food",
      description: "Last week groceries",
      transaction_date: "2026-11-12",
      created_at: "2026-11-12T10:00:00Z",
    },
  ];

  it("aggregates totals, remaining balance, category splits, and deltas accurately", () => {
    const summary = computeWeeklySummary(txns, MEMBERS, 60000, 0, REF_DATE);
    expect(summary.totalContributed).toBe(120000);
    expect(summary.totalSpent).toBe(50000);
    expect(summary.remainingBalance).toBe(70000);
    expect(summary.spentDeltaPct).toBe(25); // 50k vs 40k = +25%
    expect(summary.categories).toHaveLength(2);
    expect(summary.categories[0]).toMatchObject({ id: "food", amount: 30000, percent: 60 });
    expect(summary.categories[1]).toMatchObject({
      id: "electricity_water",
      amount: 20000,
      percent: 40,
    });
    expect(summary.memberStatuses[0].percentOfShare).toBe(100);
    expect(summary.dailySeries.find((d) => d.iso === "2026-11-18")?.spent).toBe(30000);
  });

  it("computes monthly period summaries grouped into W1-W5 buckets", () => {
    const monthly = computePeriodSummary(txns, MEMBERS, 60000, "this_month", REF_DATE);
    expect(monthly.totalContributed).toBe(120000);
    expect(monthly.totalSpent).toBe(90000); // 30k + 20k + 40k all in Nov 2026
    expect(monthly.dailySeries).toHaveLength(5);
    expect(monthly.dailySeries[0].dayShort).toBe("W1");
    expect(monthly.dailySeries[1].spent).toBe(40000); // Nov 12 -> W2
    expect(monthly.dailySeries[2].spent).toBe(50000); // Nov 18 & 19 -> W3
  });

  it("carries over lump-sum member contribution surplus across subsequent weeks", () => {
    const lumpSumTxns: Transaction[] = [
      {
        id: "t-lump",
        household_id: "h1",
        recorded_by: "u1",
        paid_by: "u1",
        type: "contribution",
        amount: 60000, // 4 weeks of a 15,000/wk share paid in week Nov 9-15
        category: "contribution",
        description: "4-week advance contribution",
        transaction_date: "2026-11-10",
        created_at: "2026-11-10T09:00:00Z",
      },
    ];
    // Current week is Nov 16-22 (REF_DATE = Nov 19), u1 pays 0 new cash this week
    const summary = computeWeeklySummary(lumpSumTxns, MEMBERS, 15000, 0, REF_DATE);
    const amani = summary.memberStatuses.find((s) => s.member.user_id === "u1")!;
    expect(amani.contributedThisWeek).toBe(0);
    expect(amani.carryOverCredit).toBe(45000); // 60k - 15k used in prior week
    expect(amani.effectiveContributed).toBe(45000);
    expect(amani.coveredByAdvance).toBe(true);
    expect(amani.advanceBalance).toBe(30000); // 45k - 15k used this week = 30k ahead
    expect(amani.weeksCoveredAhead).toBe(2);
    expect(amani.percentOfShare).toBe(100);
  });

  it("deducts prior-week contribution shortfall from upcoming week contributions until cleared", () => {
    const shortfallTxns: Transaction[] = [
      {
        id: "t-short-w1",
        household_id: "h1",
        recorded_by: "u1",
        paid_by: "u1",
        type: "contribution",
        amount: 10000, // Expected 30,000 in week Nov 9-15 -> 20,000 shortfall
        category: "contribution",
        description: "Partial week 1",
        transaction_date: "2026-11-10",
        created_at: "2026-11-10T09:00:00Z",
      },
      {
        id: "t-short-w2",
        household_id: "h1",
        recorded_by: "u1",
        paid_by: "u1",
        type: "contribution",
        amount: 30000, // Pays 30,000 in week Nov 16-22 -> 20,000 clears last week's debt, 10,000 counts for this week
        category: "contribution",
        description: "Week 2 pool",
        transaction_date: "2026-11-17",
        created_at: "2026-11-17T09:00:00Z",
      },
    ];
    const summary = computeWeeklySummary(shortfallTxns, MEMBERS, 30000, 0, REF_DATE);
    const amani = summary.memberStatuses.find((s) => s.member.user_id === "u1")!;
    expect(amani.contributedThisWeek).toBe(30000);
    expect(amani.priorShortfall).toBe(20000);
    expect(amani.effectiveContributed).toBe(10000); // 30k - 20k debt
    expect(amani.remainingDue).toBe(20000);
    expect(amani.percentOfShare).toBe(33);
  });

  it("applies early/advance weekly contributions paid before a Wed-Tue cycle starts to this week's KPI totals", () => {
    const threeMembers: HouseholdMember[] = [
      ...MEMBERS,
      {
        household_id: "h1",
        user_id: "u3",
        role: "member",
        joined_at: "2026-11-01T00:00:00Z",
        profile: { id: "u3", full_name: "Juma Ali", email: "juma@example.com", avatar_color: "#10B981" },
      },
    ];
    const earlyCycleTxns: Transaction[] = [
      // Week 1 (Wed Nov 18 - Tue Nov 24): 45,000 contributed, 43,500 spent -> 1,500 saved
      {
        id: "w1-c1",
        household_id: "h1",
        recorded_by: "u1",
        paid_by: "u1",
        type: "contribution",
        amount: 15000,
        category: "contribution",
        description: "Week 1",
        transaction_date: "2026-11-18",
        created_at: "2026-11-18T08:00:00Z",
      },
      {
        id: "w1-c2",
        household_id: "h1",
        recorded_by: "u2",
        paid_by: "u2",
        type: "contribution",
        amount: 15000,
        category: "contribution",
        description: "Week 1",
        transaction_date: "2026-11-18",
        created_at: "2026-11-18T08:01:00Z",
      },
      {
        id: "w1-c3",
        household_id: "h1",
        recorded_by: "u3",
        paid_by: "u3",
        type: "contribution",
        amount: 15000,
        category: "contribution",
        description: "Week 1",
        transaction_date: "2026-11-18",
        created_at: "2026-11-18T08:02:00Z",
      },
      {
        id: "w1-exp",
        household_id: "h1",
        recorded_by: "u1",
        type: "expense",
        amount: 43500,
        category: "food",
        description: "Week 1 food",
        transaction_date: "2026-11-20",
        created_at: "2026-11-20T12:00:00Z",
      },
      // Week 2's 45,000 paid 1 day early on Tue Nov 24
      {
        id: "w2-early",
        household_id: "h1",
        recorded_by: "u1",
        paid_by: "u1",
        type: "contribution",
        amount: 45000,
        category: "contribution",
        description: "Week 2 pool paid early",
        transaction_date: "2026-11-24",
        created_at: "2026-11-24T18:00:00Z",
      },
      // Day 1 of Week 2 (Wed Nov 25): 30,000 spent
      {
        id: "w2-exp",
        household_id: "h1",
        recorded_by: "u1",
        type: "expense",
        amount: 30000,
        category: "food",
        description: "Wed groceries",
        transaction_date: "2026-11-25",
        created_at: "2026-11-25T10:00:00Z",
      },
    ];

    const wedRef = new Date(2026, 10, 25); // Wed Nov 25, 2026
    const summary = computeWeeklySummary(earlyCycleTxns, threeMembers, 15000, 0, wedRef, 3, 45000);
    expect(summary.totalContributed).toBe(0);
    expect(summary.appliedAdvanceCredit).toBe(45000);
    expect(summary.effectiveTotalContributed).toBe(45000);
    expect(summary.totalSpent).toBe(30000);
    expect(summary.remainingBalance).toBe(15000);
    expect(summary.allTimeBalance).toBe(16500);
  });
});

describe("getBillDueStatus", () => {
  const baseBill: RecurringBill = {
    id: "b1",
    household_id: "h1",
    created_by: "u1",
    title: "Fiber Wi-Fi",
    amount: 70000,
    category: "security_internet",
    due_day: 21,
    last_paid_month: null,
    created_at: "2026-11-01T00:00:00Z",
  };

  it("identifies due soon, overdue, and paid this month bills accurately", () => {
    // REF_DATE is Nov 19, 2026
    const dueSoon = getBillDueStatus(baseBill, REF_DATE);
    expect(dueSoon.isDueSoon).toBe(true);
    expect(dueSoon.statusLabel).toBe("Due in 2 days");

    const overdue = getBillDueStatus({ ...baseBill, due_day: 15 }, REF_DATE);
    expect(overdue.isOverdue).toBe(true);
    expect(overdue.statusLabel).toBe("Overdue by 4 days");

    const paid = getBillDueStatus({ ...baseBill, last_paid_month: "2026-11" }, REF_DATE);
    expect(paid.isPaidThisMonth).toBe(true);
    expect(paid.statusLabel).toBe("Paid this month");

    // 4-month bill paid on Oct 1, 2026 stays settled in Nov 2026 / Jan 2027 (due Feb 1, 2027)
    const fourMonthBill: RecurringBill = {
      ...baseBill,
      title: "4-Month House Rent",
      due_day: 1,
      interval_months: 4,
      last_paid_month: "2026-10",
    };
    const inNovember = getBillDueStatus(fourMonthBill, new Date(2026, 10, 20));
    expect(inNovember.isPaidThisMonth).toBe(true);
    expect(inNovember.isDueSoon).toBe(false);
    expect(inNovember.statusLabel).toBe("Settled · due Feb 1, 2027");
    expect(inNovember.paidDateLabel).toBe("Oct 1, 2026");
    expect(inNovember.nextDueDateLabel).toBe("Feb 1, 2027");

    const inFebruary = getBillDueStatus(fourMonthBill, new Date(2027, 1, 1));
    expect(inFebruary.isPaidThisMonth).toBe(false);
    expect(inFebruary.isDueSoon).toBe(true);
    expect(inFebruary.statusLabel).toBe("Due today");
  });
});

describe("computeMemberTotals", () => {
  it("sums contributions, bills, and needs without double-counting pool_amount_used", () => {
    const txns: Transaction[] = [
      {
        id: "t1",
        household_id: "h1",
        recorded_by: "u1",
        paid_by: "u1",
        type: "contribution",
        amount: 30000,
        category: "contribution",
        description: "Weekly pool",
        transaction_date: "2026-11-18",
        created_at: "2026-11-18T09:00:00Z",
      },
    ];
    const bills: RecurringBill[] = [
      {
        id: "b1",
        household_id: "h1",
        created_by: "u1",
        title: "Wi-Fi",
        amount: 60000,
        pool_amount_used: 10000, // 50,000 remaining split 2 ways = 25,000 each
        category: "wifi_internet",
        due_day: 1,
        last_paid_month: "2026-11",
        paid_mode: "all",
        paid_by: null,
        settled_by: [],
        created_at: "2026-11-01T00:00:00Z",
      },
    ];
    const needs: HouseholdNeed[] = [
      {
        id: "n1",
        household_id: "h1",
        added_by: "u1",
        title: "Cooking gas",
        actual_amount: 20000,
        pool_amount_used: 0,
        paid_mode: "single",
        paid_by: "u2",
        settled_by: [], // u1 has not paid back u2's 10,000 share yet
        category: "supplies",
        is_bought: true,
        bought_at: "2026-11-19T10:00:00Z",
        created_at: "2026-11-19T09:00:00Z",
      },
    ];

    const totals = computeMemberTotals(MEMBERS, txns, bills, needs, "this_month", REF_DATE);
    const amani = totals.find((m) => m.member.user_id === "u1")!;
    const neema = totals.find((m) => m.member.user_id === "u2")!;

    expect(amani.contributionsPaid).toBe(30000);
    expect(amani.billsPaid).toBe(25000);
    expect(amani.needsPaid).toBe(0);
    expect(amani.totalPaid).toBe(55000);
    expect(amani.netPayback).toBe(-10000); // owes Neema 10,000

    expect(neema.contributionsPaid).toBe(0);
    expect(neema.billsPaid).toBe(25000);
    expect(neema.needsPaid).toBe(20000); // fronted full 20,000
    expect(neema.totalPaid).toBe(45000);
    expect(neema.netPayback).toBe(10000); // owed 10,000 back
  });
});

describe("computeWhoOwesWhom", () => {
  it("nets opposing 1-member bill and need debts into a single roommate transfer", () => {
    const bills: RecurringBill[] = [
      {
        id: "b1",
        household_id: "h1",
        created_by: "u1",
        title: "Wi-Fi",
        amount: 60000, // u1 covered -> u2 owes u1 30,000
        pool_amount_used: 0,
        category: "wifi_internet",
        due_day: 1,
        last_paid_month: "2026-11",
        paid_mode: "single",
        paid_by: "u1",
        settled_by: [],
        created_at: "2026-11-01T00:00:00Z",
      },
    ];
    const needs: HouseholdNeed[] = [
      {
        id: "n1",
        household_id: "h1",
        added_by: "u2",
        title: "Gas",
        actual_amount: 20000, // u2 covered -> u1 owes u2 10,000
        pool_amount_used: 0,
        paid_mode: "single",
        paid_by: "u2",
        settled_by: [],
        category: "supplies",
        is_bought: true,
        bought_at: "2026-11-19T10:00:00Z",
        created_at: "2026-11-19T09:00:00Z",
      },
    ];
    const transfers = computeWhoOwesWhom(MEMBERS, bills, needs);
    expect(transfers).toHaveLength(1);
    expect(transfers[0].from.user_id).toBe("u2");
    expect(transfers[0].to.user_id).toBe("u1");
    expect(transfers[0].amount).toBe(20000); // 30k - 10k net
    expect(transfers[0].itemCount).toBe(2);
  });
});

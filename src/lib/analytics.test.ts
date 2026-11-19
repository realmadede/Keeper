import { describe, expect, it } from "vitest";
import { computeWeeklySummary, getWeekWindow } from "./analytics";
import { formatCompactTZS, formatTZS } from "./format";
import type { HouseholdMember, Transaction } from "../types";

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
});

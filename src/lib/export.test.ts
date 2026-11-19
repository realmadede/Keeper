import { describe, expect, it } from "vitest";
import { computeWeeklySummary, getWeekWindow } from "./analytics";
import { buildLedgerCsv, buildWeeklyWhatsAppSummary } from "./export";
import type { Household, HouseholdMember, Transaction } from "../types";

const REF_DATE = new Date(2026, 10, 19);

const HOUSEHOLD: Household = {
  id: "h1",
  name: "Sinza House 14",
  currency: "TZS",
  weekly_budget_target: 120000,
  member_weekly_share: 60000,
  invite_code: "SNZ414",
  created_by: "u1",
  created_at: "2026-11-01T00:00:00Z",
};

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

const TRANSACTIONS: Transaction[] = [
  {
    id: "t1",
    household_id: "h1",
    recorded_by: "u1",
    paid_by: "u2",
    type: "contribution",
    amount: 60000,
    category: "contribution",
    description: "Cash pool, collected by Amani",
    transaction_date: "2026-11-18",
    created_at: "2026-11-18T10:00:00Z",
    recorder: MEMBERS[0].profile,
    payer: MEMBERS[1].profile,
  },
  {
    id: "t2",
    household_id: "h1",
    recorded_by: "u1",
    type: "expense",
    amount: 25000,
    category: "electricity_water",
    description: 'LUKU "Prepaid" Tokens',
    transaction_date: "2026-11-19",
    created_at: "2026-11-19T12:00:00Z",
    updated_at: "2026-11-19T12:05:00Z",
    recorder: MEMBERS[0].profile,
  },
  {
    id: "t-old",
    household_id: "h1",
    recorded_by: "u1",
    paid_by: "u1",
    type: "contribution",
    amount: 50000,
    category: "contribution",
    description: "Carryover pool",
    transaction_date: "2026-11-10",
    created_at: "2026-11-10T09:00:00Z",
    recorder: MEMBERS[0].profile,
    payer: MEMBERS[0].profile,
  },
];

describe("paid_by crediting, rollover balance, WhatsApp summary & CSV export", () => {
  it("credits contribution to paid_by roommate and computes all-time carry-over balance", () => {
    const summary = computeWeeklySummary(TRANSACTIONS, MEMBERS, 60000, 0, REF_DATE);
    // Neema (u2) should be credited 60,000 even though Amani (u1) recorded it
    const amani = summary.memberStatuses.find((m) => m.member.user_id === "u1")!;
    const neema = summary.memberStatuses.find((m) => m.member.user_id === "u2")!;
    expect(amani.contributedThisWeek).toBe(0);
    expect(neema.contributedThisWeek).toBe(60000);
    expect(neema.percentOfShare).toBe(100);
    // Weekly remaining = 60k - 25k = 35k; All-time rollover = (60k + 50k) - 25k = 85k
    expect(summary.remainingBalance).toBe(35000);
    expect(summary.allTimeBalance).toBe(85000);
  });

  it("builds a clean emoji-free WhatsApp weekly summary", () => {
    const week = getWeekWindow(0, REF_DATE);
    const summary = computeWeeklySummary(TRANSACTIONS, MEMBERS, 60000, 0, REF_DATE);
    const text = buildWeeklyWhatsAppSummary(HOUSEHOLD, week, summary);
    expect(text).toContain("Sinza House 14");
    expect(text).toContain("Cash on Hand (All-Time Pool): TZS 85,000");
    expect(text).toContain("Neema Hassan: TZS 60,000 / TZS 60,000 (Paid)");
    expect(text).toContain("Amani Juma: TZS 0 / TZS 60,000 (Pending)");
  });

  it("escapes CSV cells properly including commas, quotes, Paid_By, and Edited", () => {
    const csv = buildLedgerCsv(TRANSACTIONS.slice(0, 2));
    const lines = csv.split("\n");
    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain('"Cash pool, collected by Amani",60000,Neema Hassan,Amani Juma,No');
    expect(lines[2]).toContain('"LUKU ""Prepaid"" Tokens",25000,Amani Juma,Amani Juma,Yes');
  });
});

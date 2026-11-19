import {
  EXPENSE_CATEGORIES,
  type ExpenseCategoryId,
  type HouseholdMember,
  type Transaction,
} from "../types";
import { toISODate } from "./format";

export interface WeekWindow {
  offset: number; // 0 = This Week, -1 = Last Week, etc.
  label: string;
  monthLabel: string;
  startISO: string; // Monday YYYY-MM-DD
  endISO: string; // Sunday YYYY-MM-DD
  days: { iso: string; dayShort: string }[];
}

export interface DailyBarPoint {
  dayShort: string;
  iso: string;
  contributed: number;
  spent: number;
}

export interface CategoryBreakdownItem {
  id: ExpenseCategoryId;
  label: string;
  color: string;
  amount: number;
  percent: number;
}

export interface MemberContributionStatus {
  member: HouseholdMember;
  contributedThisWeek: number;
  spentRecordedThisWeek: number;
  expectedShare: number;
  percentOfShare: number;
}

export interface WeeklySummary {
  totalContributed: number;
  totalSpent: number;
  remainingBalance: number;
  allTimeBalance: number;
  spentDeltaPct: number | null;
  contributedDeltaPct: number | null;
  dailySeries: DailyBarPoint[];
  categories: CategoryBreakdownItem[];
  memberStatuses: MemberContributionStatus[];
  weekTransactions: Transaction[];
}

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Returns Monday 00:00 local time for the week containing `referenceDate`, shifted by `weekOffset` weeks. */
export function getWeekWindow(weekOffset = 0, referenceDate = new Date()): WeekWindow {
  const base = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate(),
  );
  const jsDay = base.getDay(); // 0=Sun..6=Sat
  const diffToMonday = jsDay === 0 ? -6 : 1 - jsDay;
  const monday = new Date(base);
  monday.setDate(base.getDate() + diffToMonday + weekOffset * 7);

  const days = DAY_NAMES.map((dayShort, idx) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + idx);
    return { iso: toISODate(d), dayShort };
  });

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  let label = "This Week";
  if (weekOffset === -1) label = "Last Week";
  else if (weekOffset < -1) {
    label = `${monday.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${sunday.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
  }

  const monthLabel = monday.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  return {
    offset: weekOffset,
    label,
    monthLabel,
    startISO: days[0].iso,
    endISO: days[6].iso,
    days,
  };
}

function pctChange(current: number, previous: number): number | null {
  if (previous <= 0) return current > 0 ? 100 : null;
  return Math.round(((current - previous) / previous) * 100);
}

export function computeAllTimeBalance(transactions: Transaction[]): number {
  let balance = 0;
  for (const t of transactions) {
    if (t.type === "contribution") balance += t.amount;
    else balance -= t.amount;
  }
  return balance;
}

export function computeWeeklySummary(
  transactions: Transaction[],
  members: HouseholdMember[],
  memberWeeklyShare: number,
  weekOffset = 0,
  referenceDate = new Date(),
): WeeklySummary {
  const currentWeek = getWeekWindow(weekOffset, referenceDate);
  const prevWeek = getWeekWindow(weekOffset - 1, referenceDate);

  const weekTransactions = transactions.filter(
    (t) => t.transaction_date >= currentWeek.startISO && t.transaction_date <= currentWeek.endISO,
  );
  const prevTransactions = transactions.filter(
    (t) => t.transaction_date >= prevWeek.startISO && t.transaction_date <= prevWeek.endISO,
  );

  let totalContributed = 0;
  let totalSpent = 0;
  for (const t of weekTransactions) {
    if (t.type === "contribution") totalContributed += t.amount;
    else totalSpent += t.amount;
  }

  let prevContributed = 0;
  let prevSpent = 0;
  for (const t of prevTransactions) {
    if (t.type === "contribution") prevContributed += t.amount;
    else prevSpent += t.amount;
  }

  const dailyMap = new Map<string, DailyBarPoint>();
  for (const d of currentWeek.days) {
    dailyMap.set(d.iso, {
      dayShort: d.dayShort,
      iso: d.iso,
      contributed: 0,
      spent: 0,
    });
  }
  for (const t of weekTransactions) {
    const point = dailyMap.get(t.transaction_date);
    if (!point) continue;
    if (t.type === "contribution") point.contributed += t.amount;
    else point.spent += t.amount;
  }

  const categoryTotals = new Map<ExpenseCategoryId, number>();
  for (const t of weekTransactions) {
    if (t.type === "expense" && t.category !== "contribution") {
      categoryTotals.set(t.category, (categoryTotals.get(t.category) ?? 0) + t.amount);
    }
  }

  const categories: CategoryBreakdownItem[] = EXPENSE_CATEGORIES.map((cat) => {
    const amount = categoryTotals.get(cat.id) ?? 0;
    const percent = totalSpent > 0 ? Number(((amount / totalSpent) * 100).toFixed(1)) : 0;
    return {
      id: cat.id,
      label: cat.label,
      color: cat.color,
      amount,
      percent,
    };
  })
    .filter((c) => c.amount > 0)
    .sort((a, b) => b.amount - a.amount);

  const memberStatuses: MemberContributionStatus[] = members.map((member) => {
    let contributedThisWeek = 0;
    let spentRecordedThisWeek = 0;
    for (const t of weekTransactions) {
      if (t.type === "contribution") {
        const creditedUserId = t.paid_by || t.recorded_by;
        if (creditedUserId === member.user_id) contributedThisWeek += t.amount;
      } else if (t.recorded_by === member.user_id) {
        spentRecordedThisWeek += t.amount;
      }
    }
    const percentOfShare =
      memberWeeklyShare > 0
        ? Math.min(100, Math.round((contributedThisWeek / memberWeeklyShare) * 100))
        : 100;
    return {
      member,
      contributedThisWeek,
      spentRecordedThisWeek,
      expectedShare: memberWeeklyShare,
      percentOfShare,
    };
  });

  return {
    totalContributed,
    totalSpent,
    remainingBalance: totalContributed - totalSpent,
    allTimeBalance: computeAllTimeBalance(transactions),
    spentDeltaPct: pctChange(totalSpent, prevSpent),
    contributedDeltaPct: pctChange(totalContributed, prevContributed),
    dailySeries: currentWeek.days.map((d) => dailyMap.get(d.iso)!),
    categories,
    memberStatuses,
    weekTransactions,
  };
}

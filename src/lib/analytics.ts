import {
  EXPENSE_CATEGORIES,
  type ExpenseCategoryId,
  type HouseholdMember,
  type PeriodKey,
  type RecurringBill,
  type Transaction,
} from "../types";
import { toISODate } from "./format";

export interface WeekWindow {
  kind: "week" | "month";
  key: PeriodKey;
  offset: number;
  label: string;
  comparisonLabel: string; // "From last week" | "From last month"
  monthLabel: string;
  startISO: string;
  endISO: string;
  days: { iso: string; dayShort: string }[];
}

export interface DailyBarPoint {
  dayShort: string;
  iso: string;
  detailLabel: string;
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
  carryOverCredit: number;
  effectiveContributed: number;
  advanceBalance: number;
  weeksCoveredAhead: number;
  coveredByAdvance: boolean;
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

export interface BillDueStatus {
  isPaidThisMonth: boolean;
  daysUntilDue: number;
  isDueSoon: boolean;
  isOverdue: boolean;
  statusLabel: string;
}

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function getMonthKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export function getBillDueStatus(bill: RecurringBill, referenceDate = new Date()): BillDueStatus {
  const currentMonthKey = getMonthKey(referenceDate);
  if (bill.last_paid_month === currentMonthKey) {
    return {
      isPaidThisMonth: true,
      daysUntilDue: 0,
      isDueSoon: false,
      isOverdue: false,
      statusLabel: "Paid this month",
    };
  }

  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const clampedDueDay = Math.min(bill.due_day, daysInMonth);
  const diff = clampedDueDay - referenceDate.getDate();

  if (diff < 0) {
    const overdueDays = Math.abs(diff);
    return {
      isPaidThisMonth: false,
      daysUntilDue: diff,
      isDueSoon: true,
      isOverdue: true,
      statusLabel: `Overdue by ${overdueDays} ${overdueDays === 1 ? "day" : "days"}`,
    };
  }
  if (diff === 0) {
    return {
      isPaidThisMonth: false,
      daysUntilDue: 0,
      isDueSoon: true,
      isOverdue: false,
      statusLabel: "Due today",
    };
  }
  if (diff <= 3) {
    return {
      isPaidThisMonth: false,
      daysUntilDue: diff,
      isDueSoon: true,
      isOverdue: false,
      statusLabel: `Due in ${diff} ${diff === 1 ? "day" : "days"}`,
    };
  }
  return {
    isPaidThisMonth: false,
    daysUntilDue: diff,
    isDueSoon: false,
    isOverdue: false,
    statusLabel: `Due day ${clampedDueDay} (in ${diff}d)`,
  };
}

/** Returns Monday 00:00 local time for the week containing `referenceDate`, shifted by `weekOffset` weeks. */
export function getWeekWindow(weekOffset = 0, referenceDate = new Date()): WeekWindow {
  const base = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate(),
  );
  const jsDay = base.getDay();
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
  let key: PeriodKey = "this_week";
  if (weekOffset === -1) {
    label = "Last Week";
    key = "last_week";
  } else if (weekOffset < -1) {
    label = `${monday.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${sunday.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
    key = "two_weeks_ago";
  }

  const monthLabel = monday.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  return {
    kind: "week",
    key,
    offset: weekOffset,
    label,
    comparisonLabel: "From last week",
    monthLabel,
    startISO: days[0].iso,
    endISO: days[6].iso,
    days,
  };
}

export function getMonthWindow(monthOffset = 0, referenceDate = new Date()): WeekWindow {
  const first = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + monthOffset, 1);
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0);
  const totalDays = last.getDate();

  const days: { iso: string; dayShort: string }[] = [];
  for (let d = 1; d <= totalDays; d++) {
    const dt = new Date(first.getFullYear(), first.getMonth(), d);
    days.push({ iso: toISODate(dt), dayShort: String(d) });
  }

  const monthLabel = first.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  return {
    kind: "month",
    key: monthOffset === 0 ? "this_month" : "last_month",
    offset: monthOffset,
    label: monthOffset === 0 ? "This Month" : "Last Month",
    comparisonLabel: "From last month",
    monthLabel,
    startISO: toISODate(first),
    endISO: toISODate(last),
    days,
  };
}

export function getPeriodWindow(periodKey: PeriodKey, referenceDate = new Date()): WeekWindow {
  switch (periodKey) {
    case "this_week":
      return getWeekWindow(0, referenceDate);
    case "last_week":
      return getWeekWindow(-1, referenceDate);
    case "two_weeks_ago":
      return getWeekWindow(-2, referenceDate);
    case "this_month":
      return getMonthWindow(0, referenceDate);
    case "last_month":
      return getMonthWindow(-1, referenceDate);
  }
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

export function computePeriodSummary(
  transactions: Transaction[],
  members: HouseholdMember[],
  memberWeeklyShare: number,
  periodKey: PeriodKey = "this_week",
  referenceDate = new Date(),
): WeeklySummary {
  const currentPeriod = getPeriodWindow(periodKey, referenceDate);
  const prevPeriod =
    currentPeriod.kind === "week"
      ? getWeekWindow(currentPeriod.offset - 1, referenceDate)
      : getMonthWindow(currentPeriod.offset - 1, referenceDate);

  const periodTransactions = transactions.filter(
    (t) => t.transaction_date >= currentPeriod.startISO && t.transaction_date <= currentPeriod.endISO,
  );
  const prevTransactions = transactions.filter(
    (t) => t.transaction_date >= prevPeriod.startISO && t.transaction_date <= prevPeriod.endISO,
  );

  let totalContributed = 0;
  let totalSpent = 0;
  for (const t of periodTransactions) {
    if (t.type === "contribution") totalContributed += t.amount;
    else totalSpent += t.amount;
  }

  let prevContributed = 0;
  let prevSpent = 0;
  for (const t of prevTransactions) {
    if (t.type === "contribution") prevContributed += t.amount;
    else prevSpent += t.amount;
  }

  let dailySeries: DailyBarPoint[];

  if (currentPeriod.kind === "week") {
    const dailyMap = new Map<string, DailyBarPoint>();
    for (const d of currentPeriod.days) {
      dailyMap.set(d.iso, {
        dayShort: d.dayShort,
        iso: d.iso,
        detailLabel: d.iso,
        contributed: 0,
        spent: 0,
      });
    }
    for (const t of periodTransactions) {
      const point = dailyMap.get(t.transaction_date);
      if (!point) continue;
      if (t.type === "contribution") point.contributed += t.amount;
      else point.spent += t.amount;
    }
    dailySeries = currentPeriod.days.map((d) => dailyMap.get(d.iso)!);
  } else {
    // Group monthly view cleanly into W1..W5 buckets (days 1-7, 8-14, 15-21, 22-28, 29-31)
    const totalDays = currentPeriod.days.length;
    const bucketCount = Math.ceil(totalDays / 7);
    const shortMonth = currentPeriod.monthLabel.split(" ")[0].slice(0, 3);
    dailySeries = Array.from({ length: bucketCount }, (_, idx) => {
      const startDay = idx * 7 + 1;
      const endDay = Math.min(totalDays, (idx + 1) * 7);
      return {
        dayShort: `W${idx + 1}`,
        iso: currentPeriod.days[startDay - 1].iso,
        detailLabel: `${shortMonth} ${startDay}-${endDay}`,
        contributed: 0,
        spent: 0,
      };
    });

    for (const t of periodTransactions) {
      const dayOfMonth = Number(t.transaction_date.slice(8, 10));
      if (!dayOfMonth) continue;
      const bucketIdx = Math.min(bucketCount - 1, Math.floor((dayOfMonth - 1) / 7));
      if (t.type === "contribution") dailySeries[bucketIdx].contributed += t.amount;
      else dailySeries[bucketIdx].spent += t.amount;
    }
  }

  const categoryTotals = new Map<ExpenseCategoryId, number>();
  for (const t of periodTransactions) {
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

  const shareMultiplier = currentPeriod.kind === "month" ? 4 : 1;
  const expectedShare = memberWeeklyShare * shareMultiplier;

  const toMondayMs = (iso: string): number => {
    const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
    const dt = new Date(Date.UTC(y || 2026, (m || 1) - 1, d || 1));
    const day = dt.getUTCDay();
    const diff = day === 0 ? -6 : 1 - day;
    dt.setUTCDate(dt.getUTCDate() + diff);
    return dt.getTime();
  };

  const priorTransactions = transactions.filter(
    (t) => t.transaction_date < currentPeriod.startISO,
  );
  let earliestPriorISO: string | null = null;
  for (const t of priorTransactions) {
    if (!earliestPriorISO || t.transaction_date < earliestPriorISO) {
      earliestPriorISO = t.transaction_date;
    }
  }
  const currentStartMondayMs = toMondayMs(currentPeriod.startISO);
  const WEEK_MS = 7 * 24 * 3600 * 1000;

  const memberStatuses: MemberContributionStatus[] = members.map((member) => {
    let contributedThisWeek = 0;
    let spentRecordedThisWeek = 0;
    for (const t of periodTransactions) {
      if (t.type === "contribution") {
        const creditedUserId = t.paid_by || t.recorded_by;
        if (creditedUserId === member.user_id) contributedThisWeek += t.amount;
      } else if (t.recorded_by === member.user_id) {
        spentRecordedThisWeek += t.amount;
      }
    }

    let priorContributed = 0;
    let earliestMemberPriorISO: string | null = null;
    for (const t of priorTransactions) {
      if (t.type === "contribution") {
        const creditedUserId = t.paid_by || t.recorded_by;
        if (creditedUserId === member.user_id) {
          priorContributed += t.amount;
          if (!earliestMemberPriorISO || t.transaction_date < earliestMemberPriorISO) {
            earliestMemberPriorISO = t.transaction_date;
          }
        }
      }
    }

    let carryOverCredit = 0;
    if (memberWeeklyShare > 0 && priorContributed > 0 && earliestPriorISO) {
      const joinedISO = member.joined_at ? member.joined_at.slice(0, 10) : earliestPriorISO;
      const anchorISO =
        earliestMemberPriorISO && earliestMemberPriorISO < joinedISO
          ? earliestMemberPriorISO
          : joinedISO > earliestPriorISO
            ? joinedISO
            : earliestPriorISO;
      const elapsedWeeks = Math.max(
        1,
        Math.round((currentStartMondayMs - toMondayMs(anchorISO)) / WEEK_MS),
      );
      const priorExpected = elapsedWeeks * memberWeeklyShare;
      carryOverCredit = Math.max(0, priorContributed - priorExpected);
    }

    const effectiveContributed = contributedThisWeek + carryOverCredit;
    const advanceBalance =
      expectedShare > 0 ? Math.max(0, effectiveContributed - expectedShare) : 0;
    const weeksCoveredAhead =
      memberWeeklyShare > 0 && advanceBalance > 0
        ? Math.floor(advanceBalance / memberWeeklyShare)
        : 0;
    const coveredByAdvance =
      expectedShare > 0 &&
      contributedThisWeek < expectedShare &&
      effectiveContributed >= expectedShare;

    const percentOfShare =
      expectedShare > 0
        ? Math.min(100, Math.round((effectiveContributed / expectedShare) * 100))
        : 100;
    return {
      member,
      contributedThisWeek,
      carryOverCredit,
      effectiveContributed,
      advanceBalance,
      weeksCoveredAhead,
      coveredByAdvance,
      spentRecordedThisWeek,
      expectedShare,
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
    dailySeries,
    categories,
    memberStatuses,
    weekTransactions: periodTransactions,
  };
}

/** Backwards-compatible helper for weekly summaries. */
export function computeWeeklySummary(
  transactions: Transaction[],
  members: HouseholdMember[],
  memberWeeklyShare: number,
  weekOffset = 0,
  referenceDate = new Date(),
): WeeklySummary {
  const key: PeriodKey =
    weekOffset === 0 ? "this_week" : weekOffset === -1 ? "last_week" : "two_weeks_ago";
  return computePeriodSummary(transactions, members, memberWeeklyShare, key, referenceDate);
}

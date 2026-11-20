import {
  EXPENSE_CATEGORIES,
  type ExpenseCategoryId,
  type HouseholdMember,
  type HouseholdNeed,
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
  paidDateLabel?: string;
  nextDueDateLabel?: string;
}

export const JS_DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
export const JS_DAY_FULL = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

/**
 * Resolves the household's 7-day cycle start weekday (0 = Sun .. 6 = Sat).
 * Automatically anchors to the weekday of the household's earliest recorded transaction
 * (or household creation date) unless a manual override (0..6) is set.
 */
export function resolveWeekStartDay(
  transactions: Transaction[],
  householdCreatedAt?: string,
  manualOverride?: number | null,
): { startDay: number; autoDay: number; isManual: boolean } {
  let earliestISO: string | null = null;
  for (const t of transactions) {
    if (!earliestISO || t.transaction_date < earliestISO) {
      earliestISO = t.transaction_date;
    }
  }

  let autoDay = 1; // Default Monday
  if (earliestISO && /^\d{4}-\d{2}-\d{2}$/.test(earliestISO)) {
    const [y, m, d] = earliestISO.split("-").map(Number);
    autoDay = new Date(y, m - 1, d).getDay();
  } else if (householdCreatedAt) {
    const parsed = new Date(householdCreatedAt);
    if (!Number.isNaN(parsed.getTime())) {
      autoDay = parsed.getDay();
    }
  }

  if (
    typeof manualOverride === "number" &&
    Number.isInteger(manualOverride) &&
    manualOverride >= 0 &&
    manualOverride <= 6
  ) {
    return { startDay: manualOverride, autoDay, isManual: true };
  }

  return { startDay: autoDay, autoDay, isManual: false };
}

export function getMonthKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export function getBillDueStatus(bill: RecurringBill, referenceDate = new Date()): BillDueStatus {
  const intervalMonths = Math.max(1, Math.round(bill.interval_months ?? 1));
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth(); // 0..11
  const todayMidnight = new Date(year, month, referenceDate.getDate());

  if (bill.last_paid_month && /^\d{4}-\d{2}$/.test(bill.last_paid_month)) {
    const [paidYear, paidMonth1] = bill.last_paid_month.split("-").map(Number);
    const paidMonthIdx = paidMonth1 - 1;
    const paidMonthDays = new Date(paidYear, paidMonthIdx + 1, 0).getDate();
    const paidDay = Math.min(bill.due_day, paidMonthDays);
    const paidDate = new Date(paidYear, paidMonthIdx, paidDay);

    const targetMonthIdx = paidMonthIdx + intervalMonths;
    const nextYear = paidYear + Math.floor(targetMonthIdx / 12);
    const nextMonth0 = ((targetMonthIdx % 12) + 12) % 12;
    const nextMonthDays = new Date(nextYear, nextMonth0 + 1, 0).getDate();
    const nextDueDay = Math.min(bill.due_day, nextMonthDays);
    const nextDueDate = new Date(nextYear, nextMonth0, nextDueDay);

    const paidDateLabel = paidDate.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    const nextDueDateLabel = nextDueDate.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

    if (intervalMonths === 1 && bill.last_paid_month === getMonthKey(referenceDate)) {
      return {
        isPaidThisMonth: true,
        daysUntilDue: 0,
        isDueSoon: false,
        isOverdue: false,
        statusLabel: "Paid this month",
        paidDateLabel,
        nextDueDateLabel,
      };
    }

    if (todayMidnight < nextDueDate) {
      const msPerDay = 24 * 3600 * 1000;
      const daysLeft = Math.round((nextDueDate.getTime() - todayMidnight.getTime()) / msPerDay);
      const nextDueShort = nextDueDate.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
      return {
        isPaidThisMonth: true,
        daysUntilDue: daysLeft,
        isDueSoon: false,
        isOverdue: false,
        statusLabel: intervalMonths === 1 ? "Paid this month" : `Settled · due ${nextDueShort}`,
        paidDateLabel,
        nextDueDateLabel,
      };
    }
  }
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

/**
 * Returns the 7-day window starting on `startDayOfWeek` (0=Sun..6=Sat, default 1=Mon)
 * containing `referenceDate`, shifted by `weekOffset` weeks.
 */
export function getWeekWindow(
  weekOffset = 0,
  referenceDate = new Date(),
  startDayOfWeek = 1,
): WeekWindow {
  const base = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate(),
  );
  const jsDay = base.getDay();
  const normalizedStart = ((startDayOfWeek % 7) + 7) % 7;
  const diffToStart = -((jsDay - normalizedStart + 7) % 7);
  const cycleStart = new Date(base);
  cycleStart.setDate(base.getDate() + diffToStart + weekOffset * 7);

  const days = Array.from({ length: 7 }, (_, idx) => {
    const d = new Date(cycleStart);
    d.setDate(cycleStart.getDate() + idx);
    return { iso: toISODate(d), dayShort: JS_DAY_SHORT[d.getDay()] };
  });

  const cycleEnd = new Date(cycleStart);
  cycleEnd.setDate(cycleStart.getDate() + 6);

  let label = "This Week";
  let key: PeriodKey = "this_week";
  if (weekOffset === -1) {
    label = "Last Week";
    key = "last_week";
  } else if (weekOffset < -1) {
    label = `${cycleStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${cycleEnd.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
    key = "two_weeks_ago";
  }

  const monthLabel = cycleStart.toLocaleDateString("en-US", {
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

export function getPeriodWindow(
  periodKey: PeriodKey,
  referenceDate = new Date(),
  startDayOfWeek = 1,
): WeekWindow {
  switch (periodKey) {
    case "this_week":
      return getWeekWindow(0, referenceDate, startDayOfWeek);
    case "last_week":
      return getWeekWindow(-1, referenceDate, startDayOfWeek);
    case "two_weeks_ago":
      return getWeekWindow(-2, referenceDate, startDayOfWeek);
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
  startDayOfWeek = 1,
): WeeklySummary {
  const normalizedStart = ((startDayOfWeek % 7) + 7) % 7;
  const currentPeriod = getPeriodWindow(periodKey, referenceDate, normalizedStart);
  const prevPeriod =
    currentPeriod.kind === "week"
      ? getWeekWindow(currentPeriod.offset - 1, referenceDate, normalizedStart)
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

  const toCycleStartMs = (iso: string): number => {
    const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
    const dt = new Date(Date.UTC(y || 2026, (m || 1) - 1, d || 1));
    const day = dt.getUTCDay();
    const diff = -((day - normalizedStart + 7) % 7);
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
  const currentStartMondayMs = toCycleStartMs(currentPeriod.startISO);
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
        Math.round((currentStartMondayMs - toCycleStartMs(anchorISO)) / WEEK_MS),
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
  startDayOfWeek = 1,
): WeeklySummary {
  const key: PeriodKey =
    weekOffset === 0 ? "this_week" : weekOffset === -1 ? "last_week" : "two_weeks_ago";
  return computePeriodSummary(
    transactions,
    members,
    memberWeeklyShare,
    key,
    referenceDate,
    startDayOfWeek,
  );
}

export interface MemberTotalItem {
  source: "contribution" | "bill" | "need";
  label: string;
  amount: number;
  dateLabel?: string;
}

export interface MemberTotalSummary {
  member: HouseholdMember;
  contributionsPaid: number;
  billsPaid: number;
  needsPaid: number;
  totalPaid: number;
  netPayback: number; // > 0 means others owe this member; < 0 means this member owes others
  items: MemberTotalItem[];
}

/**
 * Computes every roommate's true out-of-pocket total across Contributions, Bills, and Needs.
 * Subtracts `pool_amount_used` from Bills and Needs so leftover contribution cash is never double-counted.
 */
export function computeMemberTotals(
  members: HouseholdMember[],
  transactions: Transaction[],
  bills: RecurringBill[],
  needs: HouseholdNeed[],
  scope: "all_time" | "this_month" = "all_time",
  referenceDate = new Date(),
): MemberTotalSummary[] {
  const monthPrefix = getMonthKey(referenceDate);
  const memberCount = Math.max(1, members.length);

  const byUser = new Map<string, MemberTotalSummary>();
  for (const member of members) {
    byUser.set(member.user_id, {
      member,
      contributionsPaid: 0,
      billsPaid: 0,
      needsPaid: 0,
      totalPaid: 0,
      netPayback: 0,
      items: [],
    });
  }

  // 1. Contributions
  for (const t of transactions) {
    if (t.type !== "contribution") continue;
    if (scope === "this_month" && !t.transaction_date.startsWith(monthPrefix)) continue;
    const creditedId = t.paid_by || t.recorded_by;
    const entry = byUser.get(creditedId);
    if (!entry) continue;
    entry.contributionsPaid += t.amount;
    entry.items.push({
      source: "contribution",
      label: t.description || "Weekly contribution",
      amount: t.amount,
      dateLabel: t.transaction_date,
    });
  }

  // 2. Paid Bills (non-pool remainder only)
  for (const b of bills) {
    if (!b.last_paid_month) continue;
    if (scope === "this_month" && b.last_paid_month !== monthPrefix) continue;
    const poolUsed = Math.max(0, Math.min(b.amount, b.pool_amount_used ?? 0));
    const remainder = Math.max(0, b.amount - poolUsed);
    if (remainder <= 0) continue;
    const share = Math.round(remainder / memberCount);

    if (b.paid_mode === "single" && b.paid_by && byUser.has(b.paid_by)) {
      const payer = byUser.get(b.paid_by)!;
      const settledSet = new Set(b.settled_by ?? []);
      let settledOthers = 0;
      for (const m of members) {
        if (m.user_id === b.paid_by) continue;
        const other = byUser.get(m.user_id)!;
        if (settledSet.has(m.user_id)) {
          settledOthers += 1;
          other.billsPaid += share;
          other.items.push({
            source: "bill",
            label: `${b.title} (paid back)`,
            amount: share,
            dateLabel: b.last_paid_month,
          });
        } else {
          other.netPayback -= share;
          payer.netPayback += share;
        }
      }
      const payerNet = Math.max(0, remainder - settledOthers * share);
      payer.billsPaid += payerNet;
      payer.items.push({
        source: "bill",
        label: settledOthers > 0 ? `${b.title} (net after payback)` : `${b.title} (covered)`,
        amount: payerNet,
        dateLabel: b.last_paid_month,
      });
    } else {
      for (const m of members) {
        const entry = byUser.get(m.user_id)!;
        entry.billsPaid += share;
        entry.items.push({
          source: "bill",
          label: `${b.title} (split)`,
          amount: share,
          dateLabel: b.last_paid_month,
        });
      }
    }
  }

  // 3. Bought Needs (non-pool remainder only)
  for (const n of needs) {
    if (!n.is_bought) continue;
    const finalAmt = n.actual_amount ?? n.estimated_amount ?? 0;
    if (finalAmt <= 0) continue;
    const dateStr = (n.bought_at || n.created_at || "").slice(0, 10);
    if (scope === "this_month" && !dateStr.startsWith(monthPrefix)) continue;
    const poolUsed = Math.max(0, Math.min(finalAmt, n.pool_amount_used ?? 0));
    const remainder = Math.max(0, finalAmt - poolUsed);
    if (remainder <= 0) continue;
    const share = Math.round(remainder / memberCount);

    if (n.paid_mode === "single" && n.paid_by && byUser.has(n.paid_by)) {
      const payer = byUser.get(n.paid_by)!;
      const settledSet = new Set(n.settled_by ?? []);
      let settledOthers = 0;
      for (const m of members) {
        if (m.user_id === n.paid_by) continue;
        const other = byUser.get(m.user_id)!;
        if (settledSet.has(m.user_id)) {
          settledOthers += 1;
          other.needsPaid += share;
          other.items.push({
            source: "need",
            label: `${n.title} (paid back)`,
            amount: share,
            dateLabel: dateStr,
          });
        } else {
          other.netPayback -= share;
          payer.netPayback += share;
        }
      }
      const payerNet = Math.max(0, remainder - settledOthers * share);
      payer.needsPaid += payerNet;
      payer.items.push({
        source: "need",
        label: settledOthers > 0 ? `${n.title} (net after payback)` : `${n.title} (covered)`,
        amount: payerNet,
        dateLabel: dateStr,
      });
    } else {
      for (const m of members) {
        const entry = byUser.get(m.user_id)!;
        entry.needsPaid += share;
        entry.items.push({
          source: "need",
          label: `${n.title} (split)`,
          amount: share,
          dateLabel: dateStr,
        });
      }
    }
  }

  return Array.from(byUser.values())
    .map((s) => ({
      ...s,
      totalPaid: s.contributionsPaid + s.billsPaid + s.needsPaid,
    }))
    .sort((a, b) => b.totalPaid - a.totalPaid);
}

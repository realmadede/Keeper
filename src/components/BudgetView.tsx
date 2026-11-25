import { useState, type FormEvent } from "react";
import {
  AlertTriangle,
  Calendar,
  CalendarClock,
  Check,
  CheckCircle2,
  Plus,
  Share2,
  ShoppingBasket,
  Trash2,
  X,
} from "lucide-react";
import {
  getBillDueStatus,
  JS_DAY_SHORT,
  type WeeklySummary,
  type WeekWindow,
} from "../lib/analytics";
import { buildWeeklyWhatsAppSummary } from "../lib/export";
import { formatTZS, getInitials, toISODate } from "../lib/format";
import {
  addDaysISO,
  evaluateOverspendPlan,
  evaluateSurplusPlan,
  getBoostForWeek,
} from "../lib/overspendPlan";
import {
  EXPENSE_CATEGORIES,
  type BillPaymentRecord,
  type BudgetSubTab,
  type ExpenseCategoryId,
  type Household,
  type HouseholdMember,
  type HouseholdNeed,
  type OverspendRecoveryMode,
  type OverspendRecoveryPlan,
  type RecurringBill,
  type WeeklyBoostEntry,
  type WeeklySurplusPlan,
} from "../types";
import { CategoryIcon } from "./CategoryIcon";
import { IosDatePicker } from "./IosDatePicker";
import { SoftButton, SoftInput, SoftSegmented } from "./LightControls";

interface BudgetViewProps {
  household: Household;
  members: HouseholdMember[];
  currentUserId: string;
  weekWindow: WeekWindow;
  summary: WeeklySummary;
  subTab: BudgetSubTab;
  onSubTabChange: (tab: BudgetSubTab) => void;
  weekStartOverride: number | null;
  autoStartDay: number;
  onChangeWeekStart: (day: number | null) => void;
  needs: HouseholdNeed[];
  bills: RecurringBill[];
  billPayments: BillPaymentRecord[];
  onUpdateBudget: (weeklyBudget: number, memberShare: number) => Promise<void>;
  onUpdateOverspendPlan?: (plan: OverspendRecoveryPlan | null) => Promise<void>;
  onUpdateSurplusPlan?: (plan: WeeklySurplusPlan | null) => Promise<void>;
  onSetWeeklyBoost?: (entry: WeeklyBoostEntry | null, weekStartISO: string) => Promise<void>;
  onAddNeed: (
    title: string,
    category: ExpenseCategoryId,
    options?: { quantity?: string | null; estimatedAmount?: number | null },
  ) => Promise<void>;
  onMarkNeedBought: (
    id: string,
    options: {
      actualAmount?: number | null;
      paidMode?: "all" | "single";
      paidBy?: string | null;
      poolAmountUsed?: number;
    },
  ) => Promise<void>;
  onToggleNeedMemberSettled: (needId: string, memberUserId: string) => Promise<void>;
  onToggleNeed: (id: string, isBought: boolean) => Promise<void>;
  onDeleteNeed: (id: string) => Promise<void>;
  onAddBill: (
    title: string,
    amount: number,
    category: ExpenseCategoryId,
    dueDay: number,
    intervalMonths?: number,
    paidDateISO?: string | null,
    paidMode?: "all" | "single",
    paidBy?: string | null,
    poolAmountUsed?: number,
  ) => Promise<void>;
  onMarkBillPaid: (
    id: string,
    paidDateISO: string,
    paidMode?: "all" | "single",
    paidBy?: string | null,
    poolAmountUsed?: number,
  ) => Promise<void>;
  onToggleBillMemberSettled: (billId: string, memberUserId: string) => Promise<void>;
  onDeleteBill: (id: string) => Promise<void>;
}

const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const; // Mon..Sun
const BILL_INTERVAL_PRESETS = [1, 3, 4, 6, 12] as const;

export function BudgetView({
  household,
  members,
  currentUserId,
  weekWindow,
  summary,
  subTab,
  onSubTabChange,
  weekStartOverride,
  autoStartDay,
  onChangeWeekStart,
  needs,
  bills,
  billPayments,
  onUpdateBudget,
  onUpdateOverspendPlan,
  onUpdateSurplusPlan,
  onSetWeeklyBoost,
  onAddNeed,
  onMarkNeedBought,
  onToggleNeedMemberSettled,
  onToggleNeed,
  onDeleteNeed,
  onAddBill,
  onMarkBillPaid,
  onToggleBillMemberSettled,
  onDeleteBill,
}: BudgetViewProps) {
  // Pool budget form
  const [weeklyTarget, setWeeklyTarget] = useState(String(household.weekly_budget_target));
  const [memberShare, setMemberShare] = useState(String(household.member_weekly_share));
  const [saving, setSaving] = useState(false);
  const [savedToast, setSavedToast] = useState(false);
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [remindedUserId, setRemindedUserId] = useState<string | null>(null);

  // Add Need form
  const [needTitle, setNeedTitle] = useState("");
  const [needQty, setNeedQty] = useState("");
  const [needEstimate, setNeedEstimate] = useState("");
  const [needCategory, setNeedCategory] = useState<ExpenseCategoryId>("food");
  const [addingNeed, setAddingNeed] = useState(false);

  // Inline Mark Need Bought panel
  const [buyingNeedId, setBuyingNeedId] = useState<string | null>(null);
  const [buyingActualAmount, setBuyingActualAmount] = useState("");
  const [buyingPaidMode, setBuyingPaidMode] = useState<"all" | "single">("all");
  const [buyingPaidBy, setBuyingPaidBy] = useState(currentUserId);
  const [buyingUsePool, setBuyingUsePool] = useState(false);
  const [buyingPoolAmount, setBuyingPoolAmount] = useState("");
  const [savingBoughtNeedId, setSavingBoughtNeedId] = useState<string | null>(null);

  // Add Bill form
  const [showBillForm, setShowBillForm] = useState(false);
  const [billTitle, setBillTitle] = useState("");
  const [billAmount, setBillAmount] = useState("");
  const [billCategory, setBillCategory] = useState<ExpenseCategoryId>("rent");
  const [billDateISO, setBillDateISO] = useState(() => toISODate(new Date()));
  const [billAlreadyPaid, setBillAlreadyPaid] = useState(true);
  const [billPaidMode, setBillPaidMode] = useState<"all" | "single">("all");
  const [billPaidBy, setBillPaidBy] = useState(currentUserId);
  const [billUsePool, setBillUsePool] = useState(false);
  const [billPoolAmount, setBillPoolAmount] = useState("");
  const [billIntervalMonths, setBillIntervalMonths] = useState("1");
  const [addingBill, setAddingBill] = useState(false);
  const [confirmDeleteBillId, setConfirmDeleteBillId] = useState<string | null>(null);
  const [expandedBillHistoryId, setExpandedBillHistoryId] = useState<string | null>(null);
  const [editingPaidBillId, setEditingPaidBillId] = useState<string | null>(null);
  const [editingPaidDateISO, setEditingPaidDateISO] = useState(() => toISODate(new Date()));
  const [editingPaidMode, setEditingPaidMode] = useState<"all" | "single">("all");
  const [editingPaidBy, setEditingPaidBy] = useState(currentUserId);
  const [editingUsePool, setEditingUsePool] = useState(false);
  const [editingPoolAmount, setEditingPoolAmount] = useState("");
  const [savingPaidBillId, setSavingPaidBillId] = useState<string | null>(null);

  // Optional weekly overspend recovery chooser (off by default)
  const [showOverspendChooser, setShowOverspendChooser] = useState(false);
  const [recoveryMode, setRecoveryMode] = useState<OverspendRecoveryMode>("reduce_budget");
  const [recoveryWeeks, setRecoveryWeeks] = useState<1 | 2 | 4>(2);
  const [savingRecoveryPlan, setSavingRecoveryPlan] = useState(false);

  // Optional leftover surplus chooser (keep in buffer by default; opt-in to lower shares)
  const [showSurplusChooser, setShowSurplusChooser] = useState(false);
  const [surplusAmountInput, setSurplusAmountInput] = useState("");
  const [savingSurplusPlan, setSavingSurplusPlan] = useState(false);

  // Optional one-time weekly boost (adds extra for THIS week only without changing base budget)
  const [showBoostForm, setShowBoostForm] = useState(false);
  const [boostPerMemberInput, setBoostPerMemberInput] = useState("5000");
  const [boostReasonInput, setBoostReasonInput] = useState("");
  const [savingBoost, setSavingBoost] = useState(false);

  const memberCount = Math.max(1, members.length);
  const availablePoolCash = Math.max(0, summary.allTimeBalance);

  const activeBoost =
    weekWindow.kind === "week"
      ? getBoostForWeek(household.weekly_boosts, weekWindow.startISO)
      : null;
  const activeBoostTotal = activeBoost?.extraTotal ?? 0;
  const activeBoostPerMember = activeBoost?.extraPerMember ?? 0;

  const periodTarget =
    weekWindow.kind === "month"
      ? household.weekly_budget_target * 4
      : household.weekly_budget_target + activeBoostTotal;

  const parsedBoostPerMember = Number(boostPerMemberInput.replace(/,/g, "").trim());
  const previewBoostPerMember =
    Number.isFinite(parsedBoostPerMember) && parsedBoostPerMember > 0
      ? Math.round(parsedBoostPerMember)
      : 0;
  const previewBoostTotal = previewBoostPerMember * memberCount;

  const handleSaveWeeklyBoost = async () => {
    if (!onSetWeeklyBoost || previewBoostPerMember <= 0) return;
    setSavingBoost(true);
    try {
      await onSetWeeklyBoost(
        {
          weekStartISO: weekWindow.startISO,
          extraPerMember: previewBoostPerMember,
          extraTotal: previewBoostTotal,
          reason: boostReasonInput.trim() || null,
          createdAt: new Date().toISOString(),
        },
        weekWindow.startISO,
      );
      setShowBoostForm(false);
      setBoostReasonInput("");
    } finally {
      setSavingBoost(false);
    }
  };

  const handleCancelWeeklyBoost = async () => {
    if (!onSetWeeklyBoost) return;
    setSavingBoost(true);
    try {
      await onSetWeeklyBoost(null, weekWindow.startISO);
      setShowBoostForm(false);
    } finally {
      setSavingBoost(false);
    }
  };

  const overspendEval =
    weekWindow.kind === "week"
      ? evaluateOverspendPlan(household.overspend_plan, weekWindow.startISO, memberCount)
      : null;
  const activeBudgetDeduction =
    overspendEval?.status === "active" ? overspendEval.budgetDeduction : 0;
  const activeMemberTopUp =
    overspendEval?.status === "active" ? overspendEval.memberTopUp : 0;
  const effectiveTarget = Math.max(0, periodTarget - activeBudgetDeduction);

  const surplusEval =
    weekWindow.kind === "week"
      ? evaluateSurplusPlan(
          household.surplus_plan,
          weekWindow.startISO,
          household.weekly_budget_target,
          household.member_weekly_share,
          memberCount,
        )
      : null;
  const maxSurplusApplicable = Math.min(availablePoolCash, household.weekly_budget_target);
  const parsedSurplusInput = Number(surplusAmountInput.replace(/,/g, "").trim());
  const previewSurplusApplied = Math.max(
    0,
    Math.min(
      maxSurplusApplicable,
      Number.isFinite(parsedSurplusInput) && parsedSurplusInput > 0
        ? Math.round(parsedSurplusInput)
        : maxSurplusApplicable,
    ),
  );
  const previewSurplusRemaining = Math.max(0, household.weekly_budget_target - previewSurplusApplied);
  const previewSurplusMemberShare =
    previewSurplusRemaining > 0 ? Math.ceil(previewSurplusRemaining / memberCount) : 0;

  const fundingTarget =
    surplusEval?.active ? surplusEval.remainingPoolNeeded : periodTarget;
  const effectivePoolContributed = summary.effectiveTotalContributed;
  const poolPct =
    fundingTarget > 0
      ? Math.min(100, Math.round((effectivePoolContributed / fundingTarget) * 100))
      : surplusEval?.active
        ? 100
        : 0;

  const handleOpenSurplusChooser = () => {
    setSurplusAmountInput(String(maxSurplusApplicable));
    setShowSurplusChooser((v) => !v);
  };

  const handleSaveSurplusPlan = async () => {
    if (!onUpdateSurplusPlan || previewSurplusApplied <= 0) return;
    setSavingSurplusPlan(true);
    try {
      await onUpdateSurplusPlan({
        weekStartISO: weekWindow.startISO,
        appliedAmount: previewSurplusApplied,
        createdAt: new Date().toISOString(),
      });
      setShowSurplusChooser(false);
    } finally {
      setSavingSurplusPlan(false);
    }
  };

  const handleCancelSurplusPlan = async () => {
    if (!onUpdateSurplusPlan) return;
    setSavingSurplusPlan(true);
    try {
      await onUpdateSurplusPlan(null);
      setShowSurplusChooser(false);
    } finally {
      setSavingSurplusPlan(false);
    }
  };

  const rawSpentPct =
    effectiveTarget > 0 ? Math.round((summary.totalSpent / effectiveTarget) * 100) : 0;
  const spentPct = Math.min(100, rawSpentPct);
  const overspendAmount =
    effectiveTarget > 0 ? Math.max(0, summary.totalSpent - effectiveTarget) : 0;
  const previewPerWeek = overspendAmount > 0 ? Math.ceil(overspendAmount / recoveryWeeks) : 0;
  const previewPerMember =
    previewPerWeek > 0 ? Math.ceil(previewPerWeek / memberCount) : 0;

  const handleSaveOverspendPlan = async () => {
    if (!onUpdateOverspendPlan || overspendAmount <= 0) return;
    setSavingRecoveryPlan(true);
    try {
      await onUpdateOverspendPlan({
        sourceWeekStartISO: weekWindow.startISO,
        startWeekISO: addDaysISO(weekWindow.startISO, 7),
        totalAmount: Math.round(overspendAmount),
        weeks: recoveryWeeks,
        mode: recoveryMode,
        createdAt: new Date().toISOString(),
      });
      setShowOverspendChooser(false);
    } finally {
      setSavingRecoveryPlan(false);
    }
  };

  const handleCancelOverspendPlan = async () => {
    if (!onUpdateOverspendPlan) return;
    setSavingRecoveryPlan(true);
    try {
      await onUpdateOverspendPlan(null);
      setShowOverspendChooser(false);
    } finally {
      setSavingRecoveryPlan(false);
    }
  };

  const pendingNeeds = needs.filter((n) => !n.is_bought);
  const boughtNeeds = needs.filter((n) => n.is_bought);

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    const t = Math.max(0, Number(weeklyTarget) || 0);
    const s = Math.max(0, Number(memberShare) || 0);
    setSaving(true);
    try {
      await onUpdateBudget(t, s);
      setSavedToast(true);
      setTimeout(() => setSavedToast(false), 2200);
    } finally {
      setSaving(false);
    }
  };

  const handleShareSummary = async () => {
    const text = buildWeeklyWhatsAppSummary(household, weekWindow, summary);
    try {
      await navigator.clipboard.writeText(text);
      setCopiedSummary(true);
      setTimeout(() => setCopiedSummary(false), 2400);
    } catch {
      if (navigator.share) {
        await navigator.share({ title: `${household.name} Summary`, text }).catch(() => {});
      }
    }
  };

  const handleRemindMember = async (
    userId: string,
    fullName: string,
    remainingDue: number,
    priorShortfall: number,
  ) => {
    const firstName = fullName.split(" ")[0];
    const extra =
      priorShortfall > 0
        ? ` (includes ${formatTZS(priorShortfall)} carried over from prior week)`
        : "";
    const text = `Hi ${firstName}, quick Keeper reminder for ${household.name}: ${formatTZS(remainingDue)} remaining on this ${weekWindow.kind}'s pool share${extra}.`;
    try {
      if (navigator.share) {
        await navigator.share({ title: `${household.name} pool reminder`, text });
        return;
      }
      await navigator.clipboard.writeText(text);
      setRemindedUserId(userId);
      setTimeout(() => setRemindedUserId(null), 2200);
    } catch {
      // User cancelled share or clipboard blocked
    }
  };

  const handleAddNeed = async (e: FormEvent) => {
    e.preventDefault();
    if (!needTitle.trim()) return;
    const estRaw = Number(needEstimate.replace(/,/g, "").trim());
    const estimatedAmount = Number.isFinite(estRaw) && estRaw > 0 ? Math.round(estRaw) : null;
    setAddingNeed(true);
    try {
      await onAddNeed(needTitle, needCategory, {
        quantity: needQty.trim() || null,
        estimatedAmount,
      });
      setNeedTitle("");
      setNeedQty("");
      setNeedEstimate("");
    } finally {
      setAddingNeed(false);
    }
  };

  const handleSaveNeedBought = async (need: HouseholdNeed) => {
    const actRaw = Number(buyingActualAmount.replace(/,/g, "").trim());
    const actualAmount = Number.isFinite(actRaw) && actRaw > 0 ? Math.round(actRaw) : null;
    const prevPool = need.is_bought ? (need.pool_amount_used ?? 0) : 0;
    const maxPool = actualAmount ? Math.min(actualAmount, prevPool + availablePoolCash) : 0;
    const poolRaw = buyingUsePool ? Number(buyingPoolAmount.replace(/,/g, "").trim()) || 0 : prevPool;
    const safePool = Math.max(prevPool, Math.min(maxPool, Math.round(poolRaw)));
    setSavingBoughtNeedId(need.id);
    try {
      await onMarkNeedBought(need.id, {
        actualAmount,
        paidMode: buyingPaidMode,
        paidBy: buyingPaidMode === "single" ? buyingPaidBy || currentUserId : null,
        poolAmountUsed: safePool,
      });
      setBuyingNeedId(null);
    } finally {
      setSavingBoughtNeedId(null);
    }
  };

  const handleAddBill = async (e: FormEvent) => {
    e.preventDefault();
    const numericAmount = Number(billAmount.replace(/,/g, "").trim());
    const numericDay = Number(billDateISO.slice(8, 10)) || 1;
    const numericInterval = Math.min(60, Math.max(1, Math.round(Number(billIntervalMonths) || 1)));
    if (!billTitle.trim() || !Number.isFinite(numericAmount) || numericAmount <= 0) return;
    const maxPool = Math.min(numericAmount, availablePoolCash);
    const poolRaw =
      billAlreadyPaid && billUsePool
        ? Number(billPoolAmount.replace(/,/g, "").trim()) || 0
        : 0;
    const safePool = Math.max(0, Math.min(maxPool, Math.round(poolRaw)));
    setAddingBill(true);
    try {
      await onAddBill(
        billTitle,
        numericAmount,
        billCategory,
        numericDay,
        numericInterval,
        billAlreadyPaid ? billDateISO : null,
        billPaidMode,
        billPaidMode === "single" ? billPaidBy || currentUserId : null,
        safePool,
      );
      setBillTitle("");
      setBillAmount("");
      setBillDateISO(toISODate(new Date()));
      setBillAlreadyPaid(true);
      setBillPaidMode("all");
      setBillPaidBy(currentUserId);
      setBillUsePool(false);
      setBillPoolAmount("");
      setBillIntervalMonths("1");
      setShowBillForm(false);
    } finally {
      setAddingBill(false);
    }
  };

  const handleSaveBillPaidDate = async (bill: RecurringBill) => {
    const monthKey = editingPaidDateISO.slice(0, 7);
    const prevPool = bill.last_paid_month === monthKey ? (bill.pool_amount_used ?? 0) : 0;
    const maxPool = Math.min(bill.amount, prevPool + availablePoolCash);
    const poolRaw = editingUsePool
      ? Number(editingPoolAmount.replace(/,/g, "").trim()) || 0
      : prevPool;
    const safePool = Math.max(prevPool, Math.min(maxPool, Math.round(poolRaw)));
    setSavingPaidBillId(bill.id);
    try {
      await onMarkBillPaid(
        bill.id,
        editingPaidDateISO,
        editingPaidMode,
        editingPaidMode === "single" ? editingPaidBy || currentUserId : null,
        safePool,
      );
      setEditingPaidBillId(null);
    } finally {
      setSavingPaidBillId(null);
    }
  };

  let pendingNeedsEstTotal = 0;
  let pendingNeedsPricedCount = 0;
  for (const n of pendingNeeds) {
    if (n.estimated_amount && n.estimated_amount > 0) {
      pendingNeedsEstTotal += n.estimated_amount;
      pendingNeedsPricedCount += 1;
    }
  }

  let settledBillsTotal = 0;
  let dueBillsTotal = 0;
  for (const b of bills) {
    const st = getBillDueStatus(b);
    if (st.isPaidThisMonth) settledBillsTotal += b.amount;
    else dueBillsTotal += b.amount;
  }

  return (
    <div className="space-y-4">
      {/* Sub-navigation: Pool | Bills | Needs */}
      <SoftSegmented
        value={subTab}
        onValueChange={(v) => onSubTabChange(v as BudgetSubTab)}
        items={[
          { value: "pool", label: "Pool" },
          { value: "bills", label: `Bills (${bills.length})` },
          { value: "needs", label: `Needs (${pendingNeeds.length})` },
        ]}
      />

      {subTab === "pool" && (
        <>
          {/* Pool Progress Card */}
          <section className="rounded-2xl border border-stone-900/[0.08] bg-white p-4">
            <div className="flex items-baseline justify-between gap-2 mb-3">
              <div>
                <h2 className="text-base font-semibold text-[#1C1C1E]">
                  {weekWindow.kind === "month" ? "Monthly household pool" : "Weekly household pool"}
                </h2>
                <p className="text-xs text-[#52525B] mt-0.5 tabular-nums">
                  Target ({weekWindow.label.toLowerCase()}): {formatTZS(periodTarget)}
                  {weekWindow.kind === "week" && weekWindow.days.length === 7 && (
                    <span className="ml-1.5 text-[#8E8E93]">
                      · {weekWindow.days[0].dayShort} - {weekWindow.days[6].dayShort}
                    </span>
                  )}
                </p>
              </div>
              <span className="font-mono text-xs text-[#8E8E93] tabular-nums">
                {poolPct}% funded
              </span>
            </div>

            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="inline-flex items-center gap-1.5 text-[#52525B]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#C6A87C]" />
                    <span>Contributed ({weekWindow.label.toLowerCase()})</span>
                  </span>
                  <span className="font-semibold text-[#1C1C1E] tabular-nums">
                    {formatTZS(effectivePoolContributed)} ({poolPct}%)
                    {summary.appliedAdvanceCredit > 0 && (
                      <span className="ml-1 font-normal text-[#8F703F]">
                        · incl. {formatTZS(summary.appliedAdvanceCredit)} early
                      </span>
                    )}
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-stone-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#C6A87C] transition-[width] duration-300"
                    style={{ width: `${poolPct}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="inline-flex items-center gap-1.5 text-[#52525B]">
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        overspendAmount > 0 ? "bg-rose-600" : "bg-[#1C1C1E]"
                      }`}
                    />
                    <span>
                      {activeBudgetDeduction > 0
                        ? `Spent vs. adjusted target (${formatTZS(effectiveTarget)})`
                        : "Spent vs. target"}
                    </span>
                  </span>
                  <span
                    className={`font-semibold tabular-nums ${
                      overspendAmount > 0 ? "text-rose-700" : "text-[#1C1C1E]"
                    }`}
                  >
                    {formatTZS(summary.totalSpent)} ({rawSpentPct}%)
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-stone-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-[width] duration-300 ${
                      overspendAmount > 0 ? "bg-rose-600" : "bg-[#1C1C1E]"
                    }`}
                    style={{ width: `${spentPct}%` }}
                  />
                </div>
              </div>

              {/* Active or Scheduled Optional Overspend Recovery Banner */}
              {overspendEval &&
                (overspendEval.status === "active" || overspendEval.status === "scheduled") &&
                overspendEval.plan && (
                  <div className="rounded-xl border border-amber-700/20 bg-amber-50/75 px-3 py-2.5 text-xs space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-semibold text-amber-900">
                          {overspendEval.status === "active"
                            ? `Overspend recovery · Week ${overspendEval.currentWeekNumber} of ${overspendEval.totalWeeks}`
                            : `Overspend recovery scheduled (${overspendEval.totalWeeks} ${
                                overspendEval.totalWeeks === 1 ? "wk" : "wks"
                              })`}
                        </div>
                        <div className="text-[11px] text-amber-900/80 mt-0.5 tabular-nums">
                          {overspendEval.plan.mode === "reduce_budget"
                            ? `Trimming weekly spending limit by ${formatTZS(
                                overspendEval.perWeekAmount,
                              )}/wk`
                            : `Adding +${formatTZS(
                                Math.ceil(overspendEval.perWeekAmount / memberCount),
                              )}/member top-up per week`}
                        </div>
                      </div>
                      {onUpdateOverspendPlan && (
                        <button
                          type="button"
                          disabled={savingRecoveryPlan}
                          onClick={() => void handleCancelOverspendPlan()}
                          className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-amber-800/20 bg-white px-2 py-1 text-[11px] font-medium text-amber-900 hover:bg-amber-100/60 cursor-pointer"
                        >
                          <X className="h-3 w-3" />
                          <span>Cancel</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}

              {/* Weekly Overspend Alert + Optional Coming-Weeks Recovery Chooser */}
              {overspendAmount > 0 && weekWindow.kind === "week" && (
                <div className="rounded-xl border border-rose-700/20 bg-rose-50/80 p-3 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 min-w-0">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-700" />
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-rose-800 tabular-nums">
                          Overspent by {formatTZS(overspendAmount)}
                        </div>
                        <p className="text-[11px] leading-snug text-rose-800/85 mt-0.5">
                          Expenses exceeded your {formatTZS(effectiveTarget)} weekly budget. Next
                          week resets to normal unless you opt in to recover it.
                        </p>
                      </div>
                    </div>
                  </div>

                  {onUpdateOverspendPlan && (
                    <>
                      <button
                        type="button"
                        onClick={() => setShowOverspendChooser((v) => !v)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-rose-700/25 bg-white px-2.5 py-1.5 text-[11px] font-medium text-rose-800 hover:bg-rose-50 cursor-pointer"
                      >
                        {showOverspendChooser
                          ? "Hide recovery options"
                          : "Cover in coming weeks (optional)"}
                      </button>

                      {showOverspendChooser && (
                        <div className="rounded-xl border border-stone-900/[0.08] bg-white p-3 space-y-3">
                          <div className="space-y-1.5">
                            <div className="text-[11px] font-semibold text-[#1C1C1E]">
                              1. Choose how to cover {formatTZS(overspendAmount)}
                            </div>
                            <div className="grid grid-cols-1 gap-1.5">
                              <button
                                type="button"
                                onClick={() => setRecoveryMode("reduce_budget")}
                                className={`rounded-xl border p-2.5 text-left transition-colors cursor-pointer ${
                                  recoveryMode === "reduce_budget"
                                    ? "border-[#1C1C1E] bg-[#F6F5F2]"
                                    : "border-stone-900/10 bg-white hover:bg-stone-50"
                                }`}
                              >
                                <div className="text-xs font-semibold text-[#1C1C1E]">
                                  Trim upcoming spending limit
                                </div>
                                <div className="text-[11px] text-[#52525B] mt-0.5">
                                  Lower future weekly budget targets so the house spends less to
                                  balance out
                                </div>
                              </button>
                              <button
                                type="button"
                                onClick={() => setRecoveryMode("topup_share")}
                                className={`rounded-xl border p-2.5 text-left transition-colors cursor-pointer ${
                                  recoveryMode === "topup_share"
                                    ? "border-[#1C1C1E] bg-[#F6F5F2]"
                                    : "border-stone-900/10 bg-white hover:bg-stone-50"
                                }`}
                              >
                                <div className="text-xs font-semibold text-[#1C1C1E]">
                                  Add roommate contribution top-up
                                </div>
                                <div className="text-[11px] text-[#52525B] mt-0.5">
                                  Spread the overspend equally as a small extra share across{" "}
                                  {memberCount} {memberCount === 1 ? "member" : "members"}
                                </div>
                              </button>
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            <div className="text-[11px] font-semibold text-[#1C1C1E]">
                              2. Spread across coming weeks
                            </div>
                            <div className="grid grid-cols-3 gap-1.5">
                              {([1, 2, 4] as const).map((wk) => (
                                <button
                                  key={wk}
                                  type="button"
                                  onClick={() => setRecoveryWeeks(wk)}
                                  className={`rounded-lg border py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                                    recoveryWeeks === wk
                                      ? "border-[#1C1C1E] bg-[#1C1C1E] text-white"
                                      : "border-stone-900/10 bg-[#F6F5F2] text-[#1C1C1E]"
                                  }`}
                                >
                                  {wk} {wk === 1 ? "week" : "weeks"}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="rounded-lg bg-[#F6F5F2] px-2.5 py-2 text-[11px] text-[#52525B] tabular-nums">
                            {recoveryMode === "reduce_budget" ? (
                              <>
                                Starting next week for{" "}
                                <strong className="text-[#1C1C1E]">
                                  {recoveryWeeks} {recoveryWeeks === 1 ? "week" : "weeks"}
                                </strong>
                                : weekly budget drops to{" "}
                                <strong className="text-[#1C1C1E]">
                                  {formatTZS(
                                    Math.max(0, household.weekly_budget_target - previewPerWeek),
                                  )}
                                </strong>{" "}
                                (-{formatTZS(previewPerWeek)}/wk).
                              </>
                            ) : (
                              <>
                                Starting next week for{" "}
                                <strong className="text-[#1C1C1E]">
                                  {recoveryWeeks} {recoveryWeeks === 1 ? "week" : "weeks"}
                                </strong>
                                : each roommate adds{" "}
                                <strong className="text-[#1C1C1E]">
                                  +{formatTZS(previewPerMember)}/wk
                                </strong>{" "}
                                ({formatTZS(previewPerWeek)}/wk total).
                              </>
                            )}
                          </div>

                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setShowOverspendChooser(false)}
                              className="rounded-lg border border-stone-900/10 bg-white px-3 py-1.5 text-xs font-medium text-[#52525B] cursor-pointer"
                            >
                              Not now
                            </button>
                            <button
                              type="button"
                              disabled={savingRecoveryPlan}
                              onClick={() => void handleSaveOverspendPlan()}
                              className="rounded-lg bg-[#1C1C1E] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#2C2C30] disabled:opacity-50 cursor-pointer"
                            >
                              {savingRecoveryPlan ? "Saving..." : "Apply recovery plan"}
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              <div className="rounded-xl bg-[#F6F5F2] px-3 py-2.5 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#52525B]">Cash on hand (carry-over)</span>
                  <span
                    className={`font-semibold tabular-nums ${
                      summary.allTimeBalance >= 0 ? "text-[#1C1C1E]" : "text-rose-700"
                    }`}
                  >
                    {formatTZS(summary.allTimeBalance)}
                  </span>
                </div>

                {/* Active Leftover Surplus Reduction Banner */}
                {weekWindow.kind === "week" && surplusEval?.active && (
                  <div className="rounded-xl border border-emerald-700/20 bg-emerald-50/80 p-2.5 text-xs space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-semibold text-emerald-900 tabular-nums">
                          {formatTZS(surplusEval.appliedAmount)} leftover applied to this week
                        </div>
                        <div className="text-[11px] text-emerald-900/85 mt-0.5 tabular-nums">
                          Remaining needed: {formatTZS(surplusEval.remainingPoolNeeded)} &rarr;{" "}
                          <strong>{formatTZS(surplusEval.adjustedMemberShare)}/member</strong>
                          {surplusEval.savedPerMember > 0
                            ? ` (saves ${formatTZS(surplusEval.savedPerMember)} each)`
                            : ""}
                        </div>
                      </div>
                      {onUpdateSurplusPlan && (
                        <button
                          type="button"
                          disabled={savingSurplusPlan}
                          onClick={() => void handleCancelSurplusPlan()}
                          className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-emerald-800/20 bg-white px-2 py-1 text-[11px] font-medium text-emerald-900 hover:bg-emerald-100/60 cursor-pointer"
                        >
                          <X className="h-3 w-3" />
                          <span>Keep in buffer</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Opt-in Leftover Chooser (keep in buffer by default) */}
                {weekWindow.kind === "week" &&
                  !surplusEval?.active &&
                  maxSurplusApplicable > 0 &&
                  onUpdateSurplusPlan && (
                    <div className="space-y-2">
                      <button
                        type="button"
                        onClick={handleOpenSurplusChooser}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-stone-900/10 bg-white px-2.5 py-1.5 text-[11px] font-medium text-[#1C1C1E] hover:bg-stone-50 cursor-pointer"
                      >
                        {showSurplusChooser
                          ? "Keep leftover in buffer"
                          : "Use leftover to lower this week's shares (optional)"}
                      </button>

                      {showSurplusChooser && (
                        <div className="rounded-xl border border-stone-900/[0.08] bg-white p-3 space-y-2.5">
                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <label className="text-[11px] font-semibold text-[#1C1C1E]">
                                Leftover amount to apply (TZS)
                              </label>
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setSurplusAmountInput(String(Math.round(maxSurplusApplicable / 2)))
                                  }
                                  className="rounded-md bg-[#F6F5F2] px-2 py-0.5 text-[10px] font-medium text-[#52525B] hover:text-[#1C1C1E] cursor-pointer"
                                >
                                  Half
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setSurplusAmountInput(String(maxSurplusApplicable))}
                                  className="rounded-md bg-[#F6F5F2] px-2 py-0.5 text-[10px] font-medium text-[#52525B] hover:text-[#1C1C1E] cursor-pointer"
                                >
                                  Full ({formatTZS(maxSurplusApplicable)})
                                </button>
                              </div>
                            </div>
                            <input
                              type="number"
                              inputMode="numeric"
                              min={0}
                              max={maxSurplusApplicable}
                              value={surplusAmountInput}
                              onChange={(e) => setSurplusAmountInput(e.target.value)}
                              className="w-full rounded-lg border border-stone-900/15 bg-[#F6F5F2] px-3 py-1.5 text-xs font-medium text-[#1C1C1E] tabular-nums focus:outline-none focus:ring-2 focus:ring-[#1C1C1E]/20"
                            />
                          </div>

                          <div className="rounded-lg bg-[#F6F5F2] px-2.5 py-2 text-[11px] text-[#52525B] space-y-1 tabular-nums">
                            <div className="flex justify-between">
                              <span>Weekly budget target</span>
                              <span className="font-medium text-[#1C1C1E]">
                                {formatTZS(household.weekly_budget_target)}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span>Leftover cash applied</span>
                              <span className="font-medium text-emerald-700">
                                -{formatTZS(previewSurplusApplied)}
                              </span>
                            </div>
                            <div className="flex justify-between border-t border-stone-900/[0.08] pt-1">
                              <span>Remaining needed</span>
                              <span className="font-semibold text-[#1C1C1E]">
                                {formatTZS(previewSurplusRemaining)}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span>
                                Split across {memberCount}{" "}
                                {memberCount === 1 ? "member" : "members"}
                              </span>
                              <span className="font-semibold text-emerald-800">
                                {previewSurplusMemberShare === 0
                                  ? "TZS 0 (fully covered)"
                                  : `${formatTZS(previewSurplusMemberShare)} each`}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setShowSurplusChooser(false)}
                              className="rounded-lg border border-stone-900/10 bg-white px-3 py-1.5 text-xs font-medium text-[#52525B] cursor-pointer"
                            >
                              Keep in buffer
                            </button>
                            <button
                              type="button"
                              disabled={savingSurplusPlan || previewSurplusApplied <= 0}
                              onClick={() => void handleSaveSurplusPlan()}
                              className="rounded-lg bg-[#1C1C1E] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#2C2C30] disabled:opacity-50 cursor-pointer"
                            >
                              {savingSurplusPlan ? "Applying..." : "Apply to this week"}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
              </div>
              {/* One-Time Weekly Boost (adds extra for THIS week only without changing base budget) */}
              {weekWindow.kind === "week" && onSetWeeklyBoost && (
                activeBoost ? (
                  <div className="rounded-xl border border-[#C6A87C]/35 bg-[#C6A87C]/12 px-3 py-2.5 text-xs space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-semibold text-[#1C1C1E] tabular-nums">
                          One-time boost · +{formatTZS(activeBoost.extraPerMember)}/member (+
                          {formatTZS(activeBoost.extraTotal)})
                        </div>
                        <div className="text-[11px] text-[#52525B] mt-0.5">
                          {activeBoost.reason ? `${activeBoost.reason} · ` : ""}
                          This week only — next week resets to{" "}
                          {formatTZS(household.weekly_budget_target)}
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={savingBoost}
                        onClick={() => void handleCancelWeeklyBoost()}
                        className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-stone-900/15 bg-white px-2 py-1 text-[11px] font-medium text-[#1C1C1E] hover:bg-stone-50 cursor-pointer"
                      >
                        <X className="h-3 w-3" />
                        <span>Cancel</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => setShowBoostForm((v) => !v)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-stone-900/10 bg-[#F6F5F2] px-2.5 py-1.5 text-[11px] font-medium text-[#1C1C1E] hover:bg-stone-200/60 cursor-pointer"
                    >
                      <Plus className="h-3 w-3 text-[#8F703F]" />
                      <span>
                        {showBoostForm
                          ? "Hide one-time boost"
                          : "Add one-time boost for this week (optional)"}
                      </span>
                    </button>

                    {showBoostForm && (
                      <div className="rounded-xl border border-stone-900/[0.08] bg-[#F6F5F2] p-3 space-y-2.5">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <label className="text-[11px] font-semibold text-[#1C1C1E]">
                              Extra per member (TZS)
                            </label>
                            <div className="flex items-center gap-1">
                              {[2000, 5000, 10000].map((preset) => (
                                <button
                                  key={preset}
                                  type="button"
                                  onClick={() => setBoostPerMemberInput(String(preset))}
                                  className="rounded-md bg-white px-2 py-0.5 text-[10px] font-medium text-[#52525B] border border-stone-900/10 hover:text-[#1C1C1E] cursor-pointer"
                                >
                                  +{(preset / 1000).toFixed(0)}K
                                </button>
                              ))}
                            </div>
                          </div>
                          <input
                            type="number"
                            inputMode="numeric"
                            min={100}
                            value={boostPerMemberInput}
                            onChange={(e) => setBoostPerMemberInput(e.target.value)}
                            placeholder="e.g. 5000"
                            className="w-full rounded-lg border border-stone-900/15 bg-white px-3 py-1.5 text-xs font-medium text-[#1C1C1E] tabular-nums focus:outline-none focus:ring-2 focus:ring-[#1C1C1E]/20"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="block text-[11px] font-medium text-[#52525B]">
                            Note (optional)
                          </label>
                          <input
                            type="text"
                            maxLength={60}
                            value={boostReasonInput}
                            onChange={(e) => setBoostReasonInput(e.target.value)}
                            placeholder="e.g. Guests, extra groceries"
                            className="w-full rounded-lg border border-stone-900/15 bg-white px-3 py-1.5 text-xs text-[#1C1C1E] placeholder:text-[#8E8E93] focus:outline-none focus:ring-2 focus:ring-[#1C1C1E]/20"
                          />
                        </div>

                        {previewBoostPerMember > 0 && (
                          <div className="rounded-lg bg-white px-2.5 py-2 text-[11px] text-[#52525B] space-y-1 tabular-nums">
                            <div className="flex justify-between">
                              <span>This week&apos;s budget</span>
                              <span className="font-semibold text-[#1C1C1E]">
                                {formatTZS(household.weekly_budget_target + previewBoostTotal)} (+
                                {formatTZS(previewBoostTotal)})
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span>
                                Each member ({memberCount}{" "}
                                {memberCount === 1 ? "member" : "members"})
                              </span>
                              <span className="font-semibold text-[#8F703F]">
                                {formatTZS(household.member_weekly_share + previewBoostPerMember)}
                              </span>
                            </div>
                            <p className="text-[10px] text-[#8E8E93] pt-0.5">
                              Applies to this week only. Next week resets to{" "}
                              {formatTZS(household.member_weekly_share)}/member with no false
                              advance.
                            </p>
                          </div>
                        )}

                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setShowBoostForm(false)}
                            className="rounded-lg border border-stone-900/10 bg-white px-3 py-1.5 text-xs font-medium text-[#52525B] cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            disabled={savingBoost || previewBoostPerMember <= 0}
                            onClick={() => void handleSaveWeeklyBoost()}
                            className="rounded-lg bg-[#1C1C1E] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#2C2C30] disabled:opacity-50 cursor-pointer"
                          >
                            {savingBoost ? "Applying..." : "Apply boost"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              )}
            </div>

            <div className="mt-3.5 pt-3 border-t border-stone-900/[0.06]">
              <SoftButton
                onClick={() => void handleShareSummary()}
                icon={
                  copiedSummary ? (
                    <Check className="h-4 w-4 text-emerald-700" />
                  ) : (
                    <Share2 className="h-4 w-4" />
                  )
                }
                className="w-full !h-10 text-xs font-medium"
              >
                {copiedSummary ? "Copied summary for WhatsApp" : "Copy summary for WhatsApp"}
              </SoftButton>
            </div>
          </section>

          {/* Member Accountability Breakdown */}
          <section className="rounded-2xl border border-stone-900/[0.08] bg-white p-4">
              <div className="flex items-baseline justify-between mb-2">
                <h2 className="text-base font-semibold text-[#1C1C1E]">Member contributions</h2>
                <span className="font-mono text-xs text-[#8E8E93] tabular-nums">
                  {surplusEval?.active
                    ? `Adjusted: ${formatTZS(surplusEval.adjustedMemberShare)}/wk`
                    : `Share: ${formatTZS(household.member_weekly_share + activeBoostPerMember)}/wk`}
                  {activeBoostPerMember > 0 && !surplusEval?.active
                    ? ` (incl. +${formatTZS(activeBoostPerMember)} boost)`
                    : ""}
                  {activeMemberTopUp > 0 ? ` (+${formatTZS(activeMemberTopUp)})` : ""}
                </span>
              </div>

            <div className="divide-y divide-stone-900/[0.06]">
              {summary.memberStatuses.map((status) => {
                const baseExpected = surplusEval?.active
                  ? surplusEval.adjustedMemberShare
                  : status.expectedShare;
                const effectiveExpected = baseExpected + activeMemberTopUp;
                const effectiveRemainingDue = Math.max(
                  0,
                  effectiveExpected - status.effectiveContributed,
                );
                const effectivePct =
                  effectiveExpected > 0
                    ? Math.min(100, Math.round((status.effectiveContributed / effectiveExpected) * 100))
                    : 100;
                const done =
                  effectiveExpected === 0
                    ? Boolean(surplusEval?.active)
                    : status.effectiveContributed >= effectiveExpected;
                const partial =
                  !done && (status.effectiveContributed > 0 || status.contributedThisWeek > 0);
                const reminded = remindedUserId === status.member.user_id;
                return (
                  <div key={status.member.user_id} className="py-3 first:pt-1 last:pb-0">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-start gap-3 min-w-0">
                        <div
                          className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                          style={{ backgroundColor: status.member.profile.avatar_color }}
                        >
                          {getInitials(status.member.profile.full_name)}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-[#1C1C1E]">
                            {status.member.profile.full_name}
                          </div>
                          <div className="text-xs text-[#8E8E93] tabular-nums">
                            {formatTZS(status.contributedThisWeek)} /{" "}
                            {formatTZS(effectiveExpected)}
                            {surplusEval?.active && surplusEval.savedPerMember > 0 && (
                              <span className="ml-1.5 text-emerald-700">
                                (-{formatTZS(surplusEval.savedPerMember)} leftover)
                              </span>
                            )}
                            {activeMemberTopUp > 0 && (
                              <span className="ml-1.5 text-amber-800">
                                (+{formatTZS(activeMemberTopUp)} recovery)
                              </span>
                            )}
                            {status.carryOverCredit > 0 && (
                              <span className="ml-1.5 text-[#8F703F]">
                                (+{formatTZS(status.carryOverCredit)} carry-over)
                              </span>
                            )}
                          </div>
                          {status.priorShortfall > 0 && (
                            <div className="mt-0.5 text-[11px] font-medium text-rose-700 tabular-nums">
                              -{formatTZS(status.priorShortfall)} prior week shortfall deducted
                            </div>
                          )}
                          {!done && effectiveRemainingDue > 0 && (
                            <div className="mt-0.5 text-[11px] font-medium text-[#8F703F] tabular-nums">
                              {formatTZS(effectiveRemainingDue)} remaining
                            </div>
                          )}
                          {status.advanceBalance > 0 && (
                            <div className="mt-0.5 text-[11px] font-medium text-[#8F703F] tabular-nums">
                              Advance +{formatTZS(status.advanceBalance)}
                              {status.weeksCoveredAhead > 0
                                ? ` · covers ${status.weeksCoveredAhead} ${
                                    status.weeksCoveredAhead === 1 ? "week" : "weeks"
                                  } ahead`
                                : ""}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium ${
                            done
                              ? "bg-emerald-50 text-emerald-700"
                              : partial
                                ? "bg-stone-100 text-[#8F703F]"
                                : "bg-stone-100 text-[#8E8E93]"
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              done
                                ? "bg-emerald-600"
                                : partial
                                  ? "bg-[#C6A87C]"
                                  : "bg-stone-400"
                            }`}
                          />
                          {effectiveExpected === 0 && surplusEval?.active
                            ? "Covered"
                            : status.coveredByAdvance
                              ? "Covered"
                              : done
                                ? "Paid"
                                : partial
                                  ? "Partial"
                                  : "Pending"}
                        </span>
                        {!done && effectiveRemainingDue > 0 && (
                          <button
                            type="button"
                            onClick={() =>
                              void handleRemindMember(
                                status.member.user_id,
                                status.member.profile.full_name,
                                effectiveRemainingDue,
                                status.priorShortfall,
                              )
                            }
                            className="rounded-md bg-[#F6F5F2] border border-stone-900/10 px-2 py-0.5 text-[11px] font-medium text-[#1C1C1E] hover:bg-stone-200/60 transition-colors cursor-pointer"
                          >
                            {reminded ? "Copied" : "Remind"}
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="h-1 w-full rounded-full bg-stone-100 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-[width] duration-300"
                        style={{
                          width: `${effectivePct}%`,
                          backgroundColor: done ? "#15803D" : partial ? "#C6A87C" : "#D6D3D1",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Edit Shared Weekly Budget */}
          <section className="rounded-2xl border border-stone-900/[0.08] bg-white p-4">
            <h2 className="text-base font-semibold text-[#1C1C1E]">Update weekly budget</h2>
            <p className="text-xs text-[#52525B] mt-0.5 mb-3">
              Changes sync across everyone in {household.name}
            </p>

            <form onSubmit={(e) => void handleSave(e)} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-[#52525B] mb-1">
                  Total weekly budget (TZS)
                </label>
                <SoftInput
                  type="number"
                  min="0"
                  step="1"
                  value={weeklyTarget}
                  onValueChange={setWeeklyTarget}
                  icon={<span className="font-mono text-xs font-medium text-[#8E8E93]">TZS</span>}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#52525B] mb-1">
                  Expected share per member (TZS)
                </label>
                <SoftInput
                  type="number"
                  min="0"
                  step="1"
                  value={memberShare}
                  onValueChange={setMemberShare}
                  icon={<span className="font-mono text-xs font-medium text-[#8E8E93]">TZS</span>}
                />
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <label className="block text-xs font-medium text-[#52525B]">
                    7-day week starts on
                  </label>
                  <span className="font-mono text-[11px] text-[#8E8E93]">
                    {weekStartOverride === null
                      ? `Auto from first entry (${JS_DAY_SHORT[autoStartDay]})`
                      : `Every ${JS_DAY_SHORT[weekStartOverride]}`}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => onChangeWeekStart(null)}
                    className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                      weekStartOverride === null
                        ? "bg-[#1C1C1E] text-white"
                        : "border border-stone-900/10 bg-[#F6F5F2] text-[#52525B] hover:text-[#1C1C1E]"
                    }`}
                  >
                    Auto ({JS_DAY_SHORT[autoStartDay]})
                  </button>
                  {WEEKDAY_ORDER.map((dayIdx) => {
                    const active = weekStartOverride === dayIdx;
                    return (
                      <button
                        key={dayIdx}
                        type="button"
                        onClick={() => onChangeWeekStart(dayIdx)}
                        className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                          active
                            ? "bg-[#1C1C1E] text-white"
                            : "border border-stone-900/10 bg-[#F6F5F2] text-[#52525B] hover:text-[#1C1C1E]"
                        }`}
                      >
                        {JS_DAY_SHORT[dayIdx]}
                      </button>
                    );
                  })}
                </div>
              </div>

              <SoftButton
                type="submit"
                variant="filled"
                disabled={saving}
                className="w-full !h-10 text-xs font-medium"
              >
                {saving ? "Saving..." : "Save budget"}
              </SoftButton>

              {savedToast && (
                <div className="flex items-center justify-center gap-1.5 text-xs font-medium text-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Weekly budget updated
                </div>
              )}
            </form>
          </section>
        </>
      )}

      {subTab === "bills" && (
        <section className="rounded-2xl border border-stone-900/[0.08] bg-white p-4 space-y-3.5">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-[#1C1C1E]">Recurring house bills</h2>
              <p className="text-xs text-[#52525B] mt-0.5">
                Tracked separately — never deducted from weekly contribution money
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowBillForm((v) => !v)}
              className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-[#1C1C1E] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#2C2C30] transition-colors cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              {showBillForm ? "Close" : "Add bill"}
            </button>
          </div>

          {/* Dedicated Bills Money Summary Strip (Separate from Weekly Pool) */}
          {bills.length > 0 && (
            <div className="grid grid-cols-2 divide-x divide-stone-900/[0.06] rounded-xl bg-[#F6F5F2] p-3">
              <div className="pr-3">
                <div className="flex items-center gap-1.5 text-xs text-[#52525B]">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                  <span>Settled bills</span>
                </div>
                <div className="mt-0.5 text-sm font-semibold text-[#1C1C1E] tabular-nums">
                  {formatTZS(settledBillsTotal)}
                </div>
              </div>
              <div className="pl-3">
                <div className="flex items-center gap-1.5 text-xs text-[#52525B]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#C6A87C]" />
                  <span>Upcoming / due</span>
                </div>
                <div className="mt-0.5 text-sm font-semibold text-[#1C1C1E] tabular-nums">
                  {formatTZS(dueBillsTotal)}
                </div>
              </div>
            </div>
          )}

          {showBillForm && (
            <form
              onSubmit={(e) => void handleAddBill(e)}
              className="rounded-xl border border-stone-900/[0.08] bg-[#F6F5F2] p-3.5 space-y-3"
            >
              <div>
                <label className="block text-xs font-medium text-[#52525B] mb-1">Bill name</label>
                <SoftInput
                  type="text"
                  maxLength={80}
                  placeholder="House rent, Fiber Wi-Fi, Security"
                  value={billTitle}
                  onValueChange={setBillTitle}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-medium text-[#52525B] mb-1">
                    Amount (TZS)
                  </label>
                  <SoftInput
                    type="number"
                    min="1"
                    step="1"
                    placeholder="70000"
                    value={billAmount}
                    onValueChange={setBillAmount}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#52525B] mb-1">
                    Covers (months)
                  </label>
                  <SoftInput
                    type="number"
                    min="1"
                    max="60"
                    value={billIntervalMonths}
                    onValueChange={setBillIntervalMonths}
                    required
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-1.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  {BILL_INTERVAL_PRESETS.map((mos) => {
                    const active = Number(billIntervalMonths) === mos;
                    return (
                      <button
                        key={mos}
                        type="button"
                        onClick={() => setBillIntervalMonths(String(mos))}
                        className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer ${
                          active
                            ? "bg-[#1C1C1E] text-white"
                            : "border border-stone-900/10 bg-white text-[#52525B] hover:text-[#1C1C1E]"
                        }`}
                      >
                        {mos === 1 ? "1 mo (Monthly)" : `${mos} mos`}
                      </button>
                    );
                  })}
                </div>
                {Number(billIntervalMonths) > 1 && Number(billAmount) > 0 && (
                  <span className="font-mono text-[11px] text-[#8F703F] tabular-nums">
                    {formatTZS(Math.round(Number(billAmount) / Number(billIntervalMonths)))}/mo
                  </span>
                )}
              </div>

              {/* Payment Status & Calendar Picker */}
              <div className="space-y-2">
                <SoftSegmented
                  value={billAlreadyPaid ? "paid" : "upcoming"}
                  onValueChange={(v) => setBillAlreadyPaid(v === "paid")}
                  items={[
                    { value: "paid", label: "Paid on date" },
                    { value: "upcoming", label: "Upcoming due date" },
                  ]}
                />
                <div>
                  <label className="block text-xs font-medium text-[#52525B] mb-1">
                    {billAlreadyPaid
                      ? "Date bill was paid (counts months from this date)"
                      : "Next due date"}
                  </label>
                  <IosDatePicker value={billDateISO} onChange={setBillDateISO} />
                </div>

                {/* Optional: Use leftover pool money when marking paid */}
                {billAlreadyPaid && (() => {
                  const totalAmt = Math.max(0, Number(billAmount.replace(/,/g, "").trim()) || 0);
                  const maxPool = Math.min(totalAmt, availablePoolCash);
                  const poolUsed = billUsePool
                    ? Math.max(0, Math.min(maxPool, Math.round(Number(billPoolAmount.replace(/,/g, "").trim()) || 0)))
                    : 0;
                  const remainder = Math.max(0, totalAmt - poolUsed);
                  return (
                    <>
                      <div className="rounded-xl border border-stone-900/[0.08] bg-white p-2.5 space-y-2">
                        <button
                          type="button"
                          disabled={availablePoolCash <= 0}
                          onClick={() => {
                            const next = !billUsePool;
                            setBillUsePool(next);
                            if (next && !billPoolAmount && maxPool > 0) {
                              setBillPoolAmount(String(maxPool));
                            }
                          }}
                          className="flex w-full items-center justify-between gap-2 text-left disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                        >
                          <span className="inline-flex items-center gap-2 text-xs font-medium text-[#1C1C1E]">
                            <span
                              className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border transition-colors ${
                                billUsePool
                                  ? "border-[#1C1C1E] bg-[#1C1C1E] text-white"
                                  : "border-stone-300 bg-white text-transparent"
                              }`}
                            >
                              <Check className="h-3 w-3" strokeWidth={2.5} />
                            </span>
                            <span>Use leftover pool money</span>
                          </span>
                          <span className="font-mono text-[11px] text-[#8E8E93] tabular-nums">
                            {availablePoolCash > 0
                              ? `Avail: ${formatTZS(availablePoolCash)}`
                              : "No pool cash"}
                          </span>
                        </button>
                        {billUsePool && availablePoolCash > 0 && (
                          <div className="space-y-1.5 pt-0.5">
                            <div className="flex items-center gap-2">
                              <SoftInput
                                type="number"
                                min="0"
                                max={String(maxPool)}
                                step="1"
                                placeholder="Amount from pool"
                                value={billPoolAmount}
                                onValueChange={setBillPoolAmount}
                                className="flex-1"
                              />
                              <button
                                type="button"
                                onClick={() => setBillPoolAmount(String(maxPool))}
                                className="shrink-0 rounded-lg border border-stone-900/10 bg-[#F6F5F2] px-2.5 py-2 text-[11px] font-medium text-[#1C1C1E] hover:bg-stone-200/60 cursor-pointer"
                              >
                                Use max
                              </button>
                            </div>
                            {totalAmt > 0 && (
                              <div className="text-[11px] text-[#8F703F] tabular-nums">
                                {remainder === 0
                                  ? "Covered in full from pool · TZS 0/member"
                                  : `${formatTZS(poolUsed)} from pool + ${formatTZS(remainder)} left (${formatTZS(Math.round(remainder / memberCount))}/member)`}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Split by all vs. Paid by 1 member (only when remaining > 0) */}
                      {(totalAmt === 0 || remainder > 0) && (
                        <div className="space-y-2 pt-1">
                          <div className="flex items-center justify-between gap-2">
                            <label className="block text-xs font-medium text-[#52525B]">
                              {poolUsed > 0 ? "Who pays the remaining" : "Who pays"}
                            </label>
                            {totalAmt > 0 && (
                              <span className="font-mono text-[11px] text-[#8F703F] tabular-nums">
                                {formatTZS(Math.round(remainder / memberCount))}/member
                              </span>
                            )}
                          </div>
                          <SoftSegmented
                            value={billPaidMode}
                            onValueChange={(v) => setBillPaidMode(v as "all" | "single")}
                            items={[
                              { value: "all", label: `Split by all (${memberCount})` },
                              { value: "single", label: "Paid by 1 member" },
                            ]}
                          />
                          {billPaidMode === "single" && members.length > 0 && (
                            <div className="grid grid-cols-2 gap-1.5">
                              {members.map((m) => {
                                const selected = billPaidBy === m.user_id;
                                const name = m.profile?.full_name ?? "Roommate";
                                const color = m.profile?.avatar_color ?? "#BFA377";
                                return (
                                  <button
                                    key={m.user_id}
                                    type="button"
                                    onClick={() => setBillPaidBy(m.user_id)}
                                    className={`flex items-center gap-2 rounded-xl border px-2.5 py-1.5 text-left text-xs font-medium transition-colors cursor-pointer ${
                                      selected
                                        ? "border-[#1C1C1E] bg-[#1C1C1E] text-white"
                                        : "border-stone-900/10 bg-white text-[#52525B]"
                                    }`}
                                  >
                                    <span
                                      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white"
                                      style={{ backgroundColor: color }}
                                    >
                                      {getInitials(name)}
                                    </span>
                                    <span className="truncate">
                                      {name.split(" ")[0]}
                                      {m.user_id === currentUserId ? " (You)" : ""}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                {EXPENSE_CATEGORIES.map((cat) => {
                  const selected = billCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setBillCategory(cat.id)}
                      className={`flex items-center gap-2 rounded-xl border px-2.5 py-2 text-left text-xs font-medium transition-colors cursor-pointer ${
                        selected
                          ? "border-[#1C1C1E] bg-[#1C1C1E] text-white"
                          : "border-stone-900/10 bg-white text-[#52525B]"
                      }`}
                    >
                      <CategoryIcon category={cat.id} className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{cat.label}</span>
                    </button>
                  );
                })}
              </div>

              <SoftButton
                type="submit"
                variant="filled"
                disabled={addingBill}
                className="w-full !h-9 text-xs font-medium"
              >
                {addingBill ? "Saving..." : "Save bill"}
              </SoftButton>
            </form>
          )}

          {bills.length === 0 ? (
            <div className="rounded-xl bg-[#F6F5F2] py-8 px-4 text-center space-y-1.5">
              <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-xl bg-white border border-stone-900/[0.08] text-[#52525B]">
                <CalendarClock className="h-4 w-4" />
              </div>
              <p className="text-sm font-medium text-[#1C1C1E]">No recurring bills yet</p>
              <p className="text-xs text-[#8E8E93]">
                Add rent, Wi-Fi, water, or security fees so no due date is missed
              </p>
            </div>
          ) : (
            <div className="divide-y divide-stone-900/[0.06]">
              {bills.map((bill) => {
                const status = getBillDueStatus(bill);
                const confirming = confirmDeleteBillId === bill.id;
                const editingDate = editingPaidBillId === bill.id;
                const defaultBillISO = bill.last_paid_month
                  ? `${bill.last_paid_month}-${String(bill.due_day).padStart(2, "0")}`
                  : toISODate(new Date());
                const billPoolUsed = Math.max(0, Math.min(bill.amount, bill.pool_amount_used ?? 0));
                const billRemainder = Math.max(0, bill.amount - billPoolUsed);
                const perMemberShare = Math.round(billRemainder / memberCount);
                const paidMode: "all" | "single" = bill.paid_mode === "single" ? "single" : "all";
                const payerMember =
                  paidMode === "single" && bill.paid_by
                    ? members.find((m) => m.user_id === bill.paid_by)
                    : null;
                const otherMembers =
                  paidMode === "single" && bill.paid_by && billRemainder > 0
                    ? members.filter((m) => m.user_id !== bill.paid_by)
                    : [];
                const settledSet = new Set(bill.settled_by ?? []);
                const allOthersSettled =
                  otherMembers.length > 0 &&
                  otherMembers.every((m) => settledSet.has(m.user_id));

                return (
                  <div key={bill.id} className="py-3 first:pt-1 last:pb-0 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="flex w-5 shrink-0 items-center justify-center text-[#52525B]">
                          <CategoryIcon category={bill.category} className="h-4 w-4" />
                        </span>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-[#1C1C1E]">
                            {bill.title}
                          </div>
                          <div className="text-xs font-semibold text-[#52525B] tabular-nums">
                            {formatTZS(bill.amount)}
                            {(bill.interval_months ?? 1) > 1 && (
                              <span className="ml-1.5 font-normal text-[#8E8E93]">
                                · {bill.interval_months} mos (
                                {formatTZS(Math.round(bill.amount / (bill.interval_months ?? 1)))}
                                /mo)
                              </span>
                            )}
                          </div>
                          {status.isPaidThisMonth && (
                            <div className="mt-0.5 text-[11px] font-medium text-[#8F703F] tabular-nums">
                              {billRemainder === 0
                                ? "Paid in full from pool"
                                : billPoolUsed > 0
                                  ? `${formatTZS(billPoolUsed)} from pool + ${
                                      paidMode === "single" && payerMember
                                        ? `${payerMember.profile.full_name.split(" ")[0]} (${formatTZS(perMemberShare)}/member)`
                                        : `split (${formatTZS(perMemberShare)}/member)`
                                    }`
                                  : paidMode === "single" && payerMember
                                    ? `Paid by ${payerMember.profile.full_name} · ${formatTZS(perMemberShare)}/member`
                                    : `Split by all (${memberCount}) · ${formatTZS(perMemberShare)}/member`}
                            </div>
                          )}
                          {status.paidDateLabel && status.nextDueDateLabel && (
                            <div className="mt-0.5 text-[11px] text-[#8E8E93] tabular-nums">
                              Paid {status.paidDateLabel} → Next due {status.nextDueDateLabel}
                            </div>
                          )}
                        </div>
                      </div>

                      <span
                        className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-medium ${
                          status.isPaidThisMonth
                            ? "bg-emerald-50 text-emerald-700"
                            : status.isOverdue
                              ? "bg-rose-50 text-rose-700"
                              : status.isDueSoon
                                ? "bg-stone-100 text-[#8F703F]"
                                : "bg-stone-100 text-[#52525B]"
                        }`}
                      >
                        {status.statusLabel}
                      </span>
                    </div>

                    {/* Per-roommate payback checkmarks when 1 member covered the remaining bill */}
                    {status.isPaidThisMonth &&
                      paidMode === "single" &&
                      billRemainder > 0 &&
                      otherMembers.length > 0 && (
                        <div className="pl-8 space-y-1.5">
                          <div className="flex items-center justify-between text-[11px] text-[#8E8E93]">
                            <span>
                              {allOthersSettled
                                ? `Everyone paid back ${payerMember?.profile.full_name.split(" ")[0] ?? "payer"}`
                                : `Tap as each roommate pays ${formatTZS(perMemberShare)} back`}
                            </span>
                            {allOthersSettled && (
                              <span className="font-medium text-emerald-700">All settled</span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {otherMembers.map((m) => {
                              const isSettled = settledSet.has(m.user_id);
                              const firstName = m.profile.full_name.split(" ")[0];
                              return (
                                <button
                                  key={m.user_id}
                                  type="button"
                                  onClick={() => void onToggleBillMemberSettled(bill.id, m.user_id)}
                                  className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-medium transition-colors cursor-pointer ${
                                    isSettled
                                      ? "border-emerald-700/20 bg-emerald-50 text-emerald-700"
                                      : "border-stone-900/10 bg-[#F6F5F2] text-[#52525B] hover:border-stone-900/25"
                                  }`}
                                >
                                  {isSettled && <Check className="h-3 w-3" strokeWidth={2.5} />}
                                  <span>{firstName}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                    <div className="flex items-center justify-between gap-2 pl-8">
                      <div className="flex flex-wrap items-center gap-2">
                        {!status.isPaidThisMonth ? (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingPaidBillId(editingDate ? null : bill.id);
                              setEditingPaidDateISO(defaultBillISO);
                              setEditingPaidMode(paidMode);
                              setEditingPaidBy(bill.paid_by || currentUserId);
                              setEditingUsePool(false);
                              setEditingPoolAmount("");
                            }}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-[#1C1C1E] px-2.5 py-1 text-xs font-medium text-white hover:bg-[#2C2C30] transition-colors cursor-pointer"
                          >
                            <Check className="h-3 w-3" />
                            Mark paid
                          </button>
                        ) : (
                          <>
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              {(bill.interval_months ?? 1) > 1
                                ? `Covered for ${bill.interval_months} months`
                                : "Settled for this month"}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingPaidBillId(editingDate ? null : bill.id);
                                setEditingPaidDateISO(defaultBillISO);
                                setEditingPaidMode(paidMode);
                                setEditingPaidBy(bill.paid_by || currentUserId);
                                setEditingUsePool(billPoolUsed > 0);
                                setEditingPoolAmount(billPoolUsed > 0 ? String(billPoolUsed) : "");
                              }}
                              className="inline-flex items-center gap-1 rounded-md bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-[#52525B] hover:text-[#1C1C1E] transition-colors cursor-pointer"
                            >
                              <Calendar className="h-3 w-3" />
                              Edit payment
                            </button>
                          </>
                        )}
                        {(() => {
                          const historyCount = billPayments.filter((p) => p.bill_id === bill.id).length;
                          if (historyCount === 0) return null;
                          const isOpen = expandedBillHistoryId === bill.id;
                          return (
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedBillHistoryId(isOpen ? null : bill.id)
                              }
                              className="inline-flex items-center gap-1 rounded-md bg-[#F6F5F2] border border-stone-900/10 px-2 py-0.5 text-[11px] font-medium text-[#52525B] hover:text-[#1C1C1E] transition-colors cursor-pointer"
                            >
                              History ({historyCount})
                            </button>
                          );
                        })()}
                      </div>

                      {confirming ? (
                        <div className="flex items-center gap-1.5 text-xs">
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteBillId(null)}
                            className="rounded-md bg-stone-100 px-2 py-0.5 font-medium text-[#52525B] cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setConfirmDeleteBillId(null);
                              void onDeleteBill(bill.id);
                            }}
                            className="rounded-md bg-rose-700 px-2 py-0.5 font-medium text-white cursor-pointer"
                          >
                            Delete
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          aria-label={`Delete ${bill.title}`}
                          onClick={() => setConfirmDeleteBillId(bill.id)}
                          className="flex h-7 w-7 items-center justify-center rounded-md text-[#8E8E93] hover:bg-rose-50 hover:text-rose-700 transition-colors cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Expandable Payment History for this bill */}
                    {expandedBillHistoryId === bill.id && (() => {
                      const records = billPayments.filter((p) => p.bill_id === bill.id);
                      if (records.length === 0) return null;
                      return (
                        <div className="ml-8 rounded-xl border border-stone-900/[0.08] bg-[#F6F5F2] p-2.5 space-y-1.5">
                          <div className="text-[11px] font-medium text-[#52525B]">
                            Payment history ({records.length})
                          </div>
                          <div className="divide-y divide-stone-900/[0.06]">
                            {records.map((rec) => {
                              const payerName = rec.paid_by
                                ? members.find((m) => m.user_id === rec.paid_by)?.profile.full_name.split(" ")[0]
                                : null;
                              return (
                                <div
                                  key={rec.id}
                                  className="flex items-center justify-between gap-2 py-1.5 first:pt-0 last:pb-0 text-[11px]"
                                >
                                  <div className="min-w-0">
                                    <span className="font-mono text-[#1C1C1E]">{rec.paid_date}</span>
                                    <span className="ml-1.5 text-[#8E8E93]">
                                      {rec.pool_amount_used >= rec.amount
                                        ? "Paid from pool"
                                        : rec.paid_mode === "single" && payerName
                                          ? `Paid by ${payerName}`
                                          : "Split by all"}
                                    </span>
                                  </div>
                                  <span className="shrink-0 font-semibold text-[#1C1C1E] tabular-nums">
                                    {formatTZS(rec.amount)}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Inline Calendar, Optional Pool Usage & Payer Picker */}
                    {editingDate && (() => {
                      const monthKey = editingPaidDateISO.slice(0, 7);
                      const prevPool = bill.last_paid_month === monthKey ? billPoolUsed : 0;
                      const maxPool = Math.min(bill.amount, prevPool + availablePoolCash);
                      const canUsePool = maxPool > 0;
                      const editPoolUsed = editingUsePool
                        ? Math.max(
                            prevPool,
                            Math.min(maxPool, Math.round(Number(editingPoolAmount.replace(/,/g, "").trim()) || 0)),
                          )
                        : prevPool;
                      const editRemainder = Math.max(0, bill.amount - editPoolUsed);
                      return (
                        <div className="ml-8 rounded-xl border border-stone-900/[0.08] bg-[#F6F5F2] p-3 space-y-2.5">
                          <div className="text-xs font-medium text-[#1C1C1E]">
                            Record payment for {bill.title}
                          </div>
                          <IosDatePicker
                            value={editingPaidDateISO}
                            onChange={setEditingPaidDateISO}
                          />

                          {/* Optional leftover pool money */}
                          <div className="rounded-xl border border-stone-900/[0.08] bg-white p-2.5 space-y-2">
                            <button
                              type="button"
                              disabled={!canUsePool}
                              onClick={() => {
                                if (prevPool > 0 && editingUsePool) return;
                                const next = !editingUsePool;
                                setEditingUsePool(next);
                                if (next && !editingPoolAmount && maxPool > 0) {
                                  setEditingPoolAmount(String(maxPool));
                                }
                              }}
                              className="flex w-full items-center justify-between gap-2 text-left disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                            >
                              <span className="inline-flex items-center gap-2 text-xs font-medium text-[#1C1C1E]">
                                <span
                                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border transition-colors ${
                                    editingUsePool
                                      ? "border-[#1C1C1E] bg-[#1C1C1E] text-white"
                                      : "border-stone-300 bg-white text-transparent"
                                  }`}
                                >
                                  <Check className="h-3 w-3" strokeWidth={2.5} />
                                </span>
                                <span>Use leftover pool money</span>
                              </span>
                              <span className="font-mono text-[11px] text-[#8E8E93] tabular-nums">
                                {canUsePool ? `Max: ${formatTZS(maxPool)}` : "No pool cash"}
                              </span>
                            </button>
                            {editingUsePool && canUsePool && (
                              <div className="space-y-1.5 pt-0.5">
                                <div className="flex items-center gap-2">
                                  <SoftInput
                                    type="number"
                                    min={String(prevPool)}
                                    max={String(maxPool)}
                                    step="1"
                                    placeholder="Amount from pool"
                                    value={editingPoolAmount}
                                    onValueChange={setEditingPoolAmount}
                                    className="flex-1"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => setEditingPoolAmount(String(maxPool))}
                                    className="shrink-0 rounded-lg border border-stone-900/10 bg-[#F6F5F2] px-2.5 py-2 text-[11px] font-medium text-[#1C1C1E] hover:bg-stone-200/60 cursor-pointer"
                                  >
                                    Use max
                                  </button>
                                </div>
                                <div className="text-[11px] text-[#8F703F] tabular-nums">
                                  {editRemainder === 0
                                    ? "Covered in full from pool · TZS 0/member"
                                    : `${formatTZS(editPoolUsed)} from pool + ${formatTZS(editRemainder)} left (${formatTZS(Math.round(editRemainder / memberCount))}/member)`}
                                </div>
                              </div>
                            )}
                          </div>

                          {editRemainder > 0 && (
                            <>
                              <SoftSegmented
                                value={editingPaidMode}
                                onValueChange={(v) => setEditingPaidMode(v as "all" | "single")}
                                items={[
                                  { value: "all", label: `Split by all (${memberCount})` },
                                  { value: "single", label: "Paid by 1 member" },
                                ]}
                              />
                              {editingPaidMode === "single" && members.length > 0 && (
                                <div className="grid grid-cols-2 gap-1.5">
                                  {members.map((m) => {
                                    const selected = editingPaidBy === m.user_id;
                                    const name = m.profile?.full_name ?? "Roommate";
                                    const color = m.profile?.avatar_color ?? "#BFA377";
                                    return (
                                      <button
                                        key={m.user_id}
                                        type="button"
                                        onClick={() => setEditingPaidBy(m.user_id)}
                                        className={`flex items-center gap-2 rounded-xl border px-2.5 py-1.5 text-left text-xs font-medium transition-colors cursor-pointer ${
                                          selected
                                            ? "border-[#1C1C1E] bg-[#1C1C1E] text-white"
                                            : "border-stone-900/10 bg-white text-[#52525B]"
                                        }`}
                                      >
                                        <span
                                          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white"
                                          style={{ backgroundColor: color }}
                                        >
                                          {getInitials(name)}
                                        </span>
                                        <span className="truncate">
                                          {name.split(" ")[0]}
                                          {m.user_id === currentUserId ? " (You)" : ""}
                                        </span>
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </>
                          )}
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setEditingPaidBillId(null)}
                              className="rounded-lg bg-white px-2.5 py-1 text-xs font-medium text-[#52525B] border border-stone-900/10 cursor-pointer"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              disabled={savingPaidBillId === bill.id}
                              onClick={() => void handleSaveBillPaidDate(bill)}
                              className="rounded-lg bg-[#1C1C1E] px-3 py-1 text-xs font-medium text-white hover:bg-[#2C2C30] disabled:opacity-50 cursor-pointer"
                            >
                              {savingPaidBillId === bill.id ? "Saving..." : "Save payment"}
                            </button>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {subTab === "needs" && (
        <section className="rounded-2xl border border-stone-900/[0.08] bg-white p-4 space-y-3.5">
          <div>
            <h2 className="text-base font-semibold text-[#1C1C1E]">What the house needs</h2>
            <p className="text-xs text-[#52525B] mt-0.5">
              Shared shopping list — separate from weekly pool unless you use leftover cash
            </p>
          </div>

          {/* Quick Add Need Form */}
          <form onSubmit={(e) => void handleAddNeed(e)} className="space-y-2.5">
            <div className="flex items-center gap-2">
              <SoftInput
                type="text"
                maxLength={120}
                placeholder="Cooking gas, Rice, Dish soap"
                value={needTitle}
                onValueChange={setNeedTitle}
                className="flex-1"
                required
              />
              <SoftButton
                type="submit"
                variant="filled"
                disabled={addingNeed}
                className="shrink-0 !h-10 text-xs font-medium"
              >
                Add
              </SoftButton>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <SoftInput
                type="number"
                min="1"
                step="1"
                placeholder="Est. price (TZS)"
                value={needEstimate}
                onValueChange={setNeedEstimate}
              />
              <SoftInput
                type="text"
                maxLength={40}
                placeholder="Qty (e.g. 5 kg, 2 pcs)"
                value={needQty}
                onValueChange={setNeedQty}
              />
            </div>
            <div
              data-no-tab-swipe
              className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5"
            >
              {EXPENSE_CATEGORIES.map((cat) => {
                const active = needCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setNeedCategory(cat.id)}
                    className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer ${
                      active
                        ? "bg-[#1C1C1E] text-white"
                        : "border border-stone-900/10 bg-[#F6F5F2] text-[#52525B]"
                    }`}
                  >
                    <CategoryIcon category={cat.id} className="h-3.5 w-3.5" />
                    <span>{cat.label}</span>
                  </button>
                );
              })}
            </div>
          </form>

          {/* Shopping-list Estimate Summary */}
          {pendingNeedsPricedCount > 0 && (
            <div className="grid grid-cols-2 divide-x divide-stone-900/[0.06] rounded-xl bg-[#F6F5F2] p-3">
              <div className="pr-3">
                <div className="text-xs text-[#52525B]">Est. shopping total</div>
                <div className="mt-0.5 text-sm font-semibold text-[#1C1C1E] tabular-nums">
                  {formatTZS(pendingNeedsEstTotal)}
                </div>
              </div>
              <div className="pl-3">
                <div className="text-xs text-[#52525B]">Est. per member ({memberCount})</div>
                <div className="mt-0.5 text-sm font-semibold text-[#8F703F] tabular-nums">
                  {formatTZS(Math.round(pendingNeedsEstTotal / memberCount))}
                </div>
              </div>
            </div>
          )}

          {needs.length === 0 ? (
            <div className="rounded-xl bg-[#F6F5F2] py-8 px-4 text-center space-y-1.5">
              <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-xl bg-white border border-stone-900/[0.08] text-[#52525B]">
                <ShoppingBasket className="h-4 w-4" />
              </div>
              <p className="text-sm font-medium text-[#1C1C1E]">Everything is stocked</p>
              <p className="text-xs text-[#8E8E93]">
                Add groceries, gas, or cleaning supplies whenever the house runs low
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingNeeds.length > 0 && (
                <div className="divide-y divide-stone-900/[0.06]">
                  {pendingNeeds.map((item) => {
                    const isBuying = buyingNeedId === item.id;
                    const actAmt = Math.max(
                      0,
                      Math.round(Number(buyingActualAmount.replace(/,/g, "").trim()) || 0),
                    );
                    const maxPool = Math.min(actAmt, availablePoolCash);
                    const poolUsed = buyingUsePool
                      ? Math.max(
                          0,
                          Math.min(
                            maxPool,
                            Math.round(Number(buyingPoolAmount.replace(/,/g, "").trim()) || 0),
                          ),
                        )
                      : 0;
                    const remainder = Math.max(0, actAmt - poolUsed);

                    return (
                      <div key={item.id} className="py-2.5 first:pt-0 last:pb-0 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <button
                              type="button"
                              aria-label={`Mark ${item.title} as bought`}
                              onClick={() => {
                                setBuyingNeedId(isBuying ? null : item.id);
                                setBuyingActualAmount(
                                  item.estimated_amount ? String(item.estimated_amount) : "",
                                );
                                setBuyingPaidMode("all");
                                setBuyingPaidBy(currentUserId);
                                setBuyingUsePool(false);
                                setBuyingPoolAmount("");
                              }}
                              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-stone-300 bg-white hover:border-[#1C1C1E] transition-colors cursor-pointer"
                            />
                            <div className="min-w-0">
                              <div className="truncate text-sm font-medium text-[#1C1C1E]">
                                {item.title}
                                {item.quantity && (
                                  <span className="ml-1.5 text-xs font-normal text-[#52525B]">
                                    · {item.quantity}
                                  </span>
                                )}
                              </div>
                              <div className="truncate text-xs text-[#8E8E93] tabular-nums">
                                {item.estimated_amount
                                  ? `Est. ${formatTZS(item.estimated_amount)} (${formatTZS(Math.round(item.estimated_amount / memberCount))}/member)`
                                  : `Added by ${item.adder?.full_name ?? "Member"}`}
                              </div>
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setBuyingNeedId(isBuying ? null : item.id);
                                setBuyingActualAmount(
                                  item.estimated_amount ? String(item.estimated_amount) : "",
                                );
                                setBuyingPaidMode("all");
                                setBuyingPaidBy(currentUserId);
                                setBuyingUsePool(false);
                                setBuyingPoolAmount("");
                              }}
                              className="rounded-lg bg-[#1C1C1E] px-2.5 py-1 text-xs font-medium text-white hover:bg-[#2C2C30] transition-colors cursor-pointer"
                            >
                              Mark bought
                            </button>
                            <button
                              type="button"
                              aria-label={`Remove ${item.title}`}
                              onClick={() => void onDeleteNeed(item.id)}
                              className="flex h-7 w-7 items-center justify-center rounded-md text-[#8E8E93] hover:bg-rose-50 hover:text-rose-700 transition-colors cursor-pointer"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>

                        {isBuying && (
                          <div className="ml-7 rounded-xl border border-stone-900/[0.08] bg-[#F6F5F2] p-3 space-y-2.5">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-medium text-[#1C1C1E]">
                                Complete purchase: {item.title}
                              </span>
                              {actAmt > 0 && remainder > 0 && (
                                <span className="font-mono text-[11px] text-[#8F703F] tabular-nums">
                                  {formatTZS(Math.round(remainder / memberCount))}/member
                                </span>
                              )}
                            </div>

                            <SoftInput
                              type="number"
                              min="1"
                              step="1"
                              placeholder="Actual price paid (TZS, optional)"
                              value={buyingActualAmount}
                              onValueChange={setBuyingActualAmount}
                              icon={
                                <span className="font-mono text-xs font-medium text-[#8E8E93]">
                                  TZS
                                </span>
                              }
                            />

                            {/* Optional leftover pool money */}
                            {actAmt > 0 && (
                              <div className="rounded-xl border border-stone-900/[0.08] bg-white p-2.5 space-y-2">
                                <button
                                  type="button"
                                  disabled={availablePoolCash <= 0}
                                  onClick={() => {
                                    const next = !buyingUsePool;
                                    setBuyingUsePool(next);
                                    if (next && !buyingPoolAmount && maxPool > 0) {
                                      setBuyingPoolAmount(String(maxPool));
                                    }
                                  }}
                                  className="flex w-full items-center justify-between gap-2 text-left disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                                >
                                  <span className="inline-flex items-center gap-2 text-xs font-medium text-[#1C1C1E]">
                                    <span
                                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border transition-colors ${
                                        buyingUsePool
                                          ? "border-[#1C1C1E] bg-[#1C1C1E] text-white"
                                          : "border-stone-300 bg-white text-transparent"
                                      }`}
                                    >
                                      <Check className="h-3 w-3" strokeWidth={2.5} />
                                    </span>
                                    <span>Use leftover pool money</span>
                                  </span>
                                  <span className="font-mono text-[11px] text-[#8E8E93] tabular-nums">
                                    {availablePoolCash > 0
                                      ? `Avail: ${formatTZS(availablePoolCash)}`
                                      : "No pool cash"}
                                  </span>
                                </button>
                                {buyingUsePool && availablePoolCash > 0 && (
                                  <div className="space-y-1.5 pt-0.5">
                                    <div className="flex items-center gap-2">
                                      <SoftInput
                                        type="number"
                                        min="0"
                                        max={String(maxPool)}
                                        step="1"
                                        placeholder="Amount from pool"
                                        value={buyingPoolAmount}
                                        onValueChange={setBuyingPoolAmount}
                                        className="flex-1"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => setBuyingPoolAmount(String(maxPool))}
                                        className="shrink-0 rounded-lg border border-stone-900/10 bg-[#F6F5F2] px-2.5 py-2 text-[11px] font-medium text-[#1C1C1E] hover:bg-stone-200/60 cursor-pointer"
                                      >
                                        Use max
                                      </button>
                                    </div>
                                    <div className="text-[11px] text-[#8F703F] tabular-nums">
                                      {remainder === 0
                                        ? "Covered in full from pool · TZS 0/member"
                                        : `${formatTZS(poolUsed)} from pool + ${formatTZS(remainder)} left (${formatTZS(Math.round(remainder / memberCount))}/member)`}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Who bought the remaining amount */}
                            {actAmt > 0 && remainder > 0 && (
                              <>
                                <SoftSegmented
                                  value={buyingPaidMode}
                                  onValueChange={(v) => setBuyingPaidMode(v as "all" | "single")}
                                  items={[
                                    { value: "all", label: `Split by all (${memberCount})` },
                                    { value: "single", label: "Bought by 1 member" },
                                  ]}
                                />
                                {buyingPaidMode === "single" && members.length > 0 && (
                                  <div className="grid grid-cols-2 gap-1.5">
                                    {members.map((m) => {
                                      const selected = buyingPaidBy === m.user_id;
                                      const name = m.profile?.full_name ?? "Roommate";
                                      const color = m.profile?.avatar_color ?? "#BFA377";
                                      return (
                                        <button
                                          key={m.user_id}
                                          type="button"
                                          onClick={() => setBuyingPaidBy(m.user_id)}
                                          className={`flex items-center gap-2 rounded-xl border px-2.5 py-1.5 text-left text-xs font-medium transition-colors cursor-pointer ${
                                            selected
                                              ? "border-[#1C1C1E] bg-[#1C1C1E] text-white"
                                              : "border-stone-900/10 bg-white text-[#52525B]"
                                          }`}
                                        >
                                          <span
                                            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white"
                                            style={{ backgroundColor: color }}
                                          >
                                            {getInitials(name)}
                                          </span>
                                          <span className="truncate">
                                            {name.split(" ")[0]}
                                            {m.user_id === currentUserId ? " (You)" : ""}
                                          </span>
                                        </button>
                                      );
                                    })}
                                  </div>
                                )}
                              </>
                            )}

                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => setBuyingNeedId(null)}
                                className="rounded-lg bg-white px-2.5 py-1 text-xs font-medium text-[#52525B] border border-stone-900/10 cursor-pointer"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                disabled={savingBoughtNeedId === item.id}
                                onClick={() => void handleSaveNeedBought(item)}
                                className="rounded-lg bg-[#1C1C1E] px-3 py-1 text-xs font-medium text-white hover:bg-[#2C2C30] disabled:opacity-50 cursor-pointer"
                              >
                                {savingBoughtNeedId === item.id ? "Saving..." : "Confirm bought"}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {boughtNeeds.length > 0 && (
                <div className="pt-2 border-t border-stone-900/[0.06] space-y-1.5">
                  <div className="text-xs font-medium text-[#8E8E93]">
                    Recently bought ({boughtNeeds.length})
                  </div>
                  <div className="divide-y divide-stone-900/[0.06]">
                    {boughtNeeds.map((item) => {
                      const finalAmt = item.actual_amount ?? item.estimated_amount ?? 0;
                      const needPoolUsed = Math.max(
                        0,
                        Math.min(finalAmt, item.pool_amount_used ?? 0),
                      );
                      const needRemainder = Math.max(0, finalAmt - needPoolUsed);
                      const perMember = Math.round(needRemainder / memberCount);
                      const paidMode: "all" | "single" =
                        item.paid_mode === "single" ? "single" : "all";
                      const payerMember =
                        paidMode === "single" && item.paid_by
                          ? members.find((m) => m.user_id === item.paid_by)
                          : null;
                      const otherMembers =
                        paidMode === "single" && item.paid_by && needRemainder > 0
                          ? members.filter((m) => m.user_id !== item.paid_by)
                          : [];
                      const settledSet = new Set(item.settled_by ?? []);
                      const allOthersSettled =
                        otherMembers.length > 0 &&
                        otherMembers.every((m) => settledSet.has(m.user_id));

                      return (
                        <div key={item.id} className="py-2.5 space-y-1.5">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-start gap-2.5 min-w-0">
                              <button
                                type="button"
                                aria-label={`Restore ${item.title} to needed`}
                                onClick={() => void onToggleNeed(item.id, false)}
                                className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-[#1C1C1E] text-white cursor-pointer"
                              >
                                <Check className="h-3 w-3" strokeWidth={2.5} />
                              </button>
                              <div className="min-w-0">
                                <div className="truncate text-xs font-medium text-[#52525B] line-through">
                                  {item.title}
                                  {item.quantity ? ` · ${item.quantity}` : ""}
                                </div>
                                {finalAmt > 0 && (
                                  <div className="mt-0.5 text-[11px] font-medium text-[#8F703F] tabular-nums">
                                    {formatTZS(finalAmt)}
                                    {" · "}
                                    {needRemainder === 0
                                      ? "Paid in full from pool"
                                      : needPoolUsed > 0
                                        ? `${formatTZS(needPoolUsed)} from pool + ${
                                            paidMode === "single" && payerMember
                                              ? `${payerMember.profile.full_name.split(" ")[0]} (${formatTZS(perMember)}/member)`
                                              : `split (${formatTZS(perMember)}/member)`
                                          }`
                                        : paidMode === "single" && payerMember
                                          ? `Bought by ${payerMember.profile.full_name.split(" ")[0]} · ${formatTZS(perMember)}/member`
                                          : `Split by all (${memberCount}) · ${formatTZS(perMember)}/member`}
                                  </div>
                                )}
                              </div>
                            </div>
                            <button
                              type="button"
                              aria-label={`Delete ${item.title}`}
                              onClick={() => void onDeleteNeed(item.id)}
                              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[#8E8E93] hover:bg-rose-50 hover:text-rose-700 transition-colors cursor-pointer"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>

                          {finalAmt > 0 &&
                            paidMode === "single" &&
                            needRemainder > 0 &&
                            otherMembers.length > 0 && (
                              <div className="pl-7 space-y-1.5">
                                <div className="flex items-center justify-between text-[11px] text-[#8E8E93]">
                                  <span>
                                    {allOthersSettled
                                      ? `Everyone paid back ${payerMember?.profile.full_name.split(" ")[0] ?? "buyer"}`
                                      : `Tap as each roommate pays ${formatTZS(perMember)} back`}
                                  </span>
                                  {allOthersSettled && (
                                    <span className="font-medium text-emerald-700">
                                      All settled
                                    </span>
                                  )}
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                  {otherMembers.map((m) => {
                                    const isSettled = settledSet.has(m.user_id);
                                    const firstName = m.profile.full_name.split(" ")[0];
                                    return (
                                      <button
                                        key={m.user_id}
                                        type="button"
                                        onClick={() =>
                                          void onToggleNeedMemberSettled(item.id, m.user_id)
                                        }
                                        className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-medium transition-colors cursor-pointer ${
                                          isSettled
                                            ? "border-emerald-700/20 bg-emerald-50 text-emerald-700"
                                            : "border-stone-900/10 bg-[#F6F5F2] text-[#52525B] hover:border-stone-900/25"
                                        }`}
                                      >
                                        {isSettled && (
                                          <Check className="h-3 w-3" strokeWidth={2.5} />
                                        )}
                                        <span>{firstName}</span>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

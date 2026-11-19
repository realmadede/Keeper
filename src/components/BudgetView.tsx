import { useState, type FormEvent } from "react";
import { SegmentedControl } from "glisse";
import {
  CalendarClock,
  Check,
  CheckCircle2,
  Plus,
  Share2,
  ShoppingBasket,
  Trash2,
} from "lucide-react";
import {
  getBillDueStatus,
  type WeeklySummary,
  type WeekWindow,
} from "../lib/analytics";
import { buildWeeklyWhatsAppSummary } from "../lib/export";
import { formatTZS, getInitials } from "../lib/format";
import {
  EXPENSE_CATEGORIES,
  type BudgetSubTab,
  type ExpenseCategoryId,
  type Household,
  type HouseholdNeed,
  type RecurringBill,
} from "../types";
import type { TransactionPrefill } from "./AddTransactionModal";
import { CategoryIcon } from "./CategoryIcon";
import { SoftButton, SoftInput } from "./LightControls";

interface BudgetViewProps {
  household: Household;
  weekWindow: WeekWindow;
  summary: WeeklySummary;
  subTab: BudgetSubTab;
  onSubTabChange: (tab: BudgetSubTab) => void;
  needs: HouseholdNeed[];
  bills: RecurringBill[];
  onUpdateBudget: (weeklyBudget: number, memberShare: number) => Promise<void>;
  onAddNeed: (title: string, category: ExpenseCategoryId) => Promise<void>;
  onToggleNeed: (id: string, isBought: boolean) => Promise<void>;
  onDeleteNeed: (id: string) => Promise<void>;
  onAddBill: (
    title: string,
    amount: number,
    category: ExpenseCategoryId,
    dueDay: number,
  ) => Promise<void>;
  onDeleteBill: (id: string) => Promise<void>;
  onStartPrefillExpense: (draft: TransactionPrefill) => void;
}

export function BudgetView({
  household,
  weekWindow,
  summary,
  subTab,
  onSubTabChange,
  needs,
  bills,
  onUpdateBudget,
  onAddNeed,
  onToggleNeed,
  onDeleteNeed,
  onAddBill,
  onDeleteBill,
  onStartPrefillExpense,
}: BudgetViewProps) {
  // Pool budget form
  const [weeklyTarget, setWeeklyTarget] = useState(String(household.weekly_budget_target));
  const [memberShare, setMemberShare] = useState(String(household.member_weekly_share));
  const [saving, setSaving] = useState(false);
  const [savedToast, setSavedToast] = useState(false);
  const [copiedSummary, setCopiedSummary] = useState(false);

  // Add Need form
  const [needTitle, setNeedTitle] = useState("");
  const [needCategory, setNeedCategory] = useState<ExpenseCategoryId>("food");
  const [addingNeed, setAddingNeed] = useState(false);

  // Add Bill form
  const [showBillForm, setShowBillForm] = useState(false);
  const [billTitle, setBillTitle] = useState("");
  const [billAmount, setBillAmount] = useState("");
  const [billCategory, setBillCategory] = useState<ExpenseCategoryId>("rent");
  const [billDueDay, setBillDueDay] = useState("1");
  const [addingBill, setAddingBill] = useState(false);
  const [confirmDeleteBillId, setConfirmDeleteBillId] = useState<string | null>(null);

  const periodTarget =
    weekWindow.kind === "month"
      ? household.weekly_budget_target * 4
      : household.weekly_budget_target;

  const poolPct =
    periodTarget > 0 ? Math.min(100, Math.round((summary.totalContributed / periodTarget) * 100)) : 0;

  const spentPct =
    periodTarget > 0 ? Math.min(100, Math.round((summary.totalSpent / periodTarget) * 100)) : 0;

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

  const handleAddNeed = async (e: FormEvent) => {
    e.preventDefault();
    if (!needTitle.trim()) return;
    setAddingNeed(true);
    try {
      await onAddNeed(needTitle, needCategory);
      setNeedTitle("");
    } finally {
      setAddingNeed(false);
    }
  };

  const handleAddBill = async (e: FormEvent) => {
    e.preventDefault();
    const numericAmount = Number(billAmount.replace(/,/g, "").trim());
    const numericDay = Number(billDueDay);
    if (!billTitle.trim() || !Number.isFinite(numericAmount) || numericAmount <= 0) return;
    setAddingBill(true);
    try {
      await onAddBill(billTitle, numericAmount, billCategory, numericDay || 1);
      setBillTitle("");
      setBillAmount("");
      setBillDueDay("1");
      setShowBillForm(false);
    } finally {
      setAddingBill(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Sub-navigation: Pool | Bills | Needs */}
      <div className="flex justify-center">
        <SegmentedControl
          className="keeper-segmented-3"
          value={subTab}
          onValueChange={(v) => onSubTabChange(v as BudgetSubTab)}
          items={[
            { value: "pool", label: "Pool" },
            { value: "bills", label: `Bills (${bills.length})` },
            { value: "needs", label: `Needs (${pendingNeeds.length})` },
          ]}
        />
      </div>

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
                    {formatTZS(summary.totalContributed)} ({poolPct}%)
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
                    <span className="h-1.5 w-1.5 rounded-full bg-[#1C1C1E]" />
                    <span>Spent vs. target</span>
                  </span>
                  <span className="font-semibold text-[#1C1C1E] tabular-nums">
                    {formatTZS(summary.totalSpent)} ({spentPct}%)
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-stone-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#1C1C1E] transition-[width] duration-300"
                    style={{ width: `${spentPct}%` }}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between rounded-xl bg-[#F6F5F2] px-3 py-2.5 text-xs">
                <span className="text-[#52525B]">Cash on hand (carry-over)</span>
                <span
                  className={`font-semibold tabular-nums ${
                    summary.allTimeBalance >= 0 ? "text-[#1C1C1E]" : "text-rose-700"
                  }`}
                >
                  {formatTZS(summary.allTimeBalance)}
                </span>
              </div>
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
                Share: {formatTZS(household.member_weekly_share)}/wk
              </span>
            </div>

            <div className="divide-y divide-stone-900/[0.06]">
              {summary.memberStatuses.map((status) => {
                const done =
                  status.effectiveContributed >= status.expectedShare && status.expectedShare > 0;
                const partial = status.effectiveContributed > 0 && !done;
                return (
                  <div key={status.member.user_id} className="py-3 first:pt-1 last:pb-0">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
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
                            {formatTZS(status.expectedShare)}
                            {status.carryOverCredit > 0 && (
                              <span className="ml-1.5 text-[#8F703F]">
                                (+{formatTZS(status.carryOverCredit)} carry-over)
                              </span>
                            )}
                          </div>
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
                      <span
                        className={`inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium ${
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
                        {status.coveredByAdvance
                          ? "Covered"
                          : done
                            ? "Paid"
                            : partial
                              ? "Partial"
                              : "Pending"}
                      </span>
                    </div>
                    <div className="h-1 w-full rounded-full bg-stone-100 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-[width] duration-300"
                        style={{
                          width: `${status.percentOfShare}%`,
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
                  step="1000"
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
                  step="1000"
                  value={memberShare}
                  onValueChange={setMemberShare}
                  icon={<span className="font-mono text-xs font-medium text-[#8E8E93]">TZS</span>}
                />
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
                Track rent, Wi-Fi, water, and guard due dates
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
                  placeholder="Monthly house rent, Fiber Wi-Fi"
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
                    step="1000"
                    placeholder="70000"
                    value={billAmount}
                    onValueChange={setBillAmount}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#52525B] mb-1">
                    Due day (1-31)
                  </label>
                  <SoftInput
                    type="number"
                    min="1"
                    max="31"
                    value={billDueDay}
                    onValueChange={setBillDueDay}
                    required
                  />
                </div>
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
                Add monthly rent, Wi-Fi, water, or security fees so no due date is missed
              </p>
            </div>
          ) : (
            <div className="divide-y divide-stone-900/[0.06]">
              {bills.map((bill) => {
                const status = getBillDueStatus(bill);
                const confirming = confirmDeleteBillId === bill.id;
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
                          </div>
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

                    <div className="flex items-center justify-between gap-2 pl-8">
                      {!status.isPaidThisMonth ? (
                        <button
                          type="button"
                          onClick={() =>
                            onStartPrefillExpense({
                              type: "expense",
                              amount: bill.amount,
                              category: bill.category,
                              description: bill.title,
                              billId: bill.id,
                            })
                          }
                          className="inline-flex items-center gap-1.5 rounded-lg bg-[#1C1C1E] px-2.5 py-1 text-xs font-medium text-white hover:bg-[#2C2C30] transition-colors cursor-pointer"
                        >
                          <Check className="h-3 w-3" />
                          Record payment
                        </button>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Settled for this month
                        </span>
                      )}

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
              Shared restock list — tap Buy & log when someone picks an item up
            </p>
          </div>

          {/* Quick Add Need Form */}
          <form onSubmit={(e) => void handleAddNeed(e)} className="space-y-2.5">
            <div className="flex items-center gap-2">
              <SoftInput
                type="text"
                maxLength={120}
                placeholder="Cooking gas, Rice 5kg, Dish soap"
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
                  {pendingNeeds.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <button
                          type="button"
                          aria-label={`Mark ${item.title} as bought`}
                          onClick={() => void onToggleNeed(item.id, true)}
                          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-stone-300 bg-white hover:border-[#1C1C1E] transition-colors cursor-pointer"
                        />
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-[#1C1C1E]">
                            {item.title}
                          </div>
                          <div className="truncate text-xs text-[#8E8E93]">
                            Added by {item.adder?.full_name ?? "Member"}
                          </div>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            onStartPrefillExpense({
                              type: "expense",
                              category: item.category,
                              description: item.title,
                              needId: item.id,
                            })
                          }
                          className="rounded-lg bg-[#1C1C1E] px-2.5 py-1 text-xs font-medium text-white hover:bg-[#2C2C30] transition-colors cursor-pointer"
                        >
                          Buy & log
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
                  ))}
                </div>
              )}

              {boughtNeeds.length > 0 && (
                <div className="pt-2 border-t border-stone-900/[0.06] space-y-1.5">
                  <div className="text-xs font-medium text-[#8E8E93]">
                    Recently bought ({boughtNeeds.length})
                  </div>
                  <div className="divide-y divide-stone-900/[0.06]">
                    {boughtNeeds.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between gap-2 py-2 opacity-75"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <button
                            type="button"
                            aria-label={`Restore ${item.title} to needed`}
                            onClick={() => void onToggleNeed(item.id, false)}
                            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-[#1C1C1E] text-white cursor-pointer"
                          >
                            <Check className="h-3 w-3" strokeWidth={2.5} />
                          </button>
                          <span className="truncate text-xs text-[#52525B] line-through">
                            {item.title}
                          </span>
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
                    ))}
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

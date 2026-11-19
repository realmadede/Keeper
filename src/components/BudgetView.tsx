import { useState, type FormEvent } from "react";
import { Button, Input, SegmentedControl } from "glisse";
import {
  CalendarClock,
  Check,
  CheckCircle2,
  Plus,
  Share2,
  ShoppingBasket,
  Target,
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
          <section className="rounded-[24px] border border-slate-100 bg-white p-4 shadow-[0_2px_16px_rgba(15,23,42,0.04)]">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-[15px] font-semibold text-slate-900">
                  {weekWindow.kind === "month" ? "Monthly Household Pool" : "Weekly Household Pool"}
                </h2>
                <p className="text-xs text-slate-500">
                  Target ({weekWindow.label}): {formatTZS(periodTarget)}
                </p>
              </div>
              <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#FFF8F2] text-[#BFA377]">
                <Target className="h-5 w-5" />
              </span>
            </div>

            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-medium text-slate-600">
                    Contributed ({weekWindow.label.toLowerCase()})
                  </span>
                  <span className="font-bold text-emerald-700 tabular-nums">
                    {formatTZS(summary.totalContributed)} ({poolPct}%)
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                    style={{ width: `${poolPct}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-medium text-slate-600">Spent vs. target</span>
                  <span className="font-bold text-orange-600 tabular-nums">
                    {formatTZS(summary.totalSpent)} ({spentPct}%)
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-orange-500 transition-all duration-300"
                    style={{ width: `${spentPct}%` }}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between rounded-2xl border border-[#E5D3B3]/80 bg-[#FBF8F1] px-3 py-2 text-xs">
                <span className="font-medium text-slate-600">Cash on Hand (Carry-Over)</span>
                <span
                  className={`font-bold tabular-nums ${
                    summary.allTimeBalance >= 0 ? "text-[#7A5E31]" : "text-rose-600"
                  }`}
                >
                  {formatTZS(summary.allTimeBalance)}
                </span>
              </div>
            </div>

            <div className="mt-3.5 pt-3 border-t border-slate-100">
              <Button
                onClick={() => void handleShareSummary()}
                icon={
                  copiedSummary ? (
                    <Check className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <Share2 className="h-4 w-4" />
                  )
                }
                className="w-full justify-center !h-10 text-xs font-semibold"
              >
                {copiedSummary ? "Copied Summary for WhatsApp" : "Copy Summary for WhatsApp"}
              </Button>
            </div>
          </section>

          {/* Member Accountability Breakdown */}
          <section className="rounded-[24px] border border-slate-100 bg-white p-4 shadow-[0_2px_16px_rgba(15,23,42,0.04)]">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[15px] font-semibold text-slate-900">Member Contributions</h2>
              <span className="text-[11px] font-medium text-slate-500 tabular-nums">
                Share: {formatTZS(household.member_weekly_share)}/wk
              </span>
            </div>

            <div className="space-y-3">
              {summary.memberStatuses.map((status) => {
                const done =
                  status.contributedThisWeek >= status.expectedShare && status.expectedShare > 0;
                const partial = status.contributedThisWeek > 0 && !done;
                return (
                  <div
                    key={status.member.user_id}
                    className="rounded-2xl border border-slate-100 bg-[#FAFBFD] p-3"
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                          style={{ backgroundColor: status.member.profile.avatar_color }}
                        >
                          {getInitials(status.member.profile.full_name)}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-[13px] font-semibold text-slate-900">
                            {status.member.profile.full_name}
                          </div>
                          <div className="text-[11px] text-slate-500 tabular-nums">
                            {formatTZS(status.contributedThisWeek)} /{" "}
                            {formatTZS(status.expectedShare)}
                          </div>
                        </div>
                      </div>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                          done
                            ? "bg-emerald-50 text-emerald-700"
                            : partial
                              ? "bg-amber-50 text-amber-700"
                              : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {done ? "Paid" : partial ? "Partial" : "Pending"}
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${status.percentOfShare}%`,
                          backgroundColor: done ? "#22C55E" : partial ? "#F59E0B" : "#CBD5E1",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Edit Shared Weekly Budget */}
          <section className="rounded-[24px] border border-slate-100 bg-white p-4 shadow-[0_2px_16px_rgba(15,23,42,0.04)]">
            <h2 className="text-[15px] font-semibold text-slate-900 mb-1">Update Weekly Budget</h2>
            <p className="text-xs text-slate-500 mb-3">
              Changes sync immediately across everyone in {household.name}.
            </p>

            <form onSubmit={(e) => void handleSave(e)} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Total Weekly Budget (TZS)
                </label>
                <Input
                  type="number"
                  min="0"
                  step="1000"
                  value={weeklyTarget}
                  onValueChange={setWeeklyTarget}
                  icon={<span className="text-xs font-bold text-slate-500">TZS</span>}
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Expected Share per Member (TZS)
                </label>
                <Input
                  type="number"
                  min="0"
                  step="1000"
                  value={memberShare}
                  onValueChange={setMemberShare}
                  icon={<span className="text-xs font-bold text-slate-500">TZS</span>}
                  className="w-full"
                />
              </div>

              <Button
                type="submit"
                variant="filled"
                disabled={saving}
                className="w-full justify-center !h-10 text-xs font-semibold"
              >
                {saving ? "Updating..." : "Save Shared Budget"}
              </Button>

              {savedToast && (
                <div className="flex items-center justify-center gap-1.5 text-xs font-medium text-emerald-600">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Weekly budget updated!
                </div>
              )}
            </form>
          </section>
        </>
      )}

      {subTab === "bills" && (
        <section className="rounded-[24px] border border-slate-100 bg-white p-4 shadow-[0_2px_16px_rgba(15,23,42,0.04)] space-y-3.5">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-[15px] font-semibold text-slate-900">Recurring House Bills</h2>
              <p className="text-xs text-slate-500">
                Track rent, Wi-Fi, water, and guard due dates.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowBillForm((v) => !v)}
              className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#1C1C1E] px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-slate-800 cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              {showBillForm ? "Close" : "Add Bill"}
            </button>
          </div>

          {showBillForm && (
            <form
              onSubmit={(e) => void handleAddBill(e)}
              className="rounded-2xl border border-slate-100 bg-[#FAFBFD] p-3.5 space-y-3"
            >
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Bill Name</label>
                <Input
                  type="text"
                  maxLength={80}
                  placeholder="e.g. Monthly House Rent, Fiber Wi-Fi"
                  value={billTitle}
                  onValueChange={setBillTitle}
                  className="w-full"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Amount (TZS)
                  </label>
                  <Input
                    type="number"
                    min="1"
                    step="1000"
                    placeholder="70000"
                    value={billAmount}
                    onValueChange={setBillAmount}
                    className="w-full"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Due Day (1-31)
                  </label>
                  <Input
                    type="number"
                    min="1"
                    max="31"
                    value={billDueDay}
                    onValueChange={setBillDueDay}
                    className="w-full"
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
                      className={`flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-left text-[11px] font-medium cursor-pointer ${
                        selected
                          ? "border-slate-900 bg-slate-900 text-white"
                          : "border-slate-200 bg-white text-slate-700"
                      }`}
                    >
                      <CategoryIcon category={cat.id} className="h-3 w-3 shrink-0" />
                      <span className="truncate">{cat.label}</span>
                    </button>
                  );
                })}
              </div>

              <Button
                type="submit"
                variant="filled"
                disabled={addingBill}
                className="w-full justify-center !h-9 text-xs font-semibold"
              >
                {addingBill ? "Saving..." : "Save Recurring Bill"}
              </Button>
            </form>
          )}

          {bills.length === 0 ? (
            <div className="rounded-2xl bg-slate-50 py-8 px-4 text-center space-y-1.5">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-slate-200/70 text-slate-500">
                <CalendarClock className="h-5 w-5" />
              </div>
              <p className="text-sm font-medium text-slate-600">No recurring bills yet</p>
              <p className="text-xs text-slate-400">
                Add monthly rent, Wi-Fi, water, or security fees so no due date is missed.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {bills.map((bill) => {
                const status = getBillDueStatus(bill);
                const confirming = confirmDeleteBillId === bill.id;
                return (
                  <div
                    key={bill.id}
                    className="rounded-2xl border border-slate-100 bg-[#FAFBFD] p-3 space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white border border-slate-100 text-slate-700">
                          <CategoryIcon category={bill.category} className="h-4 w-4" />
                        </span>
                        <div className="min-w-0">
                          <div className="truncate text-[13px] font-semibold text-slate-900">
                            {bill.title}
                          </div>
                          <div className="text-xs font-bold text-slate-700 tabular-nums">
                            {formatTZS(bill.amount)}
                          </div>
                        </div>
                      </div>

                      <span
                        className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                          status.isPaidThisMonth
                            ? "bg-emerald-50 text-emerald-700"
                            : status.isOverdue
                              ? "bg-rose-50 text-rose-700"
                              : status.isDueSoon
                                ? "bg-amber-50 text-amber-800"
                                : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {status.statusLabel}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-2">
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
                          className="inline-flex items-center gap-1.5 rounded-full bg-[#1C1C1E] px-3 py-1 text-[11px] font-semibold text-white hover:bg-slate-800 cursor-pointer"
                        >
                          <Check className="h-3 w-3" />
                          Record Payment
                        </button>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Settled for this month
                        </span>
                      )}

                      {confirming ? (
                        <div className="flex items-center gap-1.5 text-[11px]">
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteBillId(null)}
                            className="rounded-lg bg-slate-100 px-2 py-0.5 font-semibold text-slate-600 cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setConfirmDeleteBillId(null);
                              void onDeleteBill(bill.id);
                            }}
                            className="rounded-lg bg-rose-600 px-2 py-0.5 font-semibold text-white cursor-pointer"
                          >
                            Delete
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          aria-label={`Delete ${bill.title}`}
                          onClick={() => setConfirmDeleteBillId(bill.id)}
                          className="flex h-7 w-7 items-center justify-center rounded-full text-slate-400 hover:bg-rose-50 hover:text-rose-600 cursor-pointer"
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
        <section className="rounded-[24px] border border-slate-100 bg-white p-4 shadow-[0_2px_16px_rgba(15,23,42,0.04)] space-y-3.5">
          <div>
            <h2 className="text-[15px] font-semibold text-slate-900">What the House Needs</h2>
            <p className="text-xs text-slate-500">
              Shared restock list — tap Buy & Log when someone picks an item up.
            </p>
          </div>

          {/* Quick Add Need Form */}
          <form onSubmit={(e) => void handleAddNeed(e)} className="space-y-2.5">
            <div className="flex items-center gap-2">
              <Input
                type="text"
                maxLength={120}
                placeholder="e.g. Cooking gas, Rice 5kg, Dish soap..."
                value={needTitle}
                onValueChange={setNeedTitle}
                className="flex-1"
                required
              />
              <Button
                type="submit"
                variant="filled"
                disabled={addingNeed}
                className="shrink-0 !h-10 text-xs font-semibold"
              >
                Add
              </Button>
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
                    className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold cursor-pointer ${
                      active
                        ? "bg-[#1C1C1E] text-white"
                        : "border border-slate-200 bg-slate-50 text-slate-600"
                    }`}
                  >
                    <CategoryIcon category={cat.id} className="h-3 w-3" />
                    <span>{cat.label}</span>
                  </button>
                );
              })}
            </div>
          </form>

          {needs.length === 0 ? (
            <div className="rounded-2xl bg-slate-50 py-8 px-4 text-center space-y-1.5">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-slate-200/70 text-slate-500">
                <ShoppingBasket className="h-5 w-5" />
              </div>
              <p className="text-sm font-medium text-slate-600">Everything is stocked</p>
              <p className="text-xs text-slate-400">
                Add groceries, gas, or cleaning supplies whenever the house runs low.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {pendingNeeds.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-2 rounded-2xl border border-slate-100 bg-[#FAFBFD] px-3 py-2.5"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <button
                      type="button"
                      aria-label={`Mark ${item.title} as bought`}
                      onClick={() => void onToggleNeed(item.id, true)}
                      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-slate-300 bg-white hover:border-slate-700 cursor-pointer"
                    />
                    <div className="min-w-0">
                      <div className="truncate text-[13px] font-semibold text-slate-900">
                        {item.title}
                      </div>
                      <div className="truncate text-[11px] text-slate-400">
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
                      className="rounded-full bg-[#1C1C1E] px-2.5 py-1 text-[10px] font-semibold text-white hover:bg-slate-800 cursor-pointer"
                    >
                      Buy & Log
                    </button>
                    <button
                      type="button"
                      aria-label={`Remove ${item.title}`}
                      onClick={() => void onDeleteNeed(item.id)}
                      className="flex h-6 w-6 items-center justify-center rounded-full text-slate-400 hover:bg-rose-50 hover:text-rose-600 cursor-pointer"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))}

              {boughtNeeds.length > 0 && (
                <div className="pt-2 space-y-1.5">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Recently Bought ({boughtNeeds.length})
                  </div>
                  {boughtNeeds.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-2 rounded-2xl border border-slate-100/70 bg-slate-50/70 px-3 py-2 opacity-75"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <button
                          type="button"
                          aria-label={`Restore ${item.title} to needed`}
                          onClick={() => void onToggleNeed(item.id, false)}
                          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-emerald-600 text-white cursor-pointer"
                        >
                          <Check className="h-3 w-3" strokeWidth={3} />
                        </button>
                        <span className="truncate text-xs font-medium text-slate-500 line-through">
                          {item.title}
                        </span>
                      </div>
                      <button
                        type="button"
                        aria-label={`Delete ${item.title}`}
                        onClick={() => void onDeleteNeed(item.id)}
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-rose-50 hover:text-rose-600 cursor-pointer"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

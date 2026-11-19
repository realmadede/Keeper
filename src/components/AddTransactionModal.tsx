import { useEffect, useState, type FormEvent } from "react";
import { Glass, SegmentedControl } from "glisse";
import { FileText, X } from "lucide-react";
import type { TransactionInput } from "../hooks/useKeeperStore";
import { formatTZS, getInitials, toISODate } from "../lib/format";
import {
  EXPENSE_CATEGORIES,
  type ExpenseCategoryId,
  type HouseholdMember,
  type Transaction,
  type TransactionType,
} from "../types";
import { CategoryIcon } from "./CategoryIcon";
import { IosDatePicker } from "./IosDatePicker";
import { SoftButton, SoftInput } from "./LightControls";

export interface TransactionPrefill {
  type: TransactionType;
  amount?: number;
  category?: ExpenseCategoryId;
  description?: string;
  needId?: string;
  billId?: string;
}

interface AddTransactionModalProps {
  open: boolean;
  initialType?: TransactionType;
  prefillDraft?: TransactionPrefill | null;
  members: HouseholdMember[];
  currentUserId: string;
  editingTransaction?: Transaction | null;
  onClose: () => void;
  onSubmit: (input: TransactionInput, prefill?: TransactionPrefill | null) => Promise<void>;
  onUpdate?: (id: string, input: TransactionInput) => Promise<void>;
}

const QUICK_AMOUNTS = [5000, 10000, 20000, 50000, 60000];

export function AddTransactionModal({
  open,
  initialType = "expense",
  prefillDraft,
  members,
  currentUserId,
  editingTransaction,
  onClose,
  onSubmit,
  onUpdate,
}: AddTransactionModalProps) {
  const [type, setType] = useState<TransactionType>(initialType);
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<ExpenseCategoryId>("food");
  const [paidBy, setPaidBy] = useState(currentUserId);
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(() => toISODate(new Date()));
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const isEditing = Boolean(editingTransaction);
  const parsedPreview = Number(amount.replace(/,/g, "").trim());
  const hasValidPreview = Number.isFinite(parsedPreview) && parsedPreview > 0;

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, open]);

  useEffect(() => {
    if (!open) return;
    setFormError(null);
    if (editingTransaction) {
      setType(editingTransaction.type);
      setAmount(String(editingTransaction.amount));
      setCategory(
        editingTransaction.category === "contribution" ? "food" : editingTransaction.category,
      );
      setPaidBy(editingTransaction.paid_by || editingTransaction.recorded_by);
      setDescription(editingTransaction.description);
      setDate(editingTransaction.transaction_date);
    } else if (prefillDraft) {
      setType(prefillDraft.type);
      setAmount(prefillDraft.amount ? String(prefillDraft.amount) : "");
      setCategory(prefillDraft.category ?? "food");
      setPaidBy(currentUserId);
      setDescription(prefillDraft.description ?? "");
      setDate(toISODate(new Date()));
    } else {
      setType(initialType);
      setAmount("");
      setCategory("food");
      setPaidBy(currentUserId);
      setDescription("");
      setDate(toISODate(new Date()));
    }
  }, [currentUserId, editingTransaction, initialType, open, prefillDraft]);

  if (!open) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const numericAmount = Number(amount.replace(/,/g, "").trim());
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setFormError("Enter a valid amount in TZS greater than 0.");
      return;
    }
    const cleanDesc =
      description.trim() ||
      (type === "contribution"
        ? "Weekly household contribution"
        : EXPENSE_CATEGORIES.find((c) => c.id === category)?.label ?? "Household purchase");

    const payload: TransactionInput = {
      type,
      amount: numericAmount,
      category: type === "contribution" ? "contribution" : category,
      description: cleanDesc,
      transaction_date: date,
      paid_by: type === "contribution" ? paidBy : currentUserId,
    };

    setSubmitting(true);
    try {
      if (editingTransaction && onUpdate) {
        await onUpdate(editingTransaction.id, payload);
      } else {
        await onSubmit(payload, prefillDraft);
      }
      onClose();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not save record.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/35 backdrop-blur-xs p-3 sm:p-4"
      onClick={onClose}
    >
      <Glass
        className="w-full max-w-[430px] max-h-[90dvh] overflow-y-auto no-scrollbar rounded-[28px] !bg-white/92 p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              {isEditing ? "Edit Activity" : "Record Activity"}
            </h3>
            <p className="text-xs text-slate-500">
              {isEditing
                ? "Changes are marked as edited for full transparency"
                : "Visible to all household members in real time"}
            </p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200/80 bg-white/80 text-slate-700 hover:bg-slate-100 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <div className="flex justify-center">
            <SegmentedControl
              className="keeper-segmented-2"
              value={type}
              onValueChange={(v) => setType(v as TransactionType)}
              items={[
                { value: "expense", label: "Expense" },
                { value: "contribution", label: "Contribution" },
              ]}
            />
          </div>

          {/* TZS Amount with Live Formatted Preview */}
          <div>
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <label className="block text-xs font-semibold text-slate-600">Amount (TZS)</label>
              {hasValidPreview && (
                <span className="rounded-full bg-[#FBF8F1] border border-[#E5D3B3] px-2 py-0.5 text-[11px] font-bold text-[#7A5E31] tabular-nums">
                  {formatTZS(parsedPreview)}
                </span>
              )}
            </div>
            <SoftInput
              type="number"
              inputMode="numeric"
              min="1"
              step="1"
              placeholder="e.g. 25000"
              value={amount}
              onValueChange={setAmount}
              icon={<span className="text-xs font-bold text-slate-500">TZS</span>}
              required
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {QUICK_AMOUNTS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setAmount(String(preset))}
                  className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-100 tabular-nums cursor-pointer"
                >
                  +{preset.toLocaleString("en-US")}
                </button>
              ))}
            </div>
          </div>

          {/* Paid By Picker (Contributions — supports treasurer logging on behalf of roommates) */}
          {type === "contribution" && members.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Contributed By
              </label>
              <div className="grid grid-cols-2 gap-2">
                {members.map((m) => {
                  const selected = paidBy === m.user_id;
                  return (
                    <button
                      key={m.user_id}
                      type="button"
                      onClick={() => setPaidBy(m.user_id)}
                      className={`flex items-center gap-2 rounded-2xl border px-2.5 py-2 text-left text-xs font-medium transition-all cursor-pointer ${
                        selected
                          ? "border-slate-900 bg-slate-900 text-white shadow-xs"
                          : "border-slate-200 bg-white/80 text-slate-700 hover:border-slate-300"
                      }`}
                    >
                      <span
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                        style={{ backgroundColor: m.profile.avatar_color }}
                      >
                        {getInitials(m.profile.full_name)}
                      </span>
                      <span className="truncate">
                        {m.profile.full_name}
                        {m.user_id === currentUserId ? " (You)" : ""}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Category Picker (Expenses only) */}
          {type === "expense" && (
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Category</label>
              <div className="grid grid-cols-2 gap-2">
                {EXPENSE_CATEGORIES.map((cat) => {
                  const selected = category === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setCategory(cat.id)}
                      className={`flex items-center gap-2 rounded-2xl border px-3 py-2 text-left text-xs font-medium transition-all cursor-pointer ${
                        selected
                          ? "border-slate-900 bg-slate-900 text-white shadow-xs"
                          : "border-slate-200 bg-white/80 text-slate-700 hover:border-slate-300"
                      }`}
                    >
                      <CategoryIcon category={cat.id} className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{cat.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Description
            </label>
            <SoftInput
              type="text"
              placeholder={
                type === "contribution"
                  ? "e.g. M-Pesa weekly pool share"
                  : "e.g. LUKU tokens, Rice & Cooking Oil"
              }
              value={description}
              onValueChange={setDescription}
              icon={<FileText className="h-4 w-4 text-slate-400" />}
            />
          </div>

          {/* iOS Inline Liquid Glass Date Picker */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Date</label>
            <IosDatePicker value={date} onChange={setDate} />
          </div>

          {formError && (
            <div className="rounded-xl bg-rose-50 border border-rose-200 px-3 py-2 text-xs font-medium text-rose-700">
              {formError}
            </div>
          )}

          <SoftButton
            type="submit"
            variant="filled"
            tint={type === "contribution" ? "#16A34A" : "#18181B"}
            disabled={submitting}
            className="w-full !h-11 !text-sm font-semibold"
          >
            {submitting
              ? "Saving..."
              : isEditing
                ? "Save Changes"
                : type === "contribution"
                  ? "Record Contribution"
                  : "Record Household Expense"}
          </SoftButton>
        </form>
      </Glass>
    </div>
  );
}

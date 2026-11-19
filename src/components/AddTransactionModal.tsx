import { useEffect, useState, type FormEvent } from "react";
import { Glass, SegmentedControl } from "glisse";
import { Check, FileText, X } from "lucide-react";
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
  onSubmit: (
    input: TransactionInput,
    prefill?: TransactionPrefill | null,
    options?: { outOfPocketBy?: string },
  ) => Promise<void>;
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
  const [paidOutOfPocket, setPaidOutOfPocket] = useState(false);
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
    setPaidOutOfPocket(false);
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
        await onSubmit(
          payload,
          prefillDraft,
          type === "expense" && paidOutOfPocket ? { outOfPocketBy: paidBy } : undefined,
        );
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
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-stone-900/35 backdrop-blur-xs p-3 sm:p-4"
      onClick={onClose}
    >
      <Glass
        className="w-full max-w-[430px] max-h-[90dvh] overflow-y-auto no-scrollbar rounded-[20px] !bg-white/95 p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-semibold text-[#1C1C1E]">
              {isEditing ? "Edit entry" : "Record entry"}
            </h3>
            <p className="text-xs text-[#52525B] mt-0.5">
              {isEditing
                ? "Updates are marked as edited for everyone"
                : "Syncs immediately to all household members"}
            </p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-stone-900/10 bg-white text-[#52525B] hover:bg-stone-50 hover:text-[#1C1C1E] transition-colors cursor-pointer"
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
              <label className="block text-xs font-medium text-[#52525B]">Amount (TZS)</label>
              {hasValidPreview && (
                <span className="text-xs font-medium text-[#8F703F] tabular-nums">
                  {formatTZS(parsedPreview)}
                </span>
              )}
            </div>
            <SoftInput
              type="number"
              inputMode="numeric"
              min="1"
              step="1"
              placeholder="25000"
              value={amount}
              onValueChange={setAmount}
              icon={<span className="font-mono text-xs font-medium text-[#8E8E93]">TZS</span>}
              required
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {QUICK_AMOUNTS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setAmount(String(preset))}
                  className="rounded-lg border border-stone-900/10 bg-[#F6F5F2] px-2.5 py-1 font-mono text-xs text-[#52525B] hover:bg-stone-200/60 hover:text-[#1C1C1E] transition-colors tabular-nums cursor-pointer"
                >
                  +{preset.toLocaleString("en-US")}
                </button>
              ))}
            </div>
          </div>

          {/* Out-of-Pocket Toggle (Expenses only, when creating a new entry) */}
          {!isEditing && type === "expense" && (
            <div className="rounded-xl border border-stone-900/[0.08] bg-[#F6F5F2] p-3 space-y-2.5">
              <button
                type="button"
                role="checkbox"
                aria-checked={paidOutOfPocket}
                onClick={() => setPaidOutOfPocket((v) => !v)}
                className="flex w-full items-start gap-2.5 text-left cursor-pointer"
              >
                <span
                  className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border transition-colors ${
                    paidOutOfPocket
                      ? "border-[#1C1C1E] bg-[#1C1C1E] text-white"
                      : "border-stone-300 bg-white text-transparent"
                  }`}
                >
                  <Check className="h-3 w-3" strokeWidth={2.5} />
                </span>
                <div className="min-w-0">
                  <div className="text-xs font-medium text-[#1C1C1E]">
                    Paid from own pocket (count toward weekly share)
                  </div>
                  <p className="text-[11px] text-[#52525B] mt-0.5">
                    Logs the expense and credits a matching contribution so the cash box balance
                    stays exact
                  </p>
                </div>
              </button>
            </div>
          )}

          {/* Paid By Picker (Contributions OR Out-of-Pocket Expenses) */}
          {(type === "contribution" || (!isEditing && type === "expense" && paidOutOfPocket)) &&
            members.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-[#52525B] mb-1.5">
                  {type === "contribution" ? "Contributed by" : "Paid out-of-pocket by"}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {members.map((m) => {
                    const selected = paidBy === m.user_id;
                    return (
                      <button
                        key={m.user_id}
                        type="button"
                        onClick={() => setPaidBy(m.user_id)}
                        className={`flex items-center gap-2 rounded-xl border px-2.5 py-2 text-left text-xs font-medium transition-colors cursor-pointer ${
                          selected
                            ? "border-[#1C1C1E] bg-[#1C1C1E] text-white"
                            : "border-stone-900/10 bg-white text-[#52525B] hover:border-stone-900/25"
                        }`}
                      >
                        <span
                          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white"
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
              <label className="block text-xs font-medium text-[#52525B] mb-1.5">Category</label>
              <div className="grid grid-cols-2 gap-2">
                {EXPENSE_CATEGORIES.map((cat) => {
                  const selected = category === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setCategory(cat.id)}
                      className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs font-medium transition-colors cursor-pointer ${
                        selected
                          ? "border-[#1C1C1E] bg-[#1C1C1E] text-white"
                          : "border-stone-900/10 bg-white text-[#52525B] hover:border-stone-900/25"
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
            <label className="block text-xs font-medium text-[#52525B] mb-1.5">
              Description
            </label>
            <SoftInput
              type="text"
              placeholder={
                type === "contribution"
                  ? "M-Pesa weekly pool share"
                  : "LUKU tokens, Rice & cooking oil"
              }
              value={description}
              onValueChange={setDescription}
              icon={<FileText className="h-4 w-4" />}
            />
          </div>

          {/* iOS Inline Liquid Glass Date Picker */}
          <div>
            <label className="block text-xs font-medium text-[#52525B] mb-1.5">Date</label>
            <IosDatePicker value={date} onChange={setDate} />
          </div>

          {formError && (
            <div className="rounded-xl bg-rose-50/70 border border-rose-700/20 px-3 py-2 text-xs font-medium text-rose-700">
              {formError}
            </div>
          )}

          <SoftButton
            type="submit"
            variant="filled"
            disabled={submitting}
            className="w-full !h-11 !text-sm font-medium"
          >
            {submitting
              ? "Saving..."
              : isEditing
                ? "Save changes"
                : type === "contribution"
                  ? "Record contribution"
                  : paidOutOfPocket
                    ? "Record expense & credit share"
                    : "Record expense"}
          </SoftButton>
        </form>
      </Glass>
    </div>
  );
}

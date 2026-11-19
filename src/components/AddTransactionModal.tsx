import { useState, type FormEvent } from "react";
import { Button, Glass, Input, SegmentedControl } from "glisse";
import { Calendar, FileText, X } from "lucide-react";
import type { NewTransactionInput } from "../hooks/useKeeperStore";
import { toISODate } from "../lib/format";
import { EXPENSE_CATEGORIES, type ExpenseCategoryId, type TransactionType } from "../types";
import { CategoryIcon } from "./CategoryIcon";

interface AddTransactionModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: NewTransactionInput) => Promise<void>;
}

const QUICK_AMOUNTS = [5000, 10000, 20000, 50000, 60000];

export function AddTransactionModal({ open, onClose, onSubmit }: AddTransactionModalProps) {
  const [type, setType] = useState<TransactionType>("expense");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<ExpenseCategoryId>("food");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(() => toISODate(new Date()));
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

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

    setSubmitting(true);
    try {
      await onSubmit({
        type,
        amount: numericAmount,
        category: type === "contribution" ? "contribution" : category,
        description: cleanDesc,
        transaction_date: date,
      });
      setAmount("");
      setDescription("");
      setDate(toISODate(new Date()));
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
        className="w-full max-w-[430px] rounded-[28px] !bg-white/90 p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">Record Activity</h3>
            <p className="text-xs text-slate-500">Visible to all household members in real time</p>
          </div>
          <Button
            aria-label="Close"
            onClick={onClose}
            icon={<X className="h-4 w-4 text-slate-700" />}
          />
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

          {/* TZS Amount */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Amount (TZS)
            </label>
            <Input
              type="number"
              inputMode="numeric"
              min="1"
              step="1"
              placeholder="e.g. 25000"
              value={amount}
              onValueChange={setAmount}
              icon={<span className="text-xs font-bold text-slate-500">TZS</span>}
              className="w-full"
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
            <Input
              type="text"
              placeholder={
                type === "contribution"
                  ? "e.g. M-Pesa weekly pool share"
                  : "e.g. LUKU tokens, Rice & Cooking Oil"
              }
              value={description}
              onValueChange={setDescription}
              icon={<FileText className="h-4 w-4 text-slate-400" />}
              className="w-full"
            />
          </div>

          {/* Date */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Date</label>
            <Input
              type="date"
              value={date}
              onValueChange={setDate}
              icon={<Calendar className="h-4 w-4 text-slate-400" />}
              className="w-full"
              required
            />
          </div>

          {formError && (
            <div className="rounded-xl bg-rose-50 border border-rose-200 px-3 py-2 text-xs font-medium text-rose-700">
              {formError}
            </div>
          )}

          <Button
            type="submit"
            variant="filled"
            tint={type === "contribution" ? "#16A34A" : "#18181B"}
            disabled={submitting}
            className="w-full justify-center !h-11 !text-sm font-semibold"
          >
            {submitting
              ? "Saving..."
              : type === "contribution"
                ? "Record Contribution"
                : "Record Household Expense"}
          </Button>
        </form>
      </Glass>
    </div>
  );
}

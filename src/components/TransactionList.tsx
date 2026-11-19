import { useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Pencil, ReceiptText, Trash2 } from "lucide-react";
import { formatShortDate, formatTZS, getInitials } from "../lib/format";
import { getCategoryMeta, type Transaction } from "../types";

interface TransactionListProps {
  title?: string;
  transactions: Transaction[];
  currentUserId: string;
  onEdit: (tx: Transaction) => void;
  onDelete: (id: string) => Promise<void>;
  maxItems?: number;
  onViewAll?: () => void;
}

export function TransactionList({
  title = "Recent Transactions",
  transactions,
  currentUserId,
  onEdit,
  onDelete,
  maxItems,
  onViewAll,
}: TransactionListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const visible = maxItems ? transactions.slice(0, maxItems) : transactions;

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await onDelete(id);
      setExpandedId(null);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <section className="rounded-[24px] border border-slate-100 bg-white p-4 shadow-[0_2px_16px_rgba(15,23,42,0.04)]">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[15px] font-semibold text-slate-900">{title}</h2>
        {onViewAll && transactions.length > (maxItems ?? 0) && (
          <button
            type="button"
            onClick={onViewAll}
            className="text-xs font-semibold text-slate-500 hover:text-slate-900 cursor-pointer"
          >
            View All ({transactions.length})
          </button>
        )}
      </div>

      {visible.length === 0 ? (
        <div className="rounded-2xl bg-slate-50 py-8 text-center">
          <p className="text-sm font-medium text-slate-500">No transactions yet</p>
          <p className="text-xs text-slate-400 mt-1">
            Contributions and household purchases will show up here for everyone.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {visible.map((tx) => {
            const isContribution = tx.type === "contribution";
            const cat = getCategoryMeta(tx.category);
            const recorderName = tx.recorder?.full_name ?? "Household Member";
            const creditedProfile =
              isContribution && tx.payer ? tx.payer : tx.recorder;
            const displayName = creditedProfile?.full_name ?? recorderName;
            const avatarColor = creditedProfile?.avatar_color ?? "#BFA377";
            const recordedOnBehalf =
              isContribution && tx.paid_by && tx.paid_by !== tx.recorded_by;
            const canManage = tx.recorded_by === currentUserId;
            const isExpanded = expandedId === tx.id;

            return (
              <div
                key={tx.id}
                className="rounded-2xl border border-slate-100 bg-[#FAFBFD] transition-colors hover:border-slate-200"
              >
                <button
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : tx.id)}
                  className="flex w-full items-center justify-between gap-3 p-3 text-left cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white shadow-xs"
                      style={{ backgroundColor: avatarColor }}
                    >
                      {getInitials(displayName)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="truncate text-[13px] font-semibold text-slate-900">
                          {displayName}
                        </span>
                        {tx.updated_at && (
                          <span className="shrink-0 rounded-full bg-slate-200/80 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-slate-500">
                            Edited
                          </span>
                        )}
                      </div>
                      <div className="truncate text-[11px] text-slate-500 mt-0.5">
                        {cat.label} · {formatShortDate(tx.transaction_date)}
                        {recordedOnBehalf ? ` · via ${recorderName.split(" ")[0]}` : ""}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-end shrink-0">
                    <div
                      className={`inline-flex items-center gap-1 text-[13px] font-bold tabular-nums ${
                        isContribution ? "text-emerald-600" : "text-rose-600"
                      }`}
                    >
                      <span>{formatTZS(tx.amount)}</span>
                      {isContribution ? (
                        <ArrowDownLeft className="h-3.5 w-3.5" />
                      ) : (
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      )}
                    </div>
                    <span className="mt-1 inline-flex max-w-[138px] items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                      <span className="truncate">{tx.description}</span>
                      <ReceiptText className="h-2.5 w-2.5 shrink-0 text-slate-400" />
                    </span>
                  </div>
                </button>

                {isExpanded && (
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-3 py-2 text-[11px] text-slate-500">
                    <span>
                      {recordedOnBehalf ? (
                        <>
                          Paid by <strong className="text-slate-700">{displayName}</strong> ·
                          recorded by <strong className="text-slate-700">{recorderName}</strong>
                        </>
                      ) : (
                        <>
                          Recorded by <strong className="text-slate-700">{recorderName}</strong>
                        </>
                      )}{" "}
                      on {tx.transaction_date}
                    </span>
                    {canManage && (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => onEdit(tx)}
                          className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 font-medium text-slate-700 hover:bg-slate-200 cursor-pointer"
                        >
                          <Pencil className="h-3 w-3" />
                          Edit
                        </button>
                        <button
                          type="button"
                          disabled={deletingId === tx.id}
                          onClick={() => void handleDelete(tx.id)}
                          className="inline-flex items-center gap-1 rounded-lg bg-rose-50 px-2 py-1 font-medium text-rose-600 hover:bg-rose-100 disabled:opacity-50 cursor-pointer"
                        >
                          <Trash2 className="h-3 w-3" />
                          {deletingId === tx.id ? "Removing..." : "Delete"}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

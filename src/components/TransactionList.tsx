import { useState, type ReactNode } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { formatShortDate, formatTZS, getInitials } from "../lib/format";
import { getCategoryMeta, type Transaction } from "../types";

interface TransactionListProps {
  title?: string;
  transactions: Transaction[];
  currentUserId: string;
  newTransactionIds?: Set<string>;
  onEdit: (tx: Transaction) => void;
  onDelete: (id: string) => Promise<void>;
  maxItems?: number;
  onViewAll?: () => void;
  emptyState?: ReactNode;
}

export function TransactionList({
  title = "Recent activity",
  transactions,
  currentUserId,
  newTransactionIds,
  onEdit,
  onDelete,
  maxItems,
  onViewAll,
  emptyState,
}: TransactionListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const visible = maxItems ? transactions.slice(0, maxItems) : transactions;

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await onDelete(id);
      setExpandedId(null);
      setConfirmDeleteId(null);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <section className="rounded-2xl border border-stone-900/[0.08] bg-white p-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-base font-semibold text-[#1C1C1E]">{title}</h2>
        {onViewAll && transactions.length > (maxItems ?? 0) && (
          <button
            type="button"
            onClick={onViewAll}
            className="text-xs font-medium text-[#52525B] hover:text-[#1C1C1E] transition-colors cursor-pointer"
          >
            View all ({transactions.length})
          </button>
        )}
      </div>

      {visible.length === 0 ? (
        emptyState ?? (
          <div className="my-2 rounded-xl bg-[#F6F5F2] py-8 px-4 text-center">
            <p className="text-sm font-medium text-[#52525B]">No transactions yet</p>
            <p className="text-xs text-[#8E8E93] mt-1">
              Contributions and household expenses appear here for everyone
            </p>
          </div>
        )
      ) : (
        <div className="divide-y divide-stone-900/[0.06]">
          {visible.map((tx) => {
            const isContribution = tx.type === "contribution";
            const cat = getCategoryMeta(tx.category);
            const recorderName = tx.recorder?.full_name ?? "Former member";
            const creditedProfile = isContribution && tx.payer ? tx.payer : tx.recorder;
            const displayName = creditedProfile?.full_name ?? recorderName;
            const avatarColor = creditedProfile?.avatar_color ?? "#BFA377";
            const recordedOnBehalf =
              isContribution && tx.paid_by && tx.paid_by !== tx.recorded_by;
            const isPendingSync = tx.id.startsWith("offline-");
            const canManage = tx.recorded_by === currentUserId && !isPendingSync;
            const isExpanded = expandedId === tx.id;
            const confirmingDelete = confirmDeleteId === tx.id;
            const isNew = Boolean(newTransactionIds?.has(tx.id));

            return (
              <div key={tx.id} className="py-3 first:pt-1 last:pb-0">
                <button
                  type="button"
                  onClick={() => {
                    setExpandedId(isExpanded ? null : tx.id);
                    if (isExpanded) setConfirmDeleteId(null);
                  }}
                  className="flex w-full items-center justify-between gap-3 text-left cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                      style={{ backgroundColor: avatarColor }}
                    >
                      {getInitials(displayName)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="truncate text-sm font-medium text-[#1C1C1E]">
                          {displayName}
                        </span>
                        {isPendingSync && (
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-stone-100 px-1.5 py-0.5 text-[11px] font-medium text-[#8F703F]">
                            <span className="h-1.5 w-1.5 rounded-full bg-[#C6A87C]" />
                            Pending sync
                          </span>
                        )}
                        {isNew && (
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-stone-100 px-1.5 py-0.5 text-[11px] font-medium text-[#8F703F]">
                            <span className="h-1.5 w-1.5 rounded-full bg-[#C6A87C]" />
                            New
                          </span>
                        )}
                        {tx.updated_at && (
                          <span className="shrink-0 rounded-md bg-stone-100 px-1.5 py-0.5 text-[11px] text-[#8E8E93]">
                            Edited
                          </span>
                        )}
                      </div>
                      <div className="truncate text-xs text-[#8E8E93] mt-0.5">
                        {cat.label} · {formatShortDate(tx.transaction_date)}
                        {recordedOnBehalf ? ` · via ${recorderName.split(" ")[0]}` : ""}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-end shrink-0">
                    <div
                      className={`text-sm font-semibold tabular-nums ${
                        isContribution ? "text-emerald-700" : "text-[#1C1C1E]"
                      }`}
                    >
                      {isContribution ? "+" : "-"}
                      {formatTZS(tx.amount)}
                    </div>
                    <span className="mt-0.5 max-w-[148px] truncate text-xs text-[#8E8E93]">
                      {tx.description}
                    </span>
                  </div>
                </button>

                {isExpanded && (
                  <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#F6F5F2] px-3 py-2 text-xs text-[#52525B]">
                    <span>
                      {recordedOnBehalf ? (
                        <>
                          Paid by <strong className="font-medium text-[#1C1C1E]">{displayName}</strong> ·
                          recorded by <strong className="font-medium text-[#1C1C1E]">{recorderName}</strong>
                        </>
                      ) : (
                        <>
                          Recorded by <strong className="font-medium text-[#1C1C1E]">{recorderName}</strong>
                        </>
                      )}{" "}
                      on {tx.transaction_date}
                    </span>
                    {canManage && (
                      <div className="flex items-center gap-1.5">
                        {confirmingDelete ? (
                          <>
                            <span className="text-rose-700 font-medium">Delete entry?</span>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="rounded-md bg-white px-2 py-1 text-xs font-medium text-[#52525B] border border-stone-900/10 hover:bg-stone-50 cursor-pointer"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              disabled={deletingId === tx.id}
                              onClick={() => void handleDelete(tx.id)}
                              className="rounded-md bg-rose-700 px-2 py-1 text-xs font-medium text-white hover:bg-rose-800 disabled:opacity-50 cursor-pointer"
                            >
                              {deletingId === tx.id ? "Deleting..." : "Confirm"}
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => onEdit(tx)}
                              className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-1 text-xs font-medium text-[#1C1C1E] border border-stone-900/10 hover:bg-stone-50 cursor-pointer"
                            >
                              <Pencil className="h-3 w-3" />
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(tx.id)}
                              className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-1 text-xs font-medium text-rose-700 border border-rose-700/20 hover:bg-rose-50 cursor-pointer"
                            >
                              <Trash2 className="h-3 w-3" />
                              Delete
                            </button>
                          </>
                        )}
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

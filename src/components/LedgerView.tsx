import { useMemo, useState } from "react";
import { SearchField, SegmentedControl } from "glisse";
import { formatTZS } from "../lib/format";
import { getCategoryMeta, type Transaction } from "../types";
import { TransactionList } from "./TransactionList";

interface LedgerViewProps {
  transactions: Transaction[];
  currentUserId: string;
  onDelete: (id: string) => Promise<void>;
}

export function LedgerView({ transactions, currentUserId, onDelete }: LedgerViewProps) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "contribution" | "expense">("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return transactions.filter((tx) => {
      if (filter !== "all" && tx.type !== filter) return false;
      if (!q) return true;
      const cat = getCategoryMeta(tx.category).label.toLowerCase();
      const who = (tx.recorder?.full_name ?? "").toLowerCase();
      return (
        tx.description.toLowerCase().includes(q) ||
        cat.includes(q) ||
        who.includes(q) ||
        tx.transaction_date.includes(q)
      );
    });
  }, [filter, query, transactions]);

  const totals = useMemo(() => {
    let pooled = 0;
    let spent = 0;
    for (const tx of filtered) {
      if (tx.type === "contribution") pooled += tx.amount;
      else spent += tx.amount;
    }
    return { pooled, spent };
  }, [filtered]);

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <SearchField
          placeholder="Search description, member, category..."
          value={query}
          onValueChange={setQuery}
          className="w-full"
        />
        <div className="flex justify-center">
          <SegmentedControl
            className="keeper-segmented-3"
            value={filter}
            onValueChange={(v) => setFilter(v as "all" | "contribution" | "expense")}
            items={[
              { value: "all", label: "All" },
              { value: "contribution", label: "Pooled" },
              { value: "expense", label: "Expenses" },
            ]}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-[#B8D7F8] bg-[#F2F8FF] px-3.5 py-2.5">
          <div className="text-[11px] font-medium text-slate-500">Filtered Pooled</div>
          <div className="text-sm font-bold text-[#1D63D8] tabular-nums mt-0.5">
            {formatTZS(totals.pooled)}
          </div>
        </div>
        <div className="rounded-2xl border border-[#F3CFAF] bg-[#FFF8F2] px-3.5 py-2.5">
          <div className="text-[11px] font-medium text-slate-500">Filtered Spent</div>
          <div className="text-sm font-bold text-[#C25E1A] tabular-nums mt-0.5">
            {formatTZS(totals.spent)}
          </div>
        </div>
      </div>

      <TransactionList
        title={`Household Ledger (${filtered.length})`}
        transactions={filtered}
        currentUserId={currentUserId}
        onDelete={onDelete}
      />
    </div>
  );
}

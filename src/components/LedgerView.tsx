import { useMemo, useState } from "react";
import { Button, SearchField, SegmentedControl } from "glisse";
import { Download, RotateCcw, SearchX } from "lucide-react";
import { buildLedgerCsv, downloadTextFile } from "../lib/export";
import { formatTZS, toISODate } from "../lib/format";
import {
  EXPENSE_CATEGORIES,
  getCategoryMeta,
  type ExpenseCategoryId,
  type Transaction,
} from "../types";
import { CategoryIcon } from "./CategoryIcon";
import { TransactionList } from "./TransactionList";

const PAGE_SIZE = 25;

interface LedgerViewProps {
  householdName: string;
  transactions: Transaction[];
  currentUserId: string;
  onEdit: (tx: Transaction) => void;
  onDelete: (id: string) => Promise<void>;
}

export function LedgerView({
  householdName,
  transactions,
  currentUserId,
  onEdit,
  onDelete,
}: LedgerViewProps) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "contribution" | "expense">("all");
  const [categoryFilter, setCategoryFilter] = useState<"all" | ExpenseCategoryId>("all");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const hasActiveFilters =
    query.trim().length > 0 || filter !== "all" || categoryFilter !== "all";

  const resetFilters = () => {
    setQuery("");
    setFilter("all");
    setCategoryFilter("all");
    setVisibleCount(PAGE_SIZE);
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const numericQuery = q.replace(/[,\s]/g, "");

    return transactions.filter((tx) => {
      if (filter !== "all" && tx.type !== filter) return false;
      if (categoryFilter !== "all" && tx.category !== categoryFilter) return false;
      if (!q) return true;

      const cat = getCategoryMeta(tx.category).label.toLowerCase();
      const who = (tx.recorder?.full_name ?? "").toLowerCase();
      const payer = (tx.payer?.full_name ?? "").toLowerCase();
      const amountRaw = String(tx.amount);
      const amountFormatted = formatTZS(tx.amount).toLowerCase();

      return (
        tx.description.toLowerCase().includes(q) ||
        cat.includes(q) ||
        who.includes(q) ||
        payer.includes(q) ||
        tx.transaction_date.includes(q) ||
        amountFormatted.includes(q) ||
        (numericQuery.length > 0 && amountRaw.includes(numericQuery))
      );
    });
  }, [categoryFilter, filter, query, transactions]);

  const paginated = useMemo(
    () => filtered.slice(0, visibleCount),
    [filtered, visibleCount],
  );
  const remainingCount = Math.max(0, filtered.length - paginated.length);

  const totals = useMemo(() => {
    let pooled = 0;
    let spent = 0;
    for (const tx of filtered) {
      if (tx.type === "contribution") pooled += tx.amount;
      else spent += tx.amount;
    }
    return { pooled, spent };
  }, [filtered]);

  const handleExportCsv = () => {
    const csv = buildLedgerCsv(filtered);
    const slug = householdName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    downloadTextFile(
      `keeper-${slug || "household"}-${toISODate(new Date())}.csv`,
      csv,
      "text/csv;charset=utf-8;",
    );
  };

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <SearchField
          placeholder="Search description, member, category, TZS..."
          value={query}
          onValueChange={(v) => {
            setQuery(v);
            setVisibleCount(PAGE_SIZE);
          }}
          className="w-full"
        />
        <div className="flex justify-center">
          <SegmentedControl
            className="keeper-segmented-3"
            value={filter}
            onValueChange={(v) => {
              const next = v as "all" | "contribution" | "expense";
              setFilter(next);
              if (next === "contribution") setCategoryFilter("all");
              setVisibleCount(PAGE_SIZE);
            }}
            items={[
              { value: "all", label: "All" },
              { value: "contribution", label: "Pooled" },
              { value: "expense", label: "Expenses" },
            ]}
          />
        </div>

        {/* Category Filter Chips (hidden when viewing Pooled contributions only) */}
        {filter !== "contribution" && (
          <div
            data-no-tab-swipe
            className="flex items-center gap-1.5 overflow-x-auto no-scrollbar -mx-4 px-4 pb-0.5"
          >
            <button
              type="button"
              onClick={() => {
                setCategoryFilter("all");
                setVisibleCount(PAGE_SIZE);
              }}
              className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors cursor-pointer ${
                categoryFilter === "all"
                  ? "bg-[#1C1C1E] text-white"
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              All Categories
            </button>
            {EXPENSE_CATEGORIES.map((cat) => {
              const active = categoryFilter === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    setCategoryFilter(active ? "all" : cat.id);
                    setVisibleCount(PAGE_SIZE);
                  }}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors cursor-pointer ${
                    active
                      ? "bg-[#1C1C1E] text-white"
                      : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <CategoryIcon category={cat.id} className="h-3 w-3" />
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>
        )}
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

      <div className="flex items-center justify-between gap-2">
        {hasActiveFilters ? (
          <button
            type="button"
            onClick={resetFilters}
            className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-900 cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Clear filters
          </button>
        ) : (
          <span className="text-[11px] font-medium text-slate-400">
            Showing {paginated.length} of {filtered.length}
          </span>
        )}

        <Button
          onClick={handleExportCsv}
          disabled={filtered.length === 0}
          icon={<Download className="h-4 w-4" />}
          className="!h-9 text-xs font-semibold"
        >
          Export CSV ({filtered.length})
        </Button>
      </div>

      <TransactionList
        title={`Household Ledger (${filtered.length})`}
        transactions={paginated}
        currentUserId={currentUserId}
        onEdit={onEdit}
        onDelete={onDelete}
        emptyState={
          hasActiveFilters ? (
            <div className="rounded-2xl bg-slate-50 py-8 px-4 text-center space-y-2.5">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-slate-200/70 text-slate-500">
                <SearchX className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-700">No matching entries</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {query.trim()
                    ? `No transactions found for "${query.trim()}".`
                    : "Try switching or clearing your active category filters."}
                </p>
              </div>
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex items-center gap-1.5 rounded-full bg-[#1C1C1E] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 cursor-pointer"
              >
                <RotateCcw className="h-3 w-3" />
                Clear filters
              </button>
            </div>
          ) : undefined
        }
      />

      {remainingCount > 0 && (
        <Button
          onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
          className="w-full justify-center !h-10 text-xs font-semibold"
        >
          Load More ({remainingCount} remaining)
        </Button>
      )}
    </div>
  );
}

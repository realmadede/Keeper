import { useMemo, useState } from "react";
import { SegmentedControl } from "glisse";
import { Download, RotateCcw, Search, SearchX } from "lucide-react";
import { buildLedgerCsv, downloadTextFile } from "../lib/export";
import { formatTZS, toISODate } from "../lib/format";
import {
  EXPENSE_CATEGORIES,
  getCategoryMeta,
  type ExpenseCategoryId,
  type Transaction,
} from "../types";
import { CategoryIcon } from "./CategoryIcon";
import { SoftButton, SoftInput } from "./LightControls";
import { TransactionList } from "./TransactionList";

const PAGE_SIZE = 25;

interface LedgerViewProps {
  householdName: string;
  transactions: Transaction[];
  currentUserId: string;
  newTransactionIds?: Set<string>;
  onEdit: (tx: Transaction) => void;
  onDelete: (id: string) => Promise<void>;
}

export function LedgerView({
  householdName,
  transactions,
  currentUserId,
  newTransactionIds,
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
        <SoftInput
          type="search"
          clearable
          placeholder="Search ledger"
          value={query}
          onValueChange={(v) => {
            setQuery(v);
            setVisibleCount(PAGE_SIZE);
          }}
          icon={<Search className="h-4 w-4" />}
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
              className={`shrink-0 rounded-xl px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                categoryFilter === "all"
                  ? "bg-[#1C1C1E] text-white"
                  : "border border-stone-900/10 bg-white text-[#52525B] hover:bg-stone-50"
              }`}
            >
              All categories
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
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                    active
                      ? "bg-[#1C1C1E] text-white"
                      : "border border-stone-900/10 bg-white text-[#52525B] hover:bg-stone-50"
                  }`}
                >
                  <CategoryIcon category={cat.id} className="h-3.5 w-3.5" />
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Quiet Warm-Stone Summary Strip */}
      <div className="grid grid-cols-2 divide-x divide-stone-900/[0.06] rounded-2xl border border-stone-900/[0.08] bg-white p-4">
        <div className="pr-3">
          <div className="flex items-center gap-1.5 text-xs text-[#52525B]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#C6A87C]" />
            <span>Filtered pooled</span>
          </div>
          <div className="mt-1 text-base font-semibold text-[#1C1C1E] tabular-nums">
            {formatTZS(totals.pooled)}
          </div>
        </div>
        <div className="pl-3">
          <div className="flex items-center gap-1.5 text-xs text-[#52525B]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#1C1C1E]" />
            <span>Filtered spent</span>
          </div>
          <div className="mt-1 text-base font-semibold text-[#1C1C1E] tabular-nums">
            {formatTZS(totals.spent)}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        {hasActiveFilters ? (
          <button
            type="button"
            onClick={resetFilters}
            className="inline-flex items-center gap-1 text-xs font-medium text-[#52525B] hover:text-[#1C1C1E] transition-colors cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Clear filters
          </button>
        ) : (
          <span className="font-mono text-[11px] text-[#8E8E93]">
            {paginated.length} of {filtered.length} entries
          </span>
        )}

        <SoftButton
          onClick={handleExportCsv}
          disabled={filtered.length === 0}
          icon={<Download className="h-4 w-4" />}
          className="!h-9 text-xs font-medium"
        >
          Export CSV ({filtered.length})
        </SoftButton>
      </div>

      <TransactionList
        title={`Household ledger (${filtered.length})`}
        transactions={paginated}
        currentUserId={currentUserId}
        newTransactionIds={newTransactionIds}
        onEdit={onEdit}
        onDelete={onDelete}
        emptyState={
          hasActiveFilters ? (
            <div className="my-2 rounded-xl bg-[#F6F5F2] py-8 px-4 text-center space-y-2.5">
              <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-xl bg-white border border-stone-900/[0.08] text-[#52525B]">
                <SearchX className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-medium text-[#1C1C1E]">No matching entries</p>
                <p className="text-xs text-[#8E8E93] mt-0.5">
                  {query.trim()
                    ? `No transactions found for "${query.trim()}"`
                    : "Try switching or clearing your active category filters"}
                </p>
              </div>
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#1C1C1E] px-3.5 py-1.5 text-xs font-medium text-white hover:bg-[#2C2C30] transition-colors cursor-pointer"
              >
                <RotateCcw className="h-3 w-3" />
                Clear filters
              </button>
            </div>
          ) : undefined
        }
      />

      {remainingCount > 0 && (
        <SoftButton
          onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
          className="w-full !h-10 text-xs font-medium"
        >
          Load more ({remainingCount} remaining)
        </SoftButton>
      )}
    </div>
  );
}

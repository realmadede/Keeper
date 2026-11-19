import type { CategoryBreakdownItem } from "../lib/analytics";
import { formatTZS } from "../lib/format";
import { CategoryIcon } from "./CategoryIcon";

interface CategoryBreakdownProps {
  categories: CategoryBreakdownItem[];
  totalSpent: number;
  periodKind: "week" | "month";
  comparisonLabel: string;
  spentDeltaPct: number | null;
  onViewAll: () => void;
}

export function CategoryBreakdown({
  categories,
  totalSpent,
  periodKind,
  comparisonLabel,
  spentDeltaPct,
  onViewAll,
}: CategoryBreakdownProps) {
  return (
    <section className="rounded-2xl border border-stone-900/[0.08] bg-white p-4">
      <div className="flex items-baseline justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-[#1C1C1E]">Spend by category</h2>
          <p className="text-xs text-[#52525B] mt-0.5 tabular-nums">
            {formatTZS(totalSpent)} spent
          </p>
        </div>
        <span className="font-mono text-[11px] text-[#8E8E93]">
          {categories.length} {categories.length === 1 ? "category" : "categories"}
        </span>
      </div>

      {categories.length === 0 ? (
        <div className="my-4 rounded-xl bg-[#F6F5F2] py-8 px-4 text-center">
          <p className="text-sm font-medium text-[#52525B]">
            No household expenses this {periodKind}
          </p>
          <p className="text-xs text-[#8E8E93] mt-1">
            Use the + button below to record a purchase in TZS
          </p>
        </div>
      ) : (
        <>
          {/* Single Stacked Share Bar */}
          <div className="mt-3 mb-4 flex h-2 w-full overflow-hidden rounded-full bg-stone-100 gap-0.5">
            {categories.map((cat, idx) => (
              <div
                key={cat.id}
                style={{
                  width: `${Math.max(4, cat.percent)}%`,
                  backgroundColor: idx === 0 ? "#1C1C1E" : idx === 1 ? "#C6A87C" : "#A8A29E",
                }}
                className="h-full first:rounded-l-full last:rounded-r-full transition-[width] duration-300"
              />
            ))}
          </div>

          {/* Ranked Category List with Thin Bars */}
          <div className="divide-y divide-stone-900/[0.06]">
            {categories.map((cat, idx) => {
              const barColor = idx === 0 ? "#1C1C1E" : idx === 1 ? "#C6A87C" : "#A8A29E";
              return (
                <div key={cat.id} className="py-2.5 first:pt-0 last:pb-0">
                  <div className="flex items-center justify-between text-sm mb-1.5">
                    <span className="inline-flex items-center gap-2 font-medium text-[#1C1C1E]">
                      <span
                        className="h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{ backgroundColor: barColor }}
                      />
                      <span className="flex w-4 shrink-0 items-center justify-center text-[#52525B]">
                        <CategoryIcon category={cat.id} className="h-4 w-4" />
                      </span>
                      <span>{cat.label}</span>
                    </span>
                    <span className="inline-flex items-center gap-2.5 tabular-nums">
                      <span className="font-mono text-[11px] text-[#8E8E93]">{cat.percent}%</span>
                      <span className="font-semibold text-[#1C1C1E]">{formatTZS(cat.amount)}</span>
                    </span>
                  </div>
                  <div className="h-1 w-full overflow-hidden rounded-full bg-stone-100">
                    <div
                      className="h-full rounded-full transition-[width] duration-300"
                      style={{
                        width: `${Math.max(4, cat.percent)}%`,
                        backgroundColor: barColor,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Footer */}
      <div className="mt-3 flex items-center justify-between border-t border-stone-900/[0.06] pt-3 text-xs">
        {spentDeltaPct !== null ? (
          <span className="inline-flex items-center gap-1 text-[11px] tabular-nums">
            <span
              className={`font-medium ${
                spentDeltaPct <= 0 ? "text-emerald-700" : "text-rose-700"
              }`}
            >
              {spentDeltaPct >= 0 ? "+" : "-"}
              {Math.abs(spentDeltaPct)}%
            </span>
            <span className="text-[#8E8E93]">{comparisonLabel.toLowerCase()}</span>
          </span>
        ) : (
          <span className="text-[11px] text-[#8E8E93]">
            {periodKind === "month" ? "Monthly share" : "Weekly share"}
          </span>
        )}
        <button
          type="button"
          onClick={onViewAll}
          className="text-xs font-medium text-[#1C1C1E] hover:text-[#8F703F] transition-colors cursor-pointer"
        >
          Open ledger
        </button>
      </div>
    </section>
  );
}

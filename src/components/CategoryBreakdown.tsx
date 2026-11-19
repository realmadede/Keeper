import { useState } from "react";
import { Glass } from "glisse";
import { TrendingDown, TrendingUp } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import type { CategoryBreakdownItem } from "../lib/analytics";
import { formatTZS } from "../lib/format";
import { CategoryIcon } from "./CategoryIcon";

interface CategoryBreakdownProps {
  categories: CategoryBreakdownItem[];
  totalSpent: number;
  spentDeltaPct: number | null;
  onViewAll: () => void;
}

export function CategoryBreakdown({
  categories,
  totalSpent,
  spentDeltaPct,
  onViewAll,
}: CategoryBreakdownProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const safeIndex = selectedIndex < categories.length ? selectedIndex : 0;
  const active = categories[safeIndex];

  return (
    <section className="rounded-[24px] border border-slate-100 bg-white p-4 shadow-[0_2px_16px_rgba(15,23,42,0.04)]">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-[15px] font-semibold text-slate-900">Expense by Category</h2>
          <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
            {formatTZS(totalSpent)} total spent
          </p>
        </div>
        <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600">
          {categories.length} {categories.length === 1 ? "category" : "categories"}
        </span>
      </div>

      {categories.length === 0 ? (
        <div className="my-6 rounded-2xl bg-slate-50 py-8 text-center">
          <p className="text-sm font-medium text-slate-500">No household expenses this week</p>
          <p className="text-xs text-slate-400 mt-1">Tap + below to record a purchase in TZS.</p>
        </div>
      ) : (
        <>
          {/* Donut Chart + Floating Glisse Active Pill */}
          <div className="relative my-3 flex flex-col items-center">
            {active && (
              <Glass className="z-10 -mb-3 rounded-xl px-3 py-1.5 text-center shadow-sm">
                <div
                  className="text-xs font-bold tabular-nums"
                  style={{ color: active.color }}
                >
                  {formatTZS(active.amount)}
                </div>
                <div className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-600">
                  <CategoryIcon category={active.id} className="h-3 w-3" />
                  <span>{active.label}</span>
                </div>
              </Glass>
            )}

            <div className="h-[188px] w-[210px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categories}
                    dataKey="amount"
                    nameKey="label"
                    cx="50%"
                    cy="50%"
                    innerRadius={54}
                    outerRadius={80}
                    paddingAngle={4}
                    cornerRadius={6}
                    stroke="none"
                    onClick={(_entry, idx) => setSelectedIndex(idx)}
                  >
                    {categories.map((cat, idx) => (
                      <Cell
                        key={cat.id}
                        fill={cat.color}
                        opacity={idx === safeIndex ? 1 : 0.72}
                        cursor="pointer"
                      />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Category Progress Rows */}
          <div className="space-y-3 mt-1">
            {categories.map((cat, idx) => {
              const isSelected = idx === safeIndex;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedIndex(idx)}
                  className={`w-full text-left rounded-xl p-1.5 -mx-1.5 transition-colors ${
                    isSelected ? "bg-slate-50/90" : "hover:bg-slate-50/60"
                  }`}
                >
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="inline-flex items-center gap-2 font-medium text-slate-800">
                      <span
                        className="flex h-6 w-6 items-center justify-center rounded-lg"
                        style={{ backgroundColor: `${cat.color}18`, color: cat.color }}
                      >
                        <CategoryIcon category={cat.id} className="h-3.5 w-3.5" />
                      </span>
                      <span>{cat.label}</span>
                    </span>
                    <span className="inline-flex items-center gap-2.5 tabular-nums">
                      <span className="text-[11px] text-slate-400">{cat.percent}%</span>
                      <span className="font-semibold text-slate-900">{formatTZS(cat.amount)}</span>
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.max(4, cat.percent)}%`,
                        backgroundColor: cat.color,
                      }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* Footer */}
      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-2.5 text-xs">
        {spentDeltaPct !== null ? (
          <span
            className={`inline-flex items-center gap-1 text-[11px] font-medium ${
              spentDeltaPct <= 0 ? "text-emerald-600" : "text-rose-500"
            }`}
          >
            {spentDeltaPct >= 0 ? (
              <TrendingUp className="h-3 w-3" />
            ) : (
              <TrendingDown className="h-3 w-3" />
            )}
            <span>{Math.abs(spentDeltaPct)}%</span>
            <span className="text-slate-400 font-normal">From last week</span>
          </span>
        ) : (
          <span className="text-[11px] text-slate-400">Weekly breakdown</span>
        )}
        <button
          type="button"
          onClick={onViewAll}
          className="text-xs font-semibold text-slate-900 hover:text-[#BFA377] transition-colors cursor-pointer"
        >
          View All
        </button>
      </div>
    </section>
  );
}

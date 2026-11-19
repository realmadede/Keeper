import { useEffect, useState } from "react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, XAxis, YAxis } from "recharts";
import type { DailyBarPoint } from "../lib/analytics";
import { formatCompactTZS, formatFullDayLabel, formatTZS } from "../lib/format";

interface WeeklyBarChartProps {
  dailySeries: DailyBarPoint[];
  periodKind: "week" | "month";
  comparisonLabel: string;
  spentDeltaPct: number | null;
}

export function WeeklyBarChart({
  dailySeries,
  periodKind,
  comparisonLabel,
  spentDeltaPct,
}: WeeklyBarChartProps) {
  const defaultIndex = (() => {
    let bestIdx = 0;
    let bestVal = -1;
    dailySeries.forEach((d, idx) => {
      const total = d.contributed + d.spent;
      if (total > bestVal) {
        bestVal = total;
        bestIdx = idx;
      }
    });
    return bestIdx;
  })();

  const [activeIndex, setActiveIndex] = useState(defaultIndex);

  useEffect(() => {
    setActiveIndex(defaultIndex);
  }, [defaultIndex]);

  const activeDay = dailySeries[activeIndex] ?? dailySeries[0];
  const hasActivity = dailySeries.some((d) => d.contributed > 0 || d.spent > 0);
  const activeSubtitle = activeDay
    ? periodKind === "month"
      ? `${activeDay.dayShort} · ${activeDay.detailLabel}`
      : formatFullDayLabel(activeDay.iso)
    : "";

  return (
    <section className="rounded-[24px] border border-slate-100 bg-white p-4 shadow-[0_2px_16px_rgba(15,23,42,0.04)]">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-[15px] font-semibold text-slate-900">Expense Overview</h2>
        <span className="text-[11px] font-medium text-slate-400">
          {hasActivity
            ? periodKind === "month"
              ? "Tap any week"
              : "Tap any day"
            : periodKind === "month"
              ? "Monthly weeks"
              : "Mon - Sun"}
        </span>
      </div>

      {!hasActivity ? (
        <div className="my-4 rounded-2xl bg-slate-50 py-10 px-4 text-center">
          <p className="text-sm font-medium text-slate-600">
            No activity recorded for this {periodKind}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Tap the + button below to log a contribution or household purchase.
          </p>
        </div>
      ) : (
        <>
          {/* Frosted Callout Chips for Selected Day/Week */}
          {activeDay && (
            <div className="mb-3 flex flex-wrap gap-2">
              <div className="flex-1 min-w-[130px] rounded-xl border border-slate-200/80 bg-slate-50/90 px-2.5 py-1.5 shadow-2xs">
                <div className="text-[12px] font-bold text-emerald-600 tabular-nums">
                  {formatTZS(activeDay.contributed)}
                </div>
                <div className="text-[10px] text-slate-500 truncate">
                  Pooled · {activeSubtitle}
                </div>
              </div>
              <div className="flex-1 min-w-[130px] rounded-xl border border-slate-200/80 bg-slate-50/90 px-2.5 py-1.5 shadow-2xs">
                <div className="text-[12px] font-bold text-rose-600 tabular-nums">
                  {formatTZS(activeDay.spent)}
                </div>
                <div className="text-[10px] text-slate-500 truncate">
                  Spent · {activeSubtitle}
                </div>
              </div>
            </div>
          )}

          <div className="h-[195px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={dailySeries}
                margin={{ top: 8, right: 4, left: -18, bottom: 0 }}
                barGap={3}
                barCategoryGap="24%"
                onClick={(state) => {
                  if (typeof state?.activeTooltipIndex === "number") {
                    setActiveIndex(state.activeTooltipIndex);
                  }
                }}
              >
                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis
                  dataKey="dayShort"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#64748B", fontSize: 11, fontWeight: 500 }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: number) => (v === 0 ? "0" : formatCompactTZS(v))}
                  tick={{ fill: "#94A3B8", fontSize: 10 }}
                  width={44}
                />
                <Bar
                  dataKey="contributed"
                  radius={[6, 6, 4, 4]}
                  maxBarSize={14}
                  cursor="pointer"
                  onClick={(_data, idx) => setActiveIndex(idx)}
                >
                  {dailySeries.map((entry, idx) => (
                    <Cell
                      key={`c-${entry.iso}`}
                      fill={idx === activeIndex ? "#16A34A" : "#E5E7EB"}
                    />
                  ))}
                </Bar>
                <Bar
                  dataKey="spent"
                  radius={[6, 6, 4, 4]}
                  maxBarSize={14}
                  cursor="pointer"
                  onClick={(_data, idx) => setActiveIndex(idx)}
                >
                  {dailySeries.map((entry, idx) => (
                    <Cell
                      key={`s-${entry.iso}`}
                      fill={idx === activeIndex ? "#DC2626" : "#EDF0F4"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      {/* Footer Legend & Delta */}
      <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5 text-xs">
        <div className="flex items-center gap-3.5">
          <span className="inline-flex items-center gap-1.5 font-medium text-emerald-700">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-600" />
            Contributed
          </span>
          <span className="inline-flex items-center gap-1.5 font-medium text-rose-600">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-600" />
            Spent
          </span>
        </div>
        {spentDeltaPct !== null && (
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
            <span className="text-slate-400 font-normal">{comparisonLabel.toLowerCase()}</span>
          </span>
        )}
      </div>
    </section>
  );
}

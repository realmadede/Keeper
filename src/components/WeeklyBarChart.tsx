import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, XAxis, YAxis } from "recharts";
import type { DailyBarPoint } from "../lib/analytics";
import { formatCompactTZS, formatFullDayLabel, formatTZS } from "../lib/format";

interface WeeklyBarChartProps {
  dailySeries: DailyBarPoint[];
  periodKind: "week" | "month";
  comparisonLabel: string;
  spentDeltaPct: number | null;
  appliedAdvanceCredit?: number;
}

export function WeeklyBarChart({
  dailySeries,
  periodKind,
  comparisonLabel,
  spentDeltaPct,
  appliedAdvanceCredit = 0,
}: WeeklyBarChartProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const seriesKey = dailySeries.map((d) => d.iso).join(",");

  useEffect(() => {
    setSelectedIndex(null);
  }, [seriesKey]);

  const activeDay = selectedIndex !== null ? (dailySeries[selectedIndex] ?? null) : null;
  const periodContributed = dailySeries.reduce((sum, d) => sum + d.contributed, 0);
  const periodSpent = dailySeries.reduce((sum, d) => sum + d.spent, 0);
  const displayContributed = activeDay
    ? activeDay.contributed
    : periodContributed + appliedAdvanceCredit;
  const displaySpent = activeDay ? activeDay.spent : periodSpent;
  const hasActivity = periodContributed > 0 || appliedAdvanceCredit > 0 || periodSpent > 0;
  const activeSubtitle = activeDay
    ? periodKind === "month"
      ? `${activeDay.dayShort} · ${activeDay.detailLabel}`
      : formatFullDayLabel(activeDay.iso)
    : periodKind === "month"
      ? "Full month total · tap a bar to inspect"
      : "Full week total · tap a bar to inspect";

  const toggleIndex = (idx: number) => {
    setSelectedIndex((prev) => (prev === idx ? null : idx));
  };

  return (
    <section className="rounded-2xl border border-stone-900/[0.08] bg-white p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-base font-semibold text-[#1C1C1E]">Pool vs. spend</h2>
          {hasActivity && (
            <p className="text-xs text-[#8E8E93] mt-0.5">{activeSubtitle}</p>
          )}
        </div>
        {activeDay ? (
          <button
            type="button"
            onClick={() => setSelectedIndex(null)}
            className="rounded-lg border border-stone-900/10 bg-[#F6F5F2] px-2 py-1 text-[11px] font-medium text-[#1C1C1E] hover:bg-stone-200/60 transition-colors cursor-pointer"
          >
            All {periodKind}
          </button>
        ) : (
          <span className="font-mono text-[11px] text-[#8E8E93]">
            {periodKind === "month"
              ? "W1 - W5"
              : `${dailySeries[0]?.dayShort ?? "Mon"} - ${dailySeries[dailySeries.length - 1]?.dayShort ?? "Sun"}`}
          </span>
        )}
      </div>

      {!hasActivity ? (
        <div className="my-3 rounded-xl bg-[#F6F5F2] py-10 px-4 text-center">
          <p className="text-sm font-medium text-[#52525B]">
            No activity recorded this {periodKind}
          </p>
          <p className="mt-1 text-xs text-[#8E8E93]">
            Use the + button below to record a contribution or household expense
          </p>
        </div>
      ) : (
        <>
          <div className="mb-3 grid grid-cols-2 gap-3 rounded-xl bg-[#F6F5F2] px-3 py-2.5">
            <div>
              <div className="flex items-center gap-1.5 text-[11px] text-[#52525B]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#C6A87C]" />
                <span>Contributed</span>
              </div>
              <div className="mt-0.5 text-sm font-semibold text-[#1C1C1E] tabular-nums">
                {formatTZS(displayContributed)}
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1.5 text-[11px] text-[#52525B]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#1C1C1E]" />
                <span>Spent</span>
              </div>
              <div className="mt-0.5 text-sm font-semibold text-[#1C1C1E] tabular-nums">
                {formatTZS(displaySpent)}
              </div>
            </div>
          </div>

          <div className="h-[196px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={dailySeries}
                margin={{ top: 8, right: 4, left: -16, bottom: 0 }}
                barGap={4}
                barCategoryGap="24%"
                onClick={(state) => {
                  if (typeof state?.activeTooltipIndex === "number") {
                    toggleIndex(state.activeTooltipIndex);
                  }
                }}
              >
                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#EFECE6" />
                <XAxis
                  dataKey="dayShort"
                  axisLine={false}
                  tickLine={false}
                  tick={{
                    fill: "#8E8E93",
                    fontSize: 11,
                    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                  }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: number) => (v === 0 ? "0" : formatCompactTZS(v))}
                  tick={{
                    fill: "#8E8E93",
                    fontSize: 11,
                    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                  }}
                  width={44}
                />
                <Bar
                  dataKey="contributed"
                  radius={[4, 4, 2, 2]}
                  maxBarSize={14}
                  cursor="pointer"
                  onClick={(_data, idx) => toggleIndex(idx)}
                >
                  {dailySeries.map((entry, idx) => (
                    <Cell
                      key={`c-${entry.iso}`}
                      fill={selectedIndex === null || idx === selectedIndex ? "#C6A87C" : "#E7E5E4"}
                    />
                  ))}
                </Bar>
                <Bar
                  dataKey="spent"
                  radius={[4, 4, 2, 2]}
                  maxBarSize={14}
                  cursor="pointer"
                  onClick={(_data, idx) => toggleIndex(idx)}
                >
                  {dailySeries.map((entry, idx) => (
                    <Cell
                      key={`s-${entry.iso}`}
                      fill={selectedIndex === null || idx === selectedIndex ? "#1C1C1E" : "#D6D3D1"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      {/* Footer Legend & Delta */}
      <div className="mt-3 flex items-center justify-between border-t border-stone-900/[0.06] pt-3 text-xs">
        <div className="flex items-center gap-4">
          <span className="inline-flex items-center gap-1.5 text-[#52525B]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#C6A87C]" />
            <span>Contributed</span>
          </span>
          <span className="inline-flex items-center gap-1.5 text-[#52525B]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#1C1C1E]" />
            <span>Spent</span>
          </span>
        </div>
        {spentDeltaPct !== null && (
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
        )}
      </div>
    </section>
  );
}

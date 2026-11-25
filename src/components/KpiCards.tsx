import { formatTZS } from "../lib/format";

interface KpiCardsProps {
  totalSpent: number;
  totalContributed: number;
  appliedAdvanceCredit?: number;
  remainingBalance: number;
  allTimeBalance: number;
  periodLabel: string;
  comparisonLabel: string;
  spentDeltaPct: number | null;
  contributedDeltaPct: number | null;
}

function DeltaLabel({
  pct,
  comparisonLabel,
  invertGood = false,
}: {
  pct: number | null;
  comparisonLabel: string;
  invertGood?: boolean;
}) {
  if (pct === null) {
    return <span className="text-[11px] text-[#8E8E93]">No prior period data</span>;
  }
  const isUp = pct >= 0;
  const isGood = invertGood ? !isUp : isUp;
  const sign = isUp ? "+" : "-";
  return (
    <span className="inline-flex items-center gap-1 text-[11px] tabular-nums">
      <span className={`font-medium ${isGood ? "text-emerald-700" : "text-rose-700"}`}>
        {sign}
        {Math.abs(pct)}%
      </span>
      <span className="text-[#8E8E93]">{comparisonLabel.toLowerCase()}</span>
    </span>
  );
}

export function KpiCards({
  totalSpent,
  totalContributed,
  appliedAdvanceCredit = 0,
  remainingBalance,
  allTimeBalance,
  periodLabel,
  comparisonLabel,
  spentDeltaPct,
  contributedDeltaPct,
}: KpiCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {/* Cash on Hand — All-time carry-over pool */}
      <div className="rounded-2xl border border-stone-900/[0.08] bg-white p-4">
        <div className="flex items-center gap-1.5 text-xs text-[#52525B]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#C6A87C]" />
          <span>Cash on hand</span>
        </div>
        <div
          className={`mt-1.5 text-lg font-semibold tabular-nums leading-tight ${
            allTimeBalance >= 0 ? "text-[#1C1C1E]" : "text-rose-700"
          }`}
        >
          {formatTZS(allTimeBalance)}
        </div>
        <div className="mt-1 text-[11px] text-[#8E8E93]">All-time carry-over pool</div>
      </div>

      {/* Period Remaining */}
      <div className="rounded-2xl border border-stone-900/[0.08] bg-white p-4">
        <div className="text-xs text-[#52525B]">Remaining</div>
        <div
          className={`mt-1.5 text-lg font-semibold tabular-nums leading-tight ${
            remainingBalance >= 0 ? "text-[#1C1C1E]" : "text-rose-700"
          }`}
        >
          {formatTZS(remainingBalance)}
        </div>
        <div className="mt-1 text-[11px] text-[#8E8E93]">
          Left from {periodLabel.toLowerCase()}
        </div>
      </div>

      {/* Contributed */}
      <div className="rounded-2xl border border-stone-900/[0.08] bg-white p-4">
        <div className="text-xs text-[#52525B]">Contributed</div>
        <div className="mt-1.5 text-lg font-semibold text-[#1C1C1E] tabular-nums leading-tight">
          {formatTZS(totalContributed)}
        </div>
        <div className="mt-1">
          {appliedAdvanceCredit > 0 ? (
            <span className="text-[11px] font-medium text-[#8F703F] tabular-nums">
              Includes {formatTZS(appliedAdvanceCredit)} paid early
            </span>
          ) : (
            <DeltaLabel pct={contributedDeltaPct} comparisonLabel={comparisonLabel} />
          )}
        </div>
      </div>

      {/* Spent */}
      <div className="rounded-2xl border border-stone-900/[0.08] bg-white p-4">
        <div className="text-xs text-[#52525B]">Spent</div>
        <div className="mt-1.5 text-lg font-semibold text-[#1C1C1E] tabular-nums leading-tight">
          {formatTZS(totalSpent)}
        </div>
        <div className="mt-1">
          <DeltaLabel pct={spentDeltaPct} comparisonLabel={comparisonLabel} invertGood />
        </div>
      </div>
    </div>
  );
}

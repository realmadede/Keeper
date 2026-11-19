import {
  ArrowDownLeft,
  ArrowUpRight,
  Clock,
  Landmark,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { formatTZS } from "../lib/format";

interface KpiCardsProps {
  totalSpent: number;
  totalContributed: number;
  remainingBalance: number;
  allTimeBalance: number;
  periodBudgetTarget: number;
  periodGoalLabel: string;
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
    return <span className="text-[11px] font-medium text-slate-400">No prior period data</span>;
  }
  const isUp = pct >= 0;
  const isGood = invertGood ? !isUp : isUp;
  return (
    <span
      className={`inline-flex items-center gap-1 text-[11px] font-medium ${
        isGood ? "text-emerald-600" : "text-rose-500"
      }`}
    >
      {isUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      <span>{Math.abs(pct)}%</span>
      <span className="text-slate-500 font-normal">{comparisonLabel}</span>
    </span>
  );
}

export function KpiCards({
  totalSpent,
  totalContributed,
  remainingBalance,
  allTimeBalance,
  periodBudgetTarget,
  periodGoalLabel,
  comparisonLabel,
  spentDeltaPct,
  contributedDeltaPct,
}: KpiCardsProps) {
  const budgetProgress =
    periodBudgetTarget > 0 ? Math.min(100, Math.round((totalContributed / periodBudgetTarget) * 100)) : 0;

  return (
    <div
      data-no-tab-swipe
      className="flex gap-3 overflow-x-auto no-scrollbar pb-1 -mx-4 px-4"
    >
      {/* Spent Card — Warm Orange/Peach tint matching mockup Payable card */}
      <div className="min-w-[168px] flex-1 rounded-2xl border border-[#F3CFAF] bg-[#FFF8F2] p-3.5 shadow-[0_2px_10px_rgba(234,88,12,0.05)]">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-medium text-slate-600">Spent</span>
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-orange-100/80 text-orange-600">
            <ArrowUpRight className="h-3.5 w-3.5" />
          </span>
        </div>
        <div className="text-[17px] font-bold tracking-tight text-[#C25E1A] tabular-nums leading-tight">
          {formatTZS(totalSpent)}
        </div>
        <div className="mt-1.5">
          <DeltaLabel pct={spentDeltaPct} comparisonLabel={comparisonLabel} invertGood />
        </div>
      </div>

      {/* Contributed Card — Cool Blue tint matching mockup Receivable card */}
      <div className="min-w-[168px] flex-1 rounded-2xl border border-[#B8D7F8] bg-[#F2F8FF] p-3.5 shadow-[0_2px_10px_rgba(37,99,235,0.05)]">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-medium text-slate-600">Contributed</span>
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100/80 text-blue-600">
            <ArrowDownLeft className="h-3.5 w-3.5" />
          </span>
        </div>
        <div className="text-[17px] font-bold tracking-tight text-[#1D63D8] tabular-nums leading-tight">
          {formatTZS(totalContributed)}
        </div>
        <div className="mt-1.5">
          <DeltaLabel pct={contributedDeltaPct} comparisonLabel={comparisonLabel} />
        </div>
      </div>

      {/* Remaining Balance Card — Soft Mint Green tint matching 3rd mockup card */}
      <div className="min-w-[168px] flex-1 rounded-2xl border border-[#B5E5C8] bg-[#F1FBF5] p-3.5 shadow-[0_2px_10px_rgba(22,163,74,0.05)]">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-medium text-slate-600">Remaining</span>
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100/80 text-emerald-600">
            {remainingBalance >= 0 ? <Wallet className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
          </span>
        </div>
        <div
          className={`text-[17px] font-bold tracking-tight tabular-nums leading-tight ${
            remainingBalance >= 0 ? "text-emerald-700" : "text-rose-600"
          }`}
        >
          {formatTZS(remainingBalance)}
        </div>
        <div className="mt-1.5 flex items-center gap-1 text-[11px] font-medium text-emerald-700">
          <ShieldCheck className="h-3 w-3 shrink-0" />
          <span>{budgetProgress}% of {periodGoalLabel}</span>
        </div>
      </div>

      {/* Carry-Over House Pool Card — All-Time Rollover Cash on Hand */}
      <div className="min-w-[168px] flex-1 rounded-2xl border border-[#E5D3B3] bg-[#FBF8F1] p-3.5 shadow-[0_2px_10px_rgba(166,135,86,0.06)]">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-medium text-slate-600">Cash on Hand</span>
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#EFE3CC] text-[#8F703F]">
            <Landmark className="h-3.5 w-3.5" />
          </span>
        </div>
        <div
          className={`text-[17px] font-bold tracking-tight tabular-nums leading-tight ${
            allTimeBalance >= 0 ? "text-[#7A5E31]" : "text-rose-600"
          }`}
        >
          {formatTZS(allTimeBalance)}
        </div>
        <div className="mt-1.5 text-[11px] font-medium text-slate-500">
          All-time carry-over pool
        </div>
      </div>
    </div>
  );
}

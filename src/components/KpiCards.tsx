import {
  ArrowDownLeft,
  ArrowUpRight,
  Clock,
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
  weeklyBudgetTarget: number;
  spentDeltaPct: number | null;
  contributedDeltaPct: number | null;
}

function DeltaLabel({ pct, invertGood = false }: { pct: number | null; invertGood?: boolean }) {
  if (pct === null) {
    return <span className="text-[11px] font-medium text-slate-400">No data last week</span>;
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
      <span className="text-slate-500 font-normal">From last week</span>
    </span>
  );
}

export function KpiCards({
  totalSpent,
  totalContributed,
  remainingBalance,
  weeklyBudgetTarget,
  spentDeltaPct,
  contributedDeltaPct,
}: KpiCardsProps) {
  const budgetProgress =
    weeklyBudgetTarget > 0 ? Math.min(100, Math.round((totalContributed / weeklyBudgetTarget) * 100)) : 0;

  return (
    <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1 -mx-4 px-4">
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
          <DeltaLabel pct={spentDeltaPct} invertGood />
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
          <DeltaLabel pct={contributedDeltaPct} />
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
          <span>{budgetProgress}% of weekly goal</span>
        </div>
      </div>
    </div>
  );
}

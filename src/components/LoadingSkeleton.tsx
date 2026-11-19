import { useEffect, useState } from "react";
import { RotateCw } from "lucide-react";

interface LoadingSkeletonProps {
  onRetry?: () => void;
}

export function LoadingSkeleton({ onRetry }: LoadingSkeletonProps) {
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setSlow(true), 4500);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-dvh px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-10">
      <div className="mx-auto w-full max-w-[440px] space-y-4">
        {/* Header Skeleton */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-slate-200/80 animate-pulse" />
            <div className="space-y-1.5">
              <div className="h-4 w-32 rounded-full bg-slate-200/80 animate-pulse" />
              <div className="h-2.5 w-24 rounded-full bg-slate-200/60 animate-pulse" />
            </div>
          </div>
          <div className="h-8 w-24 rounded-full bg-slate-200/70 animate-pulse" />
        </div>

        {/* Slow Network / Free-Tier Wakeup Banner */}
        {slow && (
          <div className="flex items-center justify-between gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-800">
            <span>Taking longer than usual — waking up server or reconnecting...</span>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-amber-900/10 px-2.5 py-1 font-semibold text-amber-900 hover:bg-amber-900/20 cursor-pointer"
              >
                <RotateCw className="h-3 w-3" />
                Retry
              </button>
            )}
          </div>
        )}

        {/* KPI Cards Skeleton */}
        <div className="grid grid-cols-2 gap-3">
          <div className="h-[92px] rounded-2xl border border-[#F3CFAF]/60 bg-[#FFF8F2]/80 p-3.5 animate-pulse space-y-2.5">
            <div className="h-3 w-14 rounded-full bg-orange-200/60" />
            <div className="h-5 w-24 rounded-full bg-orange-200/80" />
            <div className="h-2.5 w-20 rounded-full bg-orange-200/50" />
          </div>
          <div className="h-[92px] rounded-2xl border border-[#B8D7F8]/60 bg-[#F2F8FF]/80 p-3.5 animate-pulse space-y-2.5">
            <div className="h-3 w-20 rounded-full bg-blue-200/60" />
            <div className="h-5 w-24 rounded-full bg-blue-200/80" />
            <div className="h-2.5 w-20 rounded-full bg-blue-200/50" />
          </div>
        </div>

        {/* Weekly Chart Card Skeleton */}
        <div className="rounded-[24px] border border-slate-100 bg-white p-4 shadow-2xs space-y-3 animate-pulse">
          <div className="flex justify-between">
            <div className="h-4 w-32 rounded-full bg-slate-200/80" />
            <div className="h-3 w-16 rounded-full bg-slate-200/60" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="h-12 rounded-xl bg-slate-100" />
            <div className="h-12 rounded-xl bg-slate-100" />
          </div>
          <div className="flex items-end justify-between gap-3 h-[150px] px-2 pt-4">
            {[45, 78, 62, 92, 55, 34, 48].map((h, i) => (
              <div key={i} className="flex-1 flex items-end gap-1 h-full">
                <div className="flex-1 rounded-t-md bg-slate-200/70" style={{ height: `${h}%` }} />
                <div
                  className="flex-1 rounded-t-md bg-slate-100"
                  style={{ height: `${Math.max(20, h - 18)}%` }}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Recent Transactions Skeleton */}
        <div className="rounded-[24px] border border-slate-100 bg-white p-4 shadow-2xs space-y-3 animate-pulse">
          <div className="h-4 w-36 rounded-full bg-slate-200/80" />
          {[0, 1, 2].map((row) => (
            <div
              key={row}
              className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50/70 p-3"
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-slate-200/80" />
                <div className="space-y-1.5">
                  <div className="h-3.5 w-24 rounded-full bg-slate-200/80" />
                  <div className="h-2.5 w-28 rounded-full bg-slate-200/60" />
                </div>
              </div>
              <div className="space-y-1.5 flex flex-col items-end">
                <div className="h-3.5 w-20 rounded-full bg-slate-200/80" />
                <div className="h-4 w-24 rounded-md bg-slate-200/60" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

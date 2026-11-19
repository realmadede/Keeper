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
            <div className="h-9 w-9 rounded-xl bg-stone-200/80 animate-pulse" />
            <div className="space-y-1.5">
              <div className="h-4 w-32 rounded-md bg-stone-200/80 animate-pulse" />
              <div className="h-2.5 w-24 rounded-md bg-stone-200/60 animate-pulse" />
            </div>
          </div>
          <div className="h-8 w-24 rounded-xl bg-stone-200/70 animate-pulse" />
        </div>

        {/* Slow Network / Free-Tier Wakeup Banner */}
        {slow && (
          <div className="flex items-center justify-between gap-2 rounded-xl border border-stone-900/10 bg-white px-3.5 py-2.5 text-xs text-[#52525B]">
            <span>Taking longer than usual — waking up server or reconnecting</span>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-[#1C1C1E] px-2.5 py-1 font-medium text-white hover:bg-[#2C2C30] transition-colors cursor-pointer"
              >
                <RotateCw className="h-3 w-3" />
                Retry
              </button>
            )}
          </div>
        )}

        {/* 2x2 KPI Cards Skeleton */}
        <div className="grid grid-cols-2 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-[88px] rounded-2xl border border-stone-900/[0.08] bg-white p-4 animate-pulse space-y-2"
            >
              <div className="h-3 w-16 rounded-md bg-stone-200/70" />
              <div className="h-5 w-24 rounded-md bg-stone-200/90" />
              <div className="h-2.5 w-20 rounded-md bg-stone-100" />
            </div>
          ))}
        </div>

        {/* Weekly Chart Card Skeleton */}
        <div className="rounded-2xl border border-stone-900/[0.08] bg-white p-4 space-y-3 animate-pulse">
          <div className="flex justify-between">
            <div className="h-4 w-32 rounded-md bg-stone-200/80" />
            <div className="h-3 w-16 rounded-md bg-stone-200/60" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="h-12 rounded-xl bg-[#F6F5F2]" />
            <div className="h-12 rounded-xl bg-[#F6F5F2]" />
          </div>
          <div className="flex items-end justify-between gap-3 h-[150px] px-2 pt-4">
            {[45, 78, 62, 92, 55, 34, 48].map((h, i) => (
              <div key={i} className="flex-1 flex items-end gap-1 h-full">
                <div className="flex-1 rounded-t-sm bg-stone-200/80" style={{ height: `${h}%` }} />
                <div
                  className="flex-1 rounded-t-sm bg-stone-100"
                  style={{ height: `${Math.max(20, h - 18)}%` }}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Recent Transactions Skeleton */}
        <div className="rounded-2xl border border-stone-900/[0.08] bg-white p-4 space-y-3 animate-pulse">
          <div className="h-4 w-36 rounded-md bg-stone-200/80" />
          <div className="divide-y divide-stone-900/[0.06]">
            {[0, 1, 2].map((row) => (
              <div key={row} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-stone-200/80" />
                  <div className="space-y-1.5">
                    <div className="h-3.5 w-24 rounded-md bg-stone-200/80" />
                    <div className="h-2.5 w-28 rounded-md bg-stone-200/60" />
                  </div>
                </div>
                <div className="space-y-1.5 flex flex-col items-end">
                  <div className="h-3.5 w-20 rounded-md bg-stone-200/80" />
                  <div className="h-2.5 w-24 rounded-md bg-stone-100" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

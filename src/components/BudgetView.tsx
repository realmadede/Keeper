import { useState, type FormEvent } from "react";
import { Button, Input } from "glisse";
import { Check, CheckCircle2, Share2, Target } from "lucide-react";
import type { WeeklySummary, WeekWindow } from "../lib/analytics";
import { buildWeeklyWhatsAppSummary } from "../lib/export";
import { formatTZS, getInitials } from "../lib/format";
import type { Household } from "../types";

interface BudgetViewProps {
  household: Household;
  weekWindow: WeekWindow;
  summary: WeeklySummary;
  onUpdateBudget: (weeklyBudget: number, memberShare: number) => Promise<void>;
}

export function BudgetView({
  household,
  weekWindow,
  summary,
  onUpdateBudget,
}: BudgetViewProps) {
  const [weeklyTarget, setWeeklyTarget] = useState(String(household.weekly_budget_target));
  const [memberShare, setMemberShare] = useState(String(household.member_weekly_share));
  const [saving, setSaving] = useState(false);
  const [savedToast, setSavedToast] = useState(false);
  const [copiedSummary, setCopiedSummary] = useState(false);

  const poolPct =
    household.weekly_budget_target > 0
      ? Math.min(100, Math.round((summary.totalContributed / household.weekly_budget_target) * 100))
      : 0;

  const spentPct =
    household.weekly_budget_target > 0
      ? Math.min(100, Math.round((summary.totalSpent / household.weekly_budget_target) * 100))
      : 0;

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    const t = Math.max(0, Number(weeklyTarget) || 0);
    const s = Math.max(0, Number(memberShare) || 0);
    setSaving(true);
    try {
      await onUpdateBudget(t, s);
      setSavedToast(true);
      setTimeout(() => setSavedToast(false), 2200);
    } finally {
      setSaving(false);
    }
  };

  const handleShareSummary = async () => {
    const text = buildWeeklyWhatsAppSummary(household, weekWindow, summary);
    try {
      await navigator.clipboard.writeText(text);
      setCopiedSummary(true);
      setTimeout(() => setCopiedSummary(false), 2400);
    } catch {
      // Fallback: try native Web Share if clipboard denied
      if (navigator.share) {
        await navigator.share({ title: `${household.name} Weekly Summary`, text }).catch(() => {});
      }
    }
  };

  return (
    <div className="space-y-4">
      {/* Weekly Pool Progress Card */}
      <section className="rounded-[24px] border border-slate-100 bg-white p-4 shadow-[0_2px_16px_rgba(15,23,42,0.04)]">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-[15px] font-semibold text-slate-900">Weekly Household Pool</h2>
            <p className="text-xs text-slate-500">
              Agreed target: {formatTZS(household.weekly_budget_target)}
            </p>
          </div>
          <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#FFF8F2] text-[#BFA377]">
            <Target className="h-5 w-5" />
          </span>
        </div>

        <div className="space-y-3">
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="font-medium text-slate-600">Contributed this week</span>
              <span className="font-bold text-emerald-700 tabular-nums">
                {formatTZS(summary.totalContributed)} ({poolPct}%)
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                style={{ width: `${poolPct}%` }}
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="font-medium text-slate-600">Spent vs. weekly budget</span>
              <span className="font-bold text-orange-600 tabular-nums">
                {formatTZS(summary.totalSpent)} ({spentPct}%)
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-orange-500 transition-all duration-300"
                style={{ width: `${spentPct}%` }}
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-2xl border border-[#E5D3B3]/80 bg-[#FBF8F1] px-3 py-2 text-xs">
            <span className="font-medium text-slate-600">Cash on Hand (Carry-Over)</span>
            <span
              className={`font-bold tabular-nums ${
                summary.allTimeBalance >= 0 ? "text-[#7A5E31]" : "text-rose-600"
              }`}
            >
              {formatTZS(summary.allTimeBalance)}
            </span>
          </div>
        </div>

        {/* 1-Tap WhatsApp Summary Copy */}
        <div className="mt-3.5 pt-3 border-t border-slate-100">
          <Button
            onClick={() => void handleShareSummary()}
            icon={
              copiedSummary ? (
                <Check className="h-4 w-4 text-emerald-600" />
              ) : (
                <Share2 className="h-4 w-4" />
              )
            }
            className="w-full justify-center !h-10 text-xs font-semibold"
          >
            {copiedSummary ? "Copied Summary for WhatsApp" : "Copy Weekly Summary for WhatsApp"}
          </Button>
        </div>
      </section>

      {/* Member Accountability Breakdown */}
      <section className="rounded-[24px] border border-slate-100 bg-white p-4 shadow-[0_2px_16px_rgba(15,23,42,0.04)]">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[15px] font-semibold text-slate-900">Member Contributions</h2>
          <span className="text-[11px] font-medium text-slate-500 tabular-nums">
            Share: {formatTZS(household.member_weekly_share)}/wk
          </span>
        </div>

        <div className="space-y-3">
          {summary.memberStatuses.map((status) => {
            const done =
              status.contributedThisWeek >= status.expectedShare && status.expectedShare > 0;
            const partial = status.contributedThisWeek > 0 && !done;
            return (
              <div
                key={status.member.user_id}
                className="rounded-2xl border border-slate-100 bg-[#FAFBFD] p-3"
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                      style={{ backgroundColor: status.member.profile.avatar_color }}
                    >
                      {getInitials(status.member.profile.full_name)}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-[13px] font-semibold text-slate-900">
                        {status.member.profile.full_name}
                      </div>
                      <div className="text-[11px] text-slate-500 tabular-nums">
                        {formatTZS(status.contributedThisWeek)} / {formatTZS(status.expectedShare)}
                      </div>
                    </div>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                      done
                        ? "bg-emerald-50 text-emerald-700"
                        : partial
                          ? "bg-amber-50 text-amber-700"
                          : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {done ? "Paid" : partial ? "Partial" : "Pending"}
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${status.percentOfShare}%`,
                      backgroundColor: done ? "#22C55E" : partial ? "#F59E0B" : "#CBD5E1",
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Edit Shared Weekly Budget */}
      <section className="rounded-[24px] border border-slate-100 bg-white p-4 shadow-[0_2px_16px_rgba(15,23,42,0.04)]">
        <h2 className="text-[15px] font-semibold text-slate-900 mb-1">Update Weekly Budget</h2>
        <p className="text-xs text-slate-500 mb-3">
          Changes sync immediately across everyone in {household.name}.
        </p>

        <form onSubmit={(e) => void handleSave(e)} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Total Weekly Budget (TZS)
            </label>
            <Input
              type="number"
              min="0"
              step="1000"
              value={weeklyTarget}
              onValueChange={setWeeklyTarget}
              icon={<span className="text-xs font-bold text-slate-500">TZS</span>}
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Expected Share per Member (TZS)
            </label>
            <Input
              type="number"
              min="0"
              step="1000"
              value={memberShare}
              onValueChange={setMemberShare}
              icon={<span className="text-xs font-bold text-slate-500">TZS</span>}
              className="w-full"
            />
          </div>

          <Button
            type="submit"
            variant="filled"
            disabled={saving}
            className="w-full justify-center !h-10 text-xs font-semibold"
          >
            {saving ? "Updating..." : "Save Shared Budget"}
          </Button>

          {savedToast && (
            <div className="flex items-center justify-center gap-1.5 text-xs font-medium text-emerald-600">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Weekly budget updated!
            </div>
          )}
        </form>
      </section>
    </div>
  );
}

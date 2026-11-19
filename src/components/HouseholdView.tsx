import { useState } from "react";
import { Button, Glass } from "glisse";
import { Check, Copy, LogOut, Radio, Shield, Users } from "lucide-react";
import { getInitials } from "../lib/format";
import type { Household, HouseholdMember, Profile } from "../types";

interface HouseholdViewProps {
  household: Household;
  profile: Profile;
  members: HouseholdMember[];
  isDemoMode: boolean;
  realtimeConnected: boolean;
  onLeaveHousehold: () => Promise<void>;
  onSignOut: () => Promise<void>;
}

export function HouseholdView({
  household,
  profile,
  members,
  isDemoMode,
  realtimeConnected,
  onLeaveHousehold,
  onSignOut,
}: HouseholdViewProps) {
  const [copied, setCopied] = useState(false);

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(household.invite_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback ignored if clipboard blocked
    }
  };

  return (
    <div className="space-y-4">
      {/* Household Identity & Invite Code */}
      <section className="rounded-[24px] border border-slate-100 bg-white p-4 shadow-[0_2px_16px_rgba(15,23,42,0.04)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700">
              <Radio
                className={`h-3 w-3 ${
                  isDemoMode
                    ? "text-amber-500"
                    : realtimeConnected
                      ? "text-emerald-500"
                      : "text-slate-400"
                }`}
              />
              {isDemoMode
                ? "Local Demo Mode"
                : realtimeConnected
                  ? "Live Sync Active"
                  : "Synced with Supabase"}
            </span>
            <h2 className="mt-2 text-lg font-bold text-slate-900">{household.name}</h2>
            <p className="text-xs text-slate-500">
              Currency: <strong>TZS</strong> · {members.length} members
            </p>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#FFF8F2] text-[#BFA377]">
            <Users className="h-5 w-5" />
          </div>
        </div>

        <Glass className="mt-4 flex items-center justify-between rounded-2xl border border-slate-200/70 px-3.5 py-3">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Private Invite Code
            </div>
            <div className="font-mono text-lg font-bold tracking-[0.2em] text-slate-900 mt-0.5">
              {household.invite_code}
            </div>
          </div>
          <Button
            onClick={() => void copyCode()}
            icon={copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
          >
            {copied ? "Copied" : "Copy"}
          </Button>
        </Glass>
        <p className="mt-2 text-[11px] text-slate-400">
          Share this code privately with roommates so they can join and see the shared budget.
        </p>
      </section>

      {/* Household Members */}
      <section className="rounded-[24px] border border-slate-100 bg-white p-4 shadow-[0_2px_16px_rgba(15,23,42,0.04)]">
        <h3 className="text-[15px] font-semibold text-slate-900 mb-3">Roommates</h3>
        <div className="space-y-2.5">
          {members.map((m) => (
            <div
              key={m.user_id}
              className="flex items-center justify-between rounded-2xl border border-slate-100 bg-[#FAFBFD] px-3 py-2.5"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                  style={{ backgroundColor: m.profile.avatar_color }}
                >
                  {getInitials(m.profile.full_name)}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-semibold text-slate-900">
                    {m.profile.full_name}
                    {m.user_id === profile.id && (
                      <span className="ml-1.5 text-[11px] font-normal text-slate-400">(You)</span>
                    )}
                  </div>
                  <div className="truncate text-[11px] text-slate-500">{m.profile.email}</div>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-semibold capitalize text-slate-600">
                {m.role === "admin" && <Shield className="h-2.5 w-2.5 text-[#BFA377]" />}
                {m.role}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Account Actions */}
      <section className="rounded-[24px] border border-slate-100 bg-white p-4 shadow-[0_2px_16px_rgba(15,23,42,0.04)] space-y-2.5">
        <div className="text-xs text-slate-500 mb-2">
          Signed in as <strong className="text-slate-800">{profile.full_name}</strong> ({profile.email})
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <Button
            onClick={() => void onSignOut()}
            icon={<LogOut className="h-4 w-4" />}
            className="w-full justify-center"
          >
            {isDemoMode ? "Exit Demo" : "Sign Out"}
          </Button>
          <Button
            destructive
            onClick={() => void onLeaveHousehold()}
            className="w-full justify-center"
          >
            {isDemoMode ? "Reset Demo" : "Leave House"}
          </Button>
        </div>
      </section>
    </div>
  );
}

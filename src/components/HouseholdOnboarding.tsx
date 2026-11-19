import { useEffect, useState, type FormEvent } from "react";
import { Glass, SegmentedControl } from "glisse";
import { Home, Key, LogOut } from "lucide-react";
import type { Profile } from "../types";
import { KeeperLogo } from "./KeeperLogo";
import { SoftButton, SoftInput } from "./LightControls";

interface HouseholdOnboardingProps {
  profile: Profile;
  initialInviteCode?: string | null;
  error: string | null;
  onCreate: (name: string, weeklyBudget: number, memberShare: number) => Promise<void>;
  onJoin: (code: string) => Promise<void>;
  onSignOut: () => Promise<void>;
}

export function HouseholdOnboarding({
  profile,
  initialInviteCode,
  error,
  onCreate,
  onJoin,
  onSignOut,
}: HouseholdOnboardingProps) {
  const [mode, setMode] = useState<"create" | "join">(initialInviteCode ? "join" : "create");
  const [houseName, setHouseName] = useState("");
  const [weeklyBudget, setWeeklyBudget] = useState("240000");
  const [memberShare, setMemberShare] = useState("60000");
  const [inviteCode, setInviteCode] = useState(initialInviteCode?.toUpperCase() ?? "");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (initialInviteCode) {
      setMode("join");
      setInviteCode(initialInviteCode.toUpperCase());
    }
  }, [initialInviteCode]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (mode === "create") {
        await onCreate(houseName, Number(weeklyBudget) || 0, Number(memberShare) || 0);
      } else {
        await onJoin(inviteCode);
      }
    } catch {
      // Handled by store error state
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-[420px] space-y-5">
        <div className="text-center">
          <KeeperLogo
            size={54}
            className="mx-auto mb-3 drop-shadow-[0_6px_16px_rgba(15,23,42,0.16)]"
          />
          <h1 className="text-xl font-bold text-slate-900">Welcome, {profile.full_name}</h1>
          <p className="mt-1 text-xs text-slate-500">
            Create your shared household or join your roommates with an invite code.
          </p>
        </div>

        <Glass className="rounded-[28px] !bg-white/85 p-5 shadow-[0_12px_36px_rgba(15,23,42,0.08)]">
          <div className="mb-5 flex justify-center">
            <SegmentedControl
              className="keeper-segmented-2"
              value={mode}
              onValueChange={(v) => setMode(v as "create" | "join")}
              items={[
                { value: "create", label: "Create House" },
                { value: "join", label: "Join with Code" },
              ]}
            />
          </div>

          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3.5">
            {mode === "create" ? (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Household Name
                  </label>
                  <SoftInput
                    type="text"
                    placeholder="e.g. Sinza House 14"
                    value={houseName}
                    onValueChange={setHouseName}
                    icon={<Home className="h-4 w-4 text-slate-400" />}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Weekly Budget Target (TZS)
                  </label>
                  <SoftInput
                    type="number"
                    min="0"
                    step="1000"
                    value={weeklyBudget}
                    onValueChange={setWeeklyBudget}
                    icon={<span className="text-xs font-bold text-slate-500">TZS</span>}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Weekly Share per Member (TZS)
                  </label>
                  <SoftInput
                    type="number"
                    min="0"
                    step="1000"
                    value={memberShare}
                    onValueChange={setMemberShare}
                    icon={<span className="text-xs font-bold text-slate-500">TZS</span>}
                    required
                  />
                </div>
              </>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Invite Code
                </label>
                <SoftInput
                  type="text"
                  placeholder="e.g. SNZ414KP"
                  value={inviteCode}
                  onValueChange={(v) => setInviteCode(v.toUpperCase())}
                  icon={<Key className="h-4 w-4 text-slate-400" />}
                  className="uppercase tracking-widest"
                  required
                />
              </div>
            )}

            {error && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
                {error}
              </div>
            )}

            <SoftButton
              type="submit"
              variant="filled"
              disabled={submitting}
              className="w-full !h-11 text-sm font-semibold"
            >
              {submitting
                ? "Setting up..."
                : mode === "create"
                  ? "Create Shared Household"
                  : "Join Household"}
            </SoftButton>
          </form>

          <div className="mt-4 flex justify-center">
            <button
              type="button"
              onClick={() => void onSignOut()}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-slate-700 cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign out
            </button>
          </div>
        </Glass>
      </div>
    </div>
  );
}

import { useEffect, useState, type FormEvent } from "react";
import { Glass, SegmentedControl } from "glisse";
import { Home, Key, LogOut } from "lucide-react";
import { formatTZS } from "../lib/format";
import { sanitizeInviteCode } from "../lib/security";
import type { Profile } from "../types";
import { KeeperLogo } from "./KeeperLogo";
import { SoftButton, SoftInput } from "./LightControls";

interface HouseholdOnboardingProps {
  profile: Profile;
  initialInviteCode?: string | null;
  error: string | null;
  onCreate: (name: string, weeklyBudget: number, memberShare: number) => Promise<void>;
  onJoin: (inviteCode: string) => Promise<void>;
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
  const [weeklyBudget, setWeeklyBudget] = useState("");
  const [memberShare, setMemberShare] = useState("");
  const [inviteInput, setInviteInput] = useState(initialInviteCode?.toUpperCase() ?? "");
  const [submitting, setSubmitting] = useState(false);

  const extractedCode = sanitizeInviteCode(inviteInput);
  const parsedBudget = Number(weeklyBudget.replace(/,/g, "").trim());
  const parsedShare = Number(memberShare.replace(/,/g, "").trim());

  useEffect(() => {
    if (initialInviteCode) {
      setMode("join");
      setInviteInput(initialInviteCode.toUpperCase());
    }
  }, [initialInviteCode]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (mode === "create") {
        await onCreate(
          houseName,
          Number.isFinite(parsedBudget) && parsedBudget > 0 ? parsedBudget : 0,
          Number.isFinite(parsedShare) && parsedShare > 0 ? parsedShare : 0,
        );
      } else {
        await onJoin(inviteInput);
      }
    } catch {
      // Handled by store error state
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-[400px] space-y-5">
        <div className="text-center">
          <KeeperLogo
            size={52}
            className="mx-auto mb-3 drop-shadow-[0_8px_18px_rgba(28,28,30,0.14)]"
          />
          <h1 className="text-xl font-semibold text-[#1C1C1E]">Set up your household</h1>
          <p className="mt-1 text-xs text-[#52525B]">
            {profile.full_name} · create a shared house or join with an invite code or link
          </p>
        </div>

        <Glass className="rounded-[20px] !bg-white/90 p-5 shadow-[0_8px_28px_rgba(28,28,30,0.06)]">
          <div className="mb-5 flex justify-center">
            <SegmentedControl
              className="keeper-segmented-2"
              value={mode}
              onValueChange={(v) => setMode(v as "create" | "join")}
              items={[
                { value: "create", label: "Create house" },
                { value: "join", label: "Join with code" },
              ]}
            />
          </div>

          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3.5">
            {mode === "create" ? (
              <>
                <div>
                  <label className="block text-xs font-medium text-[#52525B] mb-1">
                    Household name
                  </label>
                  <SoftInput
                    type="text"
                    placeholder="Sinza House 414"
                    value={houseName}
                    onValueChange={setHouseName}
                    icon={<Home className="h-4 w-4" />}
                    required
                  />
                </div>
                <div>
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <label className="block text-xs font-medium text-[#52525B]">
                      Weekly budget target (TZS)
                    </label>
                    {Number.isFinite(parsedBudget) && parsedBudget > 0 && (
                      <span className="text-xs font-medium text-[#8F703F] tabular-nums">
                        {formatTZS(parsedBudget)}
                      </span>
                    )}
                  </div>
                  <SoftInput
                    type="number"
                    inputMode="numeric"
                    min="0"
                    step="1000"
                    placeholder="0"
                    value={weeklyBudget}
                    onValueChange={setWeeklyBudget}
                    icon={<span className="font-mono text-xs font-medium text-[#8E8E93]">TZS</span>}
                  />
                </div>
                <div>
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <label className="block text-xs font-medium text-[#52525B]">
                      Weekly share per member (TZS)
                    </label>
                    {Number.isFinite(parsedShare) && parsedShare > 0 && (
                      <span className="text-xs font-medium text-[#8F703F] tabular-nums">
                        {formatTZS(parsedShare)}
                      </span>
                    )}
                  </div>
                  <SoftInput
                    type="number"
                    inputMode="numeric"
                    min="0"
                    step="1000"
                    placeholder="0"
                    value={memberShare}
                    onValueChange={setMemberShare}
                    icon={<span className="font-mono text-xs font-medium text-[#8E8E93]">TZS</span>}
                  />
                </div>
              </>
            ) : (
              <div>
                <div className="mb-1 flex items-center justify-between gap-2">
                  <label className="block text-xs font-medium text-[#52525B]">
                    Invite code or link
                  </label>
                  {extractedCode && inviteInput.includes("join=") && (
                    <span className="font-mono text-xs font-medium text-emerald-700">
                      Code: {extractedCode}
                    </span>
                  )}
                </div>
                <SoftInput
                  type="text"
                  placeholder="Paste invite code or link"
                  value={inviteInput}
                  onValueChange={setInviteInput}
                  icon={<Key className="h-4 w-4" />}
                  required
                />
                <p className="mt-1.5 text-[11px] text-[#8E8E93]">
                  Accepts an 8-character invite code or a full Keeper invite link
                </p>
              </div>
            )}

            {error && (
              <div className="rounded-xl border border-rose-700/20 bg-rose-50/70 px-3 py-2 text-xs font-medium text-rose-700">
                {error}
              </div>
            )}

            <SoftButton
              type="submit"
              variant="filled"
              disabled={submitting}
              className="w-full !h-11 text-sm font-medium"
            >
              {submitting
                ? "Setting up..."
                : mode === "create"
                  ? "Create household"
                  : "Join household"}
            </SoftButton>
          </form>

          <div className="mt-4 pt-3 border-t border-stone-900/[0.06] text-center">
            <button
              type="button"
              onClick={() => void onSignOut()}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[#8E8E93] hover:text-[#1C1C1E] transition-colors cursor-pointer"
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

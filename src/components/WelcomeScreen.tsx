import { Button, Glass } from "glisse";
import { ShieldCheck, Sparkles, Users, Wallet } from "lucide-react";
import { KeeperLogo } from "./KeeperLogo";

interface WelcomeScreenProps {
  isSupabaseReady: boolean;
  onSignUp: () => void;
  onSignIn: () => void;
  onEnterDemo: () => void;
}

export function WelcomeScreen({
  isSupabaseReady,
  onSignUp,
  onSignIn,
  onEnterDemo,
}: WelcomeScreenProps) {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-[400px] space-y-5">
        <Glass className="rounded-[32px] !bg-white/85 p-6 shadow-[0_14px_40px_rgba(15,23,42,0.08)] space-y-6">
          {/* Identity */}
          <div className="text-center space-y-2.5">
            <KeeperLogo
              size={64}
              className="mx-auto drop-shadow-[0_10px_22px_rgba(15,23,42,0.18)]"
            />
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Keeper</h1>
              <p className="mt-1 text-xs font-medium text-slate-500">
                One household, one shared budget, complete transparency.
              </p>
            </div>
          </div>

          {/* Short plain-English explanation */}
          <p className="text-center text-[13px] leading-relaxed text-slate-600">
            A private shared ledger for roommates living together — stay in sync on weekly TZS
            contributions, household purchases, recurring bills, and what the house needs.
          </p>

          {/* 3 Quiet Apple-Style Feature Rows */}
          <div className="space-y-2.5 border-y border-slate-100 py-4">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#FBF8F1] text-[#8F703F]">
                <Wallet className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-slate-900">One shared pool</div>
                <p className="text-[11px] leading-snug text-slate-500">
                  Set a weekly budget in TZS and see who has contributed and what remains.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                <Users className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-slate-900">Real-time transparency</div>
                <p className="text-[11px] leading-snug text-slate-500">
                  Every expense shows who recorded it, what it was for, and syncs live to everyone.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                <ShieldCheck className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-slate-900">Private per household</div>
                <p className="text-[11px] leading-snug text-slate-500">
                  Each house is isolated with its own invite code. Not personal finance, no ads.
                </p>
              </div>
            </div>
          </div>

          {/* Primary Actions */}
          <div className="space-y-2.5">
            <Button
              variant="filled"
              onClick={onSignUp}
              className="w-full justify-center !h-11 text-sm font-semibold"
            >
              Sign Up
            </Button>

            <Button
              onClick={onSignIn}
              className="w-full justify-center !h-10 text-xs font-semibold"
            >
              Sign In
            </Button>

            {!isSupabaseReady && (
              <button
                type="button"
                onClick={onEnterDemo}
                className="mx-auto flex items-center justify-center gap-1.5 pt-1 text-[11px] font-semibold text-slate-500 hover:text-slate-900 cursor-pointer"
              >
                <Sparkles className="h-3.5 w-3.5 text-[#BFA377]" />
                Preview Demo Household
              </button>
            )}
          </div>
        </Glass>
      </div>
    </div>
  );
}

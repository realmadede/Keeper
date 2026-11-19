import { useState } from "react";
import { Button, Glass } from "glisse";
import { ShieldCheck, Smartphone, Sparkles, Users, Wallet } from "lucide-react";
import { KeeperLogo } from "./KeeperLogo";
import { LegalModal, type LegalDocType } from "./LegalModal";

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
  const [legalDoc, setLegalDoc] = useState<LegalDocType | null>(null);

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-[400px] space-y-4">
        <Glass className="rounded-[32px] !bg-white/85 p-6 shadow-[0_14px_40px_rgba(15,23,42,0.08)] space-y-5">
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

          {/* Compact 3-Step Flow */}
          <div className="grid grid-cols-3 gap-1.5 rounded-2xl border border-slate-100 bg-slate-50/80 p-2 text-center">
            <div className="px-1 py-1">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[#8F703F]">
                1. House
              </div>
              <div className="mt-0.5 text-[11px] font-medium leading-tight text-slate-700">
                Create or join
              </div>
            </div>
            <div className="border-x border-slate-200/70 px-1 py-1">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[#8F703F]">
                2. Record
              </div>
              <div className="mt-0.5 text-[11px] font-medium leading-tight text-slate-700">
                Pool & spend TZS
              </div>
            </div>
            <div className="px-1 py-1">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[#8F703F]">
                3. Sync
              </div>
              <div className="mt-0.5 text-[11px] font-medium leading-tight text-slate-700">
                See live balance
              </div>
            </div>
          </div>

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

          {/* Plain "Not a bank" reassurance */}
          <p className="rounded-2xl bg-slate-50/90 px-3 py-2 text-center text-[11px] leading-snug text-slate-500">
            Keeper only tracks shared house records — it never links to M-Pesa, bank accounts, or
            moves real money.
          </p>

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

          {/* Install Tip & Quiet Legal Links */}
          <div className="space-y-2 border-t border-slate-100 pt-3 text-center">
            <p className="inline-flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
              <Smartphone className="h-3 w-3 shrink-0" />
              <span>Works best added to your phone&apos;s Home Screen.</span>
            </p>
            <div className="flex items-center justify-center gap-3 text-[11px] text-slate-400">
              <button
                type="button"
                onClick={() => setLegalDoc("terms")}
                className="underline underline-offset-2 hover:text-slate-700 cursor-pointer"
              >
                Terms of Service
              </button>
              <span>·</span>
              <button
                type="button"
                onClick={() => setLegalDoc("privacy")}
                className="underline underline-offset-2 hover:text-slate-700 cursor-pointer"
              >
                Privacy Policy
              </button>
            </div>
          </div>
        </Glass>
      </div>

      <LegalModal doc={legalDoc} onClose={() => setLegalDoc(null)} />
    </div>
  );
}

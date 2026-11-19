import { useState } from "react";
import { Glass } from "glisse";
import { ArrowRight, ShieldCheck, Smartphone, Users, Wallet } from "lucide-react";
import { KeeperLogo } from "./KeeperLogo";
import { LegalModal, type LegalDocType } from "./LegalModal";
import { SoftButton } from "./LightControls";

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
        <Glass className="rounded-[20px] !bg-white/90 p-6 shadow-[0_8px_28px_rgba(28,28,30,0.06)] space-y-5">
          {/* Identity */}
          <div className="text-center space-y-2.5">
            <KeeperLogo
              size={60}
              className="mx-auto drop-shadow-[0_8px_18px_rgba(28,28,30,0.14)]"
            />
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-[#1C1C1E]">Keeper</h1>
              <p className="mt-1 text-xs font-medium text-[#52525B]">
                One household, one shared budget, complete transparency.
              </p>
            </div>
          </div>

          {/* Short plain-English explanation */}
          <p className="text-center text-sm leading-relaxed text-[#52525B]">
            A private shared ledger for roommates living together — stay in sync on weekly TZS
            contributions, household purchases, recurring bills, and what the house needs.
          </p>

          {/* Compact 3-Step Flow (Sentence Case, 4px Grid) */}
          <div className="grid grid-cols-3 gap-2 rounded-xl border border-stone-900/[0.08] bg-[#F6F5F2] p-2.5 text-center">
            <div className="px-1">
              <div className="text-xs font-semibold text-[#8F703F]">1. House</div>
              <div className="mt-0.5 text-[11px] text-[#52525B]">Create or join</div>
            </div>
            <div className="border-x border-stone-900/[0.08] px-1">
              <div className="text-xs font-semibold text-[#8F703F]">2. Record</div>
              <div className="mt-0.5 text-[11px] text-[#52525B]">Pool & spend TZS</div>
            </div>
            <div className="px-1">
              <div className="text-xs font-semibold text-[#8F703F]">3. Sync</div>
              <div className="mt-0.5 text-[11px] text-[#52525B]">See live balance</div>
            </div>
          </div>

          {/* 3 Quiet Feature Rows — Uniform 16px Line Icons in Muted Ink */}
          <div className="space-y-3 border-y border-stone-900/[0.06] py-4">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex w-5 shrink-0 items-center justify-center text-[#52525B]">
                <Wallet className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-[#1C1C1E]">One shared pool</div>
                <p className="text-xs leading-snug text-[#52525B] mt-0.5">
                  Set a weekly budget in TZS and see who has contributed and what remains
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex w-5 shrink-0 items-center justify-center text-[#52525B]">
                <Users className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-[#1C1C1E]">Real-time transparency</div>
                <p className="text-xs leading-snug text-[#52525B] mt-0.5">
                  Every expense shows who recorded it, what it was for, and syncs live to everyone
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex w-5 shrink-0 items-center justify-center text-[#52525B]">
                <ShieldCheck className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-[#1C1C1E]">Private per household</div>
                <p className="text-xs leading-snug text-[#52525B] mt-0.5">
                  Each house is isolated with its own invite key — no personal banking, no ads
                </p>
              </div>
            </div>
          </div>

          {/* Plain "Not a bank" note */}
          <p className="rounded-xl bg-[#F6F5F2] px-3 py-2 text-center text-[11px] leading-snug text-[#52525B]">
            Keeper only tracks shared house records — it never links to M-Pesa, bank accounts, or
            moves real money
          </p>

          {/* Primary Actions */}
          <div className="space-y-2">
            <SoftButton
              variant="filled"
              onClick={onSignUp}
              className="w-full !h-11 text-sm font-medium"
            >
              Create account
            </SoftButton>

            <SoftButton
              onClick={onSignIn}
              className="w-full !h-10 text-xs font-medium"
            >
              Sign in
            </SoftButton>

            {!isSupabaseReady && (
              <button
                type="button"
                onClick={onEnterDemo}
                className="mx-auto flex items-center justify-center gap-1.5 pt-1 text-xs font-medium text-[#52525B] hover:text-[#1C1C1E] transition-colors cursor-pointer"
              >
                <span>Preview demo household</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Install Tip & Quiet Legal Links */}
          <div className="space-y-2 border-t border-stone-900/[0.06] pt-3 text-center">
            <p className="inline-flex items-center justify-center gap-1.5 text-[11px] text-[#8E8E93]">
              <Smartphone className="h-3.5 w-3.5 shrink-0" />
              <span>Works best added to your phone&apos;s Home Screen</span>
            </p>
            <div className="flex items-center justify-center gap-3 text-[11px] text-[#8E8E93]">
              <button
                type="button"
                onClick={() => setLegalDoc("terms")}
                className="underline underline-offset-2 hover:text-[#1C1C1E] transition-colors cursor-pointer"
              >
                Terms of Service
              </button>
              <span>·</span>
              <button
                type="button"
                onClick={() => setLegalDoc("privacy")}
                className="underline underline-offset-2 hover:text-[#1C1C1E] transition-colors cursor-pointer"
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

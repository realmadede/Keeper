import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, Download, Key, ShieldCheck, Smartphone, Users, Wallet } from "lucide-react";
import { sanitizeInviteCode } from "../lib/security";
import { KeeperLogo } from "./KeeperLogo";
import { LegalModal, type LegalDocType } from "./LegalModal";
import { SoftButton, SoftInput } from "./LightControls";

const ANDROID_APK_URL =
  import.meta.env.VITE_ANDROID_APK_URL ||
  "https://github.com/realmadede/Keeper/releases/latest/download/Keeper.apk";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface WelcomeScreenProps {
  isSupabaseReady: boolean;
  onSignUp: () => void;
  onSignIn: () => void;
  onJoinWithCode: (cleanCode: string) => void;
  onEnterDemo: () => void;
}

export function WelcomeScreen({
  isSupabaseReady,
  onSignUp,
  onSignIn,
  onJoinWithCode,
  onEnterDemo,
}: WelcomeScreenProps) {
  const [legalDoc, setLegalDoc] = useState<LegalDocType | null>(null);
  const [inviteInput, setInviteInput] = useState("");
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallGuide, setShowInstallGuide] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const standalone =
      window.matchMedia?.("(display-mode: standalone)")?.matches ||
      Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);
    setIsStandalone(standalone);

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);

  const handleInviteSubmit = (e: FormEvent) => {
    e.preventDefault();
    setInviteError(null);
    const clean = sanitizeInviteCode(inviteInput);
    if (!clean) {
      setInviteError("Enter a valid 6-12 character invite key or link");
      return;
    }
    onJoinWithCode(clean);
  };

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice.catch(() => null);
      if (choice?.outcome === "accepted") {
        setDeferredPrompt(null);
        setIsStandalone(true);
      }
      return;
    }
    setShowInstallGuide((v) => !v);
  };

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-[400px] space-y-4">
        <div className="rounded-[20px] border border-stone-900/[0.08] bg-white/95 p-6 shadow-[0_8px_28px_rgba(28,28,30,0.06)] backdrop-blur-md space-y-5">
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

          {/* Direct "Have an invite key or link?" Quick Entry */}
          <form
            onSubmit={handleInviteSubmit}
            className="rounded-xl border border-stone-900/[0.08] bg-[#F6F5F2] p-3 space-y-2"
          >
            <label className="block text-xs font-medium text-[#1C1C1E]">
              Have a household invite key or link?
            </label>
            <div className="flex items-center gap-2">
              <SoftInput
                type="text"
                placeholder="Paste invite code or link"
                value={inviteInput}
                onValueChange={(v) => {
                  setInviteInput(v);
                  if (inviteError) setInviteError(null);
                }}
                icon={<Key className="h-4 w-4" />}
                className="flex-1"
              />
              <SoftButton
                type="submit"
                variant="filled"
                className="shrink-0 !h-10 !px-3.5 text-xs font-medium"
              >
                Join
              </SoftButton>
            </div>
            {inviteError && (
              <p className="text-[11px] font-medium text-rose-700">{inviteError}</p>
            )}
          </form>

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

          {/* Android APK Download, 1-Tap PWA Install Prompt & Quiet Legal Links */}
          <div className="space-y-2.5 border-t border-stone-900/[0.06] pt-3 text-center">
            <div className="flex flex-wrap items-center justify-center gap-2">
              <a
                href={ANDROID_APK_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-stone-900/10 bg-[#1C1C1E] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#2C2C30] transition-colors"
              >
                <Download className="h-3.5 w-3.5 text-[#E4CCA0]" />
                <span>Download for Android</span>
              </a>
              {!isStandalone && (
                <button
                  type="button"
                  onClick={() => void handleInstallClick()}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#F6F5F2] px-3 py-1.5 text-xs font-medium text-[#1C1C1E] hover:bg-stone-200/70 transition-colors cursor-pointer"
                >
                  {deferredPrompt ? (
                    <Download className="h-3.5 w-3.5 text-[#8F703F]" />
                  ) : (
                    <Smartphone className="h-3.5 w-3.5 text-[#8F703F]" />
                  )}
                  <span>Add to Home Screen</span>
                </button>
              )}
            </div>
            {!isStandalone && showInstallGuide && !deferredPrompt && (
              <div className="rounded-xl border border-stone-900/[0.08] bg-[#F6F5F2] p-2.5 text-left text-xs text-[#52525B] space-y-1">
                <div className="font-medium text-[#1C1C1E]">Install on your phone</div>
                <div>1. Tap the Share or browser menu button</div>
                <div>2. Select Add to Home Screen</div>
              </div>
            )}
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
        </div>
      </div>

      <LegalModal doc={legalDoc} onClose={() => setLegalDoc(null)} />
    </div>
  );
}

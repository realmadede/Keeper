import { Glass } from "glisse";
import { CheckCircle2, ShieldCheck, Sparkles, Wifi } from "lucide-react";
import { APP_VERSION } from "../lib/appUpdater";
import { KeeperLogo } from "./KeeperLogo";

interface WelcomeVersionModalProps {
  userName?: string | null;
  previousVersion: string | null;
  onContinue: () => void;
}

export function WelcomeVersionModal({
  userName,
  previousVersion,
  onContinue,
}: WelcomeVersionModalProps) {
  const firstName = userName?.trim().split(/\s+/)[0] || null;
  const isUpgrade = Boolean(previousVersion && previousVersion !== APP_VERSION);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 px-5 py-8">
      <Glass
        role="dialog"
        aria-modal="true"
        className="w-full max-w-[380px] rounded-[28px] p-6 shadow-[0_20px_50px_rgba(28,28,30,0.22)] space-y-5"
      >
        <div className="flex items-center justify-between">
          <KeeperLogo size={42} />
          <span className="inline-flex items-center gap-1 rounded-full border border-[#C6A87C]/35 bg-[#C6A87C]/15 px-2.5 py-1 font-mono text-[11px] font-semibold text-[#8F703F]">
            <Sparkles className="h-3 w-3" />
            {isUpgrade ? `v${previousVersion} -> v${APP_VERSION}` : `v${APP_VERSION}`}
          </span>
        </div>

        <div className="space-y-1.5">
          <h2 className="text-xl font-semibold tracking-tight text-[#1C1C1E]">
            {isUpgrade
              ? `Keeper updated to v${APP_VERSION}`
              : firstName
                ? `Welcome to Keeper, ${firstName}`
                : "Welcome to Keeper"}
          </h2>
          <p className="text-xs leading-relaxed text-[#52525B]">
            {isUpgrade
              ? "Your app is up to date and your household data is synced and ready."
              : `You are running Keeper v${APP_VERSION} for Android — built for private, transparent shared household budgets.`}
          </p>
        </div>

        <div className="rounded-2xl border border-stone-900/[0.08] bg-white p-3.5 space-y-2.5">
          <div className="flex items-start gap-2.5 text-xs text-[#1C1C1E]">
            <Wifi className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#8F703F]" />
            <span>Works offline — record expenses anytime and sync automatically when online.</span>
          </div>
          <div className="flex items-start gap-2.5 text-xs text-[#1C1C1E]">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#8F703F]" />
            <span>Optional 4-digit PIN &amp; fingerprint unlock available in Account settings.</span>
          </div>
          <div className="flex items-start gap-2.5 text-xs text-[#1C1C1E]">
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#8F703F]" />
            <span>Future updates install right inside Keeper with one tap.</span>
          </div>
        </div>

        <button
          type="button"
          onClick={onContinue}
          className="flex h-11 w-full items-center justify-center rounded-full bg-[#1C1C1E] px-5 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(28,28,30,0.15)] hover:bg-[#2C2C30] transition-colors cursor-pointer"
        >
          {isUpgrade ? "Continue" : "Start using Keeper"}
        </button>
      </Glass>
    </div>
  );
}

import { useRef, useState, type FormEvent, type TouchEvent } from "react";
import { ArrowRight, CalendarClock, Key, ShieldCheck, Wallet } from "lucide-react";
import { sanitizeInviteCode } from "../lib/security";
import { KeeperLogo } from "./KeeperLogo";
import { SoftButton, SoftInput } from "./LightControls";

interface AndroidOnboardingProps {
  onFinishToSignUp: () => void;
  onFinishToSignIn: () => void;
  onJoinWithCode: (cleanCode: string) => void;
  onEnterDemo: () => void;
}

const SLIDES = [
  {
    id: "pool",
    eyebrow: "Shared weekly pool",
    title: "One household, one shared budget",
    body: "Track weekly TZS contributions, house expenses, and live cash on hand so everyone always knows where the house stands.",
    icon: Wallet,
  },
  {
    id: "bills-needs",
    eyebrow: "Bills & house needs",
    title: "Split fairly, settle in one tap",
    body: "Keep rent, Wi-Fi, and shopping lists separate from weekly pool money — or apply leftover pool cash whenever the house decides.",
    icon: CalendarClock,
  },
  {
    id: "transparency",
    eyebrow: "Complete transparency",
    title: "Private, synced, built for roommates",
    body: "Every entry shows who recorded it, syncs live across phones, and rolls up into clear member totals. No bank links, no ads.",
    icon: ShieldCheck,
  },
] as const;

export function AndroidOnboarding({
  onFinishToSignUp,
  onFinishToSignIn,
  onJoinWithCode,
  onEnterDemo,
}: AndroidOnboardingProps) {
  const [step, setStep] = useState(0);
  const [showInviteBox, setShowInviteBox] = useState(false);
  const [inviteInput, setInviteInput] = useState("");
  const [inviteError, setInviteError] = useState<string | null>(null);
  const touchStartX = useRef<number | null>(null);

  const slide = SLIDES[step];
  const SlideIcon = slide.icon;
  const isLast = step === SLIDES.length - 1;

  const handleTouchStart = (e: TouchEvent<HTMLDivElement>) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: TouchEvent<HTMLDivElement>) => {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(dx) < 48) return;
    if (dx < 0 && step < SLIDES.length - 1) setStep((s) => s + 1);
    else if (dx > 0 && step > 0) setStep((s) => s - 1);
  };

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

  return (
    <div
      className="min-h-dvh flex flex-col justify-between px-5 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Top Bar: Brand + Skip */}
      <div className="mx-auto flex w-full max-w-[400px] items-center justify-between">
        <div className="flex items-center gap-2">
          <KeeperLogo size={30} />
          <span className="text-sm font-semibold tracking-tight text-[#1C1C1E]">Keeper</span>
        </div>
        {!isLast && (
          <button
            type="button"
            onClick={() => setStep(SLIDES.length - 1)}
            className="rounded-lg px-2.5 py-1 text-xs font-medium text-[#52525B] hover:text-[#1C1C1E] transition-colors cursor-pointer"
          >
            Skip
          </button>
        )}
      </div>

      {/* Center Slide Card */}
      <div className="mx-auto my-6 w-full max-w-[400px] space-y-5">
        <div className="rounded-[24px] border border-stone-900/[0.08] bg-white p-6 shadow-[0_8px_28px_rgba(28,28,30,0.06)] space-y-5">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#1C1C1E] text-[#E4CCA0] shadow-[0_6px_16px_rgba(28,28,30,0.14)]">
            <SlideIcon className="h-6 w-6" />
          </div>

          <div className="space-y-2">
            <div className="text-xs font-semibold text-[#8F703F]">{slide.eyebrow}</div>
            <h1 className="text-2xl font-semibold tracking-tight text-[#1C1C1E] leading-snug">
              {slide.title}
            </h1>
            <p className="text-sm leading-relaxed text-[#52525B]">{slide.body}</p>
          </div>

          {/* Step Dots */}
          <div className="flex items-center gap-1.5 pt-1">
            {SLIDES.map((s, idx) => (
              <button
                key={s.id}
                type="button"
                aria-label={`Go to slide ${idx + 1}`}
                onClick={() => setStep(idx)}
                className={`h-1.5 rounded-full transition-[width,background-color] duration-200 cursor-pointer ${
                  idx === step ? "w-6 bg-[#1C1C1E]" : "w-1.5 bg-stone-300"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Optional Invite Key Box */}
        {showInviteBox && (
          <form
            onSubmit={handleInviteSubmit}
            className="rounded-2xl border border-stone-900/[0.08] bg-white p-4 space-y-2.5"
          >
            <label className="block text-xs font-medium text-[#1C1C1E]">
              Enter household invite key or link
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
        )}
      </div>

      {/* Bottom Actions */}
      <div className="mx-auto w-full max-w-[400px] space-y-2.5">
        {!isLast ? (
          <SoftButton
            variant="filled"
            onClick={() => setStep((s) => Math.min(SLIDES.length - 1, s + 1))}
            className="w-full !h-12 text-sm font-medium"
          >
            <span>Continue</span>
            <ArrowRight className="ml-1.5 h-4 w-4" />
          </SoftButton>
        ) : (
          <>
            <SoftButton
              variant="filled"
              onClick={onFinishToSignUp}
              className="w-full !h-12 text-sm font-medium"
            >
              Get started
            </SoftButton>
            <SoftButton
              onClick={onFinishToSignIn}
              className="w-full !h-11 text-xs font-medium"
            >
              Sign in to existing account
            </SoftButton>
          </>
        )}

        <div className="flex items-center justify-center gap-4 pt-1 text-xs">
          <button
            type="button"
            onClick={() => setShowInviteBox((v) => !v)}
            className="font-medium text-[#8F703F] hover:text-[#1C1C1E] transition-colors cursor-pointer"
          >
            {showInviteBox ? "Hide invite key" : "Have an invite key?"}
          </button>
          <span className="text-stone-300">·</span>
          <button
            type="button"
            onClick={onEnterDemo}
            className="font-medium text-[#52525B] hover:text-[#1C1C1E] transition-colors cursor-pointer"
          >
            Try demo
          </button>
        </div>
      </div>
    </div>
  );
}

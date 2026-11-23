import { useState, type FormEvent } from "react";
import {
  Bug,
  Check,
  CheckCircle2,
  ChevronDown,
  Download,
  HelpCircle,
  Mail,
  RefreshCw,
  Share2,
  Star,
} from "lucide-react";
import {
  ANDROID_APK_URL,
  APP_VERSION,
  checkLatestRelease,
  type UpdateReleaseInfo,
} from "../lib/appUpdater";
import { SoftButton, SoftInput, SoftSegmented } from "./LightControls";

const DEVELOPER_EMAIL = "bagomwaraphael@gmail.com";
const SAVED_RATING_KEY = "keeper_user_rating_v1";

export interface AppFeedbackInput {
  kind: "rating" | "bug" | "feature";
  rating?: number | null;
  comment: string;
  platform: string;
  appVersion: string;
}

interface SupportAndAboutCardProps {
  onSubmitFeedback: (input: AppFeedbackInput) => Promise<void>;
  onOpenUpdate?: (info: UpdateReleaseInfo) => void;
}

const FAQ_ITEMS = [
  {
    q: "Do recurring bills deduct from weekly contributions?",
    a: "No. Bills and house needs are kept separate from weekly pool money by default. They only deduct from Cash on hand if you turn on 'Use leftover pool money'.",
  },
  {
    q: "How does 'Use leftover pool money' work?",
    a: "When marking a bill paid or a need bought, turn on the leftover pool toggle and pick how much Cash on hand to apply. Only the remaining balance is split across roommates.",
  },
  {
    q: "How does 1-member payback work?",
    a: "If one roommate covers a bill or need alone, pick 'Paid by 1 member' (or 'Bought by 1 member'). Everyone else appears as a 1-tap chip to check off once they pay their share back.",
  },
  {
    q: "How do roommates join our household?",
    a: "Share your 8-character House Key, invite link, or QR code from the top of this tab. New roommates paste it on the welcome or onboarding screen to join automatically.",
  },
  {
    q: "How does offline mode work?",
    a: "Keeper caches your latest household data on your phone so it opens even without internet. Any new entries or needs you record offline are marked 'Pending sync' and upload automatically once you reconnect.",
  },
  {
    q: "What happens if we overspend our weekly budget?",
    a: "Keeper shows a red Overspent alert (and pops up a notification if alerts are enabled). By default, next week resets to your normal budget. Optionally, you can tap 'Cover in coming weeks' and choose either: (1) Trim spending limit — lowers your weekly spending target across the next 1, 2, or 4 weeks so the house spends less to recover; or (2) Add roommate top-up — spreads the overage equally as a small extra share per roommate. You can cancel a recovery plan at any time.",
  },
] as const;

function detectPlatform(): string {
  if (typeof window === "undefined") return "web";
  const cap = (window as unknown as { Capacitor?: { getPlatform?: () => string } }).Capacitor;
  if (cap?.getPlatform) return cap.getPlatform();
  return /Android/i.test(navigator.userAgent) ? "android-web" : "web";
}

export function SupportAndAboutCard({
  onSubmitFeedback,
  onOpenUpdate,
}: SupportAndAboutCardProps) {
  const platform = detectPlatform();
  const isNativeApp = platform === "android" || platform === "ios";

  // Rating state
  const [rating, setRating] = useState<number>(() => {
    try {
      const saved = Number(localStorage.getItem(SAVED_RATING_KEY));
      return saved >= 1 && saved <= 5 ? saved : 0;
    } catch {
      return 0;
    }
  });
  const [ratingNote, setRatingNote] = useState("");
  const [savingRating, setSavingRating] = useState(false);
  const [ratingSaved, setRatingSaved] = useState(false);

  // Bug / Feature form state
  const [showReportForm, setShowReportForm] = useState(false);
  const [reportKind, setReportKind] = useState<"bug" | "feature">("bug");
  const [reportText, setReportText] = useState("");
  const [sendingReport, setSendingReport] = useState(false);
  const [reportSent, setReportSent] = useState(false);

  // Update check state
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<
    | { state: "idle" }
    | { state: "up_to_date"; latest: string }
    | { state: "available"; latest: string; info: UpdateReleaseInfo }
    | { state: "error" }
  >({ state: "idle" });

  // Share, active action highlight & FAQ state
  const [activeAction, setActiveAction] = useState<"contact" | "report" | "update" | "share">(
    "contact",
  );
  const [sharedApp, setSharedApp] = useState(false);
  const [showFaq, setShowFaq] = useState(false);
  const [openFaqIdx, setOpenFaqIdx] = useState<number | null>(0);

  const contactMailto = `mailto:${DEVELOPER_EMAIL}?subject=${encodeURIComponent(
    `Keeper App Support (v${APP_VERSION})`,
  )}&body=${encodeURIComponent(
    `Hi Bagomwa,\n\nI'm reaching out from Keeper (v${APP_VERSION}, ${platform}):\n\n`,
  )}`;

  const handleSaveRating = async (e: FormEvent) => {
    e.preventDefault();
    if (rating < 1 || rating > 5) return;
    setSavingRating(true);
    try {
      await onSubmitFeedback({
        kind: "rating",
        rating,
        comment: ratingNote.trim(),
        platform,
        appVersion: APP_VERSION,
      });
      try {
        localStorage.setItem(SAVED_RATING_KEY, String(rating));
      } catch {
        // Ignore storage errors
      }
      setRatingNote("");
      setRatingSaved(true);
      setTimeout(() => setRatingSaved(false), 3000);
    } finally {
      setSavingRating(false);
    }
  };

  const handleSendReport = async (e: FormEvent) => {
    e.preventDefault();
    if (!reportText.trim()) return;
    setSendingReport(true);
    try {
      await onSubmitFeedback({
        kind: reportKind,
        rating: null,
        comment: reportText.trim(),
        platform,
        appVersion: APP_VERSION,
      });
      setReportText("");
      setReportSent(true);
      setShowReportForm(false);
      setTimeout(() => setReportSent(false), 3000);
    } finally {
      setSendingReport(false);
    }
  };

  const handleCheckUpdate = async () => {
    setCheckingUpdate(true);
    try {
      const info = await checkLatestRelease();
      if (info.hasUpdate) {
        setUpdateStatus({ state: "available", latest: info.latestVersion, info });
        if (onOpenUpdate) {
          onOpenUpdate(info);
        }
      } else {
        setUpdateStatus({ state: "up_to_date", latest: info.latestVersion });
      }
    } catch {
      setUpdateStatus({ state: "error" });
    } finally {
      setCheckingUpdate(false);
    }
  };

  const handleShareApp = async () => {
    const shareText = `Manage your shared house budget transparently with Keeper (TZS):\nAndroid APK: ${ANDROID_APK_URL}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: "Keeper — Shared Household Budget",
          text: shareText,
          url: ANDROID_APK_URL,
        });
        return;
      }
      await navigator.clipboard.writeText(shareText);
      setSharedApp(true);
      setTimeout(() => setSharedApp(false), 2200);
    } catch {
      // User cancelled share or clipboard blocked
    }
  };

  return (
    <section className="rounded-2xl border border-stone-900/[0.08] bg-white p-4 space-y-4">
      <div>
        <h3 className="text-base font-semibold text-[#1C1C1E]">Support & about</h3>
        <p className="text-xs text-[#52525B] mt-0.5">
          Rate Keeper, contact the developer, or check for app updates
        </p>
      </div>

      {/* 1. In-App Star Rating */}
      <form
        onSubmit={(e) => void handleSaveRating(e)}
        className="rounded-xl border border-stone-900/[0.08] bg-[#F6F5F2] p-3.5 space-y-2.5"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-[#1C1C1E]">Rate Keeper</span>
          {rating > 0 && (
            <span className="font-mono text-[11px] text-[#8F703F]">{rating} / 5</span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {[1, 2, 3, 4, 5].map((star) => {
            const active = star <= rating;
            return (
              <button
                key={star}
                type="button"
                aria-label={`Rate ${star} ${star === 1 ? "star" : "stars"}`}
                onClick={() => setRating(star)}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-stone-900/[0.08] bg-white transition-colors hover:border-[#C6A87C] cursor-pointer"
              >
                <Star
                  className={`h-4 w-4 ${
                    active ? "fill-[#C6A87C] text-[#C6A87C]" : "text-stone-300"
                  }`}
                />
              </button>
            );
          })}
        </div>
        {rating > 0 && (
          <div className="space-y-2 pt-0.5">
            <SoftInput
              type="text"
              maxLength={300}
              placeholder="Optional note (what do you like or want improved?)"
              value={ratingNote}
              onValueChange={setRatingNote}
            />
            <SoftButton
              type="submit"
              variant="filled"
              disabled={savingRating}
              className="w-full !h-9 text-xs font-medium"
            >
              {savingRating ? "Sending..." : "Submit rating"}
            </SoftButton>
          </div>
        )}
        {ratingSaved && (
          <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-700">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>Thanks for rating Keeper!</span>
          </div>
        )}
      </form>

      {/* 2. Direct Actions Grid: active obsidian black shifts to whichever button is tapped */}
      <div className="grid grid-cols-2 gap-2">
        <a
          href={contactMailto}
          onClick={() => setActiveAction("contact")}
          className={`inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-stone-900/10 px-3 text-xs font-medium transition-colors ${
            activeAction === "contact"
              ? "bg-[#1C1C1E] text-white hover:bg-[#2C2C30]"
              : "bg-[#F6F5F2] text-[#1C1C1E] hover:bg-stone-200/60"
          }`}
        >
          <Mail
            className={`h-3.5 w-3.5 shrink-0 ${
              activeAction === "contact" ? "text-[#E4CCA0]" : "text-[#52525B]"
            }`}
          />
          <span className="truncate">Contact developer</span>
        </a>

        <button
          type="button"
          onClick={() => {
            setActiveAction("report");
            setShowReportForm((v) => !v);
          }}
          className={`inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-stone-900/10 px-3 text-xs font-medium transition-colors cursor-pointer ${
            activeAction === "report"
              ? "bg-[#1C1C1E] text-white hover:bg-[#2C2C30]"
              : "bg-[#F6F5F2] text-[#1C1C1E] hover:bg-stone-200/60"
          }`}
        >
          <Bug
            className={`h-3.5 w-3.5 shrink-0 ${
              activeAction === "report" ? "text-[#E4CCA0]" : "text-[#52525B]"
            }`}
          />
          <span className="truncate">Report / Idea</span>
        </button>

        {isNativeApp ? (
          <button
            type="button"
            disabled={checkingUpdate}
            onClick={() => {
              setActiveAction("update");
              void handleCheckUpdate();
            }}
            className={`inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-stone-900/10 px-3 text-xs font-medium disabled:opacity-60 transition-colors cursor-pointer ${
              activeAction === "update"
                ? "bg-[#1C1C1E] text-white hover:bg-[#2C2C30]"
                : "bg-[#F6F5F2] text-[#1C1C1E] hover:bg-stone-200/60"
            }`}
          >
            <RefreshCw
              className={`h-3.5 w-3.5 shrink-0 ${checkingUpdate ? "animate-spin" : ""} ${
                activeAction === "update" ? "text-[#E4CCA0]" : "text-[#52525B]"
              }`}
            />
            <span className="truncate">{checkingUpdate ? "Checking..." : "Check updates"}</span>
          </button>
        ) : (
          <a
            href={ANDROID_APK_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setActiveAction("update")}
            className={`inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-stone-900/10 px-3 text-xs font-medium transition-colors ${
              activeAction === "update"
                ? "bg-[#1C1C1E] text-white hover:bg-[#2C2C30]"
                : "bg-[#F6F5F2] text-[#1C1C1E] hover:bg-stone-200/60"
            }`}
          >
            <Download
              className={`h-3.5 w-3.5 shrink-0 ${
                activeAction === "update" ? "text-[#E4CCA0]" : "text-[#52525B]"
              }`}
            />
            <span className="truncate">Android app</span>
          </a>
        )}

        <button
          type="button"
          onClick={() => {
            setActiveAction("share");
            void handleShareApp();
          }}
          className={`inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-stone-900/10 px-3 text-xs font-medium transition-colors cursor-pointer ${
            activeAction === "share"
              ? "bg-[#1C1C1E] text-white hover:bg-[#2C2C30]"
              : "bg-[#F6F5F2] text-[#1C1C1E] hover:bg-stone-200/60"
          }`}
        >
          {sharedApp ? (
            <Check
              className={`h-3.5 w-3.5 shrink-0 ${
                activeAction === "share" ? "text-[#E4CCA0]" : "text-emerald-700"
              }`}
            />
          ) : (
            <Share2
              className={`h-3.5 w-3.5 shrink-0 ${
                activeAction === "share" ? "text-[#E4CCA0]" : "text-[#52525B]"
              }`}
            />
          )}
          <span className="truncate">{sharedApp ? "Link copied" : "Share Keeper"}</span>
        </button>
      </div>

      {/* Update Status Banner */}
      {updateStatus.state === "available" && (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-[#C6A87C]/40 bg-[#F6F5F2] px-3 py-2.5 text-xs">
          <div className="min-w-0">
            <div className="font-semibold text-[#1C1C1E]">
              Update available (v{updateStatus.latest})
            </div>
            <div className="text-[11px] text-[#52525B]">Installs right over your current app</div>
          </div>
          {onOpenUpdate ? (
            <button
              type="button"
              onClick={() => onOpenUpdate(updateStatus.info)}
              className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-[#1C1C1E] px-2.5 py-1.5 text-xs font-medium text-white hover:bg-[#2C2C30] cursor-pointer"
            >
              <Download className="h-3 w-3 text-[#E4CCA0]" />
              <span>Update now</span>
            </button>
          ) : (
            <a
              href={ANDROID_APK_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-[#1C1C1E] px-2.5 py-1.5 text-xs font-medium text-white hover:bg-[#2C2C30]"
            >
              <Download className="h-3 w-3 text-[#E4CCA0]" />
              <span>Download</span>
            </a>
          )}
        </div>
      )}
      {updateStatus.state === "up_to_date" && (
        <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-700">
          <CheckCircle2 className="h-3.5 w-3.5" />
          <span>You are on the latest version (v{updateStatus.latest})</span>
        </div>
      )}
      {updateStatus.state === "error" && (
        <div className="text-xs text-[#8E8E93]">
          Could not check for updates right now.{" "}
          <a
            href={ANDROID_APK_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-[#1C1C1E] underline underline-offset-2"
          >
            Download latest APK
          </a>
        </div>
      )}

      {/* Report Bug / Feature Idea Inline Form */}
      {reportSent && (
        <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-700">
          <CheckCircle2 className="h-3.5 w-3.5" />
          <span>Feedback sent to developer</span>
        </div>
      )}
      {showReportForm && (
        <form
          onSubmit={(e) => void handleSendReport(e)}
          className="rounded-xl border border-stone-900/[0.08] bg-[#F6F5F2] p-3.5 space-y-2.5"
        >
          <SoftSegmented
            value={reportKind}
            onValueChange={(v) => setReportKind(v as "bug" | "feature")}
            items={[
              { value: "bug", label: "Report a bug" },
              { value: "feature", label: "Feature idea" },
            ]}
          />
          <SoftInput
            type="text"
            maxLength={500}
            placeholder={
              reportKind === "bug"
                ? "Describe what went wrong..."
                : "Describe the feature you'd like..."
            }
            value={reportText}
            onValueChange={setReportText}
            required
          />
          <div className="flex items-center justify-between gap-2">
            <a
              href={`mailto:${DEVELOPER_EMAIL}?subject=${encodeURIComponent(
                `Keeper ${reportKind === "bug" ? "Bug Report" : "Feature Idea"} (v${APP_VERSION})`,
              )}&body=${encodeURIComponent(reportText)}`}
              className="text-[11px] font-medium text-[#8F703F] underline underline-offset-2"
            >
              Or send via Gmail
            </a>
            <SoftButton
              type="submit"
              variant="filled"
              disabled={sendingReport}
              className="!h-8 !px-3 text-xs font-medium"
            >
              {sendingReport ? "Sending..." : "Send"}
            </SoftButton>
          </div>
        </form>
      )}

      {/* 3. Quick Help / FAQ Accordion */}
      <div className="border-t border-stone-900/[0.06] pt-3 space-y-2">
        <button
          type="button"
          onClick={() => setShowFaq((v) => !v)}
          className="flex w-full items-center justify-between text-xs font-medium text-[#1C1C1E] cursor-pointer"
        >
          <span className="inline-flex items-center gap-1.5">
            <HelpCircle className="h-3.5 w-3.5 text-[#52525B]" />
            <span>Quick help & FAQ</span>
          </span>
          <ChevronDown
            className={`h-4 w-4 text-[#8E8E93] transition-transform ${showFaq ? "rotate-180" : ""}`}
          />
        </button>

        {showFaq && (
          <div className="divide-y divide-stone-900/[0.06] rounded-xl border border-stone-900/[0.08] bg-[#F6F5F2] px-3">
            {FAQ_ITEMS.map((item, idx) => {
              const open = openFaqIdx === idx;
              return (
                <div key={item.q} className="py-2.5">
                  <button
                    type="button"
                    onClick={() => setOpenFaqIdx(open ? null : idx)}
                    className="flex w-full items-center justify-between gap-2 text-left text-xs font-medium text-[#1C1C1E] cursor-pointer"
                  >
                    <span>{item.q}</span>
                    <ChevronDown
                      className={`h-3.5 w-3.5 shrink-0 text-[#8E8E93] transition-transform ${
                        open ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  {open && (
                    <p className="mt-1.5 text-xs leading-relaxed text-[#52525B]">{item.a}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. Version & Credits Footer */}
      <div className="border-t border-stone-900/[0.06] pt-3 text-center text-[11px] text-[#8E8E93]">
        Keeper v{APP_VERSION} · Built by Bagomwa Raphael
      </div>
    </section>
  );
}

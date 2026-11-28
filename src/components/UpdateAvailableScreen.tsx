import { useEffect, useState } from "react";
import { App as CapApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  ExternalLink,
  RefreshCw,
  Settings,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import {
  APP_VERSION,
  canInstallPackages,
  downloadAndInstallNativeUpdate,
  formatBytesMB,
  installCachedApk,
  openInstallPermissionSettings,
  type DownloadProgressEvent,
} from "../lib/appUpdater";
import { KeeperLogo } from "./KeeperLogo";

interface UpdateAvailableScreenProps {
  latestVersion: string;
  changelog: string[];
  downloadUrl: string;
  isForced?: boolean;
  forcedMessage?: string;
  onDismiss?: () => void;
}

type InstallStage =
  | "idle"
  | "downloading"
  | "needs_permission"
  | "installing"
  | "error";

export function UpdateAvailableScreen({
  latestVersion,
  changelog,
  downloadUrl,
  isForced = false,
  forcedMessage,
  onDismiss,
}: UpdateAvailableScreenProps) {
  const [stage, setStage] = useState<InstallStage>("idle");
  const [progress, setProgress] = useState<DownloadProgressEvent>({
    percent: 0,
    downloadedBytes: 0,
    totalBytes: 0,
  });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // When returning from Android's "Install unknown apps" settings screen, auto-trigger install
  useEffect(() => {
    if (stage !== "needs_permission" || !Capacitor.isNativePlatform()) return;
    const listener = CapApp.addListener("appStateChange", ({ isActive }) => {
      if (!isActive) return;
      void canInstallPackages().then((granted) => {
        if (!granted) return;
        setStage("installing");
        void installCachedApk()
          .then((status) => {
            if (status === "needs_permission") setStage("needs_permission");
          })
          .catch((err: unknown) => {
            setErrorMsg(
              err instanceof Error ? err.message : "Could not launch Android installer.",
            );
            setStage("error");
          });
      });
    });
    return () => {
      void listener.then((handle) => handle.remove());
    };
  }, [stage]);

  const handleStartUpdate = async () => {
    setErrorMsg(null);
    setStage("downloading");
    setProgress({ percent: 0, downloadedBytes: 0, totalBytes: 0 });
    try {
      const status = await downloadAndInstallNativeUpdate(downloadUrl, (ev) => {
        setProgress(ev);
      });
      setStage(status);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Update download failed.");
      setStage("error");
    }
  };

  const handleInstallCached = async () => {
    setErrorMsg(null);
    try {
      const status = await installCachedApk();
      setStage(status);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Could not launch Android installer.");
      setStage("error");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex min-h-dvh flex-col justify-between bg-[#F6F5F2] text-[#1C1C1E] px-6 pb-8 pt-[max(env(safe-area-inset-top),28px)] overflow-y-auto">
      {/* Top brand bar */}
      <div className="mx-auto flex w-full max-w-[420px] items-center justify-between">
        <div className="flex items-center gap-2.5">
          <KeeperLogo size={30} />
          <span className="text-sm font-semibold tracking-tight text-[#1C1C1E]">Keeper</span>
        </div>
        <span className="rounded-full border border-stone-900/10 bg-white px-2.5 py-1 font-mono text-[11px] font-medium text-[#8F703F]">
          v{APP_VERSION} &rarr; v{latestVersion}
        </span>
      </div>

      {/* Main announcement + changelog */}
      <div className="mx-auto my-8 w-full max-w-[420px] space-y-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-[#C6A87C]/35 bg-[#C6A87C]/15 px-3 py-1 text-[11px] font-medium text-[#8F703F]">
            <Sparkles className="h-3 w-3" />
            <span>{isForced ? "Update needed" : "New update ready"}</span>
          </div>
          <h1 className="text-[28px] font-bold leading-tight tracking-tight text-[#1C1C1E]">
            Keeper v{latestVersion} is ready
          </h1>
          {forcedMessage && (
            <p className="text-xs leading-relaxed text-[#52525B]">{forcedMessage}</p>
          )}
        </div>

        <div className="rounded-2xl border border-stone-900/[0.08] bg-white p-4 shadow-[0_8px_28px_rgba(28,28,30,0.05)] space-y-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-[#8E8E93]">
            What&apos;s new in Keeper
          </div>
          <ul className="space-y-2.5">
            {changelog.map((item, idx) => (
              <li key={idx} className="flex items-start gap-2.5 text-sm leading-snug text-[#1C1C1E]">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#8F703F]" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Bottom trust badge + action controls */}
      <div className="mx-auto w-full max-w-[420px] space-y-3">
        <div className="flex items-center justify-center gap-1.5 text-xs text-[#52525B]">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-700" />
          <span>Safe official update · Installs right inside Keeper</span>
        </div>

        {stage === "idle" && (
          <>
            <button
              type="button"
              onClick={() => void handleStartUpdate()}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#1C1C1E] px-5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(28,28,30,0.16)] transition-transform active:scale-[0.99] hover:bg-[#2C2C30] cursor-pointer"
            >
              <Download className="h-4 w-4 text-[#E4CCA0]" />
              <span>Update now</span>
            </button>
            {!isForced && onDismiss && (
              <button
                type="button"
                onClick={onDismiss}
                className="flex h-10 w-full items-center justify-center rounded-full text-xs font-medium text-[#52525B] hover:text-[#1C1C1E] transition-colors cursor-pointer"
              >
                Not now
              </button>
            )}
          </>
        )}

        {stage === "downloading" && (
          <div className="rounded-2xl border border-stone-900/[0.08] bg-white p-4 shadow-[0_6px_20px_rgba(28,28,30,0.05)] space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-[#1C1C1E]">Downloading update...</span>
              <span className="font-mono font-semibold text-[#8F703F]">{progress.percent}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-stone-900/10">
              <div
                className="h-full rounded-full bg-[#1C1C1E] transition-all duration-150"
                style={{ width: `${Math.max(progress.percent, 4)}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-[#52525B] tabular-nums">
              <span>
                {formatBytesMB(progress.downloadedBytes)}
                {progress.totalBytes > 0 ? ` / ${formatBytesMB(progress.totalBytes)}` : ""}
              </span>
              <span>Please keep Keeper open</span>
            </div>
          </div>
        )}

        {stage === "needs_permission" && (
          <div className="rounded-2xl border border-amber-700/20 bg-amber-50/80 p-4 space-y-3">
            <div className="space-y-1">
              <div className="text-xs font-semibold text-amber-900">
                Allow updates once in settings
              </div>
              <p className="text-xs leading-relaxed text-amber-900/80">
                The update is ready. Turn on &ldquo;Install unknown apps&rdquo; for Keeper once in
                your phone settings, then come back here to finish.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => void openInstallPermissionSettings()}
                className="flex h-10 items-center justify-center gap-1.5 rounded-xl bg-[#1C1C1E] px-3 text-xs font-semibold text-white cursor-pointer"
              >
                <Settings className="h-3.5 w-3.5 text-[#E4CCA0]" />
                <span>Open settings</span>
              </button>
              <button
                type="button"
                onClick={() => void handleInstallCached()}
                className="flex h-10 items-center justify-center gap-1.5 rounded-xl border border-stone-900/10 bg-white px-3 text-xs font-medium text-[#1C1C1E] cursor-pointer"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Install update</span>
              </button>
            </div>
          </div>
        )}

        {stage === "installing" && (
          <div className="space-y-2.5 text-center">
            <div className="rounded-2xl border border-emerald-700/20 bg-emerald-50/80 p-3.5 text-xs font-medium text-emerald-800">
              Android installer opened. Tap &ldquo;Update&rdquo; in the system prompt to finish.
            </div>
            <div className="flex items-center justify-center gap-4 text-xs">
              <button
                type="button"
                onClick={() => void handleInstallCached()}
                className="font-medium text-[#1C1C1E] underline underline-offset-2 cursor-pointer"
              >
                Open installer again
              </button>
              {!isForced && onDismiss && (
                <button
                  type="button"
                  onClick={onDismiss}
                  className="text-[#52525B] hover:text-[#1C1C1E] cursor-pointer"
                >
                  Close
                </button>
              )}
            </div>
          </div>
        )}

        {stage === "error" && (
          <div className="rounded-2xl border border-rose-700/20 bg-rose-50/80 p-4 space-y-3">
            <div className="flex items-start gap-2 text-xs text-rose-800">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-700" />
              <span>{errorMsg || "Could not download the update."}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => void handleStartUpdate()}
                className="flex h-10 items-center justify-center gap-1.5 rounded-xl bg-[#1C1C1E] px-3 text-xs font-semibold text-white cursor-pointer"
              >
                <RefreshCw className="h-3.5 w-3.5 text-[#E4CCA0]" />
                <span>Try again</span>
              </button>
              <a
                href={downloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-10 items-center justify-center gap-1.5 rounded-xl border border-stone-900/10 bg-white px-3 text-xs font-medium text-[#1C1C1E]"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                <span>Browser download</span>
              </a>
            </div>
            {!isForced && onDismiss && (
              <button
                type="button"
                onClick={onDismiss}
                className="flex h-8 w-full items-center justify-center text-xs text-[#52525B] hover:text-[#1C1C1E] cursor-pointer"
              >
                Not now
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

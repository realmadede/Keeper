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
    <div className="fixed inset-0 z-50 flex min-h-dvh flex-col justify-between bg-[#141416] text-white px-6 pb-8 pt-[max(env(safe-area-inset-top),28px)] overflow-y-auto">
      {/* Top brand bar */}
      <div className="mx-auto flex w-full max-w-[420px] items-center justify-between">
        <div className="flex items-center gap-2.5">
          <KeeperLogo size={30} />
          <span className="text-sm font-semibold tracking-tight text-white">Keeper</span>
        </div>
        <span className="rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 font-mono text-[11px] text-[#E4CCA0]">
          v{APP_VERSION} &rarr; v{latestVersion}
        </span>
      </div>

      {/* Main announcement + changelog */}
      <div className="mx-auto my-8 w-full max-w-[420px] space-y-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-[#E4CCA0]/25 bg-[#E4CCA0]/10 px-3 py-1 text-[11px] font-medium text-[#E4CCA0]">
            <Sparkles className="h-3 w-3" />
            <span>{isForced ? "Required update" : "New release ready"}</span>
          </div>
          <h1 className="text-[28px] font-bold leading-tight tracking-tight text-white">
            Discover new version v{latestVersion}
          </h1>
          {forcedMessage && (
            <p className="text-xs leading-relaxed text-zinc-400">{forcedMessage}</p>
          )}
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 space-y-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            What&apos;s new in Keeper
          </div>
          <ul className="space-y-2.5">
            {changelog.map((item, idx) => (
              <li key={idx} className="flex items-start gap-2.5 text-sm leading-snug text-zinc-200">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#E4CCA0]" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Bottom trust badge + action controls */}
      <div className="mx-auto w-full max-w-[420px] space-y-3">
        <div className="flex items-center justify-center gap-1.5 text-xs text-zinc-400">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
          <span>Signed official release · Updates right inside Keeper</span>
        </div>

        {stage === "idle" && (
          <>
            <button
              type="button"
              onClick={() => void handleStartUpdate()}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#E4CCA0] px-5 text-sm font-semibold text-[#141416] shadow-[0_10px_28px_rgba(228,204,160,0.22)] transition-transform active:scale-[0.99] cursor-pointer"
            >
              <Download className="h-4 w-4" />
              <span>Update now</span>
            </button>
            {!isForced && onDismiss && (
              <button
                type="button"
                onClick={onDismiss}
                className="flex h-10 w-full items-center justify-center rounded-full text-xs font-medium text-zinc-400 hover:text-white transition-colors cursor-pointer"
              >
                Not now
              </button>
            )}
          </>
        )}

        {stage === "downloading" && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-4 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-white">Downloading update...</span>
              <span className="font-mono font-semibold text-[#E4CCA0]">{progress.percent}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-[#E4CCA0] transition-all duration-150"
                style={{ width: `${Math.max(progress.percent, 4)}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-zinc-400 tabular-nums">
              <span>
                {formatBytesMB(progress.downloadedBytes)}
                {progress.totalBytes > 0 ? ` / ${formatBytesMB(progress.totalBytes)}` : ""}
              </span>
              <span>Please keep Keeper open</span>
            </div>
          </div>
        )}

        {stage === "needs_permission" && (
          <div className="rounded-2xl border border-[#E4CCA0]/30 bg-[#E4CCA0]/10 p-4 space-y-3">
            <div className="space-y-1">
              <div className="text-xs font-semibold text-[#E4CCA0]">
                One-time Android permission needed
              </div>
              <p className="text-xs leading-relaxed text-zinc-300">
                The update is downloaded. Allow &ldquo;Install unknown apps&rdquo; for Keeper once
                in Android settings, then return here to finish installing.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => void openInstallPermissionSettings()}
                className="flex h-10 items-center justify-center gap-1.5 rounded-xl bg-[#E4CCA0] px-3 text-xs font-semibold text-[#141416] cursor-pointer"
              >
                <Settings className="h-3.5 w-3.5" />
                <span>Open settings</span>
              </button>
              <button
                type="button"
                onClick={() => void handleInstallCached()}
                className="flex h-10 items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-white/[0.06] px-3 text-xs font-medium text-white cursor-pointer"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Install update</span>
              </button>
            </div>
          </div>
        )}

        {stage === "installing" && (
          <div className="space-y-2.5 text-center">
            <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-3.5 text-xs font-medium text-emerald-300">
              Android installer opened. Tap &ldquo;Update&rdquo; in the system prompt to finish.
            </div>
            <div className="flex items-center justify-center gap-4 text-xs">
              <button
                type="button"
                onClick={() => void handleInstallCached()}
                className="font-medium text-[#E4CCA0] underline underline-offset-2 cursor-pointer"
              >
                Open installer again
              </button>
              {!isForced && onDismiss && (
                <button
                  type="button"
                  onClick={onDismiss}
                  className="text-zinc-400 hover:text-white cursor-pointer"
                >
                  Close
                </button>
              )}
            </div>
          </div>
        )}

        {stage === "error" && (
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 space-y-3">
            <div className="flex items-start gap-2 text-xs text-rose-200">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
              <span>{errorMsg || "Could not download the update."}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => void handleStartUpdate()}
                className="flex h-10 items-center justify-center gap-1.5 rounded-xl bg-[#E4CCA0] px-3 text-xs font-semibold text-[#141416] cursor-pointer"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Try again</span>
              </button>
              <a
                href={downloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-10 items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-white/[0.06] px-3 text-xs font-medium text-white"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                <span>Browser download</span>
              </a>
            </div>
            {!isForced && onDismiss && (
              <button
                type="button"
                onClick={onDismiss}
                className="flex h-8 w-full items-center justify-center text-xs text-zinc-400 hover:text-white cursor-pointer"
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

import { Capacitor, registerPlugin, type PluginListenerHandle } from "@capacitor/core";

export const APP_VERSION =
  (import.meta.env.VITE_APP_VERSION as string | undefined) || "1.3.0";
export const RELEASES_API_URL =
  "https://api.github.com/repos/realmadede/Keeper/releases/latest";
export const ANDROID_APK_URL =
  "https://github.com/realmadede/Keeper/releases/latest/download/Keeper.apk";

const DISMISSED_UPDATE_KEY = "keeper_dismissed_update_v1";
const WELCOMED_VERSION_KEY = "keeper_welcomed_version_v1";
const DISMISS_COOLDOWN_MS = 24 * 60 * 60 * 1000;

export interface UpdateReleaseInfo {
  latestVersion: string;
  hasUpdate: boolean;
  changelog: string[];
  downloadUrl: string;
}

export interface DownloadProgressEvent {
  percent: number;
  downloadedBytes: number;
  totalBytes: number;
}

interface AppUpdaterPlugin {
  canInstallPackages(): Promise<{ granted: boolean }>;
  openInstallPermissionSettings(): Promise<void>;
  downloadAndInstall(options: {
    url: string;
  }): Promise<{ status: "installing" | "needs_permission" }>;
  installCachedApk(): Promise<{ status: "installing" | "needs_permission" }>;
  addListener(
    eventName: "downloadProgress",
    listenerFunc: (event: DownloadProgressEvent) => void,
  ): Promise<PluginListenerHandle>;
}

const NativeAppUpdater = registerPlugin<AppUpdaterPlugin>("AppUpdater");

export function compareSemver(a: string, b: string): number {
  const pa = a.replace(/^v/i, "").split(".").map((n) => Number(n) || 0);
  const pb = b.replace(/^v/i, "").split(".").map((n) => Number(n) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

export function parseReleaseChangelog(body: string | null | undefined): string[] {
  if (!body || !body.trim()) {
    return ["Performance improvements, bug fixes, and the latest Keeper features."];
  }
  const lines = body
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .filter(
      (line) =>
        !/^latest keeper android apk/i.test(line) &&
        !/^build type:/i.test(line) &&
        !/^what'?s new/i.test(line) &&
        !/^#{1,3}\s*/.test(line),
    )
    .map((line) => line.replace(/^[-*•]\s+/, "").trim())
    .filter((line) => line.length >= 4);

  if (lines.length === 0) {
    return ["Performance improvements, bug fixes, and the latest Keeper features."];
  }
  return lines.slice(0, 6);
}

export function isUpdateDismissed(version: string, nowMs = Date.now()): boolean {
  try {
    const raw = localStorage.getItem(DISMISSED_UPDATE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { version?: string; at?: number };
    if (parsed.version !== version) return false;
    return typeof parsed.at === "number" && nowMs - parsed.at < DISMISS_COOLDOWN_MS;
  } catch {
    return false;
  }
}

export function dismissUpdateVersion(version: string, nowMs = Date.now()): void {
  try {
    localStorage.setItem(DISMISSED_UPDATE_KEY, JSON.stringify({ version, at: nowMs }));
  } catch {
    // Ignore storage errors
  }
}

export function getLastWelcomedVersion(): string | null {
  try {
    return localStorage.getItem(WELCOMED_VERSION_KEY);
  } catch {
    return null;
  }
}

export function markVersionWelcomed(version: string): void {
  try {
    localStorage.setItem(WELCOMED_VERSION_KEY, version);
  } catch {
    // Ignore storage errors
  }
}

export async function checkLatestRelease(): Promise<UpdateReleaseInfo> {
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = controller ? globalThis.setTimeout(() => controller.abort(), 6_000) : null;
  let res: Response;
  try {
    res = await fetch(RELEASES_API_URL, {
      headers: { Accept: "application/vnd.github+json" },
      signal: controller?.signal,
    });
  } finally {
    if (timer !== null) globalThis.clearTimeout(timer);
  }
  if (!res.ok) throw new Error(`Release lookup failed (${res.status})`);
  const data = (await res.json()) as {
    name?: string;
    tag_name?: string;
    body?: string;
    assets?: Array<{ name?: string; browser_download_url?: string }>;
  };

  const match = (data.name ?? data.tag_name ?? "").match(/v?(\d+\.\d+\.\d+)/i);
  const latestVersion = match ? match[1] : APP_VERSION;
  const apkAsset = data.assets?.find((a) => a.name?.toLowerCase().endsWith(".apk"));
  const downloadUrl = apkAsset?.browser_download_url || ANDROID_APK_URL;
  const changelog = parseReleaseChangelog(data.body);

  return {
    latestVersion,
    hasUpdate: compareSemver(latestVersion, APP_VERSION) > 0,
    changelog,
    downloadUrl,
  };
}

export function isNativeAndroidUpdaterAvailable(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
}

export async function downloadAndInstallNativeUpdate(
  url: string,
  onProgress: (event: DownloadProgressEvent) => void,
): Promise<"installing" | "needs_permission"> {
  if (!isNativeAndroidUpdaterAvailable()) {
    window.open(url, "_blank", "noopener,noreferrer");
    return "installing";
  }

  let listener: PluginListenerHandle | null = null;
  try {
    listener = await NativeAppUpdater.addListener("downloadProgress", onProgress);
    const result = await NativeAppUpdater.downloadAndInstall({ url });
    return result.status;
  } finally {
    if (listener) {
      await listener.remove().catch(() => {});
    }
  }
}

export async function openInstallPermissionSettings(): Promise<void> {
  if (!isNativeAndroidUpdaterAvailable()) return;
  await NativeAppUpdater.openInstallPermissionSettings();
}

export async function canInstallPackages(): Promise<boolean> {
  if (!isNativeAndroidUpdaterAvailable()) return true;
  const res = await NativeAppUpdater.canInstallPackages();
  return res.granted;
}

export async function installCachedApk(): Promise<"installing" | "needs_permission"> {
  if (!isNativeAndroidUpdaterAvailable()) return "installing";
  const res = await NativeAppUpdater.installCachedApk();
  return res.status;
}

export function formatBytesMB(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 MB";
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

import { Capacitor, registerPlugin } from "@capacitor/core";

interface NativeQrScannerPlugin {
  scanWithCamera(): Promise<{ value: string }>;
  scanImage(options: { base64: string }): Promise<{ value: string }>;
}

const NativeQrScanner = registerPlugin<NativeQrScannerPlugin>("QrScanner");

export type CameraScanOutcome =
  | { status: "scanned"; value: string }
  | { status: "cancelled" }
  | { status: "error"; message: string };

export function hasNativeMlKitScanner(): boolean {
  return Capacitor.isNativePlatform();
}

export async function scanQrWithNativeMlKit(): Promise<CameraScanOutcome> {
  try {
    const res = await NativeQrScanner.scanWithCamera();
    if (res?.value) {
      return { status: "scanned", value: res.value };
    }
    return { status: "error", message: "No QR code found." };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err ?? "");
    if (msg.toUpperCase().includes("CANCEL")) {
      return { status: "cancelled" };
    }
    return {
      status: "error",
      message: msg || "Camera scanner could not start. Try scanning a screenshot instead.",
    };
  }
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Could not read image file"));
    reader.readAsDataURL(file);
  });
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load image"));
    img.src = src;
  });
}

interface BarcodeDetectorLike {
  detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue?: string }>>;
}

function createBrowserBarcodeDetector(): BarcodeDetectorLike | null {
  const Ctor = (
    globalThis as unknown as {
      BarcodeDetector?: new (opts: { formats: string[] }) => BarcodeDetectorLike;
    }
  ).BarcodeDetector;
  if (!Ctor) return null;
  try {
    return new Ctor({ formats: ["qr_code"] });
  } catch {
    return null;
  }
}

async function decodeCanvasWithJsQr(canvas: HTMLCanvasElement): Promise<string | null> {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const { default: jsQR } = await import("jsqr");
  const decoded = jsQR(imgData.data, imgData.width, imgData.height, {
    inversionAttempts: "attemptBoth",
  });
  return decoded?.data?.trim() || null;
}

async function decodeImageInBrowser(dataUrl: string): Promise<string | null> {
  const img = await loadImageElement(dataUrl);
  const detector = createBrowserBarcodeDetector();
  if (detector) {
    try {
      const found = await detector.detect(img);
      const raw = found.find((b) => b.rawValue?.trim())?.rawValue?.trim();
      if (raw) return raw;
    } catch {
      // Fall through to canvas + jsQR
    }
  }

  // Try up to two scales (high-res screenshots decode much faster & more accurately around 1200px)
  const maxDims = [1400, 900];
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;

  for (const limit of maxDims) {
    const scale = Math.min(1, limit / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
    canvas.width = Math.max(1, Math.round((img.naturalWidth || 1) * scale));
    canvas.height = Math.max(1, Math.round((img.naturalHeight || 1) * scale));
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const val = await decodeCanvasWithJsQr(canvas);
    if (val) return val;
  }
  return null;
}

export async function scanQrFromImageFile(file: File): Promise<string | null> {
  const dataUrl = await readFileAsDataUrl(file);
  if (Capacitor.isNativePlatform()) {
    const commaIdx = dataUrl.indexOf(",");
    const base64 = commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl;
    try {
      const res = await NativeQrScanner.scanImage({ base64 });
      if (res?.value) return res.value.trim();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err ?? "");
      if (msg.includes("NO_QR_FOUND")) {
        // Still try jsQR fallback on resized canvas before giving up
      }
    }
  }
  return decodeImageInBrowser(dataUrl);
}

export async function decodeQrFromVideoFrame(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  detector: BarcodeDetectorLike | null,
): Promise<string | null> {
  if (video.readyState < 2 || !video.videoWidth || !video.videoHeight) return null;
  if (detector) {
    try {
      const found = await detector.detect(video);
      const raw = found.find((b) => b.rawValue?.trim())?.rawValue?.trim();
      if (raw) return raw;
    } catch {
      // Fall back to canvas + jsQR
    }
  }
  const scale = Math.min(1, 720 / Math.max(video.videoWidth, video.videoHeight));
  canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
  canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  return decodeCanvasWithJsQr(canvas);
}

export { createBrowserBarcodeDetector };

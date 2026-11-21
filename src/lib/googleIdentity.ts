export const GOOGLE_CLIENT_ID =
  (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined)?.trim() || "";

export interface GoogleCredentialResponse {
  credential?: string;
}

interface GoogleAccountsId {
  initialize: (config: {
    client_id: string;
    callback: (response: GoogleCredentialResponse) => void;
    nonce?: string;
    ux_mode?: "popup" | "redirect";
    auto_select?: boolean;
  }) => void;
  renderButton: (
    parent: HTMLElement,
    options: {
      theme?: "outline" | "filled_blue" | "filled_black";
      size?: "large" | "medium" | "small";
      text?: "signin_with" | "signup_with" | "continue_with" | "signin";
      shape?: "rectangular" | "pill" | "circle" | "square";
      width?: number;
      logo_alignment?: "left" | "center";
    },
  ) => void;
}

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: GoogleAccountsId;
      };
    };
  }
}

let scriptPromise: Promise<GoogleAccountsId> | null = null;

export function loadGoogleIdentityScript(): Promise<GoogleAccountsId> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Window unavailable"));
  }
  if (window.google?.accounts?.id) {
    return Promise.resolve(window.google.accounts.id);
  }
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<GoogleAccountsId>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://accounts.google.com/gsi/client"]',
    );
    const onLoad = () => {
      if (window.google?.accounts?.id) {
        resolve(window.google.accounts.id);
      } else {
        scriptPromise = null;
        reject(new Error("Google Identity Services did not initialize"));
      }
    };
    const onError = () => {
      scriptPromise = null;
      reject(new Error("Failed to load Google Identity Services"));
    };

    if (existing) {
      existing.addEventListener("load", onLoad, { once: true });
      existing.addEventListener("error", onError, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = onLoad;
    script.onerror = onError;
    document.head.appendChild(script);
  });

  return scriptPromise;
}

export async function createGoogleNoncePair(): Promise<{
  rawNonce: string;
  hashedNonce: string;
}> {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const rawNonce = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(rawNonce));
  const hashedNonce = Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
  return { rawNonce, hashedNonce };
}

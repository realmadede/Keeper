import { useState } from "react";
import { Delete, Lock } from "lucide-react";
import { KeeperLogo } from "./KeeperLogo";

const PIN_HASH_KEY = "keeper_app_pin_hash_v1";

export async function hashPin(pin: string): Promise<string> {
  const bytes = new TextEncoder().encode(`keeper-pin:${pin}`);
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  // Fallback deterministic hash for non-secure contexts
  let h = 2166136261;
  for (const b of bytes) {
    h ^= b;
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}

export function getStoredPinHash(): string | null {
  try {
    return localStorage.getItem(PIN_HASH_KEY);
  } catch {
    return null;
  }
}

export function setStoredPinHash(hash: string | null): void {
  try {
    if (hash) localStorage.setItem(PIN_HASH_KEY, hash);
    else localStorage.removeItem(PIN_HASH_KEY);
  } catch {
    // Ignore storage errors
  }
}

interface PinLockScreenProps {
  expectedHash: string;
  onUnlock: () => void;
}

const DIGITS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"] as const;

export function PinLockScreen({ expectedHash, onUnlock }: PinLockScreenProps) {
  const [digits, setDigits] = useState("");
  const [error, setError] = useState(false);

  const handlePress = async (key: string) => {
    if (key === "") return;
    setError(false);
    if (key === "del") {
      setDigits((prev) => prev.slice(0, -1));
      return;
    }
    if (digits.length >= 4) return;
    const next = digits + key;
    setDigits(next);

    if (next.length === 4) {
      const hashed = await hashPin(next);
      if (hashed === expectedHash) {
        setDigits("");
        onUnlock();
      } else {
        setError(true);
        setTimeout(() => setDigits(""), 350);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#F6F5F2] px-6 py-8">
      <div className="w-full max-w-[320px] space-y-6 text-center">
        <div className="space-y-2.5">
          <KeeperLogo size={54} className="mx-auto drop-shadow-[0_8px_18px_rgba(28,28,30,0.14)]" />
          <div className="inline-flex items-center gap-1.5 text-xs font-medium text-[#8F703F]">
            <Lock className="h-3.5 w-3.5" />
            <span>Keeper is locked</span>
          </div>
          <h1 className="text-lg font-semibold text-[#1C1C1E]">Enter 4-digit PIN</h1>
        </div>

        {/* 4 PIN Dots */}
        <div className="flex items-center justify-center gap-3.5">
          {[0, 1, 2, 3].map((idx) => {
            const filled = idx < digits.length;
            return (
              <span
                key={idx}
                className={`h-3.5 w-3.5 rounded-full border transition-colors ${
                  error
                    ? "border-rose-600 bg-rose-600"
                    : filled
                      ? "border-[#1C1C1E] bg-[#1C1C1E]"
                      : "border-stone-400 bg-transparent"
                }`}
              />
            );
          })}
        </div>

        {error ? (
          <p className="text-xs font-medium text-rose-700">Incorrect PIN — try again</p>
        ) : (
          <p className="text-xs text-[#8E8E93]">Enter your passcode to view household records</p>
        )}

        {/* Tactile Keypad */}
        <div className="grid grid-cols-3 gap-3 pt-1">
          {DIGITS.map((key, idx) =>
            key === "" ? (
              <div key={`empty-${idx}`} />
            ) : (
              <button
                key={key}
                type="button"
                onClick={() => void handlePress(key)}
                className="flex h-14 items-center justify-center rounded-2xl border border-stone-900/[0.08] bg-white text-lg font-semibold text-[#1C1C1E] shadow-[0_2px_8px_rgba(28,28,30,0.04)] active:scale-95 active:bg-stone-100 transition-[transform,background-color] cursor-pointer"
              >
                {key === "del" ? <Delete className="h-5 w-5 text-[#52525B]" /> : key}
              </button>
            ),
          )}
        </div>
      </div>
    </div>
  );
}

import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Glass } from "glisse";
import { Delete, Fingerprint, Lock } from "lucide-react";
import {
  checkBiometricAvailable,
  isBiometricsEnabled,
  verifyBiometricIdentity,
} from "../lib/biometrics";
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

const DIGITS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "bio", "0", "del"] as const;

export function PinLockScreen({ expectedHash, onUnlock }: PinLockScreenProps) {
  const [digits, setDigits] = useState("");
  const [revealedIndex, setRevealedIndex] = useState<number | null>(null);
  const [error, setError] = useState(false);
  const [canUseBiometric, setCanUseBiometric] = useState(false);
  const hideTimerRef = useRef<number | null>(null);

  const triggerBiometric = useCallback(async () => {
    const ok = await verifyBiometricIdentity();
    if (ok) onUnlock();
  }, [onUnlock]);

  useEffect(() => {
    return () => {
      if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
    };
  }, []);

  useEffect(() => {
    let active = true;
    let bioTimer: number | null = null;
    if (!isBiometricsEnabled()) return;
    void checkBiometricAvailable().then((avail) => {
      if (!active || !avail) return;
      setCanUseBiometric(true);
      // Small delay so Android finishes restoring window focus after resume before opening biometrics
      bioTimer = window.setTimeout(() => {
        if (active) void triggerBiometric();
      }, 250);
    });
    return () => {
      active = false;
      if (bioTimer) window.clearTimeout(bioTimer);
    };
  }, [triggerBiometric]);

  const handlePress = async (key: string) => {
    if (key === "bio") {
      if (canUseBiometric) void triggerBiometric();
      return;
    }
    setError(false);
    if (key === "del") {
      if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
      setRevealedIndex(null);
      setDigits((prev) => prev.slice(0, -1));
      return;
    }
    if (digits.length >= 4) return;
    const next = digits + key;
    setDigits(next);

    // Briefly reveal the newly typed digit for ~2 seconds before masking into a dot
    if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
    setRevealedIndex(next.length - 1);
    hideTimerRef.current = window.setTimeout(() => {
      setRevealedIndex(null);
    }, 2000);

    if (next.length === 4) {
      const hashed = await hashPin(next);
      if (hashed === expectedHash) {
        setDigits("");
        setRevealedIndex(null);
        onUnlock();
      } else {
        setError(true);
        setTimeout(() => {
          setDigits("");
          setRevealedIndex(null);
        }, 380);
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

        {/* 4 PIN Slots (Glisse Liquid Glass) */}
        <div className="flex items-center justify-center gap-3.5">
          {[0, 1, 2, 3].map((idx) => {
            const filled = idx < digits.length;
            const showChar = filled && revealedIndex === idx;
            return (
              <Glass
                key={idx}
                className={`flex h-10 w-10 items-center justify-center rounded-2xl text-base font-semibold transition-colors ${
                  error
                    ? "ring-1 ring-rose-600 text-rose-700"
                    : filled
                      ? "ring-1 ring-[#1C1C1E]/40 text-[#1C1C1E]"
                      : "text-transparent"
                }`}
              >
                {showChar ? (
                  digits[idx]
                ) : filled ? (
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${
                      error ? "bg-rose-600" : "bg-[#1C1C1E]"
                    }`}
                  />
                ) : null}
              </Glass>
            );
          })}
        </div>

        {error ? (
          <p className="text-xs font-medium text-rose-700">Incorrect PIN — try again</p>
        ) : (
          <p className="text-xs text-[#8E8E93]">
            {canUseBiometric
              ? "Use fingerprint/face or enter your 4-digit PIN"
              : "Enter your passcode to view household records"}
          </p>
        )}

        {/* Tactile Glisse Liquid Glass Keypad */}
        <div className="grid grid-cols-3 gap-3 pt-1">
          {DIGITS.map((key) =>
            key === "bio" && !canUseBiometric ? (
              <div key="empty-bio" />
            ) : (
              <Button
                key={key}
                type="button"
                variant="glass"
                aria-label={
                  key === "bio"
                    ? "Unlock with fingerprint or face"
                    : key === "del"
                      ? "Delete digit"
                      : `Digit ${key}`
                }
                onClick={() => void handlePress(key)}
                className="!h-14 !w-full !rounded-full !text-lg !font-semibold !text-[#1C1C1E]"
              >
                {key === "del" ? (
                  <Delete className="h-5 w-5 text-[#52525B]" />
                ) : key === "bio" ? (
                  <Fingerprint className="h-6 w-6 text-[#8F703F]" />
                ) : (
                  key
                )}
              </Button>
            ),
          )}
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState, type FormEvent } from "react";
import { Button, Glass } from "glisse";
import { AlertTriangle, CheckCircle2, ShieldAlert, ShieldCheck, X } from "lucide-react";
import { formatTZS } from "../lib/format";
import { sanitizeStatementCode } from "../lib/pdfStatement";
import type { StatementVerificationRecord } from "../types";
import { SoftButton, SoftInput } from "./LightControls";

export interface StatementVerifyResult {
  found: boolean;
  record: StatementVerificationRecord | null;
  liveMatches: boolean;
  reason?: string;
}

interface StatementVerifyModalProps {
  open: boolean;
  initialCode?: string | null;
  householdName: string;
  onVerify: (code: string) => Promise<StatementVerifyResult>;
  onClose: () => void;
}

export function StatementVerifyModal({
  open,
  initialCode,
  householdName,
  onVerify,
  onClose,
}: StatementVerifyModalProps) {
  const [codeInput, setCodeInput] = useState(initialCode ?? "");
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<StatementVerifyResult | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, open]);

  useEffect(() => {
    if (!open) return;
    setLocalError(null);
    const cleaned = sanitizeStatementCode(initialCode);
    if (cleaned) {
      setCodeInput(cleaned);
      setChecking(true);
      setResult(null);
      void onVerify(cleaned)
        .then((res) => setResult(res))
        .catch(() => {
          setLocalError("Could not reach the server to verify this statement right now.");
        })
        .finally(() => setChecking(false));
    } else {
      setCodeInput(initialCode ?? "");
      setResult(null);
    }
  }, [initialCode, onVerify, open]);

  if (!open) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    const cleaned = sanitizeStatementCode(codeInput);
    if (!cleaned) {
      setLocalError("Enter a valid Statement ID like KPR-8F3A-29C1 or paste the QR link.");
      return;
    }
    setCodeInput(cleaned);
    setChecking(true);
    setResult(null);
    try {
      const res = await onVerify(cleaned);
      setResult(res);
    } catch {
      setLocalError("Could not reach the server to verify this statement right now.");
    } finally {
      setChecking(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-stone-900/40 p-3 sm:p-4"
      onClick={onClose}
    >
      <Glass
        role="dialog"
        aria-modal="true"
        className="w-full max-w-[430px] max-h-[90dvh] overflow-y-auto no-scrollbar rounded-[28px] p-5 shadow-2xl space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-[#1C1C1E]">Verify PDF statement</h2>
            <p className="text-xs text-[#52525B] mt-0.5">
              Checks against official {householdName} records only
            </p>
          </div>
          <Button
            type="button"
            aria-label="Close"
            onClick={onClose}
            icon={<X className="h-4 w-4 text-[#52525B]" />}
            className="!h-9 !w-9 shrink-0"
          />
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="flex items-center gap-2">
          <SoftInput
            type="text"
            placeholder="KPR-XXXX-XXXX or QR link"
            value={codeInput}
            onValueChange={(v) => {
              setCodeInput(v);
              if (localError) setLocalError(null);
            }}
            className="flex-1 font-mono text-xs"
          />
          <SoftButton
            type="submit"
            variant="filled"
            disabled={checking}
            className="shrink-0 !h-10 text-xs font-medium"
          >
            {checking ? "Checking..." : "Check"}
          </SoftButton>
        </form>

        {localError && (
          <div className="rounded-xl border border-rose-700/20 bg-rose-50/80 px-3 py-2 text-xs font-medium text-rose-700">
            {localError}
          </div>
        )}

        {checking && (
          <div className="rounded-2xl border border-stone-900/[0.08] bg-white p-4 text-center text-xs text-[#52525B]">
            Checking official household records...
          </div>
        )}

        {!checking && result && !result.found && (
          <div className="rounded-2xl border border-rose-700/25 bg-rose-50/85 p-4 space-y-1.5">
            <div className="flex items-center gap-2 text-sm font-semibold text-rose-800">
              <ShieldAlert className="h-4 w-4 shrink-0 text-rose-700" />
              <span>Statement not verified</span>
            </div>
            <p className="text-xs leading-relaxed text-rose-800/85">
              {result.reason ||
                "This code was not found in your household records. It may be fake, typed wrong, or belong to another household."}
            </p>
          </div>
        )}

        {!checking && result && result.found && result.record && (
          <div className="space-y-3">
            <div className="rounded-2xl border border-emerald-700/25 bg-emerald-50/85 p-4 space-y-1.5">
              <div className="flex items-center gap-2 text-sm font-semibold text-emerald-900">
                <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-700" />
                <span>Verified original Keeper statement</span>
              </div>
              <p className="text-xs leading-relaxed text-emerald-900/85">
                Compare the official server totals below against the PDF to make sure no numbers
                were altered.
              </p>
            </div>

            {!result.liveMatches && (
              <div className="flex items-start gap-2 rounded-xl border border-amber-700/25 bg-amber-50/90 px-3 py-2.5 text-xs text-amber-900">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                <span>
                  This PDF was genuine when issued, but one or more entries have been edited or
                  deleted in the live ledger since then.
                </span>
              </div>
            )}

            {result.liveMatches && (
              <div className="flex items-center gap-2 rounded-xl border border-emerald-700/20 bg-white px-3 py-2 text-xs font-medium text-emerald-800">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-700" />
                <span>Matches live household ledger exactly</span>
              </div>
            )}

            <div className="rounded-2xl border border-stone-900/[0.08] bg-white p-3.5 space-y-2 text-xs tabular-nums">
              <div className="flex justify-between">
                <span className="text-[#52525B]">Statement ID</span>
                <span className="font-mono font-semibold text-[#1C1C1E]">
                  {result.record.code}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#52525B]">Prepared by</span>
                <span className="font-medium text-[#1C1C1E]">
                  {result.record.generated_by_name}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#52525B]">Issued</span>
                <span className="font-medium text-[#1C1C1E]">
                  {new Date(result.record.created_at).toLocaleString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#52525B]">Filter &amp; entries</span>
                <span className="font-medium text-[#1C1C1E]">
                  {result.record.filter_label} ({result.record.entry_count})
                </span>
              </div>
              <div className="border-t border-stone-900/[0.06] pt-2 flex justify-between">
                <span className="text-[#52525B]">Official Contributed</span>
                <span className="font-semibold text-emerald-700">
                  {formatTZS(result.record.total_contributed)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#52525B]">Official Spent</span>
                <span className="font-semibold text-[#1C1C1E]">
                  {formatTZS(result.record.total_spent)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#52525B]">Official Net Balance</span>
                <span
                  className={`font-semibold ${
                    result.record.net_balance >= 0 ? "text-emerald-700" : "text-rose-700"
                  }`}
                >
                  {result.record.net_balance > 0
                    ? `+${formatTZS(result.record.net_balance)}`
                    : formatTZS(result.record.net_balance)}
                </span>
              </div>
            </div>
          </div>
        )}
      </Glass>
    </div>
  );
}

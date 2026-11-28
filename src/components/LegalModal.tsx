import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Button, Glass } from "glisse";
import { X } from "lucide-react";
import { SoftButton } from "./LightControls";

export type LegalDocType = "terms" | "privacy";

interface LegalModalProps {
  doc: LegalDocType | null;
  onClose: () => void;
}

export function LegalModal({ doc, onClose }: LegalModalProps) {
  useEffect(() => {
    if (!doc) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [doc, onClose]);

  if (!doc) return null;

  const isTerms = doc === "terms";

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-stone-900/40 p-3 sm:p-4"
      onClick={onClose}
    >
      <Glass
        role="dialog"
        aria-modal="true"
        className="w-full max-w-[440px] max-h-[85dvh] flex flex-col rounded-[28px] p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between gap-2 shrink-0">
          <div>
            <h2 className="text-base font-semibold text-[#1C1C1E]">
              {isTerms ? "Terms of Service" : "Privacy Policy"}
            </h2>
            <p className="text-[11px] text-[#8E8E93]">Keeper Household Management · Updated 2026</p>
          </div>
          <Button
            type="button"
            aria-label="Close"
            onClick={onClose}
            icon={<X className="h-4 w-4 text-[#52525B]" />}
            className="!h-9 !w-9 shrink-0"
          />
        </div>

        <div className="overflow-y-auto no-scrollbar space-y-3.5 pr-1 text-xs leading-relaxed text-[#52525B]">
          {isTerms ? (
            <>
              <section>
                <h3 className="font-semibold text-[#1C1C1E] mb-1">1. Purpose of Keeper</h3>
                <p>
                  Keeper is a private record-keeping tool designed to help roommates and shared
                  households track their agreed weekly budget, pooled contributions, and shared
                  expenses in Tanzanian Shillings (TZS).
                </p>
              </section>
              <section>
                <h3 className="font-semibold text-[#1C1C1E] mb-1">2. Not a Financial Institution</h3>
                <p>
                  Keeper does not hold funds, transfer money, or process M-Pesa, bank, or card
                  payments. Every entry in Keeper is a manual transparency record agreed upon by the
                  members of your household.
                </p>
              </section>
              <section>
                <h3 className="font-semibold text-[#1C1C1E] mb-1">3. Household Responsibility</h3>
                <p>
                  You are responsible for keeping your password and household invite code private
                  and for recording accurate amounts and descriptions. Financial agreements and
                  settlements remain solely between household members.
                </p>
              </section>
              <section>
                <h3 className="font-semibold text-[#1C1C1E] mb-1">4. Account Termination</h3>
                <p>
                  You may leave your household or permanently delete your Keeper account at any time
                  from the House tab. Historical shared household records remain visible to current
                  roommates for continuity.
                </p>
              </section>
            </>
          ) : (
            <>
              <section>
                <h3 className="font-semibold text-[#1C1C1E] mb-1">1. Information We Collect</h3>
                <p>
                  Keeper stores only the minimum information required to run your shared household:
                  your display name, email address, avatar color, household membership, and the
                  contributions and household expenses you log.
                </p>
              </section>
              <section>
                <h3 className="font-semibold text-[#1C1C1E] mb-1">2. Household Isolation & Security</h3>
                <p>
                  Your data is stored on Supabase PostgreSQL with Row-Level Security (RLS) enforced
                  at the database layer. Only authenticated members of your specific household can
                  view or record entries for that household.
                </p>
              </section>
              <section>
                <h3 className="font-semibold text-[#1C1C1E] mb-1">3. Zero Tracking Cookies or Ads</h3>
                <p>
                  Keeper does not set third-party advertising cookies, does not run third-party
                  analytics trackers, and never sells or shares your household data with marketers.
                  Session tokens are stored locally in your browser to keep you signed in.
                </p>
              </section>
              <section>
                <h3 className="font-semibold text-[#1C1C1E] mb-1">4. Control & Deletion</h3>
                <p>
                  You can edit your display name and avatar color, export your household ledger to
                  CSV, rotate your household invite code (admins), leave a household, or permanently
                  delete your account at any time from the House tab.
                </p>
              </section>
            </>
          )}
        </div>

        <div className="mt-4 pt-3 border-t border-stone-900/[0.06] shrink-0">
          <SoftButton
            variant="filled"
            onClick={onClose}
            className="w-full !h-10 text-xs font-medium"
          >
            Got it
          </SoftButton>
        </div>
      </Glass>
    </div>,
    document.body,
  );
}

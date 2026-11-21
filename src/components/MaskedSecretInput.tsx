import { useEffect, useRef, useState, type ReactNode } from "react";
import { Eye, EyeOff } from "lucide-react";

interface MaskedSecretInputProps {
  value: string;
  onValueChange: (next: string) => void;
  placeholder?: string;
  icon?: ReactNode;
  maxLength?: number;
  minLength?: number;
  numericOnly?: boolean;
  required?: boolean;
  allowToggleReveal?: boolean;
  revealMs?: number;
  ariaLabel?: string;
}

/**
 * Password / PIN input that briefly reveals each newly typed character for ~2 seconds
 * before masking it into a bullet (•), with an optional full-reveal eye toggle.
 */
export function MaskedSecretInput({
  value,
  onValueChange,
  placeholder,
  icon,
  maxLength,
  minLength,
  numericOnly = false,
  required = false,
  allowToggleReveal = true,
  revealMs = 2000,
  ariaLabel,
}: MaskedSecretInputProps) {
  const [showFull, setShowFull] = useState(false);
  const [revealLast, setRevealLast] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  const scheduleHide = () => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    setRevealLast(true);
    timerRef.current = window.setTimeout(() => {
      setRevealLast(false);
    }, revealMs);
  };

  const displayValue = showFull
    ? value
    : value
        .split("")
        .map((ch, idx) => (revealLast && idx === value.length - 1 ? ch : "•"))
        .join("");

  const handleChange = (rawNext: string) => {
    let nextValue: string;
    if (showFull) {
      nextValue = rawNext;
    } else if (rawNext.length >= value.length) {
      const added = rawNext.slice(value.length).replace(/•/g, "");
      nextValue = value + added;
    } else {
      nextValue = value.slice(0, rawNext.length);
    }

    if (numericOnly) {
      nextValue = nextValue.replace(/\D/g, "");
    }
    if (typeof maxLength === "number") {
      nextValue = nextValue.slice(0, maxLength);
    }

    const grew = nextValue.length > value.length;
    onValueChange(nextValue);

    if (grew && !showFull) {
      scheduleHide();
    } else if (!grew) {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      setRevealLast(false);
    }
  };

  return (
    <div className="relative flex w-full items-center">
      {icon && (
        <span className="pointer-events-none absolute left-3 flex items-center text-[#8E8E93]">
          {icon}
        </span>
      )}
      <input
        type="text"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        inputMode={numericOnly ? "numeric" : "text"}
        aria-label={ariaLabel}
        placeholder={placeholder}
        minLength={minLength}
        maxLength={maxLength}
        required={required}
        value={displayValue}
        onChange={(e) => handleChange(e.target.value)}
        className={`h-10 w-full rounded-xl border border-stone-900/12 bg-white text-sm text-[#1C1C1E] placeholder:text-[#8E8E93] focus:border-[#1C1C1E]/40 focus:outline-none focus:ring-2 focus:ring-[#1C1C1E]/10 transition-colors ${
          icon ? "pl-9" : "pl-3"
        } ${allowToggleReveal ? "pr-10" : "pr-3"}`}
      />
      {allowToggleReveal && (
        <button
          type="button"
          aria-label={showFull ? "Hide value" : "Show value"}
          onClick={() => setShowFull((prev) => !prev)}
          className="absolute right-2 top-1/2 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-[#8E8E93] hover:text-[#1C1C1E] transition-colors cursor-pointer"
        >
          {showFull ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      )}
    </div>
  );
}

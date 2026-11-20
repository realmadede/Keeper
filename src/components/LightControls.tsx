import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";
import { X } from "lucide-react";

interface SoftInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> {
  value: string;
  onValueChange: (value: string) => void;
  icon?: ReactNode;
  clearable?: boolean;
}

/**
 * Quiet warm-stone control input with nested 12px radius and hairline border.
 */
export function SoftInput({
  value,
  onValueChange,
  icon,
  clearable = false,
  className = "",
  ...props
}: SoftInputProps) {
  return (
    <div
      className={`flex h-10 w-full items-center gap-2.5 rounded-xl border border-stone-900/10 bg-white px-3.5 text-[#1C1C1E] transition-colors focus-within:border-stone-900/35 focus-within:ring-2 focus-within:ring-stone-900/[0.06] ${className}`}
    >
      {icon && <span className="flex w-4 shrink-0 items-center justify-center text-stone-400">{icon}</span>}
      <input
        value={value}
        onChange={(e) => onValueChange(e.currentTarget.value)}
        className="h-full w-full min-w-0 bg-transparent text-[16px] sm:text-sm text-[#1C1C1E] outline-none placeholder:text-stone-400"
        {...props}
      />
      {clearable && value && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => onValueChange("")}
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-stone-100 text-stone-500 transition-colors hover:bg-stone-200 cursor-pointer"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

interface SoftButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "glass" | "filled" | "destructive";
  tint?: string;
  icon?: ReactNode;
}

/**
 * Quiet control button sharing the 12px control radius and warm-stone palette.
 */
export function SoftButton({
  variant = "glass",
  tint,
  icon,
  children,
  className = "",
  style,
  type = "button",
  ...props
}: SoftButtonProps) {
  const variantClasses =
    variant === "filled"
      ? "bg-[#1C1C1E] text-white hover:bg-[#2C2C30]"
      : variant === "destructive"
        ? "border border-rose-700/20 bg-rose-50/70 text-rose-700 hover:bg-rose-100/70"
        : "border border-stone-900/10 bg-white text-[#1C1C1E] hover:bg-stone-50";

  return (
    <button
      type={type}
      style={variant === "filled" && tint ? { ...style, backgroundColor: tint } : style}
      className={`inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium transition-[transform,background-color,border-color] duration-100 active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900 disabled:opacity-45 disabled:pointer-events-none cursor-pointer select-none ${variantClasses} ${className}`}
      {...props}
    >
      {icon && <span className="flex shrink-0 items-center">{icon}</span>}
      {children}
    </button>
  );
}

export interface SoftSegmentItem {
  value: string;
  label: ReactNode;
}

interface SoftSegmentedProps {
  items: SoftSegmentItem[];
  value: string;
  onValueChange: (value: string) => void;
  className?: string;
}

/**
 * Instant iOS-style segmented control with zero DOM-cloning or SVG filter overhead.
 * Works reliably inside scrollable modals, forms, and long ledger panes.
 */
export function SoftSegmented({
  items,
  value,
  onValueChange,
  className = "",
}: SoftSegmentedProps) {
  return (
    <div
      role="tablist"
      data-no-tab-swipe
      className={`inline-grid w-full rounded-xl border border-stone-900/[0.08] bg-[#EFECE6] p-1 ${className}`}
      style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
    >
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onValueChange(item.value)}
            className={`flex h-8 items-center justify-center rounded-lg px-3 text-xs font-medium transition-colors cursor-pointer select-none ${
              active
                ? "bg-white text-[#1C1C1E] shadow-[0_1px_3px_rgba(28,28,30,0.1)]"
                : "text-[#52525B] hover:text-[#1C1C1E]"
            }`}
          >
            <span className="truncate">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}

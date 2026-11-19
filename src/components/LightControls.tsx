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
 * Lightweight Apple-frosted pill input matching Glisse's visual language without
 * running per-pixel JS canvas refraction loops on every form field.
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
      className={`flex h-10 w-full items-center gap-2.5 rounded-full border border-slate-900/10 bg-white/80 px-3.5 text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_1px_2px_rgba(15,23,42,0.04)] backdrop-blur-sm transition-colors focus-within:border-slate-900/25 focus-within:bg-white ${className}`}
    >
      {icon && <span className="flex shrink-0 items-center text-slate-400">{icon}</span>}
      <input
        value={value}
        onChange={(e) => onValueChange(e.currentTarget.value)}
        className="h-full w-full min-w-0 bg-transparent text-[16px] sm:text-sm text-slate-900 outline-none placeholder:text-slate-400"
        {...props}
      />
      {clearable && value && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => onValueChange("")}
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-200/80 text-slate-500 hover:bg-slate-300/80 cursor-pointer"
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
 * Lightweight frosted pill button matching Apple / Glisse styling with instant
 * CSS spring press feedback and zero SVG displacement overhead.
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
      ? "bg-[#1C1C1E] text-white shadow-[0_4px_12px_rgba(28,28,30,0.2)] hover:bg-[#2C2C30]"
      : variant === "destructive"
        ? "border border-rose-200/90 bg-rose-50/90 text-rose-600 hover:bg-rose-100/90"
        : "border border-slate-900/10 bg-white/80 text-slate-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_1px_3px_rgba(15,23,42,0.05)] backdrop-blur-sm hover:bg-white";

  return (
    <button
      type={type}
      style={variant === "filled" && tint ? { ...style, backgroundColor: tint } : style}
      className={`inline-flex h-10 items-center justify-center gap-2 rounded-full px-4 text-sm font-medium transition-transform duration-100 active:scale-[0.98] disabled:opacity-45 disabled:pointer-events-none cursor-pointer select-none ${variantClasses} ${className}`}
      {...props}
    >
      {icon && <span className="flex shrink-0 items-center">{icon}</span>}
      {children}
    </button>
  );
}

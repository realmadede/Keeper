import { Capacitor } from "@capacitor/core";
import { TabBar } from "glisse";
import { Home, PieChart, Plus, ShoppingBag, User, Users } from "lucide-react";
import type { ActiveTab } from "../types";

interface BottomDockProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  onOpenAdd: () => void;
}

const NAV_ITEMS: Array<{ value: ActiveTab; label: string; Icon: typeof Home }> = [
  { value: "overview", label: "Home", Icon: Home },
  { value: "ledger", label: "Ledger", Icon: ShoppingBag },
  { value: "budget", label: "Budget", Icon: PieChart },
  { value: "household", label: "House", Icon: Users },
  { value: "account", label: "Account", Icon: User },
];

export function BottomDock({ activeTab, onSelectTab, onOpenAdd }: BottomDockProps) {
  const isNative = Capacitor.isNativePlatform();

  return (
    <nav
      aria-label="Primary navigation"
      data-theme="dark"
      className="keeper-dock fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 z-40 flex max-w-[calc(100vw-0.75rem)] -translate-x-1/2 items-center gap-2"
    >
      {isNative ? (
        /* Lightweight native pill on Android WebView (avoids SVG backdrop-filter resume stalls) */
        <div
          role="tablist"
          className="flex items-center rounded-full border border-white/12 bg-[#1C1C1E]/95 p-1 shadow-[0_14px_34px_rgba(15,23,42,0.3)]"
        >
          {NAV_ITEMS.map(({ value, label, Icon }) => {
            const active = activeTab === value;
            return (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onSelectTab(value)}
                className={`flex h-12 w-[clamp(56px,16vw,66px)] flex-col items-center justify-center gap-0.5 rounded-full transition-colors duration-150 cursor-pointer select-none ${
                  active
                    ? "bg-white/12 text-[#E4CCA0]"
                    : "text-white/75 active:bg-white/8"
                }`}
              >
                <Icon className="h-[17px] w-[17px]" strokeWidth={1.75} />
                <span className="text-[10px] font-medium leading-none">{label}</span>
              </button>
            );
          })}
        </div>
      ) : (
        /* iOS-style Glisse Liquid Glass TabBar on web */
        <TabBar
          className="keeper-tab-bar shadow-[0_14px_34px_rgba(15,23,42,0.3)]"
          value={activeTab}
          onValueChange={(value) => onSelectTab(value as ActiveTab)}
          items={NAV_ITEMS.map(({ value, label, Icon }) => ({
            value,
            label,
            icon: <Icon className="h-[17px] w-[17px]" strokeWidth={1.75} />,
          }))}
        />
      )}

      {/* Detached circular Quick-Add FAB with direct native click response */}
      <button
        type="button"
        aria-label="Record contribution or expense"
        onClick={onOpenAdd}
        className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full border border-white/20 bg-[#BFA377] text-white shadow-[0_12px_28px_rgba(28,28,30,0.28)] transition-[transform,background-color] duration-100 hover:bg-[#AF9367] active:scale-95 cursor-pointer select-none"
      >
        <Plus className="h-5 w-5 text-white" strokeWidth={2.25} />
      </button>
    </nav>
  );
}

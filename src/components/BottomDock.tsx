import { TabBar } from "glisse";
import { Home, PieChart, Plus, ShoppingBag, User, Users } from "lucide-react";
import type { ActiveTab } from "../types";

interface BottomDockProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  onOpenAdd: () => void;
}

export function BottomDock({ activeTab, onSelectTab, onOpenAdd }: BottomDockProps) {
  return (
    <nav
      aria-label="Primary navigation"
      data-theme="dark"
      className="keeper-dock fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 z-40 flex max-w-[calc(100vw-0.75rem)] -translate-x-1/2 items-center gap-2"
    >
      {/* iOS-style Glisse Liquid Glass TabBar */}
      <TabBar
        className="keeper-tab-bar shadow-[0_14px_34px_rgba(15,23,42,0.3)]"
        value={activeTab}
        onValueChange={(value) => onSelectTab(value as ActiveTab)}
        items={[
          {
            value: "overview",
            label: "Home",
            icon: <Home className="h-[17px] w-[17px]" strokeWidth={1.75} />,
          },
          {
            value: "ledger",
            label: "Ledger",
            icon: <ShoppingBag className="h-[17px] w-[17px]" strokeWidth={1.75} />,
          },
          {
            value: "budget",
            label: "Budget",
            icon: <PieChart className="h-[17px] w-[17px]" strokeWidth={1.75} />,
          },
          {
            value: "household",
            label: "House",
            icon: <Users className="h-[17px] w-[17px]" strokeWidth={1.75} />,
          },
          {
            value: "account",
            label: "Account",
            icon: <User className="h-[17px] w-[17px]" strokeWidth={1.75} />,
          },
        ]}
      />

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

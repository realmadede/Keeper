import { Glass, Button } from "glisse";
import { Home, PieChart, Plus, ShoppingBag, User } from "lucide-react";
import type { ActiveTab } from "../types";

interface BottomDockProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  onOpenAdd: () => void;
}

export function BottomDock({ activeTab, onSelectTab, onOpenAdd }: BottomDockProps) {
  const navBtn = (tab: ActiveTab, label: string, Icon: typeof Home) => {
    const isActive = activeTab === tab;
    return (
      <button
        type="button"
        aria-label={label}
        aria-current={isActive ? "page" : undefined}
        onClick={() => onSelectTab(tab)}
        className={`relative flex h-11 w-11 items-center justify-center rounded-2xl transition-all duration-200 cursor-pointer ${
          isActive
            ? "bg-[#BFA377] text-white shadow-[0_4px_14px_rgba(191,163,119,0.45)] scale-105"
            : "text-white/75 hover:text-white hover:bg-white/10"
        }`}
      >
        <Icon className="h-5 w-5" strokeWidth={isActive ? 2.3 : 1.9} />
      </button>
    );
  };

  return (
    <div
      data-theme="dark"
      className="keeper-dock fixed bottom-4 left-1/2 z-40 -translate-x-1/2 px-4 w-full max-w-[330px]"
    >
      <Glass className="flex items-center justify-between rounded-[28px] px-2.5 py-2 shadow-[0_14px_34px_rgba(15,23,42,0.28)]">
        {navBtn("overview", "Overview", Home)}
        {navBtn("ledger", "Transactions", ShoppingBag)}

        {/* Center crisp white + FAB powered by Glisse Liquid Glass Button */}
        <Button
          variant="filled"
          tint="#FFFFFF"
          aria-label="Record contribution or expense"
          onClick={onOpenAdd}
          className="!h-11 !w-11 !min-w-0 !rounded-full !p-0 !text-[#18181B] shadow-[0_4px_14px_rgba(255,255,255,0.28)]"
          icon={<Plus className="h-5 w-5 text-[#18181B]" strokeWidth={2.6} />}
        />

        {navBtn("budget", "Weekly Budget", PieChart)}
        {navBtn("household", "Household", User)}
      </Glass>
    </div>
  );
}

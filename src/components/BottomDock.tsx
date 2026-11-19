import { Button, TabBar } from "glisse";
import { Home, PieChart, Plus, ShoppingBag, User } from "lucide-react";
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
      className="keeper-dock fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 z-40 flex -translate-x-1/2 items-center gap-2.5"
    >
      {/* Real iOS-style Glisse Liquid Glass TabBar with spring lens & drag scrubbing */}
      <TabBar
        className="keeper-tab-bar shadow-[0_14px_34px_rgba(15,23,42,0.3)]"
        value={activeTab}
        onValueChange={(value) => onSelectTab(value as ActiveTab)}
        items={[
          {
            value: "overview",
            label: "Home",
            icon: <Home className="h-[20px] w-[20px]" strokeWidth={2} />,
          },
          {
            value: "ledger",
            label: "Ledger",
            icon: <ShoppingBag className="h-[20px] w-[20px]" strokeWidth={2} />,
          },
          {
            value: "budget",
            label: "Budget",
            icon: <PieChart className="h-[20px] w-[20px]" strokeWidth={2} />,
          },
          {
            value: "household",
            label: "House",
            icon: <User className="h-[20px] w-[20px]" strokeWidth={2} />,
          },
        ]}
      />

      {/* Detached iOS-style circular Liquid Glass Quick-Add FAB */}
      <Button
        variant="filled"
        tint="#BFA377"
        aria-label="Record contribution or expense"
        onClick={onOpenAdd}
        className="!h-[58px] !w-[58px] !min-w-0 !rounded-full !p-0 shadow-[0_14px_30px_rgba(15,23,42,0.3)]"
        icon={<Plus className="h-6 w-6 text-white" strokeWidth={2.5} />}
      />
    </nav>
  );
}

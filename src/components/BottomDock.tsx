import { Button, TabBar } from "glisse";
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
        items={NAV_ITEMS.map(({ value, label, Icon }) => ({
          value,
          label,
          icon: <Icon className="h-[17px] w-[17px]" strokeWidth={1.75} />,
        }))}
      />

      {/* Detached circular Glisse Liquid Glass Quick-Add FAB */}
      <Button
        type="button"
        variant="filled"
        tint="#BFA377"
        aria-label="Record contribution or expense"
        onClick={onOpenAdd}
        icon={<Plus className="h-5 w-5 text-white" strokeWidth={2.25} />}
        className="!h-[52px] !w-[52px] !rounded-full shrink-0 shadow-[0_12px_28px_rgba(28,28,30,0.28)]"
      />
    </nav>
  );
}

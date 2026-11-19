import { useMemo, useState } from "react";
import { Menu } from "glisse";
import { Calendar, ChevronLeft } from "lucide-react";
import { AddTransactionModal } from "./components/AddTransactionModal";
import { AuthScreen } from "./components/AuthScreen";
import { BottomDock } from "./components/BottomDock";
import { BudgetView } from "./components/BudgetView";
import { CategoryBreakdown } from "./components/CategoryBreakdown";
import { HouseholdOnboarding } from "./components/HouseholdOnboarding";
import { HouseholdView } from "./components/HouseholdView";
import { KeeperLogo } from "./components/KeeperLogo";
import { KpiCards } from "./components/KpiCards";
import { LedgerView } from "./components/LedgerView";
import { TransactionList } from "./components/TransactionList";
import { WeeklyBarChart } from "./components/WeeklyBarChart";
import { useKeeperStore } from "./hooks/useKeeperStore";
import { computeWeeklySummary, getWeekWindow } from "./lib/analytics";
import type { ActiveTab } from "./types";

const TAB_TITLES: Record<ActiveTab, string> = {
  overview: "Expense Overview",
  ledger: "Household Ledger",
  budget: "Weekly Budget",
  household: "My Household",
};

export function App() {
  const store = useKeeperStore();
  const [activeTab, setActiveTab] = useState<ActiveTab>("overview");
  const [weekOffset, setWeekOffset] = useState(0);
  const [addOpen, setAddOpen] = useState(false);

  const weekWindow = useMemo(() => getWeekWindow(weekOffset), [weekOffset]);

  const summary = useMemo(() => {
    if (!store.household) return null;
    return computeWeeklySummary(
      store.transactions,
      store.members,
      store.household.member_weekly_share,
      weekOffset,
    );
  }, [store.household, store.members, store.transactions, weekOffset]);

  if (store.loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <div className="text-center space-y-2">
          <div className="mx-auto h-9 w-9 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900" />
          <p className="text-xs font-medium text-slate-500">Syncing Keeper...</p>
        </div>
      </div>
    );
  }

  if (!store.profile) {
    return (
      <AuthScreen
        isSupabaseReady={store.isSupabaseReady}
        error={store.error}
        onSignIn={store.signIn}
        onSignUp={store.signUp}
        onEnterDemo={store.enterDemoMode}
      />
    );
  }

  if (!store.household || !summary) {
    return (
      <HouseholdOnboarding
        profile={store.profile}
        error={store.error}
        onCreate={store.createHousehold}
        onJoin={store.joinHousehold}
        onSignOut={store.signOut}
      />
    );
  }

  const weekMenuItems = [0, -1, -2, -3].map((offset) => {
    const win = getWeekWindow(offset);
    return {
      label: offset === weekOffset ? `✓ ${win.label}` : win.label,
      icon: <Calendar className="h-3.5 w-3.5" />,
      onSelect: () => setWeekOffset(offset),
    };
  });

  return (
    <div className="min-h-dvh pb-28">
      <div className="mx-auto w-full max-w-[440px] px-4 pt-4">
        {/* Top App Header — matches mockup's crisp light header + right week pill */}
        <header className="mb-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            {activeTab === "overview" ? (
              <KeeperLogo size={38} className="shrink-0 drop-shadow-xs" />
            ) : (
              <button
                type="button"
                aria-label="Back to Overview"
                onClick={() => setActiveTab("overview")}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-slate-700 shadow-xs border border-slate-100 hover:bg-slate-50 cursor-pointer"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            )}
            <div className="min-w-0">
              <h1 className="truncate text-[16px] font-bold tracking-tight text-slate-900 leading-tight">
                {TAB_TITLES[activeTab]}
              </h1>
              <p className="truncate text-[11px] font-medium text-slate-500">
                {store.household.name} · {weekWindow.monthLabel}
              </p>
            </div>
          </div>

          {/* Week Switcher with Glisse Liquid Glass Menu */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="rounded-full border border-slate-200/80 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 shadow-2xs">
              {weekWindow.label}
            </span>
            <Menu
              aria-label="Select week"
              align="end"
              icon={<Calendar className="h-4 w-4 text-slate-700" />}
              items={weekMenuItems}
            />
          </div>
        </header>

        {store.error && (
          <div className="mb-3 flex items-center justify-between rounded-2xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-700">
            <span>{store.error}</span>
            <button
              type="button"
              onClick={store.clearError}
              className="ml-2 font-bold underline cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Active View */}
        {activeTab === "overview" && (
          <main className="space-y-4">
            <KpiCards
              totalSpent={summary.totalSpent}
              totalContributed={summary.totalContributed}
              remainingBalance={summary.remainingBalance}
              weeklyBudgetTarget={store.household.weekly_budget_target}
              spentDeltaPct={summary.spentDeltaPct}
              contributedDeltaPct={summary.contributedDeltaPct}
            />

            <WeeklyBarChart
              dailySeries={summary.dailySeries}
              spentDeltaPct={summary.spentDeltaPct}
            />

            <CategoryBreakdown
              categories={summary.categories}
              totalSpent={summary.totalSpent}
              spentDeltaPct={summary.spentDeltaPct}
              onViewAll={() => setActiveTab("ledger")}
            />

            <TransactionList
              title="Recent Transactions"
              transactions={summary.weekTransactions}
              currentUserId={store.profile.id}
              onDelete={store.deleteTransaction}
              maxItems={5}
              onViewAll={() => setActiveTab("ledger")}
            />
          </main>
        )}

        {activeTab === "ledger" && (
          <main>
            <LedgerView
              transactions={store.transactions}
              currentUserId={store.profile.id}
              onDelete={store.deleteTransaction}
            />
          </main>
        )}

        {activeTab === "budget" && (
          <main>
            <BudgetView
              household={store.household}
              totalContributed={summary.totalContributed}
              totalSpent={summary.totalSpent}
              memberStatuses={summary.memberStatuses}
              onUpdateBudget={store.updateBudget}
            />
          </main>
        )}

        {activeTab === "household" && (
          <main>
            <HouseholdView
              household={store.household}
              profile={store.profile}
              members={store.members}
              isDemoMode={store.isDemoMode}
              realtimeConnected={store.realtimeConnected}
              onLeaveHousehold={store.leaveHousehold}
              onSignOut={store.signOut}
            />
          </main>
        )}
      </div>

      {/* Floating Dark Liquid Glass Navigation Bar */}
      <BottomDock
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onOpenAdd={() => setAddOpen(true)}
      />

      {/* Quick Record Contribution / Expense Sheet */}
      <AddTransactionModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSubmit={store.addTransaction}
      />
    </div>
  );
}

export default App;

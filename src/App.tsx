import { useEffect, useMemo, useRef, useState, type TouchEvent } from "react";
import { Menu } from "glisse";
import { Calendar, Check, ChevronLeft } from "lucide-react";
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
import type { ActiveTab, Transaction } from "./types";

const TAB_ORDER: ActiveTab[] = ["overview", "ledger", "budget", "household"];
const PENDING_JOIN_KEY = "keeper_pending_join_code";

const TAB_TITLES: Record<ActiveTab, string> = {
  overview: "Expense Overview",
  ledger: "Household Ledger",
  budget: "Weekly Budget",
  household: "My Household",
};

function readInitialJoinCode(): string | null {
  try {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get("join")?.trim().toUpperCase();
    if (fromUrl) {
      sessionStorage.setItem(PENDING_JOIN_KEY, fromUrl);
      const cleanUrl = window.location.pathname + window.location.hash;
      window.history.replaceState({}, "", cleanUrl);
      return fromUrl;
    }
    return sessionStorage.getItem(PENDING_JOIN_KEY);
  } catch {
    return null;
  }
}

export function App() {
  const store = useKeeperStore();
  const [activeTab, setActiveTab] = useState<ActiveTab>("overview");
  const [weekOffset, setWeekOffset] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [pendingJoinCode, setPendingJoinCode] = useState<string | null>(() => readInitialJoinCode());

  const paneRefs = useRef<(HTMLDivElement | null)[]>([]);
  const touchStart = useRef<{ x: number; y: number; blocked: boolean } | null>(null);

  const activeIndex = TAB_ORDER.indexOf(activeTab);
  const weekWindow = useMemo(() => getWeekWindow(weekOffset), [weekOffset]);

  // Clear pending invite code once the user is inside a household
  useEffect(() => {
    if (store.household && pendingJoinCode) {
      setPendingJoinCode(null);
      try {
        sessionStorage.removeItem(PENDING_JOIN_KEY);
      } catch {
        // Ignore storage errors
      }
    }
  }, [pendingJoinCode, store.household]);

  const summary = useMemo(() => {
    if (!store.household) return null;
    return computeWeeklySummary(
      store.transactions,
      store.members,
      store.household.member_weekly_share,
      weekOffset,
    );
  }, [store.household, store.members, store.transactions, weekOffset]);

  const handleSelectTab = (tab: ActiveTab) => {
    setActiveTab(tab);
    const idx = TAB_ORDER.indexOf(tab);
    paneRefs.current[idx]?.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleOpenAdd = () => {
    setEditingTx(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (tx: Transaction) => {
    setEditingTx(tx);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setEditingTx(null);
  };

  const handleTouchStart = (e: TouchEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement | null;
    const blocked = Boolean(target?.closest("[data-no-tab-swipe]"));
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY, blocked };
  };

  const handleTouchEnd = (e: TouchEvent<HTMLDivElement>) => {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start || start.blocked) return;

    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) < 56 || Math.abs(dx) < Math.abs(dy) * 1.4) return;

    if (dx < 0 && activeIndex < TAB_ORDER.length - 1) {
      handleSelectTab(TAB_ORDER[activeIndex + 1]);
    } else if (dx > 0 && activeIndex > 0) {
      handleSelectTab(TAB_ORDER[activeIndex - 1]);
    }
  };

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

  if (!store.profile || store.passwordRecoveryMode) {
    return (
      <AuthScreen
        isSupabaseReady={store.isSupabaseReady}
        passwordRecoveryMode={store.passwordRecoveryMode}
        pendingInviteCode={pendingJoinCode}
        error={store.error}
        onSignIn={store.signIn}
        onSignUp={store.signUp}
        onResetPassword={store.resetPassword}
        onUpdatePassword={store.updatePassword}
        onEnterDemo={store.enterDemoMode}
      />
    );
  }

  if (!store.household || !summary) {
    return (
      <HouseholdOnboarding
        profile={store.profile}
        initialInviteCode={pendingJoinCode}
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
      label: win.label,
      icon:
        offset === weekOffset ? (
          <Check className="h-3.5 w-3.5" />
        ) : (
          <Calendar className="h-3.5 w-3.5" />
        ),
      onSelect: () => setWeekOffset(offset),
    };
  });

  return (
    <div className="h-dvh overflow-hidden flex flex-col">
      <div className="mx-auto flex h-full w-full max-w-[440px] flex-col">
        {/* Anchored Phone Top Bar with iOS notch safe-area support */}
        <header className="shrink-0 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            {activeTab === "overview" ? (
              <KeeperLogo size={38} className="shrink-0 drop-shadow-xs" />
            ) : (
              <button
                type="button"
                aria-label="Back to Overview"
                onClick={() => handleSelectTab("overview")}
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
            <span className="max-w-[106px] truncate rounded-full border border-slate-200/80 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 shadow-2xs">
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
          <div className="mx-4 mb-2 shrink-0 flex items-center justify-between rounded-2xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-700">
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

        {/* Horizontal 4-Screen Phone Pager (slides horizontally between Home, Ledger, Budget, House) */}
        <div
          className="relative flex-1 overflow-hidden"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <div
            className="flex h-full w-full transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform"
            style={{ transform: `translate3d(-${activeIndex * 100}%, 0, 0)` }}
          >
            {/* Screen 1: Home / Overview */}
            <div
              ref={(el) => {
                paneRefs.current[0] = el;
              }}
              aria-hidden={activeTab !== "overview"}
              className="h-full w-full shrink-0 overflow-y-auto no-scrollbar px-4 pb-28 space-y-4"
            >
              <KpiCards
                totalSpent={summary.totalSpent}
                totalContributed={summary.totalContributed}
                remainingBalance={summary.remainingBalance}
                allTimeBalance={summary.allTimeBalance}
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
                onViewAll={() => handleSelectTab("ledger")}
              />

              <TransactionList
                title="Recent Transactions"
                transactions={summary.weekTransactions}
                currentUserId={store.profile.id}
                onEdit={handleOpenEdit}
                onDelete={store.deleteTransaction}
                maxItems={5}
                onViewAll={() => handleSelectTab("ledger")}
              />
            </div>

            {/* Screen 2: Ledger */}
            <div
              ref={(el) => {
                paneRefs.current[1] = el;
              }}
              aria-hidden={activeTab !== "ledger"}
              className="h-full w-full shrink-0 overflow-y-auto no-scrollbar px-4 pb-28"
            >
              <LedgerView
                householdName={store.household.name}
                transactions={store.transactions}
                currentUserId={store.profile.id}
                onEdit={handleOpenEdit}
                onDelete={store.deleteTransaction}
              />
            </div>

            {/* Screen 3: Budget */}
            <div
              ref={(el) => {
                paneRefs.current[2] = el;
              }}
              aria-hidden={activeTab !== "budget"}
              className="h-full w-full shrink-0 overflow-y-auto no-scrollbar px-4 pb-28"
            >
              <BudgetView
                household={store.household}
                weekWindow={weekWindow}
                summary={summary}
                onUpdateBudget={store.updateBudget}
              />
            </div>

            {/* Screen 4: Household */}
            <div
              ref={(el) => {
                paneRefs.current[3] = el;
              }}
              aria-hidden={activeTab !== "household"}
              className="h-full w-full shrink-0 overflow-y-auto no-scrollbar px-4 pb-28"
            >
              <HouseholdView
                household={store.household}
                profile={store.profile}
                members={store.members}
                isDemoMode={store.isDemoMode}
                realtimeConnected={store.realtimeConnected}
                onLeaveHousehold={store.leaveHousehold}
                onSignOut={store.signOut}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Floating Dark Liquid Glass Navigation Bar */}
      <BottomDock
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        onOpenAdd={handleOpenAdd}
      />

      {/* Quick Record / Edit Contribution & Expense Sheet */}
      <AddTransactionModal
        open={modalOpen}
        members={store.members}
        currentUserId={store.profile.id}
        editingTransaction={editingTx}
        onClose={handleCloseModal}
        onSubmit={store.addTransaction}
        onUpdate={store.updateTransaction}
      />
    </div>
  );
}

export default App;

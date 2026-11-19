import { useCallback, useEffect, useMemo, useRef, useState, type TouchEvent } from "react";
import { Button, Glass, Menu, type MenuEntry } from "glisse";
import {
  Bell,
  Calendar,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronLeft,
  Copy,
  Plus,
  RotateCw,
  WifiOff,
} from "lucide-react";
import { AddTransactionModal, type TransactionPrefill } from "./components/AddTransactionModal";
import { AuthScreen } from "./components/AuthScreen";
import { BottomDock } from "./components/BottomDock";
import { BudgetView } from "./components/BudgetView";
import { CategoryBreakdown } from "./components/CategoryBreakdown";
import { HouseholdOnboarding } from "./components/HouseholdOnboarding";
import { HouseholdView } from "./components/HouseholdView";
import { KeeperLogo } from "./components/KeeperLogo";
import { KpiCards } from "./components/KpiCards";
import { LedgerView } from "./components/LedgerView";
import { LoadingSkeleton } from "./components/LoadingSkeleton";
import { TransactionList } from "./components/TransactionList";
import { WeeklyBarChart } from "./components/WeeklyBarChart";
import { WelcomeScreen } from "./components/WelcomeScreen";
import { useKeeperStore, type TransactionInput } from "./hooks/useKeeperStore";
import {
  computePeriodSummary,
  getBillDueStatus,
  getPeriodWindow,
} from "./lib/analytics";
import { formatTZS } from "./lib/format";
import { sanitizeInviteCode } from "./lib/security";
import type { ActiveTab, BudgetSubTab, PeriodKey, Transaction, TransactionType } from "./types";

const TAB_ORDER: ActiveTab[] = ["overview", "ledger", "budget", "household"];
const PENDING_JOIN_KEY = "keeper_pending_join_code";
const LAST_SEEN_PREFIX = "keeper_last_seen_v1:";

const TAB_TITLES: Record<ActiveTab, string> = {
  overview: "Expense Overview",
  ledger: "Household Ledger",
  budget: "Budget & House",
  household: "My Household",
};

function readInitialJoinCode(): string | null {
  try {
    const params = new URLSearchParams(window.location.search);
    const rawParam = params.get("join");
    if (rawParam !== null) {
      const cleanUrl = window.location.pathname + window.location.hash;
      window.history.replaceState({}, "", cleanUrl);
      const valid = sanitizeInviteCode(rawParam);
      if (valid) {
        sessionStorage.setItem(PENDING_JOIN_KEY, valid);
        return valid;
      }
      return null;
    }
    return sanitizeInviteCode(sessionStorage.getItem(PENDING_JOIN_KEY));
  } catch {
    return null;
  }
}

export function App() {
  const store = useKeeperStore();
  const [activeTab, setActiveTab] = useState<ActiveTab>("overview");
  const [budgetSubTab, setBudgetSubTab] = useState<BudgetSubTab>("pool");
  const [periodKey, setPeriodKey] = useState<PeriodKey>("this_week");
  const [modalOpen, setModalOpen] = useState(false);
  const [modalInitialType, setModalInitialType] = useState<TransactionType>("expense");
  const [prefillDraft, setPrefillDraft] = useState<TransactionPrefill | null>(null);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [pendingJoinCode, setPendingJoinCode] = useState<string | null>(() =>
    readInitialJoinCode(),
  );
  const [authView, setAuthView] = useState<"welcome" | "signin" | "signup">(
    pendingJoinCode ? "signup" : "welcome",
  );
  const [lastSeenAt, setLastSeenAt] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const [isOffline, setIsOffline] = useState(() =>
    typeof navigator !== "undefined" ? !navigator.onLine : false,
  );

  const paneRefs = useRef<(HTMLDivElement | null)[]>([]);
  const touchStart = useRef<{ x: number; y: number; blocked: boolean } | null>(null);

  const showToast = useCallback((message: string) => {
    setToastMessage(message);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => {
      setToastMessage(null);
    }, 2600);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const goOnline = () => {
      setIsOffline(false);
      void store.refresh();
    };
    const goOffline = () => setIsOffline(true);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, [store.refresh]);

  // Load "last seen" timestamp for highlighting new roommate entries since last visit
  useEffect(() => {
    const hid = store.household?.id;
    if (!hid) {
      setLastSeenAt(null);
      return;
    }
    const key = `${LAST_SEEN_PREFIX}${hid}`;
    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        setLastSeenAt(stored);
      } else {
        // First visit on this device: highlight roommate entries from the last 24h
        const dayAgo = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
        setLastSeenAt(dayAgo);
      }
      const persistNow = () => {
        try {
          localStorage.setItem(key, new Date().toISOString());
        } catch {
          // Ignore storage write errors
        }
      };
      window.addEventListener("beforeunload", persistNow);
      return () => window.removeEventListener("beforeunload", persistNow);
    } catch {
      return undefined;
    }
  }, [store.household?.id]);

  const markAllSeen = useCallback(() => {
    const nowIso = new Date().toISOString();
    setLastSeenAt(nowIso);
    if (store.household?.id) {
      try {
        localStorage.setItem(`${LAST_SEEN_PREFIX}${store.household.id}`, nowIso);
      } catch {
        // Ignore storage write errors
      }
    }
  }, [store.household?.id]);

  const newTransactionIds = useMemo(() => {
    const ids = new Set<string>();
    if (!lastSeenAt || !store.profile) return ids;
    for (const tx of store.transactions) {
      if (tx.recorded_by !== store.profile.id && tx.created_at > lastSeenAt) {
        ids.add(tx.id);
      }
    }
    return ids;
  }, [lastSeenAt, store.profile, store.transactions]);

  const activeIndex = TAB_ORDER.indexOf(activeTab);
  const periodWindow = useMemo(() => getPeriodWindow(periodKey), [periodKey]);

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
    return computePeriodSummary(
      store.transactions,
      store.members,
      store.household.member_weekly_share,
      periodKey,
    );
  }, [periodKey, store.household, store.members, store.transactions]);

  const dueSoonBillsCount = useMemo(
    () => store.bills.filter((b) => getBillDueStatus(b).isDueSoon).length,
    [store.bills],
  );
  const pendingNeedsCount = useMemo(
    () => store.needs.filter((n) => !n.is_bought).length,
    [store.needs],
  );

  const handleSelectTab = (tab: ActiveTab) => {
    setActiveTab(tab);
    const idx = TAB_ORDER.indexOf(tab);
    paneRefs.current[idx]?.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleOpenAdd = (initialType: TransactionType = "expense") => {
    setEditingTx(null);
    setPrefillDraft(null);
    setModalInitialType(initialType);
    setModalOpen(true);
  };

  const handleOpenPrefillExpense = (draft: TransactionPrefill) => {
    setEditingTx(null);
    setPrefillDraft(draft);
    setModalInitialType(draft.type);
    setModalOpen(true);
  };

  const handleOpenEdit = (tx: Transaction) => {
    setEditingTx(tx);
    setPrefillDraft(null);
    setModalInitialType(tx.type);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setEditingTx(null);
    setPrefillDraft(null);
  };

  const handleAddTransaction = async (
    input: TransactionInput,
    prefill?: TransactionPrefill | null,
  ) => {
    await store.addTransaction(input);
    if (prefill?.needId) {
      await store.toggleNeed(prefill.needId, true);
    }
    if (prefill?.billId) {
      await store.markBillPaid(prefill.billId);
    }
    const verb = input.type === "contribution" ? "contribution" : "expense";
    showToast(`Recorded ${formatTZS(input.amount)} ${verb}`);
  };

  const handleUpdateTransaction = async (id: string, input: TransactionInput) => {
    await store.updateTransaction(id, input);
    showToast("Transaction updated");
  };

  const handleDeleteTransaction = async (id: string) => {
    await store.deleteTransaction(id);
    showToast("Transaction removed");
  };

  const handleManualSync = async () => {
    await store.refresh();
    showToast("Household synced");
  };

  const handleCopyInviteQuick = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      showToast(`Invite code ${code} copied`);
    } catch {
      showToast(`Invite code: ${code}`);
    }
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
    return <LoadingSkeleton onRetry={() => void store.refresh()} />;
  }

  if (!store.profile || store.passwordRecoveryMode) {
    if (!store.passwordRecoveryMode && !pendingJoinCode && authView === "welcome") {
      return (
        <WelcomeScreen
          isSupabaseReady={store.isSupabaseReady}
          onSignUp={() => setAuthView("signup")}
          onSignIn={() => setAuthView("signin")}
          onEnterDemo={store.enterDemoMode}
        />
      );
    }

    return (
      <AuthScreen
        isSupabaseReady={store.isSupabaseReady}
        initialMode={authView === "signup" ? "signup" : "signin"}
        passwordRecoveryMode={store.passwordRecoveryMode}
        pendingInviteCode={pendingJoinCode}
        error={store.error}
        onBack={pendingJoinCode ? undefined : () => setAuthView("welcome")}
        onSignIn={store.signIn}
        onSignUp={store.signUp}
        onSignInWithGoogle={store.signInWithGoogle}
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

  const periodOption = (key: PeriodKey): MenuEntry => {
    const win = getPeriodWindow(key);
    return {
      label: win.label,
      icon:
        key === periodKey ? (
          <Check className="h-3.5 w-3.5" />
        ) : (
          <Calendar className="h-3.5 w-3.5" />
        ),
      onSelect: () => setPeriodKey(key),
    };
  };

  const periodMenuItems: MenuEntry[] = [
    periodOption("this_week"),
    periodOption("last_week"),
    periodOption("two_weeks_ago"),
    "separator",
    periodOption("this_month"),
    periodOption("last_month"),
  ];

  const isBrandNewHouse = store.transactions.length === 0;
  const periodBudgetTarget =
    periodWindow.kind === "month"
      ? store.household.weekly_budget_target * 4
      : store.household.weekly_budget_target;

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
                {store.household.name} · {periodWindow.monthLabel}
              </p>
            </div>
          </div>

          {/* Manual Sync + Weekly/Monthly Period Switcher */}
          <div className="flex items-center gap-1.5 shrink-0">
            {!store.isDemoMode && (
              <button
                type="button"
                aria-label="Sync household now"
                disabled={store.refreshing}
                onClick={() => void handleManualSync()}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200/80 bg-white text-slate-600 shadow-2xs hover:bg-slate-50 disabled:opacity-60 cursor-pointer"
              >
                <RotateCw className={`h-3.5 w-3.5 ${store.refreshing ? "animate-spin" : ""}`} />
              </button>
            )}
            <span className="max-w-[96px] truncate rounded-full border border-slate-200/80 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 shadow-2xs">
              {periodWindow.label}
            </span>
            <Menu
              aria-label="Select period"
              align="end"
              icon={<Calendar className="h-4 w-4 text-slate-700" />}
              items={periodMenuItems}
            />
          </div>
        </header>

        {isOffline && (
          <div className="mx-4 mb-2 shrink-0 flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-3.5 py-2 text-xs font-medium text-amber-800">
            <WifiOff className="h-3.5 w-3.5 shrink-0" />
            <span>You are offline — reconnect to sync household changes.</span>
          </div>
        )}

        {store.error && (
          <div className="mx-4 mb-2 shrink-0 flex items-center justify-between gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-700">
            <span className="min-w-0">{store.error}</span>
            <div className="flex shrink-0 items-center gap-2">
              {!store.isDemoMode && (
                <button
                  type="button"
                  onClick={() => void handleManualSync()}
                  className="font-bold underline cursor-pointer"
                >
                  Retry
                </button>
              )}
              <button
                type="button"
                onClick={store.clearError}
                className="font-bold underline cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Horizontal 4-Screen Phone Pager */}
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
              {/* New Roommate Activity Pill */}
              {newTransactionIds.size > 0 && (
                <div className="flex items-center justify-between gap-2 rounded-2xl border border-[#E5D3B3] bg-[#FBF8F1] px-3.5 py-2 text-xs">
                  <span className="inline-flex items-center gap-1.5 font-semibold text-[#7A5E31]">
                    <Bell className="h-3.5 w-3.5 shrink-0" />
                    <span>
                      {newTransactionIds.size}{" "}
                      {newTransactionIds.size === 1 ? "new entry" : "new entries"} since your last
                      visit
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={markAllSeen}
                    className="shrink-0 rounded-full bg-[#1C1C1E] px-2.5 py-1 text-[10px] font-semibold text-white hover:bg-slate-800 cursor-pointer"
                  >
                    Mark seen
                  </button>
                </div>
              )}

              {/* Quick Bills Due / House Needs Reminder Strip */}
              {(dueSoonBillsCount > 0 || pendingNeedsCount > 0) && (
                <div className="flex flex-wrap items-center gap-2">
                  {dueSoonBillsCount > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setBudgetSubTab("bills");
                        handleSelectTab("budget");
                      }}
                      className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-[11px] font-semibold text-amber-800 hover:bg-amber-100 cursor-pointer"
                    >
                      <CalendarClock className="h-3.5 w-3.5" />
                      <span>
                        {dueSoonBillsCount} {dueSoonBillsCount === 1 ? "bill" : "bills"} due soon
                      </span>
                    </button>
                  )}
                  {pendingNeedsCount > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setBudgetSubTab("needs");
                        handleSelectTab("budget");
                      }}
                      className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                    >
                      <span>
                        {pendingNeedsCount} house {pendingNeedsCount === 1 ? "need" : "needs"} to
                        restock
                      </span>
                    </button>
                  )}
                </div>
              )}

              {/* Actionable First-Time Household Guide */}
              {isBrandNewHouse && (
                <section className="rounded-[24px] border border-[#E5D3B3] bg-[#FBF8F1] p-4 shadow-xs space-y-3">
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">
                      Welcome to {store.household.name}
                    </h2>
                    <p className="mt-0.5 text-xs text-slate-600">
                      Start by logging your first weekly contribution or inviting your roommates.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="filled"
                      onClick={() => handleOpenAdd("contribution")}
                      icon={<Plus className="h-3.5 w-3.5" />}
                      className="w-full justify-center !h-9 text-xs font-semibold"
                    >
                      First Contribution
                    </Button>
                    <Button
                      onClick={() => void handleCopyInviteQuick(store.household!.invite_code)}
                      icon={<Copy className="h-3.5 w-3.5" />}
                      className="w-full justify-center !h-9 text-xs font-semibold"
                    >
                      Copy Invite Code
                    </Button>
                  </div>
                </section>
              )}

              <KpiCards
                totalSpent={summary.totalSpent}
                totalContributed={summary.totalContributed}
                remainingBalance={summary.remainingBalance}
                allTimeBalance={summary.allTimeBalance}
                periodBudgetTarget={periodBudgetTarget}
                periodGoalLabel={
                  periodWindow.kind === "month" ? "monthly goal" : "weekly goal"
                }
                comparisonLabel={periodWindow.comparisonLabel}
                spentDeltaPct={summary.spentDeltaPct}
                contributedDeltaPct={summary.contributedDeltaPct}
              />

              <WeeklyBarChart
                dailySeries={summary.dailySeries}
                periodKind={periodWindow.kind}
                comparisonLabel={periodWindow.comparisonLabel}
                spentDeltaPct={summary.spentDeltaPct}
              />

              <CategoryBreakdown
                categories={summary.categories}
                totalSpent={summary.totalSpent}
                periodKind={periodWindow.kind}
                comparisonLabel={periodWindow.comparisonLabel}
                spentDeltaPct={summary.spentDeltaPct}
                onViewAll={() => handleSelectTab("ledger")}
              />

              <TransactionList
                title="Recent Transactions"
                transactions={summary.weekTransactions}
                currentUserId={store.profile.id}
                newTransactionIds={newTransactionIds}
                onEdit={handleOpenEdit}
                onDelete={handleDeleteTransaction}
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
                newTransactionIds={newTransactionIds}
                onEdit={handleOpenEdit}
                onDelete={handleDeleteTransaction}
              />
            </div>

            {/* Screen 3: Budget, Recurring Bills & House Needs */}
            <div
              ref={(el) => {
                paneRefs.current[2] = el;
              }}
              aria-hidden={activeTab !== "budget"}
              className="h-full w-full shrink-0 overflow-y-auto no-scrollbar px-4 pb-28"
            >
              <BudgetView
                household={store.household}
                weekWindow={periodWindow}
                summary={summary}
                subTab={budgetSubTab}
                onSubTabChange={setBudgetSubTab}
                needs={store.needs}
                bills={store.bills}
                onUpdateBudget={store.updateBudget}
                onAddNeed={async (title, category) => {
                  await store.addNeed(title, category);
                  showToast("Added to house needs");
                }}
                onToggleNeed={store.toggleNeed}
                onDeleteNeed={async (id) => {
                  await store.deleteNeed(id);
                  showToast("Item removed");
                }}
                onAddBill={async (title, amount, category, dueDay) => {
                  await store.addBill(title, amount, category, dueDay);
                  showToast("Recurring bill added");
                }}
                onDeleteBill={async (id) => {
                  await store.deleteBill(id);
                  showToast("Bill removed");
                }}
                onStartPrefillExpense={handleOpenPrefillExpense}
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
                onUpdateProfile={store.updateProfile}
                onUpdatePassword={store.updatePassword}
                onRenameHousehold={store.renameHousehold}
                onPromoteMember={store.promoteMember}
                onRemoveMember={store.removeMember}
                onRegenerateInviteCode={store.regenerateInviteCode}
                onLeaveHousehold={store.leaveHousehold}
                onDeleteAccount={store.deleteAccount}
                onSignOut={store.signOut}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Floating Glisse Liquid Glass Toast Feedback */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          data-theme="dark"
          className="keeper-dock pointer-events-none fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom))] left-1/2 z-50 -translate-x-1/2 px-4"
        >
          <Glass className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold text-white shadow-xl whitespace-nowrap">
            <CheckCircle2 className="h-3.5 w-3.5 text-[#E4CCA0] shrink-0" />
            <span>{toastMessage}</span>
          </Glass>
        </div>
      )}

      {/* Floating Dark Liquid Glass Navigation Bar */}
      <BottomDock
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        onOpenAdd={() => handleOpenAdd("expense")}
      />

      {/* Quick Record / Edit Contribution & Expense Sheet */}
      <AddTransactionModal
        open={modalOpen}
        initialType={modalInitialType}
        prefillDraft={prefillDraft}
        members={store.members}
        currentUserId={store.profile.id}
        editingTransaction={editingTx}
        onClose={handleCloseModal}
        onSubmit={handleAddTransaction}
        onUpdate={handleUpdateTransaction}
      />
    </div>
  );
}

export default App;

import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type TouchEvent } from "react";
import { Button, Glass, Menu, type MenuEntry } from "glisse";
import {
  AlertTriangle,
  Award,
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
  X,
} from "lucide-react";
import { App as CapApp } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";
import { StatusBar, Style } from "@capacitor/status-bar";
import { AccountView } from "./components/AccountView";
import { AddTransactionModal, type TransactionPrefill } from "./components/AddTransactionModal";
import { AndroidOnboarding } from "./components/AndroidOnboarding";
import { AuthScreen } from "./components/AuthScreen";
import { BottomDock } from "./components/BottomDock";
import { BudgetView } from "./components/BudgetView";
import { HouseholdOnboarding } from "./components/HouseholdOnboarding";
import { HouseholdView } from "./components/HouseholdView";
import { KeeperLogo } from "./components/KeeperLogo";
import { KpiCards } from "./components/KpiCards";
import { LedgerView } from "./components/LedgerView";
import { SoftButton } from "./components/LightControls";
import { LoadingSkeleton } from "./components/LoadingSkeleton";
import { getStoredPinHash, PinLockScreen } from "./components/PinLockScreen";
import { TransactionList } from "./components/TransactionList";
import { UpdateAvailableScreen } from "./components/UpdateAvailableScreen";
import { WelcomeVersionModal } from "./components/WelcomeVersionModal";

// Lazy-load Recharts visualizations so Welcome/Auth screens skip downloading chart code
const WeeklyBarChart = lazy(() =>
  import("./components/WeeklyBarChart").then((m) => ({ default: m.WeeklyBarChart })),
);
const CategoryBreakdown = lazy(() =>
  import("./components/CategoryBreakdown").then((m) => ({ default: m.CategoryBreakdown })),
);
import { useKeeperStore, type TransactionInput } from "./hooks/useKeeperStore";
import {
  computePeriodSummary,
  getBillDueStatus,
  getPeriodWindow,
  JS_DAY_SHORT,
  resolveWeekStartDay,
} from "./lib/analytics";
import {
  APP_VERSION,
  checkLatestRelease,
  compareSemver,
  dismissUpdateVersion,
  getLastWelcomedVersion,
  isUpdateDismissed,
  markVersionWelcomed,
  type UpdateReleaseInfo,
} from "./lib/appUpdater";
import { formatTZS } from "./lib/format";
import {
  notifyHouseholdChange,
  scheduleBillReminders,
  scheduleWeeklyBudgetCongrats,
  subscribeToAlertPopups,
} from "./lib/notifications";
import {
  addDaysISO,
  dismissWeeklyCongrats,
  evaluateOverspendPlan,
  evaluateWeeklyBudgetSuccess,
  getBoostForWeek,
  isWeeklyCongratsDismissed,
  markOverspendNotified,
  markWeeklyCongratsNotified,
  shouldNotifyOverspend,
  shouldNotifyWeeklyCongrats,
} from "./lib/overspendPlan";
import { sanitizeInviteCode } from "./lib/security";
import { supabase } from "./lib/supabase";
import type { ActiveTab, BudgetSubTab, PeriodKey, Transaction, TransactionType } from "./types";

const TAB_ORDER: ActiveTab[] = ["overview", "ledger", "budget", "household", "account"];
const PENDING_JOIN_KEY = "keeper_pending_join_code";
const LAST_SEEN_PREFIX = "keeper_last_seen_v1:";
const WEEK_START_PREFIX = "keeper_week_start_v1:";
const ANDROID_ONBOARDED_KEY = "keeper_android_onboarded_v1";
const UPDATE_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

function hasCompletedOnboarding(): boolean {
  try {
    return localStorage.getItem(ANDROID_ONBOARDED_KEY) === "1";
  } catch {
    return false;
  }
}

function markOnboardingComplete(): void {
  try {
    localStorage.setItem(ANDROID_ONBOARDED_KEY, "1");
  } catch {
    // Ignore storage errors
  }
}

const TAB_TITLES: Record<ActiveTab, string> = {
  overview: "Household overview",
  ledger: "Household ledger",
  budget: "Budget & house",
  household: "My household",
  account: "Account & support",
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
  const [visitedTabs, setVisitedTabs] = useState<Set<ActiveTab>>(() => new Set(["overview"]));
  const [budgetSubTab, setBudgetSubTab] = useState<BudgetSubTab>("pool");
  const [periodKey, setPeriodKey] = useState<PeriodKey>("this_week");
  const [modalOpen, setModalOpen] = useState(false);
  const [modalInitialType, setModalInitialType] = useState<TransactionType>("expense");
  const [prefillDraft, setPrefillDraft] = useState<TransactionPrefill | null>(null);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [pendingJoinCode, setPendingJoinCode] = useState<string | null>(() =>
    readInitialJoinCode(),
  );
  const [authView, setAuthView] = useState<"onboarding" | "signin" | "signup">(() =>
    pendingJoinCode ? "signup" : hasCompletedOnboarding() ? "signin" : "onboarding",
  );
  const autoJoinedCodeRef = useRef<string | null>(null);
  const [lastSeenAt, setLastSeenAt] = useState<string | null>(null);
  const [weekStartOverride, setWeekStartOverride] = useState<number | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const [isOffline, setIsOffline] = useState(() =>
    typeof navigator !== "undefined" ? !navigator.onLine : false,
  );
  const [forceUpdate, setForceUpdate] = useState<{
    minVersion: string;
    message: string;
    downloadUrl: string;
  } | null>(null);
  const [softUpdate, setSoftUpdate] = useState<UpdateReleaseInfo | null>(null);
  const [welcomeVersion, setWelcomeVersion] = useState<{ previousVersion: string | null } | null>(
    () => {
      const last = getLastWelcomedVersion();
      return last !== APP_VERSION ? { previousVersion: last } : null;
    },
  );
  const lastUpdateCheckRef = useRef<number>(0);
  const [pinHash, setPinHash] = useState<string | null>(() => getStoredPinHash());
  const [isLocked, setIsLocked] = useState<boolean>(() => Boolean(getStoredPinHash()));

  // Re-lock app when returning from background if PIN lock is enabled
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const listener = CapApp.addListener("appStateChange", ({ isActive }) => {
      if (!isActive && getStoredPinHash()) {
        setIsLocked(true);
      }
      if (isActive && Date.now() - lastUpdateCheckRef.current > UPDATE_CHECK_INTERVAL_MS) {
        lastUpdateCheckRef.current = Date.now();
        void checkLatestRelease()
          .then((info) => {
            if (info.hasUpdate && !isUpdateDismissed(info.latestVersion)) {
              setSoftUpdate(info);
            }
          })
          .catch(() => {});
      }
    });
    return () => {
      void listener.then((handle) => handle.remove());
    };
  }, []);

  // Automatic launch update check on native Android (deferred so it never competes with first paint)
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let active = true;
    const timer = window.setTimeout(() => {
      if (!active) return;
      lastUpdateCheckRef.current = Date.now();
      void checkLatestRelease()
        .then((info) => {
          if (!active) return;
          if (info.hasUpdate && !isUpdateDismissed(info.latestVersion)) {
            setSoftUpdate(info);
          }
        })
        .catch(() => {
          // Offline or rate-limited — fail silently
        });
    }, 2500);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, []);

  // Keep on-device bill reminders synced whenever bills update (only if user opted in)
  useEffect(() => {
    if (store.bills.length > 0) {
      void scheduleBillReminders(store.bills);
    }
  }, [store.bills]);

  // Remote minimum version check (deferred & fails open if offline or table not yet created)
  useEffect(() => {
    if (!supabase) return;
    let active = true;
    const timer = window.setTimeout(() => {
      if (!active || !supabase) return;
      void supabase
        .from("app_config")
        .select("min_app_version, update_message, download_url")
        .eq("id", 1)
        .maybeSingle()
        .then(({ data }) => {
          if (!active || !data?.min_app_version) return;
          if (compareSemver(String(data.min_app_version), APP_VERSION) > 0) {
            setForceUpdate({
              minVersion: String(data.min_app_version),
              message:
                String(data.update_message || "") ||
                "A newer version of Keeper is required. Please download the latest update to continue.",
              downloadUrl:
                String(data.download_url || "") ||
                "https://github.com/realmadede/Keeper/releases/latest/download/Keeper.apk",
            });
          }
        });
    }, 2500);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, []);

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
    return subscribeToAlertPopups((title, body) => {
      showToast(`${title} · ${body}`);
    });
  }, [showToast]);

  // Native Android OAuth deep-link callback (Chrome Custom Tabs -> app.keeper.household://auth-callback)
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const listener = CapApp.addListener("appUrlOpen", async ({ url }) => {
      if (!url) return;
      if (url.startsWith("app.keeper.household://auth-callback")) {
        void Browser.close().catch(() => {});
        if (!supabase) return;
        try {
          const parsed = new URL(url);
          const code = parsed.searchParams.get("code");
          if (code) {
            await supabase.auth.exchangeCodeForSession(code);
            return;
          }
          const hashParams = new URLSearchParams(parsed.hash.replace(/^#/, ""));
          const accessToken = hashParams.get("access_token");
          const refreshToken = hashParams.get("refresh_token");
          if (accessToken && refreshToken) {
            await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
          }
        } catch {
          // Ignore malformed callback URL
        }
      }
    });
    return () => {
      void listener.then((handle) => handle.remove());
    };
  }, []);

  // Native Android status bar & hardware Back button handling
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    void StatusBar.setStyle({ style: Style.Light }).catch(() => {});
    void StatusBar.setBackgroundColor({ color: "#F6F5F2" }).catch(() => {});

    const listener = CapApp.addListener("backButton", () => {
      if (modalOpen) {
        setModalOpen(false);
        setEditingTx(null);
        setPrefillDraft(null);
        return;
      }
      if (activeTab !== "overview") {
        setActiveTab("overview");
        return;
      }
      void CapApp.minimizeApp();
    });

    return () => {
      void listener.then((handle) => handle.remove());
    };
  }, [activeTab, modalOpen]);

  useEffect(() => {
    const goOnline = () => {
      setIsOffline(false);
      void (async () => {
        const synced = await store.syncOfflineQueue();
        if (synced > 0) {
          showToast(`Synced ${synced} offline ${synced === 1 ? "entry" : "entries"}`);
        } else {
          await store.refresh();
        }
      })();
    };
    const goOffline = () => setIsOffline(true);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, [showToast, store.refresh, store.syncOfflineQueue]);

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

  // Load saved custom week-start day override for this household (or null for auto from first entry)
  useEffect(() => {
    const hid = store.household?.id;
    if (!hid) {
      setWeekStartOverride(null);
      return;
    }
    try {
      const raw = localStorage.getItem(`${WEEK_START_PREFIX}${hid}`);
      if (raw !== null && raw !== "") {
        const parsed = Number(raw);
        if (Number.isInteger(parsed) && parsed >= 0 && parsed <= 6) {
          setWeekStartOverride(parsed);
          return;
        }
      }
    } catch {
      // Ignore storage read errors
    }
    setWeekStartOverride(null);
  }, [store.household?.id]);

  const handleChangeWeekStart = useCallback(
    (day: number | null) => {
      setWeekStartOverride(day);
      const hid = store.household?.id;
      if (hid) {
        try {
          const key = `${WEEK_START_PREFIX}${hid}`;
          if (day === null) localStorage.removeItem(key);
          else localStorage.setItem(key, String(day));
        } catch {
          // Ignore storage write errors
        }
      }
      if (day === null) {
        showToast("Week cycle set to auto from first entry");
      } else {
        showToast(`7-day week now starts on ${JS_DAY_SHORT[day]}`);
      }
    },
    [showToast, store.household?.id],
  );

  const weekStartInfo = useMemo(
    () =>
      resolveWeekStartDay(
        store.transactions,
        store.household?.created_at,
        weekStartOverride,
      ),
    [store.household?.created_at, store.transactions, weekStartOverride],
  );

  const activeIndex = TAB_ORDER.indexOf(activeTab);
  const periodWindow = useMemo(
    () => getPeriodWindow(periodKey, new Date(), weekStartInfo.startDay),
    [periodKey, weekStartInfo.startDay],
  );

  // Clear pending invite code once the user is inside a household, or auto-join right after auth
  useEffect(() => {
    if (store.household && pendingJoinCode) {
      setPendingJoinCode(null);
      try {
        sessionStorage.removeItem(PENDING_JOIN_KEY);
      } catch {
        // Ignore storage errors
      }
      return;
    }
    if (
      store.profile &&
      !store.household &&
      !store.loading &&
      pendingJoinCode &&
      autoJoinedCodeRef.current !== pendingJoinCode
    ) {
      autoJoinedCodeRef.current = pendingJoinCode;
      void store.joinHousehold(pendingJoinCode).catch(() => {
        // Falls back to HouseholdOnboarding with error visible and code pre-filled
      });
    }
  }, [pendingJoinCode, store.household, store.joinHousehold, store.loading, store.profile]);

  const handleStartJoinWithCode = useCallback((cleanCode: string) => {
    autoJoinedCodeRef.current = null;
    setPendingJoinCode(cleanCode);
    try {
      sessionStorage.setItem(PENDING_JOIN_KEY, cleanCode);
    } catch {
      // Ignore storage errors
    }
    setAuthView("signup");
  }, []);

  const summary = useMemo(() => {
    if (!store.household) return null;
    return computePeriodSummary(
      store.transactions,
      store.members,
      store.household.member_weekly_share,
      periodKey,
      new Date(),
      weekStartInfo.startDay,
      store.household.weekly_budget_target,
      store.household.weekly_boosts,
    );
  }, [periodKey, store.household, store.members, store.transactions, weekStartInfo.startDay]);

  const dueSoonBillsCount = useMemo(
    () => store.bills.filter((b) => getBillDueStatus(b).isDueSoon).length,
    [store.bills],
  );
  const pendingNeedsCount = useMemo(
    () => store.needs.filter((n) => !n.is_bought).length,
    [store.needs],
  );

  // Weekly budget overspend detection (evaluated on current week regardless of active filter)
  const weeklyOverspend = useMemo(() => {
    if (!store.household || store.household.weekly_budget_target <= 0) {
      return { amount: 0, target: 0, spent: 0, weekStartISO: "" };
    }
    const thisWeekWin = getPeriodWindow("this_week", new Date(), weekStartInfo.startDay);
    const thisWeekSum = computePeriodSummary(
      store.transactions,
      store.members,
      store.household.member_weekly_share,
      "this_week",
      new Date(),
      weekStartInfo.startDay,
      store.household.weekly_budget_target,
      store.household.weekly_boosts,
    );
    const evalPlan = evaluateOverspendPlan(
      store.household.overspend_plan,
      thisWeekWin.startISO,
      Math.max(1, store.members.length),
    );
    const thisWeekBoost = getBoostForWeek(store.household.weekly_boosts, thisWeekWin.startISO);
    const deduction = evalPlan.status === "active" ? evalPlan.budgetDeduction : 0;
    const effectiveTarget = Math.max(
      0,
      store.household.weekly_budget_target + (thisWeekBoost?.extraTotal ?? 0) - deduction,
    );
    const over = Math.max(0, thisWeekSum.totalSpent - effectiveTarget);
    return {
      amount: over,
      target: effectiveTarget,
      spent: thisWeekSum.totalSpent,
      weekStartISO: thisWeekWin.startISO,
    };
  }, [store.household, store.members, store.transactions, weekStartInfo.startDay]);

  // Completed previous-week on-budget celebration check (requires real spending <= target)
  const lastWeekCongrats = useMemo(() => {
    if (!store.household || store.household.weekly_budget_target <= 0) {
      return {
        qualified: false,
        weekStartISO: "",
        rangeLabel: "",
        spentAmount: 0,
        targetAmount: 0,
        savedAmount: 0,
      };
    }
    const lastWeekWin = getPeriodWindow("last_week", new Date(), weekStartInfo.startDay);
    const lastWeekSum = computePeriodSummary(
      store.transactions,
      store.members,
      store.household.member_weekly_share,
      "last_week",
      new Date(),
      weekStartInfo.startDay,
      store.household.weekly_budget_target,
      store.household.weekly_boosts,
    );
    const evalPlan = evaluateOverspendPlan(
      store.household.overspend_plan,
      lastWeekWin.startISO,
      Math.max(1, store.members.length),
    );
    const lastWeekBoost = getBoostForWeek(store.household.weekly_boosts, lastWeekWin.startISO);
    const deduction = evalPlan.status === "active" ? evalPlan.budgetDeduction : 0;
    const effectiveTarget = Math.max(
      0,
      store.household.weekly_budget_target + (lastWeekBoost?.extraTotal ?? 0) - deduction,
    );
    const res = evaluateWeeklyBudgetSuccess(
      lastWeekSum.totalSpent,
      effectiveTarget,
      lastWeekWin.startISO,
    );
    return { ...res, rangeLabel: lastWeekWin.monthLabel };
  }, [store.household, store.members, store.transactions, weekStartInfo.startDay]);

  const [dismissedCongratsWeek, setDismissedCongratsWeek] = useState<string | null>(null);
  const showWeeklyCongratsCard = Boolean(
    store.household &&
      lastWeekCongrats.qualified &&
      dismissedCongratsWeek !== lastWeekCongrats.weekStartISO &&
      !isWeeklyCongratsDismissed(store.household.id, lastWeekCongrats.weekStartISO),
  );

  // Schedule (or cancel if overspent) end-of-week Android local notification for this week
  useEffect(() => {
    if (!store.household || store.isDemoMode || !weeklyOverspend.weekStartISO) return;
    void scheduleWeeklyBudgetCongrats({
      householdName: store.household.name,
      weekEndNextDayISO: addDaysISO(weeklyOverspend.weekStartISO, 7),
      spentAmount: weeklyOverspend.spent,
      targetAmount: weeklyOverspend.target,
    });
  }, [store.household, store.isDemoMode, weeklyOverspend]);

  // Fire once-per-week congratulations notification when last week finished on budget
  useEffect(() => {
    if (!store.household || store.isDemoMode || !lastWeekCongrats.qualified) return;
    if (!shouldNotifyWeeklyCongrats(store.household.id, lastWeekCongrats.weekStartISO)) return;
    markWeeklyCongratsNotified(store.household.id, lastWeekCongrats.weekStartISO);
    void notifyHouseholdChange(
      "Weekly budget goal achieved",
      `Well done! ${store.household.name} stayed within budget last week (${formatTZS(lastWeekCongrats.spentAmount)} of ${formatTZS(lastWeekCongrats.targetAmount)}, saved ${formatTZS(lastWeekCongrats.savedAmount)}).`,
    );
  }, [lastWeekCongrats, store.household, store.isDemoMode]);

  // Pop up notification + toast when weekly spending exceeds budget (deduplicated per week/overage)
  useEffect(() => {
    if (!store.household || store.isDemoMode || weeklyOverspend.amount <= 0) return;
    if (
      !shouldNotifyOverspend(
        store.household.id,
        weeklyOverspend.weekStartISO,
        weeklyOverspend.amount,
      )
    ) {
      return;
    }
    markOverspendNotified(
      store.household.id,
      weeklyOverspend.weekStartISO,
      weeklyOverspend.amount,
    );
    const title = "Weekly budget exceeded";
    const body = `Overspent by ${formatTZS(weeklyOverspend.amount)} over your ${formatTZS(weeklyOverspend.target)} weekly budget. Tap Budget to review recovery options.`;
    showToast(`Overspent weekly budget by ${formatTZS(weeklyOverspend.amount)}`);
    void notifyHouseholdChange(title, body, { inAppToast: false });
  }, [showToast, store.household, store.isDemoMode, weeklyOverspend]);

  const handleSelectTab = (tab: ActiveTab) => {
    setActiveTab(tab);
    setVisitedTabs((prev) => {
      if (prev.has(tab)) return prev;
      const next = new Set(prev);
      next.add(tab);
      return next;
    });
    const idx = TAB_ORDER.indexOf(tab);
    paneRefs.current[idx]?.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleOpenAdd = (initialType: TransactionType = "expense") => {
    setEditingTx(null);
    setPrefillDraft(null);
    setModalInitialType(initialType);
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
    options?: { outOfPocketBy?: string },
  ) => {
    await store.addTransaction(input);
    if (input.type === "expense" && options?.outOfPocketBy) {
      await store.addTransaction({
        type: "contribution",
        amount: input.amount,
        category: "contribution",
        description: `Out-of-pocket: ${input.description}`.slice(0, 200),
        transaction_date: input.transaction_date,
        paid_by: options.outOfPocketBy,
      });
    }
    if (prefill?.needId) {
      await store.toggleNeed(prefill.needId, true);
    }
    if (prefill?.billId) {
      await store.markBillPaid(prefill.billId);
    }
    if (input.type === "expense" && options?.outOfPocketBy) {
      showToast(`Recorded ${formatTZS(input.amount)} expense & credited share`);
      return;
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
    const synced = await store.syncOfflineQueue();
    if (synced > 0) {
      showToast(`Synced ${synced} offline ${synced === 1 ? "entry" : "entries"}`);
      return;
    }
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

  if (pinHash && isLocked) {
    return <PinLockScreen expectedHash={pinHash} onUnlock={() => setIsLocked(false)} />;
  }

  if (forceUpdate) {
    return (
      <UpdateAvailableScreen
        latestVersion={forceUpdate.minVersion}
        changelog={[forceUpdate.message]}
        downloadUrl={forceUpdate.downloadUrl}
        isForced
        forcedMessage={`Installed v${APP_VERSION} · Required v${forceUpdate.minVersion}+`}
      />
    );
  }

  if (softUpdate) {
    return (
      <UpdateAvailableScreen
        latestVersion={softUpdate.latestVersion}
        changelog={softUpdate.changelog}
        downloadUrl={softUpdate.downloadUrl}
        onDismiss={() => {
          dismissUpdateVersion(softUpdate.latestVersion);
          setSoftUpdate(null);
        }}
      />
    );
  }

  if (store.loading) {
    return <LoadingSkeleton onRetry={() => void store.refresh()} />;
  }

  if (!store.profile || store.passwordRecoveryMode) {
    if (!store.passwordRecoveryMode && !pendingJoinCode && authView === "onboarding") {
      return (
        <AndroidOnboarding
          onFinishToSignUp={() => {
            markOnboardingComplete();
            setAuthView("signup");
          }}
          onFinishToSignIn={() => {
            markOnboardingComplete();
            setAuthView("signin");
          }}
          onJoinWithCode={(code) => {
            markOnboardingComplete();
            handleStartJoinWithCode(code);
          }}
          onEnterDemo={() => {
            markOnboardingComplete();
            store.enterDemoMode();
          }}
        />
      );
    }

    return (
      <>
        <AuthScreen
          isSupabaseReady={store.isSupabaseReady}
          initialMode={authView === "signup" ? "signup" : "signin"}
          passwordRecoveryMode={store.passwordRecoveryMode}
          pendingInviteCode={pendingJoinCode}
          error={store.error}
          onBack={() => {
            setPendingJoinCode(null);
            try {
              sessionStorage.removeItem(PENDING_JOIN_KEY);
            } catch {
              // Ignore storage errors
            }
            setAuthView("onboarding");
          }}
          onSignIn={store.signIn}
          onSignUp={store.signUp}
          onSignInWithGoogle={store.signInWithGoogle}
          onResetPassword={store.resetPassword}
          onUpdatePassword={store.updatePassword}
          onEnterDemo={store.enterDemoMode}
        />
        {welcomeVersion && !store.passwordRecoveryMode && (
          <WelcomeVersionModal
            previousVersion={welcomeVersion.previousVersion}
            onContinue={() => {
              markVersionWelcomed(APP_VERSION);
              setWelcomeVersion(null);
            }}
          />
        )}
      </>
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
    const win = getPeriodWindow(key, new Date(), weekStartInfo.startDay);
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

  return (
    <div className="h-dvh overflow-hidden flex flex-col">
      <div className="mx-auto flex h-full w-full max-w-[440px] flex-col">
        {/* Anchored Phone Top Bar with iOS notch safe-area support */}
        <header className="shrink-0 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            {activeTab === "overview" ? (
              <KeeperLogo size={36} className="shrink-0 drop-shadow-xs" />
            ) : (
              <Button
                type="button"
                aria-label="Back to overview"
                onClick={() => handleSelectTab("overview")}
                icon={<ChevronLeft className="h-4 w-4 text-[#1C1C1E]" />}
                className="!h-9 !w-9 shrink-0"
              />
            )}
            <div className="min-w-0">
              <h1 className="truncate text-base font-semibold tracking-tight text-[#1C1C1E] leading-tight">
                {TAB_TITLES[activeTab]}
              </h1>
              <p className="truncate text-xs text-[#52525B]">
                {store.household.name} · {periodWindow.monthLabel}
              </p>
            </div>
          </div>

          {/* Manual Sync + Weekly/Monthly Period Switcher (Glisse Liquid Glass) */}
          <div className="flex items-center gap-1.5 shrink-0">
            {!store.isDemoMode && (
              <Button
                type="button"
                aria-label="Sync household now"
                disabled={store.refreshing}
                onClick={() => void handleManualSync()}
                icon={
                  <RotateCw
                    className={`h-3.5 w-3.5 text-[#52525B] ${store.refreshing ? "animate-spin" : ""}`}
                  />
                }
                className="!h-9 !w-9 shrink-0"
              />
            )}
            <Glass className="max-w-[96px] truncate rounded-full px-3 py-1.5 text-xs font-medium text-[#1C1C1E]">
              {periodWindow.label}
            </Glass>
            <Menu
              aria-label="Select period"
              align="end"
              icon={<Calendar className="h-4 w-4 text-[#1C1C1E]" />}
              items={periodMenuItems}
            />
          </div>
        </header>

        {isOffline && (
          <Glass className="mx-4 mb-2 shrink-0 flex items-center gap-2 rounded-2xl px-3.5 py-2 text-xs font-medium text-[#8F703F]">
            <WifiOff className="h-3.5 w-3.5 shrink-0" />
            <span>Offline — new entries are saved locally and sync when back online</span>
          </Glass>
        )}

        {store.pendingSyncCount > 0 && !isOffline && (
          <Glass className="mx-4 mb-2 shrink-0 flex items-center justify-between gap-2 rounded-2xl px-3.5 py-2 text-xs font-medium text-[#8F703F]">
            <span>
              {store.pendingSyncCount} offline{" "}
              {store.pendingSyncCount === 1 ? "entry" : "entries"} waiting to sync
            </span>
            <button
              type="button"
              onClick={() => void handleManualSync()}
              className="shrink-0 rounded-full bg-[#1C1C1E] px-2.5 py-1 text-[11px] font-medium text-white hover:bg-[#2C2C30] cursor-pointer"
            >
              Sync now
            </button>
          </Glass>
        )}

        {store.error && (
          <div className="mx-4 mb-2 shrink-0 flex items-center justify-between gap-2 rounded-xl border border-rose-700/20 bg-rose-50/80 px-3.5 py-2.5 text-xs font-medium text-rose-700">
            <span className="min-w-0">{store.error}</span>
            <div className="flex shrink-0 items-center gap-2">
              {!store.isDemoMode && (
                <button
                  type="button"
                  onClick={() => void handleManualSync()}
                  className="font-semibold underline cursor-pointer"
                >
                  Retry
                </button>
              )}
              <button
                type="button"
                onClick={store.clearError}
                className="font-semibold underline cursor-pointer"
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
              {/* New Roommate Activity Pill (Glisse Liquid Glass) */}
              {newTransactionIds.size > 0 && (
                <Glass className="flex items-center justify-between gap-2 rounded-2xl px-3.5 py-2 text-xs">
                  <span className="inline-flex items-center gap-2 font-medium text-[#1C1C1E]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#C6A87C]" />
                    <Bell className="h-3.5 w-3.5 shrink-0 text-[#52525B]" />
                    <span>
                      {newTransactionIds.size}{" "}
                      {newTransactionIds.size === 1 ? "new entry" : "new entries"} since your last
                      visit
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={markAllSeen}
                    className="shrink-0 rounded-full bg-[#1C1C1E] px-2.5 py-1 text-xs font-medium text-white hover:bg-[#2C2C30] transition-colors cursor-pointer"
                  >
                    Mark seen
                  </button>
                </Glass>
              )}

              {/* Weekly On-Budget Congratulations Banner (once per completed on-budget week) */}
              {showWeeklyCongratsCard && (
                <div className="flex items-start justify-between gap-3 rounded-2xl border border-emerald-700/20 bg-emerald-50/85 px-3.5 py-3">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-700 text-white">
                      <Award className="h-4 w-4 text-[#E4CCA0]" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-emerald-900">
                        Well done · On budget last week
                      </div>
                      <p className="mt-0.5 text-[11px] leading-snug text-emerald-900/85 tabular-nums">
                        {store.household.name} spent {formatTZS(lastWeekCongrats.spentAmount)} of{" "}
                        {formatTZS(lastWeekCongrats.targetAmount)} ({lastWeekCongrats.rangeLabel})
                        {lastWeekCongrats.savedAmount > 0
                          ? ` — saved ${formatTZS(lastWeekCongrats.savedAmount)}`
                          : " — right on target"}
                        .
                      </p>
                      {summary.allTimeBalance > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setPeriodKey("this_week");
                            setBudgetSubTab("pool");
                            handleSelectTab("budget");
                          }}
                          className="mt-1.5 inline-flex items-center rounded-lg border border-emerald-800/20 bg-white px-2.5 py-1 text-[11px] font-medium text-emerald-900 hover:bg-emerald-100/60 cursor-pointer"
                        >
                          Use leftover to lower this week&apos;s shares
                        </button>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-label="Dismiss weekly congratulations"
                    onClick={() => {
                      dismissWeeklyCongrats(store.household!.id, lastWeekCongrats.weekStartISO);
                      setDismissedCongratsWeek(lastWeekCongrats.weekStartISO);
                    }}
                    className="rounded-lg p-1 text-emerald-800/70 hover:bg-emerald-100 hover:text-emerald-900 cursor-pointer"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}

              {/* Quick Overspend / Bills Due / House Needs Reminder Strip */}
              {(weeklyOverspend.amount > 0 || dueSoonBillsCount > 0 || pendingNeedsCount > 0) && (
                <div className="flex flex-wrap items-center gap-2">
                  {weeklyOverspend.amount > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setPeriodKey("this_week");
                        setBudgetSubTab("pool");
                        handleSelectTab("budget");
                      }}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-rose-700/25 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-800 hover:bg-rose-100/70 transition-colors cursor-pointer"
                    >
                      <AlertTriangle className="h-3.5 w-3.5 text-rose-700" />
                      <span>Overspent by {formatTZS(weeklyOverspend.amount)}</span>
                    </button>
                  )}
                  {dueSoonBillsCount > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setBudgetSubTab("bills");
                        handleSelectTab("budget");
                      }}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-stone-900/[0.08] bg-white px-3 py-1.5 text-xs font-medium text-[#1C1C1E] hover:bg-stone-50 transition-colors cursor-pointer"
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-[#C6A87C]" />
                      <CalendarClock className="h-3.5 w-3.5 text-[#52525B]" />
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
                      className="inline-flex items-center gap-1.5 rounded-xl border border-stone-900/[0.08] bg-white px-3 py-1.5 text-xs font-medium text-[#52525B] hover:bg-stone-50 hover:text-[#1C1C1E] transition-colors cursor-pointer"
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
                <section className="rounded-2xl border border-stone-900/[0.08] bg-white p-4 space-y-3">
                  <div>
                    <h2 className="text-sm font-semibold text-[#1C1C1E]">
                      {store.household.name} is ready
                    </h2>
                    <p className="mt-0.5 text-xs text-[#52525B]">
                      Record your first weekly contribution or copy the invite key for your roommates
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <SoftButton
                      variant="filled"
                      onClick={() => handleOpenAdd("contribution")}
                      icon={<Plus className="h-3.5 w-3.5" />}
                      className="w-full !h-9 text-xs font-medium"
                    >
                      First contribution
                    </SoftButton>
                    <SoftButton
                      onClick={() => void handleCopyInviteQuick(store.household!.invite_code)}
                      icon={<Copy className="h-3.5 w-3.5" />}
                      className="w-full !h-9 text-xs font-medium"
                    >
                      Copy invite key
                    </SoftButton>
                  </div>
                </section>
              )}

              <KpiCards
                totalSpent={summary.totalSpent}
                totalContributed={summary.effectiveTotalContributed}
                appliedAdvanceCredit={summary.appliedAdvanceCredit}
                remainingBalance={summary.remainingBalance}
                allTimeBalance={summary.allTimeBalance}
                periodLabel={periodWindow.label}
                comparisonLabel={periodWindow.comparisonLabel}
                spentDeltaPct={summary.spentDeltaPct}
                contributedDeltaPct={summary.contributedDeltaPct}
              />

              <Suspense
                fallback={
                  <div className="h-[260px] rounded-2xl border border-stone-900/[0.08] bg-white p-4 animate-pulse" />
                }
              >
                <WeeklyBarChart
                  dailySeries={summary.dailySeries}
                  periodKind={periodWindow.kind}
                  comparisonLabel={periodWindow.comparisonLabel}
                  spentDeltaPct={summary.spentDeltaPct}
                  appliedAdvanceCredit={summary.appliedAdvanceCredit}
                />
              </Suspense>

              <Suspense
                fallback={
                  <div className="h-[220px] rounded-2xl border border-stone-900/[0.08] bg-white p-4 animate-pulse" />
                }
              >
                <CategoryBreakdown
                  categories={summary.categories}
                  totalSpent={summary.totalSpent}
                  periodKind={periodWindow.kind}
                  comparisonLabel={periodWindow.comparisonLabel}
                  spentDeltaPct={summary.spentDeltaPct}
                  onViewAll={() => handleSelectTab("ledger")}
                />
              </Suspense>

              <TransactionList
                title="Recent activity"
                transactions={summary.weekTransactions}
                currentUserId={store.profile.id}
                newTransactionIds={newTransactionIds}
                onEdit={handleOpenEdit}
                onDelete={handleDeleteTransaction}
                maxItems={5}
                onViewAll={() => handleSelectTab("ledger")}
              />
            </div>

            {/* Screen 2: Ledger (mounted on demand for faster initial paint) */}
            <div
              ref={(el) => {
                paneRefs.current[1] = el;
              }}
              aria-hidden={activeTab !== "ledger"}
              className="h-full w-full shrink-0 overflow-y-auto no-scrollbar px-4 pb-28"
            >
              {visitedTabs.has("ledger") && (
                <LedgerView
                  householdName={store.household.name}
                  transactions={store.transactions}
                  members={store.members}
                  currentUserId={store.profile.id}
                  newTransactionIds={newTransactionIds}
                  onEdit={handleOpenEdit}
                  onDelete={handleDeleteTransaction}
                />
              )}
            </div>

            {/* Screen 3: Budget, Recurring Bills & House Needs (mounted on demand) */}
            <div
              ref={(el) => {
                paneRefs.current[2] = el;
              }}
              aria-hidden={activeTab !== "budget"}
              className="h-full w-full shrink-0 overflow-y-auto no-scrollbar px-4 pb-28"
            >
              {visitedTabs.has("budget") && (
                <BudgetView
                  household={store.household}
                  members={store.members}
                  currentUserId={store.profile.id}
                  weekWindow={periodWindow}
                  summary={summary}
                  subTab={budgetSubTab}
                  onSubTabChange={setBudgetSubTab}
                  weekStartOverride={weekStartOverride}
                  autoStartDay={weekStartInfo.autoDay}
                  onChangeWeekStart={handleChangeWeekStart}
                  needs={store.needs}
                  bills={store.bills}
                  billPayments={store.billPayments}
                  onUpdateBudget={store.updateBudget}
                  onUpdateOverspendPlan={async (plan) => {
                    await store.updateOverspendPlan(plan);
                    showToast(plan ? "Overspend recovery plan saved" : "Recovery plan cancelled");
                  }}
                  onUpdateSurplusPlan={async (plan) => {
                    await store.updateSurplusPlan(plan);
                    showToast(
                      plan
                        ? "Leftover applied to lower this week's shares"
                        : "Leftover kept in Cash on hand buffer",
                    );
                  }}
                  onSetWeeklyBoost={async (entry, weekStartISO) => {
                    await store.setWeeklyBoost(entry, weekStartISO);
                    showToast(
                      entry
                        ? `One-time boost (+${formatTZS(entry.extraPerMember)}/member) applied`
                        : "One-time boost cancelled",
                    );
                  }}
                  onAddNeed={async (title, category, options) => {
                    await store.addNeed(title, category, options);
                    showToast("Added to house needs");
                  }}
                  onMarkNeedBought={async (id, options) => {
                    await store.markNeedBought(id, options);
                    showToast("Marked as bought");
                  }}
                  onToggleNeedMemberSettled={store.toggleNeedMemberSettled}
                  onToggleNeed={store.toggleNeed}
                  onDeleteNeed={async (id) => {
                    await store.deleteNeed(id);
                    showToast("Item removed");
                  }}
                  onAddBill={async (
                    title,
                    amount,
                    category,
                    dueDay,
                    intervalMonths,
                    paidDateISO,
                    paidMode,
                    paidBy,
                    poolAmountUsed,
                  ) => {
                    await store.addBill(
                      title,
                      amount,
                      category,
                      dueDay,
                      intervalMonths,
                      paidDateISO,
                      paidMode,
                      paidBy,
                      poolAmountUsed,
                    );
                    showToast("Recurring bill saved");
                  }}
                  onMarkBillPaid={async (id, paidDateISO, paidMode, paidBy, poolAmountUsed) => {
                    await store.markBillPaid(id, paidDateISO, paidMode, paidBy, poolAmountUsed);
                    showToast("Bill payment saved");
                  }}
                  onToggleBillMemberSettled={store.toggleBillMemberSettled}
                  onDeleteBill={async (id) => {
                    await store.deleteBill(id);
                    showToast("Bill removed");
                  }}
                />
              )}
            </div>

            {/* Screen 4: Household (mounted on demand) */}
            <div
              ref={(el) => {
                paneRefs.current[3] = el;
              }}
              aria-hidden={activeTab !== "household"}
              className="h-full w-full shrink-0 overflow-y-auto no-scrollbar px-4 pb-28"
            >
              {visitedTabs.has("household") && (
                <HouseholdView
                  household={store.household}
                  profile={store.profile}
                  members={store.members}
                  transactions={store.transactions}
                  bills={store.bills}
                  needs={store.needs}
                  isDemoMode={store.isDemoMode}
                  realtimeConnected={store.realtimeConnected}
                  onRenameHousehold={store.renameHousehold}
                  onPromoteMember={store.promoteMember}
                  onRemoveMember={store.removeMember}
                  onRegenerateInviteCode={store.regenerateInviteCode}
                  onSettlePairwiseDebts={async (fromId, toId, billIds, needIds) => {
                    await store.settlePairwiseDebts(fromId, toId, billIds, needIds);
                    showToast("Settled all pending items");
                  }}
                />
              )}
            </div>

            {/* Screen 5: Account & Support (mounted on demand) */}
            <div
              ref={(el) => {
                paneRefs.current[4] = el;
              }}
              aria-hidden={activeTab !== "account"}
              className="h-full w-full shrink-0 overflow-y-auto no-scrollbar px-4 pb-28"
            >
              {visitedTabs.has("account") && (
                <AccountView
                  profile={store.profile}
                  householdName={store.household.name}
                  memberRole={
                    store.members.find((m) => m.user_id === store.profile?.id)?.role ?? "member"
                  }
                  bills={store.bills}
                  isDemoMode={store.isDemoMode}
                  pendingSyncCount={store.pendingSyncCount}
                  onSyncNow={async () => {
                    await store.syncOfflineQueue();
                  }}
                  onUpdateProfile={store.updateProfile}
                  onUpdatePassword={store.updatePassword}
                  onLeaveHousehold={store.leaveHousehold}
                  onDeleteAccount={store.deleteAccount}
                  onSignOut={store.signOut}
                  onSubmitFeedback={store.submitAppFeedback}
                  onPinHashChange={setPinHash}
                  onOpenUpdate={(info) => setSoftUpdate(info)}
                />
              )}
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
          <Glass className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-medium text-white shadow-xl whitespace-nowrap">
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

      {/* First-install / post-update version welcome card */}
      {welcomeVersion && (
        <WelcomeVersionModal
          userName={store.profile.full_name}
          previousVersion={welcomeVersion.previousVersion}
          onContinue={() => {
            markVersionWelcomed(APP_VERSION);
            setWelcomeVersion(null);
          }}
        />
      )}
    </div>
  );
}

export default App;

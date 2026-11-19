import type {
  Household,
  HouseholdMember,
  HouseholdNeed,
  Profile,
  RecurringBill,
  Transaction,
} from "../types";
import { getMonthKey, getWeekWindow } from "./analytics";

export function createDemoSeed() {
  const thisWeek = getWeekWindow(0);
  const lastWeek = getWeekWindow(-1);

  const profiles: Profile[] = [
    { id: "demo-1", full_name: "Amani Juma", email: "amani@keeper.home", avatar_color: "#BFA377" },
    { id: "demo-2", full_name: "Neema Hassan", email: "neema@keeper.home", avatar_color: "#3B82F6" },
    { id: "demo-3", full_name: "Baraka Paul", email: "baraka@keeper.home", avatar_color: "#14B8A6" },
    { id: "demo-4", full_name: "Zainab Musa", email: "zainab@keeper.home", avatar_color: "#F97316" },
  ];

  const household: Household = {
    id: "demo-household",
    name: "Sinza House 14",
    currency: "TZS",
    weekly_budget_target: 240000,
    member_weekly_share: 60000,
    invite_code: "SNZ414KP",
    created_by: "demo-1",
    created_at: new Date().toISOString(),
  };

  const members: HouseholdMember[] = profiles.map((profile, idx) => ({
    household_id: household.id,
    user_id: profile.id,
    role: idx === 0 ? "admin" : "member",
    joined_at: new Date().toISOString(),
    profile,
  }));

  const day = (offset: number) => thisWeek.days[Math.min(6, Math.max(0, offset))].iso;
  const prevDay = (offset: number) => lastWeek.days[Math.min(6, Math.max(0, offset))].iso;

  const transactions: Transaction[] = [
    {
      id: "tx-1",
      household_id: household.id,
      recorded_by: "demo-1",
      type: "contribution",
      amount: 60000,
      category: "contribution",
      description: "Weekly House Pool",
      transaction_date: day(0),
      created_at: `${day(0)}T08:30:00Z`,
      recorder: profiles[0],
    },
    {
      id: "tx-2",
      household_id: household.id,
      recorded_by: "demo-2",
      type: "contribution",
      amount: 60000,
      category: "contribution",
      description: "Weekly House Pool",
      transaction_date: day(1),
      created_at: `${day(1)}T09:15:00Z`,
      recorder: profiles[1],
    },
    {
      id: "tx-3",
      household_id: household.id,
      recorded_by: "demo-3",
      type: "contribution",
      amount: 60000,
      category: "contribution",
      description: "M-Pesa Pool Transfer",
      transaction_date: day(2),
      created_at: `${day(2)}T11:00:00Z`,
      recorder: profiles[2],
    },
    {
      id: "tx-4",
      household_id: household.id,
      recorded_by: "demo-1",
      paid_by: "demo-4",
      type: "contribution",
      amount: 45000,
      category: "contribution",
      description: "Partial Weekly Share (Cash)",
      transaction_date: day(3),
      created_at: `${day(3)}T10:20:00Z`,
      recorder: profiles[0],
      payer: profiles[3],
    },
    {
      id: "tx-5",
      household_id: household.id,
      recorded_by: "demo-2",
      type: "expense",
      amount: 42000,
      category: "food",
      description: "Kariakoo Market Groceries",
      transaction_date: day(1),
      created_at: `${day(1)}T16:40:00Z`,
      recorder: profiles[1],
    },
    {
      id: "tx-6",
      household_id: household.id,
      recorded_by: "demo-1",
      type: "expense",
      amount: 35000,
      category: "electricity_water",
      description: "LUKU Tokens + DAWASA",
      transaction_date: day(2),
      created_at: `${day(2)}T13:10:00Z`,
      recorder: profiles[0],
    },
    {
      id: "tx-7",
      household_id: household.id,
      recorded_by: "demo-3",
      type: "expense",
      amount: 25000,
      category: "security_internet",
      description: "Shared Fiber Wi-Fi & Guard",
      transaction_date: day(3),
      created_at: `${day(3)}T15:05:00Z`,
      recorder: profiles[2],
    },
    {
      id: "tx-8",
      household_id: household.id,
      recorded_by: "demo-4",
      type: "expense",
      amount: 18500,
      category: "supplies",
      description: "Cooking Gas Refill & Soap",
      transaction_date: day(3),
      created_at: `${day(3)}T18:00:00Z`,
      recorder: profiles[3],
    },
    {
      id: "tx-9",
      household_id: household.id,
      recorded_by: "demo-1",
      type: "expense",
      amount: 14500,
      category: "food",
      description: "Rice, Oil & Vegetables",
      transaction_date: day(4),
      created_at: `${day(4)}T12:30:00Z`,
      recorder: profiles[0],
    },
    // Last week baseline so "% From last week" deltas work realistically
    {
      id: "tx-prev-1",
      household_id: household.id,
      recorded_by: "demo-1",
      type: "contribution",
      amount: 200000,
      category: "contribution",
      description: "Last Week Pool",
      transaction_date: prevDay(1),
      created_at: `${prevDay(1)}T10:00:00Z`,
      recorder: profiles[0],
    },
    {
      id: "tx-prev-2",
      household_id: household.id,
      recorded_by: "demo-2",
      type: "expense",
      amount: 120000,
      category: "food",
      description: "Last Week Groceries & Bills",
      transaction_date: prevDay(3),
      created_at: `${prevDay(3)}T15:00:00Z`,
      recorder: profiles[1],
    },
  ];

  const now = new Date();
  const todayDay = now.getDate();
  const currentMonthKey = getMonthKey(now);

  const needs: HouseholdNeed[] = [
    {
      id: "need-1",
      household_id: household.id,
      added_by: "demo-2",
      title: "Cooking gas refill (15kg)",
      category: "supplies",
      is_bought: false,
      bought_at: null,
      created_at: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
      adder: profiles[1],
    },
    {
      id: "need-2",
      household_id: household.id,
      added_by: "demo-3",
      title: "Rice (5kg) & Tomatoes",
      category: "food",
      is_bought: false,
      bought_at: null,
      created_at: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
      adder: profiles[2],
    },
    {
      id: "need-3",
      household_id: household.id,
      added_by: "demo-4",
      title: "Dish soap & toilet tissue",
      category: "supplies",
      is_bought: true,
      bought_at: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
      created_at: new Date(Date.now() - 48 * 3600 * 1000).toISOString(),
      adder: profiles[3],
    },
  ];

  const bills: RecurringBill[] = [
    {
      id: "bill-1",
      household_id: household.id,
      created_by: "demo-1",
      title: "Shared Fiber Wi-Fi",
      amount: 70000,
      category: "security_internet",
      due_day: Math.min(28, todayDay + 2),
      last_paid_month: null,
      created_at: now.toISOString(),
    },
    {
      id: "bill-2",
      household_id: household.id,
      created_by: "demo-1",
      title: "DAWASA Water Bill",
      amount: 25000,
      category: "electricity_water",
      due_day: Math.min(28, todayDay + 6),
      last_paid_month: null,
      created_at: now.toISOString(),
    },
    {
      id: "bill-3",
      household_id: household.id,
      created_by: "demo-1",
      title: "Night Security Guard",
      amount: 40000,
      category: "security_internet",
      due_day: 5,
      last_paid_month: currentMonthKey,
      created_at: now.toISOString(),
    },
  ];

  return {
    currentUser: profiles[0],
    household,
    members,
    transactions,
    needs,
    bills,
  };
}

export type TransactionType = "contribution" | "expense";

export type ExpenseCategoryId =
  | "food"
  | "electricity_water"
  | "rent"
  | "security_internet"
  | "wifi_internet"
  | "supplies"
  | "transport";

export type TransactionCategory = ExpenseCategoryId | "contribution";

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  avatar_color: string;
}

export interface Household {
  id: string;
  name: string;
  currency: "TZS";
  weekly_budget_target: number;
  member_weekly_share: number;
  invite_code: string;
  created_by: string;
  created_at: string;
}

export interface HouseholdMember {
  household_id: string;
  user_id: string;
  role: "admin" | "member";
  joined_at: string;
  profile: Profile;
}

export interface Transaction {
  id: string;
  household_id: string;
  recorded_by: string;
  paid_by?: string | null;
  type: TransactionType;
  amount: number;
  category: TransactionCategory;
  description: string;
  transaction_date: string; // YYYY-MM-DD
  created_at: string;
  updated_at?: string | null;
  recorder?: Profile;
  payer?: Profile;
}

export interface HouseholdNeed {
  id: string;
  household_id: string;
  added_by: string | null;
  title: string;
  quantity?: string | null;
  estimated_amount?: number | null;
  actual_amount?: number | null;
  paid_mode?: "all" | "single";
  paid_by?: string | null;
  settled_by?: string[];
  pool_amount_used?: number;
  category: ExpenseCategoryId;
  is_bought: boolean;
  bought_at: string | null;
  created_at: string;
  adder?: Profile;
}

export interface RecurringBill {
  id: string;
  household_id: string;
  created_by: string | null;
  title: string;
  amount: number;
  category: ExpenseCategoryId;
  due_day: number; // 1..31
  interval_months?: number; // 1 = monthly, 3 = quarterly, 4 = 4 months, etc.
  last_paid_month: string | null; // YYYY-MM
  paid_mode?: "all" | "single";
  paid_by?: string | null;
  settled_by?: string[];
  pool_amount_used?: number;
  created_at: string;
}

export type ActiveTab = "overview" | "ledger" | "budget" | "household" | "account";
export type BudgetSubTab = "pool" | "bills" | "needs";
export type PeriodKey = "this_week" | "last_week" | "two_weeks_ago" | "this_month" | "last_month";

export interface CategoryMeta {
  id: ExpenseCategoryId;
  label: string;
  color: string;
  bgClass: string;
}

export const EXPENSE_CATEGORIES: CategoryMeta[] = [
  {
    id: "food",
    label: "Food & Groceries",
    color: "#F97316",
    bgClass: "bg-orange-50 text-orange-700",
  },
  {
    id: "electricity_water",
    label: "Electricity & Water",
    color: "#14B8A6",
    bgClass: "bg-teal-50 text-teal-700",
  },
  {
    id: "rent",
    label: "House Rent",
    color: "#22C55E",
    bgClass: "bg-green-50 text-green-700",
  },
  {
    id: "security_internet",
    label: "Security",
    color: "#EF4444",
    bgClass: "bg-red-50 text-red-700",
  },
  {
    id: "wifi_internet",
    label: "Wi-Fi & Internet",
    color: "#0EA5E9",
    bgClass: "bg-sky-50 text-sky-700",
  },
  {
    id: "supplies",
    label: "Home Supplies",
    color: "#A855F7",
    bgClass: "bg-purple-50 text-purple-700",
  },
  {
    id: "transport",
    label: "Errands & Transport",
    color: "#3B82F6",
    bgClass: "bg-blue-50 text-blue-700",
  },
];

export function getCategoryMeta(category: TransactionCategory): {
  label: string;
  color: string;
} {
  if (category === "contribution") {
    return { label: "Contribution", color: "#22C55E" };
  }
  const found = EXPENSE_CATEGORIES.find((c) => c.id === category);
  return found ?? { label: "Other", color: "#64748B" };
}

export type TransactionType = "contribution" | "expense";

export type ExpenseCategoryId =
  | "food"
  | "electricity_water"
  | "rent"
  | "security_internet"
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
  type: TransactionType;
  amount: number;
  category: TransactionCategory;
  description: string;
  transaction_date: string; // YYYY-MM-DD
  created_at: string;
  recorder?: Profile;
}

export type ActiveTab = "overview" | "ledger" | "budget" | "household";

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
    label: "Security & Wi-Fi",
    color: "#EF4444",
    bgClass: "bg-red-50 text-red-700",
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

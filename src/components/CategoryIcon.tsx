import {
  ArrowDownLeft,
  Car,
  Home,
  Package,
  Receipt,
  Shield,
  UtensilsCrossed,
  Wifi,
  Zap,
} from "lucide-react";
import type { TransactionCategory } from "../types";

interface CategoryIconProps {
  category: TransactionCategory;
  className?: string;
}

export function CategoryIcon({ category, className = "h-4 w-4" }: CategoryIconProps) {
  switch (category) {
    case "food":
      return <UtensilsCrossed className={className} />;
    case "electricity_water":
      return <Zap className={className} />;
    case "rent":
      return <Home className={className} />;
    case "security_internet":
      return <Shield className={className} />;
    case "wifi_internet":
      return <Wifi className={className} />;
    case "supplies":
      return <Package className={className} />;
    case "transport":
      return <Car className={className} />;
    case "contribution":
      return <ArrowDownLeft className={className} />;
    default:
      return <Receipt className={className} />;
  }
}

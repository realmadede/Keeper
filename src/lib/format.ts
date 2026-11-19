export function formatTZS(amount: number): string {
  const rounded = Math.round(amount);
  const abs = Math.abs(rounded).toLocaleString("en-US");
  return rounded < 0 ? `-TZS ${abs}` : `TZS ${abs}`;
}

export function formatCompactTZS(amount: number): string {
  const abs = Math.abs(amount);
  if (abs >= 1_000_000) {
    const m = abs / 1_000_000;
    return `${m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)}M`;
  }
  if (abs >= 1_000) {
    const k = abs / 1_000;
    return `${k % 1 === 0 ? k.toFixed(0) : k.toFixed(0)}K`;
  }
  return String(Math.round(abs));
}

export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function formatShortDate(iso: string, referenceDate = new Date()): string {
  const todayIso = toISODate(referenceDate);
  if (iso === todayIso) return "Today";
  const yesterday = new Date(referenceDate);
  yesterday.setDate(yesterday.getDate() - 1);
  if (iso === toISODate(yesterday)) return "Yesterday";
  const d = parseISODate(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function formatFullDayLabel(iso: string): string {
  const d = parseISODate(iso);
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

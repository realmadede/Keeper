import { useMemo, useState } from "react";
import { Glass } from "glisse";
import { Calendar, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { parseISODate, toISODate } from "../lib/format";

interface IosDatePickerProps {
  value: string; // YYYY-MM-DD
  onChange: (nextISO: string) => void;
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

interface CalendarCell {
  iso: string;
  day: number;
  inMonth: boolean;
}

function buildMonthGrid(year: number, monthIndex: number): CalendarCell[] {
  const firstOfMonth = new Date(year, monthIndex, 1);
  const jsDay = firstOfMonth.getDay(); // 0=Sun..6=Sat
  const leadingBlank = jsDay === 0 ? 6 : jsDay - 1; // Monday-first offset

  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, monthIndex, 0).getDate();

  const cells: CalendarCell[] = [];

  for (let i = leadingBlank - 1; i >= 0; i--) {
    const d = new Date(year, monthIndex - 1, daysInPrevMonth - i);
    cells.push({ iso: toISODate(d), day: d.getDate(), inMonth: false });
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(year, monthIndex, day);
    cells.push({ iso: toISODate(d), day, inMonth: true });
  }

  const remainder = cells.length % 7;
  if (remainder !== 0) {
    const trailing = 7 - remainder;
    for (let day = 1; day <= trailing; day++) {
      const d = new Date(year, monthIndex + 1, day);
      cells.push({ iso: toISODate(d), day, inMonth: false });
    }
  }

  return cells;
}

export function IosDatePicker({ value, onChange }: IosDatePickerProps) {
  const todayISO = useMemo(() => toISODate(new Date()), []);
  const yesterdayISO = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return toISODate(d);
  }, []);

  const selectedDate = useMemo(() => parseISODate(value), [value]);
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(() => selectedDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(() => selectedDate.getMonth());

  const monthLabel = useMemo(
    () =>
      new Date(viewYear, viewMonth, 1).toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      }),
    [viewMonth, viewYear],
  );

  const formattedPill = useMemo(
    () =>
      selectedDate.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
    [selectedDate],
  );

  const grid = useMemo(() => buildMonthGrid(viewYear, viewMonth), [viewMonth, viewYear]);

  const shiftMonth = (delta: number) => {
    const next = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
  };

  const selectISO = (iso: string, closeAfter = true) => {
    const parsed = parseISODate(iso);
    setViewYear(parsed.getFullYear());
    setViewMonth(parsed.getMonth());
    onChange(iso);
    if (closeAfter) setOpen(false);
  };

  const toggleOpen = () => {
    if (!open) {
      setViewYear(selectedDate.getFullYear());
      setViewMonth(selectedDate.getMonth());
    }
    setOpen((prev) => !prev);
  };

  return (
    <div className="space-y-2.5">
      {/* Compact iOS Row: Quick Today / Yesterday pills + Glass Date Trigger */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {[
            { label: "Today", iso: todayISO },
            { label: "Yesterday", iso: yesterdayISO },
          ].map((chip) => {
            const active = value === chip.iso;
            return (
              <button
                key={chip.label}
                type="button"
                onClick={() => selectISO(chip.iso, true)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                  active
                    ? "bg-[#1C1C1E] text-white shadow-xs"
                    : "border border-slate-200 bg-white/80 text-slate-600 hover:bg-slate-100"
                }`}
              >
                {chip.label}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={toggleOpen}
          aria-expanded={open}
          aria-label="Choose date from calendar"
          className="cursor-pointer"
        >
          <Glass className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-slate-800">
            <Calendar className="h-3.5 w-3.5 text-[#A68756]" />
            <span className="tabular-nums">{formattedPill}</span>
            <ChevronDown
              className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-200 ${
                open ? "rotate-180" : ""
              }`}
            />
          </Glass>
        </button>
      </div>

      {/* Expandable iOS Inline Liquid Glass Calendar */}
      {open && (
        <Glass className="rounded-[22px] !bg-white/95 p-3.5 shadow-[0_10px_28px_rgba(15,23,42,0.08)]">
          {/* Month Header */}
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[13px] font-bold tracking-tight text-slate-900">
              {monthLabel}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label="Previous month"
                onClick={() => shiftMonth(-1)}
                className="flex h-7 w-7 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100 active:scale-95 transition-all cursor-pointer"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label="Next month"
                onClick={() => shiftMonth(1)}
                className="flex h-7 w-7 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100 active:scale-95 transition-all cursor-pointer"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Weekday Labels */}
          <div className="mb-1 grid grid-cols-7 text-center">
            {WEEKDAYS.map((day) => (
              <div
                key={day}
                className="py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400"
              >
                {day.slice(0, 2)}
              </div>
            ))}
          </div>

          {/* Day Grid */}
          <div className="grid grid-cols-7 gap-y-1 text-center">
            {grid.map((cell) => {
              const isSelected = cell.iso === value;
              const isToday = cell.iso === todayISO;
              return (
                <div key={cell.iso} className="flex items-center justify-center">
                  <button
                    type="button"
                    onClick={() => selectISO(cell.iso, true)}
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-xs tabular-nums transition-all cursor-pointer ${
                      isSelected
                        ? "bg-[#1C1C1E] font-bold text-white shadow-[0_3px_10px_rgba(28,28,30,0.28)] scale-105"
                        : isToday
                          ? "bg-[#FFF5E8] font-bold text-[#A68756] ring-1 ring-[#E4CCA0]"
                          : cell.inMonth
                            ? "font-medium text-slate-800 hover:bg-slate-100"
                            : "font-normal text-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    {cell.day}
                  </button>
                </div>
              );
            })}
          </div>
        </Glass>
      )}
    </div>
  );
}

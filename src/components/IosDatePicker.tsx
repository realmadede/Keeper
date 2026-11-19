import { useMemo, useState } from "react";
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
      {/* Compact Row: Quick Today / Yesterday controls + Date Trigger */}
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
                className={`rounded-xl px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                  active
                    ? "bg-[#1C1C1E] text-white"
                    : "border border-stone-900/10 bg-white text-[#52525B] hover:bg-stone-50"
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
          className="inline-flex items-center gap-1.5 rounded-xl border border-stone-900/10 bg-white px-3 py-1.5 text-xs font-medium text-[#1C1C1E] hover:bg-stone-50 transition-colors cursor-pointer"
        >
          <Calendar className="h-3.5 w-3.5 text-[#8F703F]" />
          <span className="tabular-nums">{formattedPill}</span>
          <ChevronDown
            className={`h-3.5 w-3.5 text-[#8E8E93] transition-transform duration-200 ${
              open ? "rotate-180" : ""
            }`}
          />
        </button>
      </div>

      {/* Expandable Inline Calendar */}
      {open && (
        <div className="rounded-2xl border border-stone-900/[0.08] bg-white p-3.5">
          {/* Month Header */}
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-semibold text-[#1C1C1E]">
              {monthLabel}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label="Previous month"
                onClick={() => shiftMonth(-1)}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-[#52525B] hover:bg-stone-100 transition-colors cursor-pointer"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label="Next month"
                onClick={() => shiftMonth(1)}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-[#52525B] hover:bg-stone-100 transition-colors cursor-pointer"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Weekday Labels (Sentence Case) */}
          <div className="mb-1 grid grid-cols-7 text-center">
            {WEEKDAYS.map((day) => (
              <div
                key={day}
                className="py-1 font-mono text-[11px] font-medium text-[#8E8E93]"
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
                    className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs tabular-nums transition-colors cursor-pointer ${
                      isSelected
                        ? "bg-[#1C1C1E] font-semibold text-white"
                        : isToday
                          ? "bg-[#F6F5F2] font-semibold text-[#8F703F] ring-1 ring-[#C6A87C]"
                          : cell.inMonth
                            ? "font-medium text-[#1C1C1E] hover:bg-stone-100"
                            : "font-normal text-stone-300 hover:bg-stone-50"
                    }`}
                  >
                    {cell.day}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

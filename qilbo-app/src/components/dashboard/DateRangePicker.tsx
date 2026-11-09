import { useState } from "react";
import { Calendar, ChevronDown } from "lucide-react";

export interface DateRange {
  startDate: string;
  endDate: string;
  label: string;
}

interface DateRangePickerProps {
  currentRange: DateRange;
  onChange: (range: DateRange) => void;
  referenceDate?: string; // defaults to 2026-11-05
}

function formatDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function addDays(d: Date, days: number): Date {
  const res = new Date(d);
  res.setDate(res.getDate() + days);
  return res;
}

export function computePresets(refDateStr = "2026-11-05"): Record<string, { start: string; end: string; label: string }> {
  const ref = parseDate(refDateStr);

  // Today
  const todayStr = formatDate(ref);

  // Yesterday
  const yest = addDays(ref, -1);
  const yestStr = formatDate(yest);

  // Last 7 days
  const last7Start = formatDate(addDays(ref, -6));

  // This week (Sunday of current week through ref)
  const dayOfWeek = ref.getDay(); // 0 is Sunday
  const thisWeekStart = formatDate(addDays(ref, -dayOfWeek));

  // This month (1st of month to ref)
  const thisMonthStart = `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, "0")}-01`;

  // Last month
  const lastMonthYear = ref.getMonth() === 0 ? ref.getFullYear() - 1 : ref.getFullYear();
  const lastMonthNum = ref.getMonth() === 0 ? 12 : ref.getMonth();
  const lastMonthStart = `${lastMonthYear}-${String(lastMonthNum).padStart(2, "0")}-01`;
  const lastDayOfLastMonth = new Date(ref.getFullYear(), ref.getMonth(), 0).getDate();
  const lastMonthEnd = `${lastMonthYear}-${String(lastMonthNum).padStart(2, "0")}-${String(lastDayOfLastMonth).padStart(2, "0")}`;

  // Last 30 days
  const last30Start = formatDate(addDays(ref, -29));

  return {
    "today": { start: todayStr, end: todayStr, label: "Today" },
    "yesterday": { start: yestStr, end: yestStr, label: "Yesterday" },
    "last7": { start: last7Start, end: todayStr, label: "Last 7 days" },
    "thisWeek": { start: thisWeekStart, end: todayStr, label: "This week" },
    "thisMonth": { start: thisMonthStart, end: todayStr, label: "This month" },
    "lastMonth": { start: lastMonthStart, end: lastMonthEnd, label: "Last month" },
    "last30": { start: last30Start, end: todayStr, label: "Last 30 days" },
  };
}

export default function DateRangePicker({ currentRange, onChange, referenceDate = "2026-11-05" }: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isCustom, setIsCustom] = useState(false);
  const [customStart, setCustomStart] = useState(currentRange.startDate);
  const [customEnd, setCustomEnd] = useState(currentRange.endDate);

  const presets = computePresets(referenceDate);

  const handleSelectPreset = (key: string) => {
    setIsCustom(false);
    setIsOpen(false);
    const p = presets[key];
    if (p) {
      onChange({ startDate: p.start, endDate: p.end, label: p.label });
    }
  };

  const handleApplyCustom = () => {
    if (customStart && customEnd) {
      setIsCustom(true);
      setIsOpen(false);
      onChange({ startDate: customStart, endDate: customEnd, label: `${customStart} to ${customEnd}` });
    }
  };

  return (
    <div className="relative inline-block text-left">
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-750 transition"
        >
          <Calendar className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
          <span>{currentRange.label}</span>
          <span className="text-[10px] text-slate-400 font-mono">
            ({currentRange.startDate === currentRange.endDate ? currentRange.startDate : `${currentRange.startDate} → ${currentRange.endDate}`})
          </span>
          <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-0.5" />
        </button>
      </div>

      {isOpen && (
        <div className="absolute right-0 z-50 mt-2 w-72 origin-top-right rounded-2xl bg-white dark:bg-slate-800 p-3 shadow-xl ring-1 ring-black/5 dark:ring-white/10 border border-slate-100 dark:border-slate-700 space-y-2">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 pt-1">
            Date Range Presets
          </div>
          <div className="grid grid-cols-2 gap-1">
            {Object.entries(presets).map(([k, p]) => {
              const active = !isCustom && currentRange.startDate === p.start && currentRange.endDate === p.end;
              return (
                <button
                  key={k}
                  onClick={() => handleSelectPreset(k)}
                  className={`text-left px-2.5 py-1.5 rounded-lg text-xs font-medium transition ${
                    active
                      ? "bg-blue-600 text-white font-bold"
                      : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>

          <div className="border-t border-slate-100 dark:border-slate-700 pt-2 px-1">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Custom Range
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-[11px] text-slate-800 dark:text-slate-200"
              />
              <span className="text-slate-400 text-xs">to</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-[11px] text-slate-800 dark:text-slate-200"
              />
            </div>
            <button
              onClick={handleApplyCustom}
              className="mt-2 w-full py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition shadow-sm"
            >
              Apply Custom Range
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

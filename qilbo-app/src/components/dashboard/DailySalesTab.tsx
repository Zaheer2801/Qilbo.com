import { useState, useEffect } from "react";
import {
  Search,
  DollarSign,
  TrendingUp,
  RefreshCw,
  ShoppingBag,
} from "lucide-react";
import type { ApiSalesSummary } from "../../types";
import { api } from "../../lib/api";
import { getCategoryConfig } from "../../lib/colors";
import DateRangePicker, { type DateRange, computePresets } from "./DateRangePicker";

interface Props {
  selectedDate: string;
  onDateChange: (date: string) => void;
}

export default function DailySalesTab({ selectedDate, onDateChange }: Props) {
  const presets = computePresets(selectedDate || "2026-11-05");
  const [currentRange, setCurrentRange] = useState<DateRange>({
    startDate: selectedDate || presets.today.start,
    endDate: selectedDate || presets.today.end,
    label: "Today",
  });

  const [salesData, setSalesData] = useState<ApiSalesSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  const loadSales = async (start: string, end: string) => {
    setLoading(true);
    try {
      const data = await api.getSales(start, end);
      setSalesData(data);
    } catch (err) {
      console.error("Failed to load sales:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSales(currentRange.startDate, currentRange.endDate);
  }, [currentRange.startDate, currentRange.endDate]);

  const handleRangeChange = (newRange: DateRange) => {
    setCurrentRange(newRange);
    onDateChange(newRange.endDate);
  };

  if (loading && !salesData) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-slate-400">
        <RefreshCw className="w-8 h-8 animate-spin mb-3 text-blue-600" />
        <p className="text-sm font-medium">Loading register sales report...</p>
      </div>
    );
  }

  const s = salesData;

  const filteredItems = (s?.top_items || []).filter((it) => {
    if (search && !it.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header with Range Picker */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-6 rounded-2xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Register Sales Report
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Verified POS Register Sales for {currentRange.label} ({currentRange.startDate} → {currentRange.endDate}) • Pre-tax calculations include 7% FL tax separation
          </p>
        </div>

        <div className="flex items-center gap-2">
          <DateRangePicker
            currentRange={currentRange}
            onChange={handleRangeChange}
            referenceDate="2026-11-05"
          />
          <button
            onClick={() => loadSales(currentRange.startDate, currentRange.endDate)}
            className="p-2.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-600 dark:text-slate-300 transition shadow-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-blue-600" : ""}`} />
          </button>
        </div>
      </div>

      {s && (
        <>
          {/* Top Metric Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-5 rounded-2xl shadow-sm">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1 flex items-center justify-between">
                <span>Store Sales</span>
                <DollarSign className="w-4 h-4 text-blue-600" />
              </div>
              <div className="text-2xl font-black text-slate-900 dark:text-white">
                ${s.store_sales.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="text-xs text-emerald-600 font-semibold mt-1">
                ${(s.store_sales / 1.07).toFixed(2)} pre-tax
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">incl. 7% tax, excl. lottery</div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-5 rounded-2xl shadow-sm">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1 flex items-center justify-between">
                <span>Items Scanned</span>
                <ShoppingBag className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-2xl font-black text-slate-900 dark:text-white">
                {s.scanned_items.toLocaleString()}
              </div>
              <div className="text-xs text-slate-500 mt-1">scanned at registers</div>
              <div className="text-[11px] text-slate-400 mt-0.5">Excludes open dept rings</div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-5 rounded-2xl shadow-sm">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1 flex items-center justify-between">
                <span>Tracked Profit</span>
                <TrendingUp className="w-4 h-4 text-purple-600" />
              </div>
              <div className="text-2xl font-black text-slate-900 dark:text-white">
                ${s.tracked_profit.toFixed(2)}
              </div>
              <div className="text-xs text-emerald-600 font-semibold mt-1">
                {s.tracked_margin != null ? `${(s.tracked_margin * 100).toFixed(1)}% pre-tax margin` : "–"}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">on invoiced items</div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-5 rounded-2xl shadow-sm">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1 flex items-center justify-between">
                <span>Top Shelf Share</span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded">Liquor</span>
              </div>
              <div className="text-2xl font-black text-slate-900 dark:text-white">
                {s.top_shelf ? `${(s.top_shelf.share * 100).toFixed(1)}%` : "–"}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                ${s.top_shelf ? s.top_shelf.amount.toFixed(2) : "0"} ({s.top_shelf?.qty || 0} bottles)
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">Premium high-margin stock</div>
            </div>
          </div>

          {/* Department Breakdown */}
          {s.departments && s.departments.length > 0 && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-6 rounded-2xl shadow-sm space-y-4">
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">
                Register Department Sales
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {s.departments.map((d) => (
                  <div key={d.department} className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700">
                    <div className="text-xs text-slate-500 dark:text-slate-400 truncate font-semibold">{d.department}</div>
                    <div className="text-lg font-black text-slate-900 dark:text-white mt-1">
                      ${d.amount.toFixed(2)}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5 font-mono">{d.qty} transactions</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sales by Category & Top Sellers */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Sales by Category */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-6 rounded-2xl shadow-sm">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">
                  Sales by Category ({s.by_category.length})
                </h3>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-800 mt-2 max-h-96 overflow-y-auto">
                {s.by_category.map((c) => {
                  const conf = getCategoryConfig(c.category);
                  return (
                    <div key={c.category} className="py-2.5 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: conf.hex }} />
                        <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">{c.category}</span>
                      </div>
                      <div className="text-right">
                        <div className="font-mono font-bold text-slate-900 dark:text-white">${c.amount.toFixed(2)}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{c.qty} sold</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Top Items Table */}
            <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-6 rounded-2xl shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                  <h3 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">
                    Top Selling Products ({filteredItems.length})
                  </h3>
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search items..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 w-full sm:w-48 text-slate-800 dark:text-white"
                    />
                  </div>
                </div>

                <div className="divide-y divide-slate-100 dark:divide-slate-800 mt-2 max-h-96 overflow-y-auto">
                  {filteredItems.map((it, idx) => (
                    <div key={idx} className="py-2.5 flex items-center justify-between text-xs hover:bg-slate-50 dark:hover:bg-slate-800/50 px-2 rounded-lg transition">
                      <div className="min-w-0 pr-4">
                        <div className="font-bold text-slate-800 dark:text-slate-200 truncate">{it.name}</div>
                        <div className="text-[10px] text-slate-400">{it.size || "Standard"}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-mono font-bold text-slate-900 dark:text-white">${it.amount.toFixed(2)}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{it.qty} sold</div>
                      </div>
                    </div>
                  ))}
                  {filteredItems.length === 0 && (
                    <div className="py-8 text-center text-xs text-slate-400">
                      No matching products found.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

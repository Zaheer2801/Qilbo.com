import { useState, useEffect } from "react";
import {
  Calendar,
  Search,
  DollarSign,
  TrendingUp,
  RefreshCw,
  Wine,
  ShoppingBag,
} from "lucide-react";
import type { ApiSalesSummary } from "../../types";
import { api } from "../../lib/api";
import { getCategoryConfig } from "../../lib/colors";

interface Props {
  selectedDate: string;
  onDateChange: (date: string) => void;
}

export default function DailySalesTab({ selectedDate, onDateChange }: Props) {
  const [salesData, setSalesData] = useState<ApiSalesSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  const loadDailySales = async (date: string) => {
    setLoading(true);
    try {
      const data = await api.getSales(date, date);
      setSalesData(data);
    } catch (err) {
      console.error("Failed to load daily sales:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDailySales(selectedDate);
  }, [selectedDate]);

  if (loading && !salesData) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-slate-400">
        <RefreshCw className="w-8 h-8 animate-spin mb-3 text-blue-600" />
        <p className="text-sm font-medium">Loading daily sales report...</p>
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
      {/* Header with Date Picker */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-6 rounded-2xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Daily Register Sales Report
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Verified POS Register Sales for {selectedDate} • Pre-tax calculations include 7% FL tax separation
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-700 dark:text-slate-300">
            <Calendar className="w-4 h-4 mr-2 text-slate-400" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => onDateChange(e.target.value)}
              className="bg-transparent font-medium text-slate-900 dark:text-white border-0 focus:outline-none cursor-pointer"
            />
          </div>
          <button
            onClick={() => loadDailySales(selectedDate)}
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
                <Wine className="w-4 h-4 text-amber-500" />
              </div>
              <div className="text-2xl font-black text-slate-900 dark:text-white">
                {s.top_shelf ? `$${s.top_shelf.amount.toFixed(2)}` : "–"}
              </div>
              <div className="text-xs text-amber-600 font-semibold mt-1">
                {s.top_shelf ? `${(s.top_shelf.share * 100).toFixed(1)}% of store sales` : "–"}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                {s.top_shelf?.qty || 0} premium bottles
              </div>
            </div>
          </div>

          {/* Breakdown Section: Category Distribution & Top Selling Items */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Category Breakdown Table */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
              <h3 className="text-base font-bold text-slate-900 dark:text-white pb-3 border-b border-slate-100 dark:border-slate-800">
                Sales by Category ({s.by_category.length})
              </h3>
              <div className="divide-y divide-slate-100 dark:divide-slate-800 mt-3">
                {s.by_category.map((c) => {
                  const conf = getCategoryConfig(c.category);
                  const pct = s.store_sales ? (c.amount / s.store_sales) * 100 : 0;
                  return (
                    <div key={c.category} className="py-2.5 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: conf.hex }} />
                        <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">{c.category}</span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 font-mono">
                        <span className="text-slate-400">{c.qty} sold</span>
                        <span className="font-bold text-slate-900 dark:text-white">${c.amount.toFixed(2)}</span>
                        <span className="text-[10px] text-slate-400 w-10 text-right">{pct.toFixed(1)}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Top 15 Items List */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Top Scanned Products</h3>
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
                    <input
                      type="text"
                      placeholder="Filter items..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg pl-8 pr-3 py-1 text-xs text-slate-800 dark:text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="divide-y divide-slate-100 dark:divide-slate-800 mt-3 max-h-96 overflow-y-auto pr-1">
                  {filteredItems.map((it, idx) => (
                    <div key={idx} className="py-2.5 flex items-center justify-between text-xs hover:bg-slate-50 dark:hover:bg-slate-800/40 px-1 rounded transition">
                      <div className="min-w-0 pr-2">
                        <div className="font-bold text-slate-900 dark:text-white truncate">
                          {idx + 1}. {it.name}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono">{it.size || "unit"}</div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 font-mono text-right">
                        <span className="text-slate-500 font-semibold">{it.qty} sold</span>
                        <span className="font-bold text-slate-900 dark:text-white">${it.amount.toFixed(2)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

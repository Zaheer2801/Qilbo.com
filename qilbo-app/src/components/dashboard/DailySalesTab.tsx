import { useState, useEffect } from "react";
import {
  Calendar,
  Search,
  DollarSign,
  TrendingUp,
  Award,
  RefreshCw,
  Wine,
} from "lucide-react";
import type { ApiSalesSummary } from "../../types";
import { api } from "../../lib/api";

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
      <div className="flex flex-col items-center justify-center py-24 text-stone-400">
        <RefreshCw className="w-8 h-8 animate-spin mb-3 text-amber-500" />
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
      <div className="bg-stone-900 border border-stone-800 p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-white">Daily Register Sales Report</h2>
          <p className="text-xs text-stone-400">
            NRS Register Sales for {selectedDate} • Pre-tax calculations include 7% FL tax separation
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-stone-800 border border-stone-700 rounded-lg px-3 py-1.5 text-xs text-stone-200">
            <Calendar className="w-3.5 h-3.5 mr-2 text-stone-400" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => onDateChange(e.target.value)}
              className="bg-transparent text-white border-0 focus:outline-none cursor-pointer"
            />
          </div>
          <button
            onClick={() => loadDailySales(selectedDate)}
            className="p-2 bg-stone-800 hover:bg-stone-700 border border-stone-700 rounded-lg text-stone-300 transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {s && (
        <>
          {/* Top Metric Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-stone-900 border border-stone-800 p-4 rounded-xl">
              <div className="text-xs text-stone-400 mb-1 flex items-center justify-between">
                <span>Store Sales</span>
                <DollarSign className="w-3.5 h-3.5 text-amber-400" />
              </div>
              <div className="text-2xl font-bold text-white">
                ${s.store_sales.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="text-xs text-amber-300 mt-1">
                ${(s.store_sales / 1.07).toFixed(2)} pre-tax
              </div>
              <div className="text-[11px] text-stone-400 mt-0.5">incl. 7% tax, excl. lottery</div>
            </div>

            <div className="bg-stone-900 border border-stone-800 p-4 rounded-xl">
              <div className="text-xs text-stone-400 mb-1 flex items-center justify-between">
                <span>Tracked Profit</span>
                <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <div className="text-2xl font-bold text-white">
                ${s.tracked_profit.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="text-xs text-stone-400 mt-1">
                {s.tracked_margin != null ? `${(s.tracked_margin * 100).toFixed(1)}% margin (pre-tax)` : "–"}
              </div>
            </div>

            <div className="bg-stone-900 border border-stone-800 p-4 rounded-xl">
              <div className="text-xs text-stone-400 mb-1 flex items-center justify-between">
                <span>Scanned Volume</span>
                <Award className="w-3.5 h-3.5 text-blue-400" />
              </div>
              <div className="text-2xl font-bold text-white">{s.scanned_items}</div>
              <div className="text-xs text-stone-400 mt-1">Units rung through register</div>
            </div>

            <div className="bg-stone-900 border border-stone-800 p-4 rounded-xl">
              <div className="text-xs text-stone-400 mb-1 flex items-center justify-between">
                <span>Top Shelf Revenue</span>
                <Wine className="w-3.5 h-3.5 text-purple-400" />
              </div>
              <div className="text-2xl font-bold text-white">
                ${s.top_shelf ? s.top_shelf.amount.toFixed(2) : "0.00"}
              </div>
              <div className="text-xs text-stone-400 mt-1">
                {s.top_shelf ? `${(s.top_shelf.share * 100).toFixed(1)}% of store sales` : "0%"}
              </div>
            </div>
          </div>

          {/* Category Summary & Departments */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-stone-900 border border-stone-800 p-4 rounded-xl">
              <h3 className="text-sm font-semibold text-white mb-3">Sales by Category</h3>
              <div className="space-y-2">
                {s.by_category
                  .filter((c) => c.category !== "Lottery")
                  .map((c) => (
                    <div key={c.category} className="flex justify-between items-center text-xs py-1.5 border-b border-stone-800/60 last:border-0">
                      <span className="font-medium text-stone-200">{c.category}</span>
                      <span className="text-stone-300 font-semibold">
                        ${c.amount.toFixed(2)} <span className="text-stone-500 font-normal">({c.qty} units)</span>
                      </span>
                    </div>
                  ))}
              </div>
            </div>

            <div className="bg-stone-900 border border-stone-800 p-4 rounded-xl">
              <h3 className="text-sm font-semibold text-white mb-3">Department Summary Rings</h3>
              <div className="space-y-2">
                {s.departments.map((d) => (
                  <div key={d.department} className="flex justify-between items-center text-xs py-1.5 border-b border-stone-800/60 last:border-0">
                    <span className="font-medium text-stone-200">{d.department}</span>
                    <span className="text-stone-300 font-semibold">
                      ${d.amount.toFixed(2)} <span className="text-stone-500 font-normal">({d.qty} rings)</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Line Items Table */}
          <div className="bg-stone-900 border border-stone-800 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-stone-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-white">Itemized Register Sales ({filteredItems.length} items)</h3>
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-stone-500" />
                <input
                  type="text"
                  placeholder="Filter by product..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="bg-stone-800 border border-stone-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-stone-500 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-stone-300">
                <thead className="bg-stone-950 text-stone-400 uppercase font-medium border-b border-stone-800">
                  <tr>
                    <th className="py-2.5 px-4">Product Name</th>
                    <th className="py-2.5 px-4">Size</th>
                    <th className="py-2.5 px-4 text-right">Units Sold</th>
                    <th className="py-2.5 px-4 text-right">Register Total</th>
                    <th className="py-2.5 px-4 text-right">Pre-Tax Unit Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-800">
                  {filteredItems.map((it, idx) => {
                    const preTaxUnit = it.qty > 0 ? it.amount / it.qty / 1.07 : 0;
                    return (
                      <tr key={idx} className="hover:bg-stone-800/40 transition">
                        <td className="py-2.5 px-4 font-medium text-white">{it.name}</td>
                        <td className="py-2.5 px-4 text-stone-400">{it.size || "–"}</td>
                        <td className="py-2.5 px-4 text-right font-medium text-stone-200">×{it.qty}</td>
                        <td className="py-2.5 px-4 text-right font-semibold text-stone-200">${it.amount.toFixed(2)}</td>
                        <td className="py-2.5 px-4 text-right font-semibold text-amber-300">${preTaxUnit.toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

import {
  TrendingUp,
  DollarSign,
  Award,
  Calendar,
  Layers,
  ChevronRight,
  Receipt,
  Wine,
  HelpCircle,
  RefreshCw,
} from "lucide-react";
import type { ApiSummaryResponse } from "../../types";

interface Props {
  summary: ApiSummaryResponse | null;
  loading: boolean;
  onRefresh: () => void;
  onNavigateTab: (tabId: string) => void;
  selectedDate: string;
  onDateChange: (date: string) => void;
}

export default function OverviewTab({
  summary,
  loading,
  onRefresh,
  onNavigateTab,
  selectedDate,
  onDateChange,
}: Props) {
  if (loading && !summary) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-stone-400">
        <RefreshCw className="w-8 h-8 animate-spin mb-3 text-amber-500" />
        <p className="text-sm font-medium">Loading store metrics...</p>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="p-8 text-center text-stone-400">
        <p>No sales or inventory data available.</p>
        <button
          onClick={onRefresh}
          className="mt-4 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium"
        >
          Retry
        </button>
      </div>
    );
  }

  const day = summary.day;
  const range = summary.range;
  const inv = summary.inventory;
  const topShelf = day.top_shelf;

  return (
    <div className="space-y-6">
      {/* Date Header & Quick Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-stone-900 border border-stone-800 p-4 rounded-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white">Executive Partner Board & Store Overview</h2>
            <p className="text-xs text-stone-400">Discount Liquor • Eustis, FL (All 3 Terminals Combined)</p>
          </div>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="flex items-center bg-stone-800 border border-stone-700 rounded-lg px-2.5 py-1.5 text-xs text-stone-300">
            <Calendar className="w-3.5 h-3.5 mr-1.5 text-stone-400" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => onDateChange(e.target.value)}
              className="bg-transparent text-white border-0 focus:outline-none text-xs cursor-pointer"
            />
          </div>
          <button
            onClick={onRefresh}
            title="Refresh metrics"
            className="p-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 border border-stone-700 transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Pending Invoices Banner */}
      {summary.pending_invoices > 0 && (
        <div className="bg-amber-950/40 border border-amber-800/60 p-4 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Receipt className="w-5 h-5 text-amber-400 flex-shrink-0" />
            <div>
              <div className="text-sm font-semibold text-amber-200">
                {summary.pending_invoices} distributor invoice{summary.pending_invoices > 1 ? "s" : ""} awaiting your approval
              </div>
              <div className="text-xs text-amber-400/80">
                Invoices must be reviewed and confirmed before updating live inventory.
              </div>
            </div>
          </div>
          <button
            onClick={() => onNavigateTab("invoices")}
            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition"
          >
            Review Invoices <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Key KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        {/* Day Store Sales */}
        <div className="bg-stone-900 border border-stone-800 p-4 rounded-xl">
          <div className="flex items-center justify-between text-xs text-stone-400 mb-1">
            <span>Store Sales ({day.start})</span>
            <DollarSign className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-white">${day.store_sales.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          <div className="text-xs text-stone-400 mt-1 flex items-center gap-1">
            <span>{day.scanned_items} items scanned</span>
            <span className="text-stone-600">•</span>
            <span className="text-amber-400">Excludes lottery</span>
          </div>
        </div>

        {/* 30-Day Sales Volume */}
        <div className="bg-stone-900 border border-stone-800 p-4 rounded-xl">
          <div className="flex items-center justify-between text-xs text-stone-400 mb-1">
            <span>30-Day Revenue</span>
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-white">${range.store_sales.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          <div className="text-xs text-stone-400 mt-1">
            {range.scanned_items.toLocaleString()} units sold ({range.start} → {range.end})
          </div>
        </div>

        {/* Tracked Gross Margin */}
        <div className="bg-stone-900 border border-stone-800 p-4 rounded-xl">
          <div className="flex items-center justify-between text-xs text-stone-400 mb-1">
            <span>Tracked Margin</span>
            <Award className="w-3.5 h-3.5 text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-white">
            {day.tracked_margin != null ? `${(day.tracked_margin * 100).toFixed(1)}%` : "–"}
          </div>
          <div className="text-xs text-stone-400 mt-1">
            ${day.tracked_profit.toFixed(2)} profit on tracked cost SKUs
          </div>
        </div>

        {/* Inventory Status Breakdown */}
        <div className="bg-stone-900 border border-stone-800 p-4 rounded-xl">
          <div className="flex items-center justify-between text-xs text-stone-400 mb-1">
            <span>Stock Health</span>
            <Layers className="w-3.5 h-3.5 text-purple-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white">{inv.tracked}</span>
            <span className="text-xs text-stone-400">/ {inv.total_products} SKUs tracked</span>
          </div>
          <div className="flex items-center gap-2 text-xs mt-1">
            {inv.counts.OUT > 0 && <span className="text-red-400 font-medium">{inv.counts.OUT} OUT</span>}
            {inv.counts.REORDER > 0 && <span className="text-amber-400 font-medium">{inv.counts.REORDER} Reorder</span>}
            {inv.needs_count > 0 && (
              <span className="text-blue-400 font-medium flex items-center gap-0.5">
                <HelpCircle className="w-3 h-3" /> {inv.needs_count} Count
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Top Shelf Executive Monitor */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-amber-950/30 to-stone-900 border border-amber-900/40 p-4 rounded-xl md:col-span-1">
          <div className="flex items-center gap-2 mb-3">
            <Wine className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-semibold text-white">Top Shelf Spirits Monitor</h3>
          </div>
          <div className="space-y-3">
            <div>
              <div className="text-xs text-stone-400">Top Shelf Revenue ({day.start})</div>
              <div className="text-xl font-bold text-amber-300">
                ${topShelf ? topShelf.amount.toFixed(2) : "0.00"}
              </div>
              <div className="text-xs text-amber-400/80 mt-0.5">
                {topShelf ? `${(topShelf.share * 100).toFixed(1)}% of store sales` : "0%"} • {topShelf?.qty || 0} premium bottles
              </div>
            </div>
            <div className="pt-2 border-t border-amber-900/30">
              <div className="text-xs text-stone-400 mb-1">Tracked Inventory Asset Value</div>
              <div className="text-lg font-bold text-white">
                ${inv.stock_value.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </div>
            </div>
            <button
              onClick={() => onNavigateTab("inventory")}
              className="w-full mt-2 py-1.5 px-3 bg-amber-600/20 hover:bg-amber-600/30 border border-amber-600/30 rounded-lg text-xs font-medium text-amber-300 flex items-center justify-center gap-1 transition"
            >
              Filter Top Shelf Live Inventory <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Category Share Breakdown */}
        <div className="bg-stone-900 border border-stone-800 p-4 rounded-xl md:col-span-2">
          <h3 className="text-sm font-semibold text-white mb-3">Day Sales by Merchandise Category</h3>
          <div className="space-y-2.5">
            {day.by_category
              .filter((c) => c.category !== "Lottery")
              .map((c) => {
                const pct = day.store_sales > 0 ? (c.amount / day.store_sales) * 100 : 0;
                return (
                  <div key={c.category} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-medium text-stone-200">{c.category}</span>
                      <span className="text-stone-400">
                        ${c.amount.toFixed(2)} ({c.qty} units • {pct.toFixed(1)}%)
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-stone-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-500 rounded-full transition-all"
                        style={{ width: `${Math.min(100, Math.max(2, pct))}%` }}
                      />
                    </div>
                  </div>
                );
              })}
          </div>

          {/* Lottery Separate Notice */}
          <div className="mt-4 pt-3 border-t border-stone-800 flex items-center justify-between text-xs text-stone-400">
            <span>Lottery (Scratch-offs & Payouts):</span>
            <span className="text-stone-300 font-medium">
              ${(
                day.departments
                  .filter((d) => /lotter/i.test(d.department))
                  .reduce((a, d) => a + d.amount, 0) +
                (day.by_category.find((c) => c.category === "Lottery")?.amount || 0)
              ).toFixed(2)}{" "}
              <span className="text-stone-500">(Kept separate from store sales)</span>
            </span>
          </div>
        </div>
      </div>

      {/* Top 10 Best Sellers */}
      <div className="bg-stone-900 border border-stone-800 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-stone-800 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Top 10 Best Sellers ({day.start})</h3>
          <button
            onClick={() => onNavigateTab("dailysales")}
            className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1"
          >
            View Full Daily Report <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-stone-300">
            <thead className="bg-stone-950 text-stone-400 uppercase font-medium border-b border-stone-800">
              <tr>
                <th className="py-2.5 px-4">#</th>
                <th className="py-2.5 px-4">Product Name</th>
                <th className="py-2.5 px-4">Size</th>
                <th className="py-2.5 px-4 text-right">Units Sold</th>
                <th className="py-2.5 px-4 text-right">Total Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-800">
              {day.top_items.slice(0, 10).map((it, idx) => (
                <tr key={idx} className="hover:bg-stone-800/40 transition">
                  <td className="py-2.5 px-4 font-bold text-stone-500">{idx + 1}</td>
                  <td className="py-2.5 px-4 font-medium text-white">{it.name}</td>
                  <td className="py-2.5 px-4 text-stone-400">{it.size || "–"}</td>
                  <td className="py-2.5 px-4 text-right font-medium text-stone-200">×{it.qty}</td>
                  <td className="py-2.5 px-4 text-right font-semibold text-amber-300">${it.amount.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

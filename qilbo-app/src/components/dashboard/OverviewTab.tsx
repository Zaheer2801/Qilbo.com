import { useState, useEffect } from "react";
import {
  TrendingUp,
  DollarSign,
  Layers,
  ChevronRight,
  Receipt,
  Wine,
  RefreshCw,
  Percent,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import type { ApiSummaryResponse } from "../../types";
import { api } from "../../lib/api";
import { getCategoryConfig } from "../../lib/colors";
import DateRangePicker, { type DateRange, computePresets } from "./DateRangePicker";

interface Props {
  summary: ApiSummaryResponse | null;
  loading: boolean;
  onRefresh: () => void;
  onNavigateTab: (tabId: string, filter?: { category?: string; distributor?: string }) => void;
  selectedDate: string;
  onDateChange: (date: string) => void;
}

export default function OverviewTab({
  summary: initialSummary,
  loading: initialLoading,
  onRefresh,
  onNavigateTab,
  selectedDate,
  onDateChange,
}: Props) {
  const [currentRange, setCurrentRange] = useState<DateRange>(() => {
    const presets = computePresets(selectedDate || "2026-11-05");
    return {
      startDate: presets.last7.start,
      endDate: presets.last7.end,
      label: "Last 7 days",
    };
  });

  const [summaryData, setSummaryData] = useState<ApiSummaryResponse | null>(initialSummary);
  const [loadingRange, setLoadingRange] = useState(false);
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);
  const [hoveredDay, setHoveredDay] = useState<{ d: string; amount: number } | null>(null);

  // Sync initial summary if provided
  useEffect(() => {
    if (initialSummary && !summaryData) {
      setSummaryData(initialSummary);
    }
  }, [initialSummary]);

  // Load summary for the selected range
  const loadRangeSummary = async (range: DateRange) => {
    setLoadingRange(true);
    try {
      const data = await api.getSummary(undefined, undefined, range.startDate, range.endDate);
      setSummaryData(data);
    } catch (err) {
      console.error("Failed to load range summary:", err);
    } finally {
      setLoadingRange(false);
    }
  };

  const handleRangeChange = (newRange: DateRange) => {
    setCurrentRange(newRange);
    onDateChange(newRange.endDate);
    loadRangeSummary(newRange);
  };

  const summary = summaryData || initialSummary;
  const isLoading = initialLoading || loadingRange;

  if (isLoading && !summary) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-slate-400">
        <RefreshCw className="w-8 h-8 animate-spin mb-3 text-blue-600" />
        <p className="text-sm font-medium">Loading store metrics...</p>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="p-8 text-center text-slate-500 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
        <p>No sales or inventory data available.</p>
        <button
          onClick={onRefresh}
          className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition"
        >
          Retry
        </button>
      </div>
    );
  }

  const range = summary.range;
  const inv = summary.inventory;
  const topShelf = range.top_shelf || summary.day.top_shelf;

  // Categories for donut chart & breakdown (showing ALL non-lottery categories)
  const categoriesData = (range.by_category || [])
    .filter((c) => c.category !== "Lottery" && c.amount > 0)
    .sort((a, b) => b.amount - a.amount);
  const totalCatAmount = categoriesData.reduce((acc, c) => acc + c.amount, 0) || 1;

  // Reconciliation amounts
  const scannedSales = range.scanned_sales != null ? range.scanned_sales : totalCatAmount;
  const deptSales = range.dept_sales != null ? range.dept_sales : +(range.store_sales - scannedSales).toFixed(2);

  // Group tiles (The 7 Groups)
  const groupNames = ["Spirits", "Beer & RTD", "Wine", "Drinks & Mixers", "Snacks & Grocery", "Tobacco"];
  const groupTiles = groupNames.map((gName) => {
    const found = categoriesData.find((c) => c.category === gName);
    const amount = found ? found.amount : 0;
    const qty = found ? found.qty : 0;
    const pct = range.store_sales > 0 ? (amount / range.store_sales) * 100 : 0;
    const conf = getCategoryConfig(gName);
    return {
      name: gName,
      amount,
      qty,
      pct,
      conf,
    };
  });

  // Daily bar chart data
  const dailyData = range.daily || [];
  const maxDaily = Math.max(...dailyData.map((d) => d.amount), 1);
  const avgDaily = dailyData.length > 0 ? dailyData.reduce((acc, d) => acc + d.amount, 0) / dailyData.length : 0;

  // Stock health score
  const totalTracked = inv.tracked || 1;
  const okCount = inv.counts?.OK || 0;
  const outCount = inv.counts?.OUT || 0;
  const reorderCount = inv.counts?.REORDER || 0;
  const healthPercent = Math.min(100, Math.round((okCount / totalTracked) * 100));

  // Compute SVG Donut segments for ALL categories
  let cumulativePercent = 0;
  const donutSegments = categoriesData.map((c) => {
    const conf = getCategoryConfig(c.category);
    const pct = c.amount / totalCatAmount;
    const startAngle = cumulativePercent * 360;
    cumulativePercent += pct;
    const endAngle = cumulativePercent * 360;
    return {
      ...c,
      color: conf.hex,
      dotClass: conf.dot,
      pct: pct * 100,
      startAngle,
      endAngle,
    };
  });

  const salesChange = range.sales_change_pct;
  const itemsChange = range.items_change_pct;

  return (
    <div className="space-y-6">
      {/* Top Header: Title + Range Picker */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-5 rounded-2xl shadow-sm">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Store Performance Overview
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Discount Liquor • 2105 E Orange Ave, Eustis FL • Terminals: 87287, 83954, 60696
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <DateRangePicker
            currentRange={currentRange}
            onChange={handleRangeChange}
            referenceDate="2026-11-05"
          />
          <button
            onClick={() => loadRangeSummary(currentRange)}
            title="Refresh metrics"
            className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition shadow-sm"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin text-blue-600" : ""}`} />
          </button>
        </div>
      </div>

      {/* Pending Invoices Alert Banner */}
      {summary.pending_invoices > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 p-4 rounded-2xl flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center text-amber-700 dark:text-amber-400">
              <Receipt className="w-5 h-5 flex-shrink-0" />
            </div>
            <div>
              <div className="text-sm font-bold text-amber-900 dark:text-amber-200">
                {summary.pending_invoices} distributor invoice{summary.pending_invoices > 1 ? "s" : ""} pending approval
              </div>
              <div className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                Review verified line items and beer pack codes before posting to live stock ledger
              </div>
            </div>
          </div>
          <button
            onClick={() => onNavigateTab("invoices")}
            className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold transition shadow-sm"
          >
            Review Invoices
          </button>
        </div>
      )}

      {/* 4 Primary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Store Sales */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-5 rounded-2xl shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-semibold">
            <span>Store Sales ({currentRange.label})</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                ${range.store_sales.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              {salesChange != null && (
                <span
                  className={`inline-flex items-center text-xs font-bold px-1.5 py-0.5 rounded-md ${
                    salesChange >= 0
                      ? "text-emerald-700 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-950/60"
                      : "text-rose-700 bg-rose-50 dark:text-rose-300 dark:bg-rose-950/60"
                  }`}
                >
                  {salesChange >= 0 ? <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" /> : <ArrowDownRight className="w-3.5 h-3.5 mr-0.5" />}
                  {salesChange >= 0 ? `+${salesChange}%` : `${salesChange}%`}
                </span>
              )}
            </div>
            <div className="text-xs text-emerald-600 font-semibold mt-1">
              ${(range.store_sales / 1.07).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} pre-tax
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              incl. 7% tax, excl. lottery • {range.scanned_items} items scanned
            </p>
          </div>
        </div>

        {/* Card 2: Units Sold */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-5 rounded-2xl shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-semibold">
            <span>Units Sold ({currentRange.label})</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                {range.scanned_items.toLocaleString()}
              </span>
              {itemsChange != null && (
                <span
                  className={`inline-flex items-center text-xs font-bold px-1.5 py-0.5 rounded-md ${
                    itemsChange >= 0
                      ? "text-emerald-700 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-950/60"
                      : "text-rose-700 bg-rose-50 dark:text-rose-300 dark:bg-rose-950/60"
                  }`}
                >
                  {itemsChange >= 0 ? <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" /> : <ArrowDownRight className="w-3.5 h-3.5 mr-0.5" />}
                  {itemsChange >= 0 ? `+${itemsChange}%` : `${itemsChange}%`}
                </span>
              )}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {currentRange.startDate} → {currentRange.endDate}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Scanned units across register terminals
            </p>
          </div>
        </div>

        {/* Card 3: Tracked Margin */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-5 rounded-2xl shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-semibold">
            <span>Tracked Gross Margin</span>
            <div className="w-8 h-8 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 flex items-center justify-center">
              <Percent className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              {range.tracked_margin != null ? `${(range.tracked_margin * 100).toFixed(1)}%` : "–"}
            </div>
            <div className="text-xs text-emerald-600 font-semibold mt-1">
              ${range.tracked_profit.toFixed(2)} profit on invoiced items
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Calculated on pre-tax sales vs. invoice cost
            </p>
          </div>
        </div>

        {/* Card 4: Stock Health Gauge */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-5 rounded-2xl shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-semibold">
            <span>Stock Health Status</span>
            <div className="w-8 h-8 rounded-xl bg-orange-50 dark:bg-orange-950/50 text-orange-600 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                {okCount}
              </span>
              <span className="text-xs text-slate-500 font-medium">/ {inv.tracked} tracked SKUs OK</span>
            </div>
            {/* Status progress bar */}
            <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full mt-2.5 overflow-hidden flex">
              <div style={{ width: `${healthPercent}%` }} className="bg-emerald-500 h-full" title={`OK: ${okCount}`} />
              <div style={{ width: `${(reorderCount / totalTracked) * 100}%` }} className="bg-amber-500 h-full" title={`Reorder: ${reorderCount}`} />
              <div style={{ width: `${(outCount / totalTracked) * 100}%` }} className="bg-red-500 h-full" title={`Out: ${outCount}`} />
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mt-2 font-medium">
              <span className="text-red-600 font-bold">{outCount} OUT</span>
              <span className="text-amber-600 font-bold">{reorderCount} to reorder</span>
              <span className="text-slate-400">{inv.needs_count || 956} not counted</span>
            </div>
          </div>
        </div>
      </div>

      {/* "Sales by group" Tiles */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-5 rounded-2xl shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">
              Sales by Group
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Click any group to explore inventory & live stock
            </p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg">
            7 Store Groups
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {groupTiles.map((gt) => (
            <button
              key={gt.name}
              onClick={() => onNavigateTab("inventory", { category: gt.name })}
              className="text-left p-3 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800 hover:border-slate-300 transition group shadow-2xs"
            >
              <div className="flex items-center gap-2 mb-1.5">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: gt.conf.hex }} />
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate group-hover:text-blue-600 transition">
                  {gt.name}
                </span>
              </div>
              <div className="text-base font-extrabold text-slate-900 dark:text-white">
                ${gt.amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 mt-1 font-mono">
                <span>{gt.qty} units</span>
                <span className="font-bold text-slate-700 dark:text-slate-300">{gt.pct.toFixed(1)}%</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Visual Charts Grid: Daily Sales Bar Chart + Category Donut */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Daily Bar Chart */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-6 rounded-2xl shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Daily Sales Trend</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Daily revenue for {currentRange.label} (Avg: ${avgDaily.toFixed(2)}/day)
                </p>
              </div>
              {hoveredDay ? (
                <div className="text-right">
                  <div className="text-xs font-bold text-blue-600 dark:text-blue-400">{hoveredDay.d}</div>
                  <div className="text-xs font-mono font-extrabold text-slate-900 dark:text-white">${hoveredDay.amount.toFixed(2)}</div>
                </div>
              ) : (
                <span className="text-xs font-semibold px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg">
                  {dailyData.length} Days
                </span>
              )}
            </div>

            {/* Bar Chart Container */}
            <div className="mt-6 h-52 flex items-end gap-1.5 sm:gap-2 pt-6 pb-2 px-1">
              {dailyData.map((d) => {
                const heightPct = Math.max(6, Math.round((d.amount / maxDaily) * 100));
                const isSelected = d.d === selectedDate;
                const isHovered = hoveredDay?.d === d.d;
                const shortDate = d.d.slice(5).replace("-", "/");

                return (
                  <div
                    key={d.d}
                    className="flex-1 flex flex-col items-center h-full justify-end group cursor-pointer"
                    onMouseEnter={() => setHoveredDay(d)}
                    onMouseLeave={() => setHoveredDay(null)}
                    onClick={() => onDateChange(d.d)}
                  >
                    {/* Amount label on hover or selected */}
                    <div
                      className={`text-[9px] font-mono font-bold mb-1 transition-opacity ${
                        isHovered || isSelected ? "opacity-100 text-blue-600 dark:text-blue-400" : "opacity-0 group-hover:opacity-100 text-slate-400"
                      }`}
                    >
                      ${d.amount > 999 ? `${(d.amount / 1000).toFixed(1)}k` : d.amount.toFixed(0)}
                    </div>

                    {/* Bar */}
                    <div
                      style={{ height: `${heightPct}%` }}
                      className={`w-full rounded-t-lg transition-all duration-200 ${
                        isSelected
                          ? "bg-blue-600 shadow-md ring-2 ring-blue-300"
                          : isHovered
                          ? "bg-blue-500"
                          : "bg-blue-200 dark:bg-slate-700 hover:bg-blue-400"
                      }`}
                    />

                    {/* Date label */}
                    <span
                      className={`text-[10px] mt-2 font-mono truncate w-full text-center ${
                        isSelected ? "font-bold text-blue-600 dark:text-blue-400" : "text-slate-400"
                      }`}
                    >
                      {shortDate}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
            <span>Range Total: ${range.store_sales.toFixed(2)}</span>
            <span className="font-semibold text-blue-600 dark:text-blue-400">Click bar to inspect day</span>
          </div>
        </div>

        {/* Chart 2: Donut of Sales by Category with ALL Categories */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-6 rounded-2xl shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Sales by Category</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Split into spirit types and beverage classes ({currentRange.label})
                </p>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg">
                ${totalCatAmount.toFixed(2)} Tracked
              </span>
            </div>

            {/* Donut Layout */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-6 items-center mt-6">
              {/* SVG Donut */}
              <div className="sm:col-span-5 flex justify-center relative">
                <svg viewBox="0 0 100 100" className="w-40 h-40 transform -rotate-90">
                  <circle cx="50" cy="50" r="38" fill="transparent" stroke="#F1F5F9" strokeWidth="16" />
                  {donutSegments.map((seg) => {
                    const circumference = 2 * Math.PI * 38;
                    const strokeDasharray = `${(seg.pct / 100) * circumference} ${circumference}`;
                    const strokeDashoffset = -((seg.startAngle / 360) * circumference);
                    const isHovered = hoveredCategory === seg.category;

                    return (
                      <circle
                        key={seg.category}
                        cx="50"
                        cy="50"
                        r="38"
                        fill="transparent"
                        stroke={seg.color}
                        strokeWidth={isHovered ? 20 : 16}
                        strokeDasharray={strokeDasharray}
                        strokeDashoffset={strokeDashoffset}
                        className="transition-all duration-300 cursor-pointer"
                        onMouseEnter={() => setHoveredCategory(seg.category)}
                        onMouseLeave={() => setHoveredCategory(null)}
                      />
                    );
                  })}
                </svg>
                {/* Center metric */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Store Sales</span>
                  <span className="text-sm font-extrabold text-slate-900 dark:text-white">
                    ${range.store_sales.toFixed(0)}
                  </span>
                </div>
              </div>

              {/* Legend with ALL Categories */}
              <div className="sm:col-span-7 space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {donutSegments.map((seg) => {
                  const isHovered = hoveredCategory === seg.category;
                  return (
                    <div
                      key={seg.category}
                      onClick={() => onNavigateTab("inventory", { category: seg.category })}
                      onMouseEnter={() => setHoveredCategory(seg.category)}
                      onMouseLeave={() => setHoveredCategory(null)}
                      className={`flex items-center justify-between p-1.5 rounded-lg text-xs transition cursor-pointer ${
                        isHovered
                          ? "bg-slate-100 dark:bg-slate-800 font-bold"
                          : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: seg.color }} />
                        <span className="truncate text-slate-800 dark:text-slate-200">{seg.category}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono text-slate-900 dark:text-white font-semibold">
                          ${seg.amount.toFixed(2)}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono w-9 text-right">
                          {seg.pct.toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Department Sales Reconciliation Line */}
          <div className="pt-3 mt-4 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <div className="font-medium">
              Tracked items: <span className="font-mono font-bold text-slate-800 dark:text-slate-200">${scannedSales.toFixed(2)}</span>
              {" + "}
              <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">${deptSales.toFixed(2)}</span> department sales
              {" = "}
              <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">${range.store_sales.toFixed(2)}</span> store sales
            </div>
            <span className="text-[10px] text-slate-400">Lottery excl.</span>
          </div>
        </div>
      </div>

      {/* Top Shelf Monitor Card */}
      {topShelf && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-slate-900 dark:to-slate-800 border border-amber-200/80 dark:border-amber-900/40 p-6 rounded-2xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-md">
              <Wine className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-base font-bold text-slate-900 dark:text-white">Top-Shelf Spirits Monitor</h4>
                <span className="text-[11px] font-bold bg-amber-200/70 text-amber-900 px-2 py-0.5 rounded-full">
                  {(topShelf.share * 100).toFixed(1)}% of Store Sales
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                ${topShelf.amount.toFixed(2)} generated from {topShelf.qty} premium bottles ({currentRange.label})
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigateTab("inventory", { category: "Tequila/Mezcal" })}
            className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition shadow-sm self-start sm:self-auto flex items-center gap-2"
          >
            Filter Top Shelf Live Inventory <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}

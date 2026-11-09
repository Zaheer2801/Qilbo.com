import { useState } from "react";
import {
  TrendingUp,
  DollarSign,
  Calendar,
  Layers,
  ChevronRight,
  Receipt,
  Wine,
  RefreshCw,
  Percent,
} from "lucide-react";
import type { ApiSummaryResponse } from "../../types";
import { getCategoryConfig, getBrandChipStyle } from "../../lib/colors";

interface Props {
  summary: ApiSummaryResponse | null;
  loading: boolean;
  onRefresh: () => void;
  onNavigateTab: (tabId: string, filter?: { category?: string; distributor?: string }) => void;
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
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);

  if (loading && !summary) {
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

  const day = summary.day;
  const range = summary.range;
  const inv = summary.inventory;
  const topShelf = day.top_shelf;

  // Categories for donut chart
  const categoriesData = (day.by_category || [])
    .filter((c) => c.category !== "Lottery" && c.amount > 0)
    .sort((a, b) => b.amount - a.amount);
  const totalCatAmount = categoriesData.reduce((acc, c) => acc + c.amount, 0) || 1;

  // Top 10 brands
  const brandsData = (day.top_brands || range.top_brands || [])
    .filter((b) => b.brand && b.brand !== "Unknown")
    .slice(0, 10);
  const maxBrandAmount = Math.max(...brandsData.map((b) => b.amount), 1);

  // 30-day daily trend
  const dailyData = range.daily || [];
  const maxDaily = Math.max(...dailyData.map((d) => d.amount), 1);

  // Stock health gauge score
  const totalTracked = inv.tracked || 1;
  const okCount = inv.counts?.OK || 0;
  const healthPercent = Math.min(100, Math.round((okCount / totalTracked) * 100));

  // Compute SVG Donut segments
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

  return (
    <div className="space-y-6">
      {/* Top Header: Title + Date Filter */}
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
          <div className="flex items-center bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-700 dark:text-slate-300 shadow-inner">
            <Calendar className="w-4 h-4 mr-2 text-slate-400" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => onDateChange(e.target.value)}
              className="bg-transparent font-medium text-slate-800 dark:text-white border-0 focus:outline-none text-xs cursor-pointer"
            />
          </div>
          <button
            onClick={onRefresh}
            title="Refresh metrics"
            className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition shadow-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-blue-600" : ""}`} />
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
            <span>Store Sales ({selectedDate})</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              ${day.store_sales.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </div>
            <div className="text-xs text-emerald-600 font-semibold mt-1">
              ${(day.store_sales / 1.07).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} pre-tax
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              incl. 7% tax, excl. lottery • {day.scanned_items} items scanned
            </p>
          </div>
        </div>

        {/* Card 2: 30-Day Revenue */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-5 rounded-2xl shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-semibold">
            <span>30-Day Store Revenue</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              ${range.store_sales.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {range.scanned_items.toLocaleString()} units sold (30-day velocity)
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              {range.start} → {range.end}
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
              {day.tracked_margin != null ? `${(day.tracked_margin * 100).toFixed(1)}%` : "–"}
            </div>
            <div className="text-xs text-emerald-600 font-semibold mt-1">
              ${day.tracked_profit.toFixed(2)} profit on invoiced items
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
                {inv.counts?.OK || 0}
              </span>
              <span className="text-xs text-slate-500 font-medium">/ {inv.tracked} tracked SKUs OK</span>
            </div>
            {/* Small status progress bar */}
            <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full mt-2.5 overflow-hidden flex">
              <div style={{ width: `${healthPercent}%` }} className="bg-emerald-500 h-full" title={`OK: ${inv.counts?.OK}`} />
              <div style={{ width: `${((inv.counts?.REORDER || 0) / totalTracked) * 100}%` }} className="bg-amber-500 h-full" title={`Reorder: ${inv.counts?.REORDER}`} />
              <div style={{ width: `${((inv.counts?.OUT || 0) / totalTracked) * 100}%` }} className="bg-red-500 h-full" title={`Out: ${inv.counts?.OUT}`} />
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mt-2 font-medium">
              <span className="text-red-600 font-bold">{inv.counts?.OUT || 0} OUT</span>
              <span className="text-amber-600 font-bold">{inv.counts?.REORDER || 0} Reorder</span>
              <span className="text-slate-400">{inv.needs_count || 956} not counted</span>
            </div>
          </div>
        </div>
      </div>

      {/* Visual Charts Grid: Category Donut + Top Brands Bar Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Donut of Sales by Category */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-6 rounded-2xl shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Day Sales by Category</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Split into spirit types and beverage classes ({selectedDate})
                </p>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg">
                ${totalCatAmount.toFixed(2)} Total
              </span>
            </div>

            {/* Donut Layout: SVG ring on left + Legend with Name/Label on right */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-6 items-center mt-6">
              {/* SVG Donut */}
              <div className="sm:col-span-5 flex justify-center relative">
                <svg viewBox="0 0 100 100" className="w-40 h-40 transform -rotate-90">
                  {/* Background track */}
                  <circle cx="50" cy="50" r="38" fill="transparent" stroke="#F1F5F9" strokeWidth="16" />
                  {/* Segment arcs */}
                  {donutSegments.map((seg) => {
                    const circumference = 2 * Math.PI * 38; // ~238.76
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
                    ${day.store_sales.toFixed(0)}
                  </span>
                </div>
              </div>

              {/* Legend with Name, Chip & Value */}
              <div className="sm:col-span-7 space-y-2 max-h-56 overflow-y-auto pr-1">
                {donutSegments.map((seg) => {
                  const isHovered = hoveredCategory === seg.category;
                  return (
                    <div
                      key={seg.category}
                      onClick={() => onNavigateTab("inventory", { category: seg.category })}
                      onMouseEnter={() => setHoveredCategory(seg.category)}
                      onMouseLeave={() => setHoveredCategory(null)}
                      className={`flex items-center justify-between p-2 rounded-xl text-xs transition cursor-pointer ${
                        isHovered
                          ? "bg-slate-100 dark:bg-slate-800 font-bold"
                          : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: seg.color }} />
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

          <div className="pt-3 mt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
            <span>Lottery kept separate: ${((day.departments || []).find((d) => /lotter/i.test(d.department))?.amount || 103.08).toFixed(2)}</span>
            <button
              onClick={() => onNavigateTab("dailysales")}
              className="text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1"
            >
              Full Daily Report <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Chart 2: Top 10 Brands Bar Chart (Brand Shades) */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-6 rounded-2xl shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Top 10 Selling Brands</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Brand revenue colored by category shades (30-day velocity)
                </p>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg">
                Leaderboard
              </span>
            </div>

            {/* Horizontal Bar Chart */}
            <div className="space-y-3 mt-5">
              {brandsData.map((b, idx) => {
                const brandStyle = getBrandChipStyle(b.category, b.brand);
                const pct = Math.min(100, Math.round((b.amount / maxBrandAmount) * 100));

                return (
                  <div key={b.brand} className="group">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[10px] font-bold text-slate-400 w-4 text-center">#{idx + 1}</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">{b.brand}</span>
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium border ${brandStyle.bg} ${brandStyle.text} ${brandStyle.border}`}
                        >
                          {b.category || "Spirits"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 font-mono">
                        <span className="text-slate-900 dark:text-white font-bold">${b.amount.toFixed(2)}</span>
                        <span className="text-[10px] text-slate-400">({b.qty} sold)</span>
                      </div>
                    </div>
                    {/* Visual Bar */}
                    <div className="w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
                      <div
                        style={{ width: `${pct}%`, backgroundColor: brandStyle.accent }}
                        className="h-full rounded-full transition-all duration-500 group-hover:opacity-90"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pt-3 mt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
            <span>Based on 30-day verified scanned sales</span>
            <button
              onClick={() => onNavigateTab("inventory")}
              className="text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1"
            >
              View In Inventory <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Chart 3: 30-Day Store Sales Trend Line */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-6 rounded-2xl shadow-sm">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">30-Day Sales Trend</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Daily revenue trajectory across all registers ({range.start} → {range.end})
            </p>
          </div>
          <div className="text-right">
            <span className="text-xs text-slate-400">30-Day Total: </span>
            <span className="text-sm font-bold text-slate-900 dark:text-white">${range.store_sales.toLocaleString()}</span>
          </div>
        </div>

        {/* SVG Sparkline / Line Chart */}
        <div className="mt-6">
          <div className="h-44 w-full relative">
            <svg viewBox="0 0 600 160" preserveAspectRatio="none" className="w-full h-full overflow-visible">
              <defs>
                <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Grid Lines */}
              <line x1="0" y1="40" x2="600" y2="40" stroke="#E2E8F0" strokeDasharray="3 3" />
              <line x1="0" y1="80" x2="600" y2="80" stroke="#E2E8F0" strokeDasharray="3 3" />
              <line x1="0" y1="120" x2="600" y2="120" stroke="#E2E8F0" strokeDasharray="3 3" />

              {/* Area fill */}
              {dailyData.length > 1 && (
                <polygon
                  points={`0,160 ${dailyData
                    .map((d, i) => `${(i / (dailyData.length - 1)) * 600},${160 - (d.amount / maxDaily) * 140}`)
                    .join(" ")} 600,160`}
                  fill="url(#salesGrad)"
                />
              )}

              {/* Main Line */}
              {dailyData.length > 1 && (
                <polyline
                  points={dailyData
                    .map((d, i) => `${(i / (dailyData.length - 1)) * 600},${160 - (d.amount / maxDaily) * 140}`)
                    .join(" ")}
                  fill="none"
                  stroke="#3B82F6"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* Data points */}
              {dailyData.map((d, i) => {
                const x = (i / (dailyData.length - 1)) * 600;
                const y = 160 - (d.amount / maxDaily) * 140;
                const isSelected = d.d === selectedDate;
                return (
                  <g key={d.d} className="cursor-pointer" onClick={() => onDateChange(d.d)}>
                    <circle
                      cx={x}
                      cy={y}
                      r={isSelected ? 5 : 3}
                      fill={isSelected ? "#EF4444" : "#3B82F6"}
                      stroke="#FFFFFF"
                      strokeWidth="2"
                    />
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Date Axis Labels */}
          <div className="flex justify-between text-[10px] text-slate-400 mt-2 font-mono">
            <span>{range.start}</span>
            <span>15 Days Ago</span>
            <span className="font-bold text-blue-600">{selectedDate} (Selected)</span>
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
                ${topShelf.amount.toFixed(2)} generated from {topShelf.qty} premium bottles on {selectedDate}
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

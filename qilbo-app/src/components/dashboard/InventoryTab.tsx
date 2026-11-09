import { useState, useEffect, useMemo } from "react";
import {
  Search,
  RefreshCw,
  ChevronDown,
  TrendingUp,
  Layers,
  Wine,
  Plus,
  Check,
  Calculator,
  SlidersHorizontal,
} from "lucide-react";
import type { ApiInventoryItem } from "../../types";
import { api } from "../../lib/api";
import ProductDetailModal from "./ProductDetailModal";
import DateRangePicker, { type DateRange, computePresets } from "./DateRangePicker";
import {
  CATEGORY_COLORS,
  getCategoryConfig,
  getBrandChipStyle,
  getBrandInitials,
  getDistributorBadge,
} from "../../lib/colors";

function shouldShowSize(name: string, size?: string | null): boolean {
  if (!size) return false;
  const n = name.toLowerCase();
  const s = size.toLowerCase().trim();
  if (n.includes(s)) return false;
  const sClean = s.replace(/\s+/g, "");
  if (n.includes(sClean)) return false;
  const sizeNum = size.replace(/[^0-9.]/g, "");
  if (sizeNum && sizeNum.length >= 2 && n.includes(sizeNum)) {
    const patterns = [
      `${sizeNum}l`, `${sizeNum} l`, `${sizeNum} liter`, `${sizeNum}liter`,
      `${sizeNum}ml`, `${sizeNum} ml`, `${sizeNum}oz`, `${sizeNum} oz`
    ];
    if (patterns.some(p => n.includes(p))) return false;
  }
  return true;
}

interface Props {
  initialCategory?: string;
  initialDistributor?: string;
  initialTopShelf?: boolean;
}

export default function InventoryTab({
  initialCategory = "all",
  initialDistributor = "all",
  initialTopShelf = false,
}: Props) {
  const [items, setItems] = useState<ApiInventoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>(initialCategory);
  const [distributor, setDistributor] = useState<string>(initialDistributor);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [topShelfOnly, setTopShelfOnly] = useState<boolean>(initialTopShelf);
  const [groupByBrand, setGroupByBrand] = useState<boolean>(false);
  const [currentRange, setCurrentRange] = useState<DateRange>(() => {
    const presets = computePresets("2026-11-05");
    return {
      startDate: presets.last30.start,
      endDate: presets.last30.end,
      label: "Last 30 days",
    };
  });
  const [showPhoneFilters, setShowPhoneFilters] = useState<boolean>(false);
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [addedPoMap, setAddedPoMap] = useState<Record<number, boolean>>({});
  const [showArithmeticId, setShowArithmeticId] = useState<number | null>(null);

  // Sync props when user clicks sidebar categories/distributors
  useEffect(() => {
    if (initialCategory) setCategory(initialCategory);
  }, [initialCategory]);

  useEffect(() => {
    if (initialDistributor) setDistributor(initialDistributor);
  }, [initialDistributor]);

  const loadInventory = async () => {
    setLoading(true);
    try {
      const data = await api.getInventory({
        category: category !== "all" ? category : undefined,
        distributor: distributor !== "all" ? distributor : undefined,
        status: statusFilter !== "all" ? statusFilter : undefined,
        top_shelf: topShelfOnly,
        all: true,
        start: currentRange.startDate,
        end: currentRange.endDate,
      });
      setItems(data);
    } catch (err) {
      console.error("Failed to load inventory:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInventory();
  }, [category, distributor, statusFilter, topShelfOnly, currentRange.startDate, currentRange.endDate]);

  const filtered = useMemo(() => {
    return items.filter((it) => {
      if (search) {
        const q = search.toLowerCase();
        const matchName = (it.name || "").toLowerCase().includes(q);
        const matchClean = (it.clean_name || "").toLowerCase().includes(q);
        const matchBrand = (it.brand || "").toLowerCase().includes(q);
        if (!matchName && !matchClean && !matchBrand) return false;
      }
      return true;
    });
  }, [items, search]);

  const hasItems = filtered.length > 0;

  // Statistics calculation for the Top Strip
  const activeCount = filtered.length;
  const bestSeller = useMemo(() => {
    if (!filtered.length) return null;
    const withSales = [...filtered].filter((it) => (it.sold_range ?? it.sold30 ?? 0) > 0);
    if (!withSales.length) return null;
    return withSales.sort((a, b) => (b.sold_range ?? b.sold30 ?? 0) - (a.sold_range ?? a.sold30 ?? 0))[0];
  }, [filtered]);

  const totalRangeUnits = useMemo(() => {
    return filtered.reduce((acc, it) => acc + (it.sold_range ?? it.sold30 ?? 0), 0);
  }, [filtered]);

  const stockOkCount = filtered.filter((i) => i.status === "OK").length;
  const healthScore = filtered.length ? Math.round((stockOkCount / filtered.length) * 100) : null;

  // Group by Category -> Brand with totals
  const groupedData = useMemo(() => {
    if (!groupByBrand) return null;
    const groups: Record<
      string,
      {
        totalItems: number;
        totalBottles: number;
        totalStockValue: number;
        totalSold: number;
        totalSalesAmount: number;
        brands: Record<
          string,
          {
            items: ApiInventoryItem[];
            bottles: number;
            stockValue: number;
            soldRange: number;
            salesAmount: number;
          }
        >;
      }
    > = {};

    filtered.forEach((it) => {
      const cat = it.category || "Other";
      const br = it.brand || "Other Brands";
      if (!groups[cat]) {
        groups[cat] = {
          totalItems: 0,
          totalBottles: 0,
          totalStockValue: 0,
          totalSold: 0,
          totalSalesAmount: 0,
          brands: {},
        };
      }
      if (!groups[cat].brands[br]) {
        groups[cat].brands[br] = {
          items: [],
          bottles: 0,
          stockValue: 0,
          soldRange: 0,
          salesAmount: 0,
        };
      }
      const btls = it.on_hand != null && it.on_hand > 0 ? it.on_hand : 0;
      const sVal = it.stock_value || 0;
      const sQty = it.sold_range ?? it.sold30 ?? 0;
      const sAmt = it.sales_range_amount || 0;

      groups[cat].brands[br].items.push(it);
      groups[cat].brands[br].bottles += btls;
      groups[cat].brands[br].stockValue += sVal;
      groups[cat].brands[br].soldRange += sQty;
      groups[cat].brands[br].salesAmount += sAmt;

      groups[cat].totalItems += 1;
      groups[cat].totalBottles += btls;
      groups[cat].totalStockValue += sVal;
      groups[cat].totalSold += sQty;
      groups[cat].totalSalesAmount += sAmt;
    });
    return groups;
  }, [filtered, groupByBrand]);

  const toggleCategoryExpand = (cat: string) => {
    setExpandedCategories((prev) => ({ ...prev, [cat]: !prev[cat] }));
  };

  const handleAddToPO = async (e: React.MouseEvent, it: ApiInventoryItem) => {
    e.stopPropagation();
    const cases = it.suggested_cases && it.suggested_cases > 0 ? it.suggested_cases : 1;
    try {
      await api.addToDraftPO(it.id, cases, it.distributor || undefined);
      setAddedPoMap((prev) => ({ ...prev, [it.id]: true }));
      setTimeout(() => {
        setAddedPoMap((prev) => ({ ...prev, [it.id]: false }));
      }, 2200);
    } catch (err) {
      console.error("Failed to add to PO:", err);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. TOP STATISTIC STRIP */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Product Statistics & Health</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Live store inventory performance metrics ({currentRange.label})
            </p>
          </div>
          <button
            onClick={loadInventory}
            title="Refresh inventory"
            className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition shadow-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-blue-600" : ""}`} />
          </button>
        </div>

        {/* 4 Strip Columns */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:divide-x divide-slate-100 dark:divide-slate-800">
          {/* Column 1: Active Product */}
          <div className="md:px-4 first:pl-0">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Active Products
            </span>
            <div className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1">
              {activeCount} <span className="text-xs font-semibold text-slate-400">SKUs</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              {items.length} in current filter
            </p>
          </div>

          {/* Column 2: Winning Product this week */}
          <div className="md:px-4">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Winning Product ({currentRange.label})
            </span>
            {bestSeller ? (
              <>
                <div className="text-sm font-bold text-slate-900 dark:text-white mt-1 truncate">
                  {bestSeller.clean_name || bestSeller.name}
                </div>
                <p className="text-[11px] text-emerald-600 font-semibold mt-1 flex items-center gap-1">
                  <TrendingUp className="w-3.5 h-3.5" />
                  {bestSeller.sold_range ?? bestSeller.sold30} units sold ({bestSeller.size || "750ml"})
                </p>
              </>
            ) : (
              <>
                <div className="text-sm font-bold text-slate-400 mt-1">No items</div>
                <p className="text-[11px] text-slate-400 mt-1">0 units sold in period</p>
              </>
            )}
          </div>

          {/* Column 3: Stock Health Gauge */}
          <div className="md:px-4">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Stock Health
            </span>
            {hasItems && healthScore !== null ? (
              <>
                <div className="flex items-center gap-2 mt-1">
                  <div className="w-8 h-8 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 flex items-center justify-center font-bold text-xs">
                    {healthScore}%
                  </div>
                  <span className="text-sm font-bold text-emerald-600">
                    {healthScore >= 75 ? "Good!" : healthScore >= 40 ? "Moderate" : "Attention"}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  {stockOkCount} OK • {filtered.filter((i) => i.status === "OUT").length} Out
                </p>
              </>
            ) : (
              <>
                <div className="text-sm font-bold text-slate-400 mt-1">–</div>
                <p className="text-[11px] text-slate-400 mt-1">No items to evaluate</p>
              </>
            )}
          </div>

          {/* Column 4: Total Units Sold */}
          <div className="md:px-4">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Units Sold ({currentRange.label})
            </span>
            <div className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1">
              {totalRangeUnits.toLocaleString()}{" "}
              <span className="text-xs font-semibold text-slate-400">units</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Store sales volume across registers</p>
          </div>
        </div>
      </div>

      {/* 2. FILTER & SEARCH CONTROLS */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-4 rounded-2xl shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search bar + Phone Filters Toggle */}
          <div className="flex items-center gap-2 flex-1">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                placeholder="Search product, brand (e.g. Don Julio, Hennessy, Bud Light)..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-10 pr-4 py-2 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 transition"
              />
            </div>
            <button
              onClick={() => setShowPhoneFilters(!showPhoneFilters)}
              className="md:hidden shrink-0 flex items-center gap-1.5 px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Filters {category !== "all" || distributor !== "all" || statusFilter !== "all" || topShelfOnly ? "•" : ""}</span>
            </button>
          </div>

          {/* Controls: Date range, Group by Brand, Category & Distributor (Hidden on phone unless toggled) */}
          <div className={`${showPhoneFilters ? "flex" : "hidden md:flex"} flex-wrap items-center gap-2`}>
            {/* Date Range Picker */}
            <DateRangePicker
              currentRange={currentRange}
              onChange={setCurrentRange}
              referenceDate="2026-11-05"
            />

            {/* Group by Brand Toggle */}
            <button
              onClick={() => setGroupByBrand(!groupByBrand)}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm border ${
                groupByBrand
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100"
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>{groupByBrand ? "Grouped by Brand" : "Group by Brand"}</span>
            </button>

            {/* Category Dropdown */}
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 dark:text-white focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="all">All Categories</option>
              {Object.keys(CATEGORY_COLORS).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            {/* Distributor Dropdown */}
            <select
              value={distributor}
              onChange={(e) => setDistributor(e.target.value)}
              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 dark:text-white focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="all">All Distributors</option>
              <option value="Southern Glazer's">Southern Glazer's</option>
              <option value="Breakthru">Breakthru</option>
              <option value="Gold Coast">Gold Coast</option>
              <option value="Florida Distributors">Florida Dist (FDI)</option>
              <option value="Wayne Densch">Wayne Densch</option>
            </select>

            {/* Top Shelf Filter */}
            <button
              onClick={() => setTopShelfOnly(!topShelfOnly)}
              className={`px-3 py-2 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 ${
                topShelfOnly
                  ? "bg-amber-100 border-amber-300 text-amber-900"
                  : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100"
              }`}
            >
              <Wine className="w-3.5 h-3.5 text-amber-600" />
              <span>Top Shelf</span>
            </button>
          </div>
        </div>

        {/* Status Filter Pills (Hidden on phone unless filters toggled) */}
        <div className={`${showPhoneFilters ? "flex" : "hidden md:flex"} flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-800`}>
          {[
            { id: "all", label: "All Items", count: items.length, color: "bg-slate-900 text-white" },
            { id: "OUT", label: "OUT", count: items.filter((i) => i.status === "OUT").length, color: "bg-red-500 text-white" },
            { id: "REORDER", label: "Reorder", count: items.filter((i) => i.status === "REORDER").length, color: "bg-amber-500 text-white" },
            { id: "NOT SELLING", label: "Not Selling (60d)", count: items.filter((i) => i.status === "NOT SELLING").length, color: "bg-stone-500 text-white" },
            { id: "NOT COUNTED", label: "Not Counted", count: items.filter((i) => i.status === "NOT COUNTED").length, color: "bg-blue-500 text-white" },
            { id: "OK", label: "OK", count: items.filter((i) => i.status === "OK").length, color: "bg-emerald-600 text-white" },
          ].map((pill) => {
            const isActive = statusFilter === pill.id;
            return (
              <button
                key={pill.id}
                onClick={() => setStatusFilter(pill.id)}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                  isActive
                    ? pill.color
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
                }`}
              >
                <span>{pill.label}</span>
                <span className="text-[10px] opacity-80 font-mono">({pill.count})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* EMPTY LIST STATE */}
      {!hasItems && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-12 text-center shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 mx-auto flex items-center justify-center mb-3">
            <Search className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-800 dark:text-white">No items found</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            No products match the selected filters. Try choosing a different category or clearing your search.
          </p>
        </div>
      )}

      {/* 3. GROUPED BY BRAND VIEW */}
      {groupByBrand && groupedData && hasItems && (
        <div className="space-y-6">
          {Object.entries(groupedData).map(([catName, groupInfo]) => {
            const catConf = getCategoryConfig(catName);
            const isExpanded = expandedCategories[catName] !== false;

            return (
              <div
                key={catName}
                className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm"
              >
                {/* Category Header with Complete Totals */}
                <div
                  onClick={() => toggleCategoryExpand(catName)}
                  className="p-4 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200/80 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3 cursor-pointer select-none"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: catConf.hex }} />
                    <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                      {catName}
                    </h3>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                      {Object.keys(groupInfo.brands).length} Brands
                    </span>
                  </div>

                  {/* Category Totals */}
                  <div className="flex items-center gap-3.5 text-xs font-semibold flex-wrap">
                    <div>
                      <span className="text-slate-400">Items: </span>
                      <span className="font-bold text-slate-900 dark:text-white">{groupInfo.totalItems}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">On Hand: </span>
                      <span className="font-bold text-slate-900 dark:text-white">{groupInfo.totalBottles} btls</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Stock Value: </span>
                      <span className="font-bold text-emerald-600">${groupInfo.totalStockValue.toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Sold ({currentRange.label}): </span>
                      <span className="font-bold text-blue-600">{groupInfo.totalSold}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Sales: </span>
                      <span className="font-bold text-slate-900 dark:text-white">${groupInfo.totalSalesAmount.toFixed(2)}</span>
                    </div>
                    <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${isExpanded ? "" : "-rotate-90"}`} />
                  </div>
                </div>

                {/* Brands Content */}
                {isExpanded && (
                  <div className="p-4 space-y-4">
                    {Object.entries(groupInfo.brands).map(([brandName, brandInfo]) => {
                      const brandStyle = getBrandChipStyle(catName, brandName);

                      return (
                        <div
                          key={brandName}
                          className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 rounded-xl p-4 space-y-3"
                        >
                          {/* Brand Summary Row with Totals */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/60 dark:border-slate-800 pb-3">
                            <div className="flex items-center gap-2">
                              <span
                                className={`text-xs font-extrabold px-3 py-1 rounded-lg border ${brandStyle.bg} ${brandStyle.text} ${brandStyle.border}`}
                              >
                                {brandName}
                              </span>
                              <span className="text-xs text-slate-400 font-medium">
                                ({brandInfo.items.length} SKUs)
                              </span>
                            </div>
                            <div className="flex items-center gap-3.5 text-xs font-semibold flex-wrap">
                              <div>
                                <span className="text-slate-400">On Hand: </span>
                                <span className="font-extrabold text-slate-900 dark:text-white">{brandInfo.bottles} btls</span>
                              </div>
                              <div>
                                <span className="text-slate-400">Stock Value: </span>
                                <span className="font-extrabold text-emerald-600">${brandInfo.stockValue.toFixed(2)}</span>
                              </div>
                              <div>
                                <span className="text-slate-400">Sold: </span>
                                <span className="font-extrabold text-blue-600">{brandInfo.soldRange}</span>
                              </div>
                              <div>
                                <span className="text-slate-400">Sales: </span>
                                <span className="font-extrabold text-slate-900 dark:text-white">${brandInfo.salesAmount.toFixed(2)}</span>
                              </div>
                            </div>
                          </div>

                          {/* Brand Items Mini List */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {brandInfo.items.map((it) => (
                              <div
                                key={it.id}
                                onClick={() => setSelectedProductId(it.id)}
                                className="bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200/80 dark:border-slate-800 hover:border-blue-400 cursor-pointer flex items-center justify-between text-xs transition shadow-2xs"
                              >
                                <div className="min-w-0 pr-2">
                                  <div className="font-bold text-slate-900 dark:text-white truncate">
                                    {it.clean_name || it.name}
                                  </div>
                                  <div className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                                    <span>{it.size || "unit"}</span>
                                    <span>•</span>
                                    <span>{it.display_price}</span>
                                    <span>•</span>
                                    <span>${it.cost != null ? it.cost.toFixed(2) : "–"} cost</span>
                                  </div>
                                </div>
                                <div className="text-right shrink-0 flex items-center gap-2">
                                  <span
                                    className={`font-extrabold text-[11px] px-2 py-0.5 rounded-full ${
                                      it.status === "OUT"
                                        ? "bg-red-100 text-red-700"
                                        : it.status === "REORDER"
                                        ? "bg-amber-100 text-amber-700"
                                        : "bg-emerald-100 text-emerald-700"
                                    }`}
                                  >
                                    {it.on_hand != null ? `${it.on_hand} in stock` : "Not counted"}
                                  </span>
                                  <button
                                    onClick={(e) => handleAddToPO(e, it)}
                                    className="p-1 rounded bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 transition"
                                    title="Add to draft PO"
                                  >
                                    {addedPoMap[it.id] ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Plus className="w-3.5 h-3.5" />}
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 4. MAIN ENRICHED INVENTORY PRODUCT LIST */}
      {!groupByBrand && hasItems && (
        <div className="space-y-2.5">
          {/* Header Row on Desktop */}
          <div className="hidden sm:grid grid-cols-12 gap-3 px-5 py-2.5 text-xs font-bold text-slate-400 uppercase tracking-wider">
            <div className="col-span-4">Product & Distributor</div>
            <div className="col-span-2 text-center">On Hand & Status</div>
            <div className="col-span-2 text-center">Sales ({currentRange.label}) & /Wk</div>
            <div className="col-span-2 text-right">Cost, Price & Margin</div>
            <div className="col-span-2 text-right">Suggested & PO</div>
          </div>

          {/* Product Items */}
          {filtered.slice(0, 150).map((it) => {
            const catConf = getCategoryConfig(it.category);
            const brandStyle = getBrandChipStyle(it.category, it.brand);
            const distBadge = getDistributorBadge(it.distributor);
            const initials = getBrandInitials(it.brand, it.clean_name || it.name);

            const isOut = it.status === "OUT";
            const isReorder = it.status === "REORDER";
            const isNotCounted = it.status === "NOT COUNTED";
            const isAdded = !!addedPoMap[it.id];
            const isShowingCalc = showArithmeticId === it.id;

            return (
              <div
                key={it.id}
                onClick={() => setSelectedProductId(it.id)}
                className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-500 rounded-2xl p-3 sm:px-5 sm:py-3.5 transition shadow-sm hover:shadow-md cursor-pointer relative overflow-hidden"
              >
                {/* Left category accent border */}
                <div
                  className="absolute left-0 top-0 bottom-0 w-1.5"
                  style={{ backgroundColor: catConf.hex }}
                />

                {/* Desktop Row Grid (>= 640px) */}
                <div className="hidden sm:grid grid-cols-12 gap-3 items-center pl-1">
                  {/* Col 1-4: Icon -> Name + Size -> Chips */}
                  <div className="col-span-4 flex items-center gap-3 min-w-0">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center font-extrabold text-xs shrink-0 border shadow-2xs"
                      style={{
                        backgroundColor: `${catConf.hex}15`,
                        color: catConf.hex,
                        borderColor: `${catConf.hex}30`,
                      }}
                    >
                      {initials}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="font-extrabold text-slate-900 dark:text-white text-sm tracking-tight truncate flex items-center gap-1.5">
                        <span className="truncate">{it.clean_name || it.name}</span>
                        {it.is_top_shelf === 1 && (
                          <span className="text-[10px] bg-amber-100 text-amber-900 px-1.5 py-0.2 rounded font-bold border border-amber-300 shrink-0">
                            ★ Top Shelf
                          </span>
                        )}
                        {it.do_not_reorder === 1 && (
                          <span className="text-[10px] bg-rose-100 text-rose-900 px-1.5 py-0.2 rounded font-bold border border-rose-300 shrink-0">
                            No Reorder
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-1 mt-1">
                        {shouldShowSize(it.clean_name || it.name, it.size) && (
                          <span className="font-mono text-[10px] font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                            {it.size}
                          </span>
                        )}
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${brandStyle.bg} ${brandStyle.text} ${brandStyle.border}`}
                        >
                          {it.brand || "Brand"}
                        </span>
                        {it.distributor && it.distributor !== "Unknown" && (
                          <span
                            className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${distBadge.bg} ${distBadge.text} ${distBadge.border}`}
                          >
                            {distBadge.label}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Col 5-6: On Hand & Status */}
                  <div className="col-span-2 flex flex-col items-center justify-center text-center">
                    <div className="flex items-center gap-1.5">
                      <span className="text-base font-black text-slate-900 dark:text-white">
                        {it.on_hand != null ? it.on_hand : "–"}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowArithmeticId(isShowingCalc ? null : it.id);
                        }}
                        title={it.arithmetic || it.basis}
                        className="p-1 text-slate-400 hover:text-blue-600 rounded bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                      >
                        <Calculator className="w-3 h-3" />
                      </button>
                    </div>

                    {isShowingCalc ? (
                      <span className="text-[10px] font-mono text-blue-600 bg-blue-50 dark:bg-blue-950/60 px-1.5 py-0.5 rounded mt-0.5">
                        {it.arithmetic || it.basis}
                      </span>
                    ) : (
                      <div className="flex items-center gap-1 mt-0.5">
                        <span
                          className={`text-[10px] font-extrabold px-1.5 py-0.2 rounded-full ${
                            isOut
                              ? "bg-red-100 text-red-700"
                              : isReorder
                              ? "bg-amber-100 text-amber-700"
                              : isNotCounted
                              ? "bg-blue-100 text-blue-700"
                              : it.status === "OVERSTOCK"
                              ? "bg-purple-100 text-purple-700"
                              : it.status === "NOT SELLING"
                              ? "bg-stone-100 text-stone-700"
                              : "bg-emerald-100 text-emerald-700"
                          }`}
                        >
                          {it.status}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {it.weeks_left != null ? `${it.weeks_left.toFixed(1)}w` : ""}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Col 7-8: Sold in Range + /Week */}
                  <div className="col-span-2 text-center">
                    <div className="font-extrabold text-sm text-slate-900 dark:text-white">
                      {it.sold_range ?? it.sold30} sold
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                      ~{it.per_week.toFixed(1)}/wk
                      {it.sales_range_amount != null && it.sales_range_amount > 0 && (
                        <span> • ${it.sales_range_amount.toFixed(0)}</span>
                      )}
                    </div>
                  </div>

                  {/* Col 9-10: Cost, Shelf Price & Margin */}
                  <div className="col-span-2 text-right">
                    <div className="text-sm font-black text-slate-900 dark:text-white">
                      {it.display_price || "–"}{" "}
                      <span className="text-[11px] font-normal text-slate-400">
                        (${it.cost != null ? it.cost.toFixed(2) : "–"} cost)
                      </span>
                    </div>
                    <div className="text-[11px] font-semibold text-emerald-600 mt-0.5">
                      {it.profit_per_bottle != null ? (
                        <span>
                          +${it.profit_per_bottle.toFixed(2)} ({it.margin_pct ?? 0}%)
                        </span>
                      ) : (
                        <span className="text-slate-400">margin –</span>
                      )}
                    </div>
                  </div>

                  {/* Col 11-12: Suggested Order + Add to PO */}
                  <div className="col-span-2 flex items-center justify-end gap-2">
                    <div className="text-right">
                      <div className="text-xs font-bold text-blue-600">
                        {it.suggested_cases && it.suggested_cases > 0 ? `${it.suggested_cases} cs` : "0 cs"}
                      </div>
                      <span className="text-[10px] text-slate-400 font-medium">suggested</span>
                    </div>

                    <button
                      onClick={(e) => handleAddToPO(e, it)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 shadow-sm border ${
                        isAdded
                          ? "bg-emerald-600 text-white border-emerald-600"
                          : "bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800"
                      }`}
                    >
                      {isAdded ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Added</span>
                        </>
                      ) : (
                        <>
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add to PO</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Mobile Card (< 640px) - STRICT 2 LINES MAX PER ITEM */}
                <div className="sm:hidden space-y-1.5 pl-1">
                  {/* Line 1: Name + Size + Badges (Left) | Status Badge (Right) */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="font-extrabold text-slate-900 dark:text-white text-xs truncate">
                        {it.clean_name || it.name}
                      </span>
                      {shouldShowSize(it.clean_name || it.name, it.size) && (
                        <span className="font-mono text-[9px] font-bold bg-slate-100 dark:bg-slate-800 px-1 py-0.2 rounded text-slate-600 shrink-0">
                          {it.size}
                        </span>
                      )}
                      {it.distributor && it.distributor !== "Unknown" && (
                        <span
                          className={`text-[9px] font-semibold px-1 py-0.2 rounded border ${distBadge.bg} ${distBadge.text} ${distBadge.border} shrink-0`}
                        >
                          {distBadge.label}
                        </span>
                      )}
                    </div>

                    <span
                      className={`text-[9px] font-black px-1.5 py-0.2 rounded-full shrink-0 ${
                        isOut
                          ? "bg-red-100 text-red-700"
                          : isReorder
                          ? "bg-amber-100 text-amber-700"
                          : isNotCounted
                          ? "bg-blue-100 text-blue-700"
                          : "bg-emerald-100 text-emerald-700"
                      }`}
                    >
                      {it.status}
                    </span>
                  </div>

                  {/* Line 2: On Hand • Sold/Wk • Cost/Price • Sug Cs (Left) | Compact Add to PO (Right) */}
                  <div className="flex items-center justify-between gap-1 text-[11px] pt-1 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-1 text-slate-600 dark:text-slate-400 truncate">
                      <span className="font-black text-slate-900 dark:text-white">
                        {it.on_hand != null ? `${it.on_hand} on hand` : "not counted"}
                      </span>
                      <span>•</span>
                      <span>{it.sold_range ?? it.sold30} sold (~{it.per_week.toFixed(1)}/w)</span>
                      <span>•</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {it.display_price}
                      </span>
                      {it.margin_pct != null && (
                        <span className="text-emerald-600 font-semibold">({it.margin_pct}%)</span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {it.suggested_cases && it.suggested_cases > 0 ? (
                        <span className="text-[10px] font-bold text-blue-600">
                          {it.suggested_cases}cs
                        </span>
                      ) : null}
                      <button
                        onClick={(e) => handleAddToPO(e, it)}
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition flex items-center gap-1 ${
                          isAdded
                            ? "bg-emerald-600 text-white"
                            : "bg-blue-600 text-white hover:bg-blue-700"
                        }`}
                      >
                        {isAdded && <Check className="w-3 h-3" />}
                        <span>{isAdded ? "Added" : "+ PO"}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Product Detail & Audit Modal */}
      {selectedProductId != null && (
        <ProductDetailModal
          productId={selectedProductId}
          onClose={() => setSelectedProductId(null)}
          onStockUpdated={loadInventory}
        />
      )}
    </div>
  );
}

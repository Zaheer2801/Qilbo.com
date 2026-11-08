import { useState, useMemo, useEffect } from "react";
import {
  RefreshCw,
  Search,
  Wine,
  Beer,
  Cigarette,
  CupSoda,
  Ticket,
  Flame,
  ArrowUpDown,
  Calendar,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import type { AppState, Sale, Product } from "../../types";
import { card, btnPrimary } from "../ui";
import { titleCase } from "../../lib/format";

interface CategoryMeta {
  id: string;
  label: string;
  icon?: any;
}

const DEPARTMENTS: CategoryMeta[] = [
  { id: "all", label: "All Departments" },
  { id: "Liquor", label: "Liquor & Spirits", icon: Wine },
  { id: "Beer", label: "Beer & Malt", icon: Beer },
  { id: "Tobacco", label: "Tobacco & Cigars", icon: Cigarette },
  { id: "Beverages", label: "Beverages & Mixers", icon: CupSoda },
  { id: "Wine", label: "Wine & Sangria", icon: Wine },
  { id: "Lottery", label: "Lottery & Scratchers", icon: Ticket },
];

const LIQUOR_SUBCATEGORIES: CategoryMeta[] = [
  { id: "all", label: "All Liquor" },
  { id: "Whiskey & Bourbon", label: "Whiskey & Bourbon" },
  { id: "Tequila", label: "Tequila" },
  { id: "Cognac & Brandy", label: "Cognac & Brandy" },
  { id: "Vodka", label: "Vodka" },
  { id: "Cutwaters & Ready-to-Drink", label: "Cutwaters & RTD" },
  { id: "Rum", label: "Rum" },
  { id: "Gin", label: "Gin" },
  { id: "Cordials & Shooters", label: "Cordials & 99s" },
];

export default function DailySalesReportTab({
  state,
  onSyncNrs,
  isSyncing,
  syncMessage,
  initialDate,
}: {
  state: AppState;
  onSyncNrs: () => void;
  isSyncing: boolean;
  syncMessage: string | null;
  initialDate?: string;
}) {
  const [selectedStore, setSelectedStore] = useState<string>("all");
  const [dateMode, setDateMode] = useState<"single" | "range" | "all">("single");
  const [selectedDate, setSelectedDate] = useState<string>(initialDate || "2026-10-21");
  const [startDate, setStartDate] = useState<string>("2026-07-01");
  const [endDate, setEndDate] = useState<string>("2026-10-21");
  const [selectedDept, setSelectedDept] = useState<string>("all");
  const [selectedSubCat, setSelectedSubCat] = useState<string>("all");
  const [search, setSearch] = useState<string>("");
  const [sortBy, setSortBy] = useState<"amount" | "qty" | "name">("amount");
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  // All unique dates chronologically
  const allUniqueDates = useMemo(() => {
    return Array.from(new Set(state.sales.map((s) => s.date))).sort();
  }, [state.sales]);

  const minDate = allUniqueDates[0] || "2026-06-17";
  const maxDate = allUniqueDates[allUniqueDates.length - 1] || "2026-10-21";

  // When initialDate changes from outside (e.g. clicking calendar heatmap)
  useEffect(() => {
    if (initialDate) {
      setSelectedDate(initialDate);
      setDateMode("single");
    }
  }, [initialDate]);

  // Distinct POS terminals for Discount Liquor
  const availableTerminals = useMemo(() => {
    const termMap = new Map<string, string>();
    state.sales.forEach((s) => {
      const id = s.storeId || "87287";
      let label = `Terminal #${id}`;
      if (id === "87287") label = "Terminal #87287 (Current Active)";
      else if (id === "83954") label = "Terminal #83954 (Jul–Sep 2026)";
      else if (id === "60696") label = "Terminal #60696 (Jun 2026)";
      termMap.set(id, label);
    });
    return Array.from(termMap.entries()).map(([id, name]) => ({ id, name }));
  }, [state.sales]);

  // Step dates with arrows
  function stepDate(direction: -1 | 1) {
    if (allUniqueDates.length === 0) return;
    const idx = allUniqueDates.indexOf(selectedDate);
    if (idx === -1) {
      setSelectedDate(allUniqueDates[allUniqueDates.length - 1]);
      return;
    }
    const nextIdx = idx + direction;
    if (nextIdx >= 0 && nextIdx < allUniqueDates.length) {
      setSelectedDate(allUniqueDates[nextIdx]);
      setDateMode("single");
    }
  }

  // Date matcher
  const matchesDate = (dateStr: string) => {
    if (dateMode === "all") return true;
    if (dateMode === "single") return dateStr === selectedDate;
    if (dateMode === "range") {
      if (startDate && endDate) return dateStr >= startDate && dateStr <= endDate;
      if (startDate) return dateStr >= startDate;
      if (endDate) return dateStr <= endDate;
      return true;
    }
    return true;
  };

  // Map products by UPC for instant stock & detail lookup
  const productMap = useMemo(() => {
    const map = new Map<string, Product>();
    state.products.forEach((p) => map.set(p.id, p));
    return map;
  }, [state.products]);

  // Filtered sales line items
  const filteredSales = useMemo(() => {
    return state.sales.filter((sale: Sale) => {
      // Store filter
      if (selectedStore !== "all" && sale.storeId && sale.storeId !== selectedStore) {
        return false;
      }

      // Date filter
      if (!matchesDate(sale.date)) {
        return false;
      }

      const prod = productMap.get(sale.productId);
      const name = sale.productName || prod?.name || "";
      const dept = sale.department || prod?.department || "Liquor";
      const subCat = sale.subCategory || prod?.subCategory || prod?.category || "Spirits";

      // Department filter
      if (selectedDept !== "all" && dept !== selectedDept) {
        return false;
      }

      // Liquor Sub-category filter
      if (selectedDept === "Liquor" && selectedSubCat !== "all" && subCat !== selectedSubCat) {
        return false;
      }

      // Search keyword filter
      if (search.trim()) {
        const query = search.toLowerCase();
        const matchesName = name.toLowerCase().includes(query);
        const matchesUpc = sale.productId.toLowerCase().includes(query);
        const matchesSub = subCat.toLowerCase().includes(query);
        if (!matchesName && !matchesUpc && !matchesSub) return false;
      }

      return true;
    }).sort((a: Sale, b: Sale) => {
      if (sortBy === "amount") {
        const amtA = a.amount || 0;
        const amtB = b.amount || 0;
        return sortAsc ? amtA - amtB : amtB - amtA;
      }
      if (sortBy === "qty") {
        return sortAsc ? a.qty - b.qty : b.qty - a.qty;
      }
      const prodA = productMap.get(a.productId);
      const prodB = productMap.get(b.productId);
      const nameA = a.productName || prodA?.name || "";
      const nameB = b.productName || prodB?.name || "";
      return sortAsc ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
    });
  }, [state.sales, productMap, selectedStore, dateMode, selectedDate, startDate, endDate, selectedDept, selectedSubCat, search, sortBy, sortAsc]);

  // Sales for active date & store (for KPIs and breakdowns)
  const scopedSales = useMemo(() => {
    return state.sales.filter((sale) => {
      if (selectedStore !== "all" && sale.storeId && sale.storeId !== selectedStore) return false;
      if (!matchesDate(sale.date)) return false;
      return true;
    });
  }, [state.sales, selectedStore, dateMode, selectedDate, startDate, endDate]);

  // Aggregate metrics for scoped date & store
  const totalRevenue = useMemo(() => {
    return scopedSales.reduce((sum, s) => sum + (s.amount || 0), 0);
  }, [scopedSales]);

  const totalUnits = useMemo(() => {
    return scopedSales.reduce((sum, s) => sum + s.qty, 0);
  }, [scopedSales]);

  // Department totals
  const deptStats = useMemo(() => {
    const stats: Record<string, { units: number; revenue: number }> = {};
    scopedSales.forEach((s) => {
      const prod = productMap.get(s.productId);
      const dept = s.department || prod?.department || "Liquor";
      if (!stats[dept]) stats[dept] = { units: 0, revenue: 0 };
      stats[dept].units += s.qty;
      stats[dept].revenue = Math.round((stats[dept].revenue + (s.amount || 0)) * 100) / 100;
    });
    return stats;
  }, [scopedSales, productMap]);

  // Liquor subcategory totals
  const liquorSubStats = useMemo(() => {
    const stats: Record<string, { units: number; revenue: number }> = {};
    scopedSales.forEach((s) => {
      const prod = productMap.get(s.productId);
      const dept = s.department || prod?.department || "Liquor";
      if (dept === "Liquor") {
        const sub = s.subCategory || prod?.subCategory || prod?.category || "Other Spirits";
        if (!stats[sub]) stats[sub] = { units: 0, revenue: 0 };
        stats[sub].units += s.qty;
        stats[sub].revenue = Math.round((stats[sub].revenue + (s.amount || 0)) * 100) / 100;
      }
    });
    return stats;
  }, [scopedSales, productMap]);

  function toggleSort(field: "amount" | "qty" | "name") {
    if (sortBy === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortBy(field);
      setSortAsc(false);
    }
  }

  // Date label for display
  const dateDisplayLabel = useMemo(() => {
    if (dateMode === "all") return "All Dates Combined";
    if (dateMode === "range") return `${startDate} to ${endDate}`;
    return selectedDate;
  }, [dateMode, selectedDate, startDate, endDate]);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Top Header & Store / Date Selector Bar */}
      <div className="bg-white p-5 rounded-lg border border-stone-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl">📊</span>
            <h1 className="text-xl font-bold text-stone-900 tracking-tight">
              Daily Sales Report Breakdown
            </h1>
          </div>
          <p className="text-xs text-stone-500 mt-1">
            Historical settlement records extracted from your NRS emails.
          </p>
        </div>

        {/* Store & Date Pickers */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Terminal / POS Selector */}
          <div className="flex items-center gap-1.5 text-xs bg-stone-50 border border-stone-300 rounded-md px-2.5 py-1.5">
            <span className="font-bold text-stone-500">POS Terminal:</span>
            <select
              value={selectedStore}
              onChange={(e) => setSelectedStore(e.target.value)}
              className="bg-transparent font-semibold text-stone-900 focus:outline-none cursor-pointer"
            >
              <option value="all">All Terminals (Unified Store)</option>
              {availableTerminals.map((term) => (
                <option key={term.id} value={term.id}>
                  {term.name}
                </option>
              ))}
            </select>
          </div>

          {/* Date Mode Toggle */}
          <div className="inline-flex rounded-md border border-stone-300 p-0.5 bg-stone-100 text-xs">
            <button
              onClick={() => setDateMode("single")}
              className={`px-2 py-1 rounded font-semibold transition ${
                dateMode === "single" ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:text-stone-800"
              }`}
            >
              Calendar Day
            </button>
            <button
              onClick={() => setDateMode("range")}
              className={`px-2 py-1 rounded font-semibold transition ${
                dateMode === "range" ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:text-stone-800"
              }`}
            >
              Date Range
            </button>
            <button
              onClick={() => setDateMode("all")}
              className={`px-2 py-1 rounded font-semibold transition ${
                dateMode === "all" ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:text-stone-800"
              }`}
            >
              All Time
            </button>
          </div>

          {/* Single Date Calendar Picker */}
          {dateMode === "single" && (
            <div className="flex items-center gap-1 bg-stone-50 border border-stone-300 rounded-md px-1.5 py-1 text-xs">
              <button
                onClick={() => stepDate(-1)}
                title="Previous Day Report"
                className="p-1 rounded hover:bg-stone-200 text-stone-600 transition"
              >
                <ChevronLeft size={14} />
              </button>

              <div className="flex items-center gap-1">
                <Calendar size={13} className="text-amber-800" />
                <input
                  type="date"
                  value={selectedDate}
                  min={minDate}
                  max={maxDate}
                  onChange={(e) => {
                    if (e.target.value) {
                      setSelectedDate(e.target.value);
                      setDateMode("single");
                    }
                  }}
                  className="bg-white border border-stone-300 rounded px-2 py-0.5 text-xs font-bold text-amber-950 focus:outline-none focus:ring-1 focus:ring-amber-700 cursor-pointer"
                />
              </div>

              <button
                onClick={() => stepDate(1)}
                title="Next Day Report"
                className="p-1 rounded hover:bg-stone-200 text-stone-600 transition"
              >
                <ChevronRight size={14} />
              </button>

              <button
                onClick={() => setSelectedDate("2026-07-01")}
                className="text-[11px] font-semibold text-stone-500 hover:text-amber-900 underline ml-1 px-1"
                title="Jump to July 01"
              >
                July 1
              </button>
              <button
                onClick={() => setSelectedDate(maxDate)}
                className="text-[11px] font-semibold text-stone-500 hover:text-amber-900 underline px-1"
                title="Jump to Latest Report"
              >
                Latest
              </button>
            </div>
          )}

          {/* Date Range Picker */}
          {dateMode === "range" && (
            <div className="flex items-center gap-1.5 bg-stone-50 border border-stone-300 rounded-md px-2 py-1 text-xs">
              <span className="text-stone-500 font-medium">From:</span>
              <input
                type="date"
                value={startDate}
                min={minDate}
                max={maxDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-white border border-stone-300 rounded px-1.5 py-0.5 text-xs font-semibold text-stone-900 focus:outline-none"
              />
              <span className="text-stone-500 font-medium">To:</span>
              <input
                type="date"
                value={endDate}
                min={minDate}
                max={maxDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-white border border-stone-300 rounded px-1.5 py-0.5 text-xs font-semibold text-stone-900 focus:outline-none"
              />

              {/* Month shortcuts */}
              <div className="flex items-center gap-1 ml-1 border-l border-stone-300 pl-1.5">
                <button
                  onClick={() => { setStartDate("2026-07-01"); setEndDate("2026-07-31"); }}
                  className="text-[10px] px-1.5 py-0.5 rounded bg-stone-200 text-stone-700 hover:bg-stone-300 font-semibold"
                >
                  July
                </button>
                <button
                  onClick={() => { setStartDate("2026-08-01"); setEndDate("2026-08-31"); }}
                  className="text-[10px] px-1.5 py-0.5 rounded bg-stone-200 text-stone-700 hover:bg-stone-300 font-semibold"
                >
                  Aug
                </button>
                <button
                  onClick={() => { setStartDate("2026-09-01"); setEndDate("2026-09-30"); }}
                  className="text-[10px] px-1.5 py-0.5 rounded bg-stone-200 text-stone-700 hover:bg-stone-300 font-semibold"
                >
                  Sept
                </button>
                <button
                  onClick={() => { setStartDate("2026-10-01"); setEndDate("2026-10-31"); }}
                  className="text-[10px] px-1.5 py-0.5 rounded bg-stone-200 text-stone-700 hover:bg-stone-300 font-semibold"
                >
                  Oct
                </button>
              </div>
            </div>
          )}

          {syncMessage && (
            <span className="text-xs font-semibold px-2.5 py-1 rounded bg-amber-50 text-amber-900 border border-amber-200">
              {syncMessage}
            </span>
          )}

          <button
            onClick={onSyncNrs}
            disabled={isSyncing}
            className={`${btnPrimary} flex items-center gap-1.5 text-xs`}
            title="Fetch today's report from Gmail"
          >
            <RefreshCw size={14} className={isSyncing ? "animate-spin" : ""} />
            {isSyncing ? "Syncing..." : "Sync Latest NRS"}
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className={card}>
          <div className="text-xs font-medium text-stone-500 mb-1">Total Sales Revenue</div>
          <div className="text-2xl font-bold text-stone-900">
            ${totalRevenue.toFixed(2)}
          </div>
          <div className="text-[11px] text-stone-400 mt-0.5">Net settlement from NRS</div>
        </div>

        <div className={card}>
          <div className="text-xs font-medium text-stone-500 mb-1">Units Sold</div>
          <div className="text-2xl font-bold text-emerald-800">{totalUnits}</div>
          <div className="text-[11px] text-stone-400 mt-0.5">Total scanned bottles/items</div>
        </div>

        <div className={card}>
          <div className="text-xs font-medium text-stone-500 mb-1">Liquor Revenue</div>
          <div className="text-2xl font-bold text-amber-900">
            ${(deptStats["Liquor"]?.revenue || 0).toFixed(2)}
          </div>
          <div className="text-[11px] text-stone-400 mt-0.5">
            {deptStats["Liquor"]?.units || 0} spirits & cocktail bottles
          </div>
        </div>

        <div className={card}>
          <div className="text-xs font-medium text-stone-500 mb-1">Beer & Tobacco</div>
          <div className="text-2xl font-bold text-stone-800">
            ${((deptStats["Beer"]?.revenue || 0) + (deptStats["Tobacco"]?.revenue || 0)).toFixed(2)}
          </div>
          <div className="text-[11px] text-stone-400 mt-0.5">
            {(deptStats["Beer"]?.units || 0) + (deptStats["Tobacco"]?.units || 0)} units sold
          </div>
        </div>
      </div>

      {/* Primary Department Filter Bar */}
      <div className="bg-white p-3 rounded-lg border border-stone-200 shadow-sm">
        <div className="text-xs font-bold uppercase tracking-wider text-stone-400 mb-2 px-1">
          Select Department
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {DEPARTMENTS.map((dept) => {
            const active = selectedDept === dept.id;
            const stat = deptStats[dept.id];
            return (
              <button
                key={dept.id}
                onClick={() => {
                  setSelectedDept(dept.id);
                  if (dept.id !== "Liquor") setSelectedSubCat("all");
                }}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-semibold whitespace-nowrap transition ${
                  active
                    ? "bg-amber-800 text-amber-50 shadow-sm"
                    : "bg-stone-50 text-stone-700 border border-stone-200 hover:bg-stone-100"
                }`}
              >
                {dept.icon && <dept.icon size={14} className={active ? "text-amber-200" : "text-stone-500"} />}
                <span>{dept.label}</span>
                {stat && (
                  <span
                    className={`ml-1 text-[10px] px-1.5 py-0.2 rounded-full ${
                      active ? "bg-amber-900 text-amber-200" : "bg-stone-200/80 text-stone-600"
                    }`}
                  >
                    ${stat.revenue.toFixed(0)}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Secondary Sub-Category Filter (When Liquor is Selected or All) */}
        {(selectedDept === "Liquor" || selectedDept === "all") && (
          <div className="mt-3 pt-3 border-t border-stone-100">
            <div className="text-xs font-bold text-stone-500 mb-2 px-1 flex items-center justify-between">
              <span>Liquor Sub-Categories (Whiskey, Tequila, Cognac, Cutwaters, etc.)</span>
              {selectedDept !== "Liquor" && (
                <span className="text-[10px] text-stone-400 font-normal">
                  Filter liquor specific bottles
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {LIQUOR_SUBCATEGORIES.map((sub) => {
                const active = selectedSubCat === sub.id;
                const stat = liquorSubStats[sub.id];
                return (
                  <button
                    key={sub.id}
                    onClick={() => {
                      if (selectedDept !== "Liquor") setSelectedDept("Liquor");
                      setSelectedSubCat(sub.id);
                    }}
                    className={`px-2.5 py-1.5 rounded text-xs font-medium whitespace-nowrap transition ${
                      active
                        ? "bg-amber-100 text-amber-950 font-bold border border-amber-300"
                        : "bg-white text-stone-600 border border-stone-200 hover:bg-stone-50"
                    }`}
                  >
                    <span>{sub.label}</span>
                    {stat && (
                      <span className="ml-1 text-[10px] text-stone-400 font-mono">
                        ({stat.units})
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Line Item Table Card */}
      <div className={card}>
        {/* Table Controls / Search */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-sm font-bold text-stone-900">
              Itemized Daily Sales Breakdown
            </h2>
            <p className="text-xs text-stone-500">
              Showing {filteredSales.length} items sold ({dateDisplayLabel})
            </p>
          </div>

          <div className="w-full sm:w-64 relative">
            <Search size={14} className="absolute left-3 top-2.5 text-stone-400" />
            <input
              type="text"
              placeholder="Search bottle name, brand, or UPC..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-md border border-stone-300 bg-white placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-700/40 focus:border-amber-700"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-stone-200 text-xs font-semibold text-stone-500 uppercase tracking-wider">
                <th className="pb-3 pr-4">
                  <button
                    onClick={() => toggleSort("name")}
                    className="flex items-center gap-1 hover:text-stone-900"
                  >
                    Product Description
                    <ArrowUpDown size={12} />
                  </button>
                </th>
                <th className="pb-3 pr-4">Department</th>
                <th className="pb-3 pr-4">Sub-Category</th>
                <th className="pb-3 pr-4">Size</th>
                <th className="pb-3 pr-4 text-center">
                  <button
                    onClick={() => toggleSort("qty")}
                    className="flex items-center gap-1 hover:text-stone-900 mx-auto"
                  >
                    Qty Sold
                    <ArrowUpDown size={12} />
                  </button>
                </th>
                <th className="pb-3 pr-4 text-right">Unit Price</th>
                <th className="pb-3 pr-4 text-right">
                  <button
                    onClick={() => toggleSort("amount")}
                    className="flex items-center gap-1 hover:text-stone-900 ml-auto"
                  >
                    Total Sales
                    <ArrowUpDown size={12} />
                  </button>
                </th>
                <th className="pb-3 text-center">Live Stock</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filteredSales.map((sale: Sale) => {
                const prod = productMap.get(sale.productId);
                const name = sale.productName || prod?.name || "Item";
                const dept = sale.department || prod?.department || "Liquor";
                const sub = sale.subCategory || prod?.subCategory || prod?.category || "Spirits";
                const size = sale.size || prod?.size || "—";
                const unitPrice = sale.unitPrice || prod?.sellingPrice || (sale.amount ? sale.amount / sale.qty : 0);
                const currentStock = prod?.qty ?? 10;
                const isTopShelf = sale.isTopShelf || prod?.isTopShelf;
                const isLow = prod ? prod.qty <= prod.reorderPoint : false;

                return (
                  <tr key={sale.id} className="hover:bg-stone-50/80 transition-colors">
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-1.5">
                        {isTopShelf && (
                          <span title="Top Shelf" className="text-amber-600 shrink-0">
                            <Flame size={14} className="fill-amber-600" />
                          </span>
                        )}
                        <span className="font-semibold text-stone-900">
                          {titleCase(name)}
                        </span>
                      </div>
                      <span className="text-[10px] text-stone-400 font-mono block ml-5">
                        UPC: {sale.productId}
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      <span className="text-xs px-2 py-0.5 rounded font-medium bg-stone-100 text-stone-700">
                        {dept}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-xs text-stone-600">
                      {sub}
                    </td>
                    <td className="py-3 pr-4 text-xs font-mono text-stone-600">{size}</td>
                    <td className="py-3 pr-4 text-center">
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-200">
                        {sale.qty} sold
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-right font-medium text-stone-700">
                      ${unitPrice.toFixed(2)}
                    </td>
                    <td className="py-3 pr-4 text-right font-bold text-stone-900">
                      ${(sale.amount || (unitPrice * sale.qty)).toFixed(2)}
                    </td>
                    <td className="py-3 text-center">
                      <span
                        className={`text-xs px-2 py-0.5 rounded font-bold ${
                          isLow
                            ? "bg-red-100 text-red-800 border border-red-200"
                            : "bg-emerald-50 text-emerald-800 border border-emerald-200"
                        }`}
                      >
                        {currentStock} on hand
                      </span>
                    </td>
                  </tr>
                );
              })}
              {filteredSales.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-stone-400 italic">
                    No items match this category or search filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

import { useState, useMemo, useEffect } from "react";
import {
  TrendingUp,
  Award,
  DollarSign,
  Package,
  Calendar,
  Flame,
  Wine,
  Sparkles,
  Layers,
  Clock,
  Filter,
  Bot,
  ArrowUpRight,
  X,
} from "lucide-react";
import type { AppState, Sale } from "../../types";
import QilboChatbot from "./QilboChatbot";

export default function ExecutivePartnerTab({
  state,
  onNavigateToDailyReport,
}: {
  state: AppState;
  onNavigateToDailyReport?: (date: string) => void;
}) {
  // Period filter
  const [period, setPeriod] = useState<"all" | "oct" | "sep" | "aug" | "jul" | "7d">("all");
  const [activeBrandSpotlight, setActiveBrandSpotlight] = useState<"topshelf" | "podium" | "xxl" | "stella">("topshelf");
  const [hoveredDay, setHoveredDay] = useState<{ date: string; revenue: number; units: number } | null>(null);

  // Chatbot state
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatInitialQuestion, setChatInitialQuestion] = useState<string | undefined>(undefined);

  const triggerChat = (question: string) => {
    setChatInitialQuestion(question);
    setIsChatOpen(true);
  };

  // All sales data
  const allSales: Sale[] = state.sales || [];

  // Filter sales by selected period
  const filteredSales = useMemo(() => {
    if (period === "all") return allSales;
    if (period === "oct") return allSales.filter((s) => s.date.startsWith("2026-10"));
    if (period === "sep") return allSales.filter((s) => s.date.startsWith("2026-09"));
    if (period === "aug") return allSales.filter((s) => s.date.startsWith("2026-08"));
    if (period === "jul") return allSales.filter((s) => s.date.startsWith("2026-07"));
    if (period === "7d") {
      const dates = Array.from(new Set(allSales.map((s) => s.date))).sort();
      const last7 = new Set(dates.slice(-7));
      return allSales.filter((s) => last7.has(s.date));
    }
    return allSales;
  }, [allSales, period]);

  // Overall KPIs
  const totalRevenue = useMemo(
    () => filteredSales.reduce((acc, s) => acc + (s.amount || s.qty * (s.unitPrice || 0)), 0),
    [filteredSales]
  );
  const totalUnits = useMemo(() => filteredSales.reduce((acc, s) => acc + s.qty, 0), [filteredSales]);
  const uniqueDatesCount = useMemo(() => new Set(filteredSales.map((s) => s.date)).size, [filteredSales]);
  const avgDailyRevenue = uniqueDatesCount > 0 ? totalRevenue / uniqueDatesCount : 0;

  // Top Shelf KPI
  const topShelfSales = useMemo(() => filteredSales.filter((s) => s.isTopShelf || (s.unitPrice || 0) >= 35), [filteredSales]);
  const topShelfRevenue = useMemo(
    () => topShelfSales.reduce((acc, s) => acc + (s.amount || s.qty * (s.unitPrice || 0)), 0),
    [topShelfSales]
  );
  const topShelfPct = totalRevenue > 0 ? (topShelfRevenue / totalRevenue) * 100 : 0;

  // Department Breakdown
  const deptBreakdown = useMemo(() => {
    const map: Record<string, { name: string; revenue: number; units: number }> = {};
    filteredSales.forEach((s) => {
      const dept = s.department || "General";
      const amt = s.amount || s.qty * (s.unitPrice || 0);
      if (!map[dept]) {
        map[dept] = { name: dept, revenue: 0, units: 0 };
      }
      map[dept].revenue += amt;
      map[dept].units += s.qty;
    });
    return Object.values(map).sort((a, b) => b.revenue - a.revenue);
  }, [filteredSales]);

  // Liquor Subcategory Breakdown
  const liquorSubCats = useMemo(() => {
    const map: Record<string, { name: string; revenue: number; units: number }> = {};
    filteredSales
      .filter((s) => s.department === "Liquor")
      .forEach((s) => {
        const sub = s.subCategory || "Other Spirits";
        const amt = s.amount || s.qty * (s.unitPrice || 0);
        if (!map[sub]) map[sub] = { name: sub, revenue: 0, units: 0 };
        map[sub].revenue += amt;
        map[sub].units += s.qty;
      });
    return Object.values(map).sort((a, b) => b.revenue - a.revenue);
  }, [filteredSales]);

  // Month-over-Month Data
  const monthlyData = useMemo(() => {
    const months = [
      { key: "2026-06", label: "June 2026", terminal: "60696", growth: null },
      { key: "2026-07", label: "July 2026", terminal: "83954", growth: "+52%" },
      { key: "2026-08", label: "August 2026", terminal: "83954", growth: "+19%" },
      { key: "2026-09", label: "September 2026", terminal: "83954", growth: "+4%" },
      { key: "2026-10", label: "October 2026", terminal: "87287", growth: "Active MTD" },
    ];
    return months.map((m) => {
      const salesInMonth = allSales.filter((s) => s.date.startsWith(m.key));
      const rev = salesInMonth.reduce((acc, s) => acc + (s.amount || s.qty * (s.unitPrice || 0)), 0);
      const units = salesInMonth.reduce((acc, s) => acc + s.qty, 0);
      const days = new Set(salesInMonth.map((s) => s.date)).size;
      return {
        ...m,
        revenue: rev,
        units,
        days,
        dailyAvg: days > 0 ? rev / days : 0,
      };
    });
  }, [allSales]);

  // Day of Week Distribution
  const dayOfWeekData = useMemo(() => {
    const days = [
      { name: "Mon", full: "Monday", count: 0, revenue: 0 },
      { name: "Tue", full: "Tuesday", count: 0, revenue: 0 },
      { name: "Wed", full: "Wednesday", count: 0, revenue: 0 },
      { name: "Thu", full: "Thursday", count: 0, revenue: 0 },
      { name: "Fri", full: "Friday", count: 0, revenue: 0, isWeekend: true },
      { name: "Sat", full: "Saturday", count: 0, revenue: 0, isWeekend: true },
      { name: "Sun", full: "Sunday", count: 0, revenue: 0 },
    ];

    filteredSales.forEach((s) => {
      const dt = new Date(s.date + "T12:00:00Z");
      const dIndex = (dt.getUTCDay() + 6) % 7; // 0 = Mon, 6 = Sun
      const amt = s.amount || s.qty * (s.unitPrice || 0);
      days[dIndex].revenue += amt;
      days[dIndex].count += s.qty;
    });

    const maxDayRev = Math.max(...days.map((d) => d.revenue), 1);
    const weekendRev = days[4].revenue + days[5].revenue;
    const totalRev = days.reduce((a, b) => a + b.revenue, 0);
    const weekendPct = totalRev > 0 ? (weekendRev / totalRev) * 100 : 0;

    return { days, maxDayRev, weekendRev, weekendPct };
  }, [filteredSales]);

  // Top 5 Highest Grossing Products (Podium)
  const topProducts = useMemo(() => {
    const map: Record<string, { name: string; revenue: number; units: number; price: number; subCat: string }> = {};
    filteredSales.forEach((s) => {
      const name = s.productName || "Unknown Item";
      const amt = s.amount || s.qty * (s.unitPrice || 0);
      if (!map[name]) {
        map[name] = {
          name,
          revenue: 0,
          units: 0,
          price: s.unitPrice || 0,
          subCat: s.subCategory || s.department || "Spirits",
        };
      }
      map[name].revenue += amt;
      map[name].units += s.qty;
    });
    return Object.values(map)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }, [filteredSales]);

  // Brand Spotlights: XXL, Stella Rosa, Top Shelf Luxury
  const brandData = useMemo(() => {
    // XXL Wine
    const xxlSales = allSales.filter((s) => s.productName?.toLowerCase().includes("xxl"));
    const xxlByFlavour: Record<string, { qty: number; rev: number; latestPrice: number }> = {};
    xxlSales.forEach((s) => {
      const name = s.productName?.replace(/xxl/i, "").replace(/750ml/i, "").trim() || "Original";
      if (!xxlByFlavour[name]) xxlByFlavour[name] = { qty: 0, rev: 0, latestPrice: s.unitPrice || 0 };
      xxlByFlavour[name].qty += s.qty;
      xxlByFlavour[name].rev += s.amount || s.qty * (s.unitPrice || 0);
    });

    // Stella Rosa
    const stellaSales = allSales.filter(
      (s) =>
        (s.productName?.toLowerCase().includes("stella") || s.productName?.toLowerCase().includes("steela")) &&
        !s.productName?.toLowerCase().includes("carlo")
    );
    const stellaByVariety: Record<string, { qty: number; rev: number; latestPrice: number }> = {};
    stellaSales.forEach((s) => {
      const name = s.productName?.replace(/stella\s+rosa/i, "").replace(/steela\s+rosa/i, "").trim() || "Red Blend";
      if (!stellaByVariety[name]) stellaByVariety[name] = { qty: 0, rev: 0, latestPrice: s.unitPrice || 0 };
      stellaByVariety[name].qty += s.qty;
      stellaByVariety[name].rev += s.amount || s.qty * (s.unitPrice || 0);
    });

    // Top Shelf Luxury
    const luxurySpirits = allSales.filter((s) => (s.unitPrice || 0) >= 35 && s.department === "Liquor");
    const luxuryByBottle: Record<string, { qty: number; rev: number; price: number; subCat: string }> = {};
    luxurySpirits.forEach((s) => {
      const name = s.productName || "Spirits";
      if (!luxuryByBottle[name]) {
        luxuryByBottle[name] = {
          qty: 0,
          rev: 0,
          price: s.unitPrice || 0,
          subCat: s.subCategory || "Spirits",
        };
      }
      luxuryByBottle[name].qty += s.qty;
      luxuryByBottle[name].rev += s.amount || s.qty * (s.unitPrice || 0);
    });

    return {
      xxl: {
        totalQty: xxlSales.reduce((a, b) => a + b.qty, 0),
        totalRev: xxlSales.reduce((a, b) => a + (b.amount || b.qty * (b.unitPrice || 0)), 0),
        items: Object.entries(xxlByFlavour).sort((a, b) => b[1].qty - a[1].qty),
      },
      stella: {
        totalQty: stellaSales.reduce((a, b) => a + b.qty, 0),
        totalRev: stellaSales.reduce((a, b) => a + (b.amount || b.qty * (b.unitPrice || 0)), 0),
        items: Object.entries(stellaByVariety).sort((a, b) => b[1].qty - a[1].qty),
      },
      topshelf: {
        totalQty: luxurySpirits.reduce((a, b) => a + b.qty, 0),
        totalRev: luxurySpirits.reduce((a, b) => a + (b.amount || b.qty * (b.unitPrice || 0)), 0),
        items: Object.entries(luxuryByBottle)
          .sort((a, b) => b[1].rev - a[1].rev)
          .slice(0, 8),
      },
    };
  }, [allSales]);

  // Continuous Sales Wave (SVG Area Curve)
  const salesWaveData = useMemo(() => {
    const dailyMap: Record<string, { date: string; revenue: number; units: number }> = {};
    filteredSales.forEach((s) => {
      if (!dailyMap[s.date]) dailyMap[s.date] = { date: s.date, revenue: 0, units: 0 };
      dailyMap[s.date].revenue += s.amount || s.qty * (s.unitPrice || 0);
      dailyMap[s.date].units += s.qty;
    });

    const points = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));
    const maxRev = Math.max(...points.map((p) => p.revenue), 100);

    return { points, maxRev };
  }, [filteredSales]);

  // Heatmap 12 Sections definition (2x6 Box)
  const HEATMAP_SECTIONS = [
    { id: "tequila", name: "Tequila", icon: "🥃", keys: ["Tequila"] },
    { id: "cognac", name: "Cognac & Brandy", icon: "🥃", keys: ["Cognac & Brandy"] },
    { id: "whiskey", name: "Whiskey & Bourbon", icon: "🥃", keys: ["Whiskey & Bourbon"] },
    { id: "vodka", name: "Vodka", icon: "🍸", keys: ["Vodka"] },
    { id: "cutwaters", name: "Cutwaters & RTD", icon: "🍹", keys: ["Cutwaters & Ready-to-Drink"] },
    { id: "rum_gin", name: "Rum & Gin", icon: "🧉", keys: ["Rum", "Gin"] },
    { id: "wine", name: "Wine & Sangria", icon: "🍷", keys: ["Wine & Sangria"] },
    { id: "beer", name: "Beer & Malt", icon: "🍺", keys: ["Beer & Malt"] },
    { id: "cordials", name: "Cordials & Shooters", icon: "🍬", keys: ["Cordials & Shooters"] },
    { id: "tobacco", name: "Tobacco & Cigars", icon: "🚬", keys: ["Tobacco & Cigars", "Tobacco"] },
    { id: "other_spirits", name: "Other Spirits", icon: "🍾", keys: ["Other Spirits"] },
    { id: "general", name: "General & Lottery", icon: "📦", keys: ["General", "Lottery", "Non-Alcoholic", "Scratch-Off", "General Merchandise"] },
  ];

  // Pre-index sales by date and 12 sections for 0.01ms instant hover performance
  const dateSectionIndex = useMemo(() => {
    const index: Record<
      string,
      { totalRev: number; totalUnits: number; terminal: string; sections: Record<string, { revenue: number; units: number }> }
    > = {};

    allSales.forEach((s) => {
      if (!index[s.date]) {
        const terminal = s.date >= "2026-09-28" ? "87287" : s.date >= "2026-06-30" ? "83954" : "60696";
        index[s.date] = {
          totalRev: 0,
          totalUnits: 0,
          terminal,
          sections: {},
        };
        HEATMAP_SECTIONS.forEach((sec) => {
          index[s.date].sections[sec.id] = { revenue: 0, units: 0 };
        });
      }

      const amt = s.amount || s.qty * (s.unitPrice || 0);
      index[s.date].totalRev += amt;
      index[s.date].totalUnits += s.qty;

      const sub = s.subCategory || s.department || "General";
      let matched = false;
      for (const sec of HEATMAP_SECTIONS) {
        if (sec.keys.some((k) => sub.toLowerCase().includes(k.toLowerCase()))) {
          index[s.date].sections[sec.id].revenue += amt;
          index[s.date].sections[sec.id].units += s.qty;
          matched = true;
          break;
        }
      }
      if (!matched) {
        index[s.date].sections["general"].revenue += amt;
        index[s.date].sections["general"].units += s.qty;
      }
    });

    return index;
  }, [allSales]);

  // Calendar Heatmap: Unique dates and daily totals
  const dailyHeatmap = useMemo(() => {
    const dailyMap: Record<string, { date: string; revenue: number; units: number }> = {};
    allSales.forEach((s) => {
      if (!dailyMap[s.date]) dailyMap[s.date] = { date: s.date, revenue: 0, units: 0 };
      dailyMap[s.date].revenue += s.amount || s.qty * (s.unitPrice || 0);
      dailyMap[s.date].units += s.qty;
    });

    const dates = Object.keys(dailyMap).sort();
    const maxDay = Math.max(...Object.values(dailyMap).map((d) => d.revenue), 1);

    return {
      dates: dates.map((d) => dailyMap[d]),
      maxDay,
    };
  }, [allSales]);

  // Active date for the 2x6 Box (defaults to latest settlement date, NEVER resets to null to prevent flickering!)
  const allDatesList = useMemo(() => dailyHeatmap.dates.map((d) => d.date), [dailyHeatmap.dates]);
  const [activeHeatmapDate, setActiveHeatmapDate] = useState<string>("2026-10-21");

  useEffect(() => {
    if (allDatesList.length > 0 && !allDatesList.includes(activeHeatmapDate)) {
      setActiveHeatmapDate(allDatesList[allDatesList.length - 1]);
    }
  }, [allDatesList, activeHeatmapDate]);

  // Selected & Hovered Section for Item Drill-down
  const [activeSectionId, setActiveSectionId] = useState<string | null>("tequila");
  const [hoveredSectionId, setHoveredSectionId] = useState<string | null>(null);

  const currentViewingSection = hoveredSectionId || activeSectionId;
  const activeSectionObj = HEATMAP_SECTIONS.find((s) => s.id === currentViewingSection);

  // Compute list of items for the active section on the selected day
  const currentSectionItems = useMemo(() => {
    if (!currentViewingSection || !activeSectionObj) return [];

    const daySales = allSales.filter((s) => s.date === activeHeatmapDate);
    const matched = daySales.filter((s) => {
      const sub = s.subCategory || s.department || "General";
      if (activeSectionObj.id === "general") {
        return !HEATMAP_SECTIONS.filter((x) => x.id !== "general").some((other) =>
          other.keys.some((k) => sub.toLowerCase().includes(k.toLowerCase()))
        );
      }
      return activeSectionObj.keys.some((k) => sub.toLowerCase().includes(k.toLowerCase()));
    });

    return matched.map((s) => {
      const isTopShelf = s.isTopShelf || (s.unitPrice && s.unitPrice >= 30);
      const quality = isTopShelf ? "Top Shelf ⭐" : (s.unitPrice && s.unitPrice >= 18) ? "Premium 💎" : "Standard";
      return {
        id: s.id,
        name: s.productName || "Item",
        soldPrice: s.unitPrice || 0,
        quantity: s.qty,
        quality,
        size: s.size || "Unit",
        totalAmount: s.amount || s.qty * (s.unitPrice || 0),
      };
    }).sort((a, b) => b.totalAmount - a.totalAmount);
  }, [allSales, activeHeatmapDate, currentViewingSection, activeSectionObj]);

  const activeDaySnapshot = useMemo(() => {
    return dateSectionIndex[activeHeatmapDate] || {
      totalRev: 0,
      totalUnits: 0,
      terminal: "87287",
      sections: {},
    };
  }, [dateSectionIndex, activeHeatmapDate]);

  const activeFormattedDate = useMemo(() => {
    try {
      const dt = new Date(activeHeatmapDate + "T12:00:00Z");
      return dt.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
    } catch {
      return activeHeatmapDate;
    }
  }, [activeHeatmapDate]);

  return (
    <div className="space-y-6 pb-12">
      {/* 1. TOP AI COPILOT SEARCH & CHAT TRIGGER BAR */}
      <div className="bg-gradient-to-r from-amber-900 via-amber-800 to-stone-900 rounded-2xl p-4 sm:p-5 text-amber-50 shadow-md relative overflow-hidden border border-amber-700/50">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-700/60 border border-amber-500/40 text-[11px] font-semibold text-amber-200">
              <Bot className="w-3.5 h-3.5 text-amber-300" />
              <span>Ask Store Intelligence</span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold tracking-tight text-white">
              Instant Partner Intelligence & Query Engine
            </h2>
            <p className="text-xs text-amber-200/80">
              Don't search through tables. Type or tap below to get instant answers about flavours, sales, or stock.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsChatOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-amber-400 hover:bg-amber-300 text-stone-950 rounded-xl text-xs font-extrabold shadow-sm hover:shadow transition transform active:scale-95"
            >
              <Sparkles className="w-4 h-4 text-stone-950" />
              <span>Open Qilbo AI Chat</span>
            </button>
          </div>
        </div>

        {/* Quick Question Chips */}
        <div className="relative z-10 mt-3 pt-3 border-t border-amber-700/50 flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold text-amber-300 uppercase tracking-wider">Quick Inquiries:</span>
          {[
            { label: "🚬 Top item in tobacco", q: "top item in tobacco" },
            { label: "🌵 Best selling tequila", q: "best selling tequila" },
            { label: "🍺 Top beer items", q: "top beer items" },
            { label: "🍇 XXL wines breakdown", q: "How many XXL wines did we sell?" },
            { label: "🍷 Stella Rosa performance", q: "How much Stella Rosa sold so far?" },
            { label: "👑 Top-shelf luxury sales", q: "Show me top shelf luxury spirits" },
            { label: "⚠️ What's out of stock?", q: "Which items are out of stock?" },
            { label: "📊 Sales for Oct 21", q: "Show me sales for Oct 21" },
          ].map((chip) => (
            <button
              key={chip.label}
              onClick={() => triggerChat(chip.q)}
              className="text-xs font-medium px-3 py-1 rounded-full bg-white/10 hover:bg-white/20 text-white border border-white/15 transition flex items-center gap-1 active:scale-95 cursor-pointer"
            >
              <span>{chip.label}</span>
              <ArrowUpRight className="w-3 h-3 opacity-70" />
            </button>
          ))}
        </div>
      </div>

      {/* 2. EXECUTIVE HEADER & METADATA BAR */}
      <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-800 text-amber-50 flex items-center justify-center font-bold shadow-sm">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-stone-900 tracking-tight flex items-center gap-2">
                Discount Liquor — Executive Partner Board
              </h1>
              <p className="text-xs text-stone-500 font-medium">
                Single Store Operations • Unified Continuous Timeline (Jun 17 – Oct 21)
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-full text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
              Live POS Terminal: #87287 (Active)
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-stone-100 text-stone-600 border border-stone-200 rounded-full text-xs">
              Legacy Terminals: #83954, #60696 (Archived)
            </span>
          </div>
        </div>

        {/* Global Period Filter Pills */}
        <div className="mt-5 pt-4 border-t border-stone-100 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider flex items-center gap-1 mr-1">
            <Filter className="w-3.5 h-3.5 text-stone-400" />
            Time Filter:
          </span>
          {[
            { id: "all", label: "All-Time (Jun–Oct)" },
            { id: "oct", label: "October 2026 (Current)" },
            { id: "sep", label: "September 2026" },
            { id: "aug", label: "August 2026" },
            { id: "jul", label: "July 2026" },
            { id: "7d", label: "Last 7 Days" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setPeriod(tab.id as any)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                period === tab.id
                  ? "bg-amber-800 text-amber-50 shadow-sm"
                  : "bg-stone-50 text-stone-700 hover:bg-stone-100 border border-stone-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 3. TOP EXECUTIVE SCORECARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Revenue */}
        <div className="bg-white border border-stone-200 rounded-xl p-4 shadow-sm hover:border-amber-400 transition-all">
          <div className="flex items-center justify-between text-stone-500 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-stone-500">Gross Sales Revenue</span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center">
              <DollarSign className="w-4 h-4 text-amber-700" />
            </div>
          </div>
          <div className="text-2xl font-black text-stone-900 tracking-tight">
            ${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-stone-500">
            <span>{uniqueDatesCount} operating days</span>
            <span className="font-bold text-amber-900 bg-amber-50 px-2 py-0.5 rounded border border-amber-200/60">
              ${avgDailyRevenue.toFixed(0)}/day
            </span>
          </div>
        </div>

        {/* Total Bottles & Units */}
        <div className="bg-white border border-stone-200 rounded-xl p-4 shadow-sm hover:border-amber-400 transition-all">
          <div className="flex items-center justify-between text-stone-500 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-stone-500">Units & Bottles Sold</span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center">
              <Package className="w-4 h-4 text-amber-700" />
            </div>
          </div>
          <div className="text-2xl font-black text-stone-900 tracking-tight">
            {totalUnits.toLocaleString()} <span className="text-sm font-semibold text-stone-500">bottles</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-stone-500">
            <span>{filteredSales.length} register scans</span>
            <span className="font-semibold text-stone-700">~{(totalUnits / (uniqueDatesCount || 1)).toFixed(0)}/day</span>
          </div>
        </div>

        {/* Top-Shelf Spirits */}
        <div className="bg-white border border-stone-200 rounded-xl p-4 shadow-sm hover:border-amber-400 transition-all">
          <div className="flex items-center justify-between text-stone-500 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-stone-500">Luxury Top-Shelf</span>
            <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center">
              <Flame className="w-4 h-4 text-amber-600" />
            </div>
          </div>
          <div className="text-2xl font-black text-amber-900 tracking-tight">
            ${topShelfRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-stone-500">
            <span>{topShelfSales.reduce((a, b) => a + b.qty, 0)} premium bottles</span>
            <span className="px-2 py-0.5 rounded font-extrabold bg-amber-100 text-amber-900">
              {topShelfPct.toFixed(1)}% of sales
            </span>
          </div>
        </div>

        {/* Top Performing Category */}
        <div className="bg-white border border-stone-200 rounded-xl p-4 shadow-sm hover:border-amber-400 transition-all">
          <div className="flex items-center justify-between text-stone-500 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-stone-500">Leading Driver</span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center">
              <Wine className="w-4 h-4 text-amber-700" />
            </div>
          </div>
          <div className="text-2xl font-black text-stone-900 tracking-tight truncate">
            {deptBreakdown[0]?.name || "Liquor"}
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-stone-500">
            <span>
              {deptBreakdown[0]
                ? `${((deptBreakdown[0].revenue / (totalRevenue || 1)) * 100).toFixed(0)}% volume`
                : "Spirits"}
            </span>
            <span className="font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              High Margin
            </span>
          </div>
        </div>
      </div>

      {/* 4. CONTINUOUS REVENUE WAVE CHART (SVG AREA CURVE) */}
      <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
          <div>
            <h2 className="text-sm font-bold text-stone-900 uppercase tracking-wider flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-amber-800" />
              Daily Revenue Wave & Peak Acceleration
            </h2>
            <p className="text-xs text-stone-500">
              Continuous sales velocity across all operational settlement days. Hover over any point to inspect revenue.
            </p>
          </div>

          {hoveredDay ? (
            <div className="text-xs bg-amber-50 border border-amber-300 rounded-lg px-3 py-1 font-bold text-amber-900">
              📅 {hoveredDay.date}: ${hoveredDay.revenue.toFixed(2)} ({hoveredDay.units} units)
            </div>
          ) : (
            <span className="text-xs text-stone-600 font-semibold">
              Peak Day: ${salesWaveData.maxRev.toFixed(0)}
            </span>
          )}
        </div>

        {/* SVG Area Chart */}
        <div className="w-full h-44 relative pt-2">
          {salesWaveData.points.length > 1 ? (
            <svg
              className="w-full h-full overflow-visible"
              viewBox={`0 0 ${salesWaveData.points.length * 10} 100`}
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id="amberWaveGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#92400e" stopOpacity="0.45" />
                  <stop offset="60%" stopColor="#b45309" stopOpacity="0.15" />
                  <stop offset="100%" stopColor="#d97706" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Area path */}
              <path
                d={(() => {
                  const pts = salesWaveData.points;
                  const max = salesWaveData.maxRev;
                  const coords = pts.map((p, idx) => {
                    const x = idx * 10;
                    const y = 95 - (p.revenue / max) * 85;
                    return `${x},${y}`;
                  });
                  return `M 0,100 L ${coords.join(" L ")} L ${(pts.length - 1) * 10},100 Z`;
                })()}
                fill="url(#amberWaveGradient)"
              />

              {/* Stroke Line */}
              <path
                d={(() => {
                  const pts = salesWaveData.points;
                  const max = salesWaveData.maxRev;
                  const coords = pts.map((p, idx) => {
                    const x = idx * 10;
                    const y = 95 - (p.revenue / max) * 85;
                    return `${x},${y}`;
                  });
                  return `M ${coords.join(" L ")}`;
                })()}
                fill="none"
                stroke="#78350f"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Interactive Dots */}
              {salesWaveData.points.map((p, idx) => {
                const x = idx * 10;
                const y = 95 - (p.revenue / salesWaveData.maxRev) * 85;
                const isHovered = hoveredDay?.date === p.date;
                return (
                  <circle
                    key={p.date}
                    cx={x}
                    cy={y}
                    r={isHovered ? 4.5 : 2}
                    className="cursor-pointer transition-all fill-amber-900 stroke-white stroke-2 hover:fill-amber-600"
                    onMouseEnter={() => setHoveredDay(p)}
                    onMouseLeave={() => setHoveredDay(null)}
                    onClick={() => onNavigateToDailyReport && onNavigateToDailyReport(p.date)}
                  />
                );
              })}
            </svg>
          ) : (
            <div className="h-full flex items-center justify-center text-xs text-stone-500">
              Not enough points to render chart.
            </div>
          )}
        </div>

        <div className="flex items-center justify-between text-[11px] text-stone-500 pt-2 border-t border-stone-100">
          <span>{salesWaveData.points[0]?.date || "June 17"}</span>
          <span className="font-medium text-stone-600">Daily Trajectory</span>
          <span>{salesWaveData.points[salesWaveData.points.length - 1]?.date || "Oct 21"}</span>
        </div>
      </div>

      {/* 5. MONTHLY PROGRESSION & THE WEEKEND RHYTHM */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Month-over-Month Revenue Trajectory (2 Cols) */}
        <div className="lg:col-span-2 bg-white border border-stone-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-stone-900 uppercase tracking-wider flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-amber-800" />
                Store Revenue Progression by Month
              </h2>
              <p className="text-xs text-stone-500">Continuous single-store sales trajectory (Terminals #60696 → #83954 → #87287)</p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 bg-stone-100 text-stone-700 rounded-md border border-stone-200">
              5 Operating Months
            </span>
          </div>

          <div className="space-y-3.5 pt-2">
            {monthlyData.map((m) => {
              const maxMonth = Math.max(...monthlyData.map((x) => x.revenue), 1);
              const pctOfMax = (m.revenue / maxMonth) * 100;
              return (
                <div key={m.key} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-stone-800 flex items-center gap-1.5">
                      {m.label}
                      <span className="text-[10px] font-medium text-stone-500 px-1.5 py-0.2 bg-stone-100 rounded border border-stone-200">
                        Terminal #{m.terminal}
                      </span>
                      {m.growth && (
                        <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                          {m.growth}
                        </span>
                      )}
                    </span>
                    <span className="font-extrabold text-stone-900">
                      ${m.revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      <span className="ml-1.5 text-[11px] font-normal text-stone-500">
                        ({m.units} units • {m.days} days)
                      </span>
                    </span>
                  </div>
                  <div className="w-full bg-stone-100 rounded-full h-3.5 overflow-hidden flex shadow-inner">
                    <div
                      className="bg-amber-800 h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.max(pctOfMax, 3)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Day-of-Week Velocity (The Weekend Rush) */}
        <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-bold text-stone-900 uppercase tracking-wider flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-800" />
                The Weekly Rhythm
              </h2>
            </div>
            <p className="text-xs text-stone-500 mb-4">
              Friday & Saturday drive <span className="font-bold text-amber-900">{dayOfWeekData.weekendPct.toFixed(0)}%</span> of total weekly revenue.
            </p>

            <div className="space-y-2">
              {dayOfWeekData.days.map((d) => {
                const fillPct = (d.revenue / dayOfWeekData.maxDayRev) * 100;
                return (
                  <div key={d.name} className="flex items-center gap-2 text-xs">
                    <span className={`w-8 font-bold ${d.isWeekend ? "text-amber-900 font-extrabold" : "text-stone-500"}`}>
                      {d.name}
                    </span>
                    <div className="flex-1 bg-stone-100 h-2.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          d.isWeekend ? "bg-amber-700" : "bg-stone-400"
                        }`}
                        style={{ width: `${Math.max(fillPct, 4)}%` }}
                      />
                    </div>
                    <span className="w-16 text-right font-medium text-stone-700 text-[11px]">
                      ${d.revenue > 1000 ? `${(d.revenue / 1000).toFixed(1)}k` : d.revenue.toFixed(0)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-stone-100 text-[11px] text-stone-500 bg-stone-50 p-2.5 rounded-lg border border-stone-200">
            💡 <strong className="text-stone-800">Ordering Advice:</strong> Have distributor shipments (Southern, RNDC) arrive by Thursday noon to prevent weekend stockouts on top shelf spirits.
          </div>
        </div>
      </div>

      {/* 6. DEPARTMENT & LIQUOR TAXONOMY MOSAIC (TREEMAP) */}
      <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h2 className="text-sm font-bold text-stone-900 uppercase tracking-wider flex items-center gap-2">
              <Layers className="w-4 h-4 text-amber-800" />
              Store Department & Liquor Taxonomy Distribution
            </h2>
            <p className="text-xs text-stone-500">Proportional breakdown of gross revenue across store categories</p>
          </div>
          <span className="text-xs font-semibold text-stone-600">Total: ${totalRevenue.toFixed(0)}</span>
        </div>

        {/* Visual Proportional Bar */}
        <div className="w-full h-8 rounded-lg overflow-hidden flex shadow-inner border border-stone-200 mb-4">
          {deptBreakdown.map((dept, idx) => {
            const pct = (dept.revenue / (totalRevenue || 1)) * 100;
            if (pct < 1) return null;
            const colors = [
              "bg-amber-800 text-amber-50",
              "bg-amber-600 text-white",
              "bg-stone-500 text-stone-50",
              "bg-stone-400 text-stone-900",
              "bg-stone-300 text-stone-800",
            ];
            const color = colors[idx % colors.length];
            return (
              <div
                key={dept.name}
                className={`${color} flex items-center justify-center text-[11px] font-bold px-1 truncate transition-all`}
                style={{ width: `${pct}%` }}
                title={`${dept.name}: $${dept.revenue.toFixed(2)} (${pct.toFixed(1)}%)`}
              >
                {pct > 8 ? `${dept.name} ${pct.toFixed(0)}%` : ""}
              </div>
            );
          })}
        </div>

        {/* Liquor Sub-Category Breakdown Cards */}
        <div className="mt-3">
          <div className="text-xs font-bold text-stone-700 uppercase tracking-wider mb-2.5">
            Spirits Drill-down (Whiskey, Tequila, Cognac, Vodka & RTD)
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
            {liquorSubCats.slice(0, 8).map((sub) => {
              const pct = (sub.revenue / (totalRevenue || 1)) * 100;
              return (
                <div
                  key={sub.name}
                  className="bg-stone-50 border border-stone-200 rounded-lg p-2.5 text-center flex flex-col justify-between hover:border-amber-400 transition"
                >
                  <div className="text-[11px] font-bold text-stone-800 truncate" title={sub.name}>
                    {sub.name}
                  </div>
                  <div className="my-1 text-sm font-extrabold text-amber-900">
                    ${sub.revenue > 1000 ? `${(sub.revenue / 1000).toFixed(1)}k` : sub.revenue.toFixed(0)}
                  </div>
                  <div className="text-[10px] text-stone-500 font-semibold">{pct.toFixed(1)}% share</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 7. BRAND SPOTLIGHT & THE REVENUE PODIUM */}
      <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-sm font-bold text-stone-900 uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-700" />
              Specialty Brand & Flavour Velocity Trackers
            </h2>
            <p className="text-xs text-stone-500">Live monitor for XXL Wines, Stella Rosa, and Luxury Trophy Spirits</p>
          </div>

          <div className="flex items-center gap-1.5 bg-stone-100 p-1 rounded-lg border border-stone-200">
            <button
              onClick={() => setActiveBrandSpotlight("topshelf")}
              className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
                activeBrandSpotlight === "topshelf"
                  ? "bg-amber-800 text-amber-50 shadow-sm"
                  : "text-stone-600 hover:text-stone-900"
              }`}
            >
              👑 Luxury Spirits ($35+)
            </button>
            <button
              onClick={() => setActiveBrandSpotlight("podium")}
              className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
                activeBrandSpotlight === "podium"
                  ? "bg-amber-800 text-amber-50 shadow-sm"
                  : "text-stone-600 hover:text-stone-900"
              }`}
            >
              🏆 Top 5 Grossing SKUs
            </button>
            <button
              onClick={() => setActiveBrandSpotlight("xxl")}
              className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
                activeBrandSpotlight === "xxl"
                  ? "bg-amber-800 text-amber-50 shadow-sm"
                  : "text-stone-600 hover:text-stone-900"
              }`}
            >
              🍇 XXL Wines (19)
            </button>
            <button
              onClick={() => setActiveBrandSpotlight("stella")}
              className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
                activeBrandSpotlight === "stella"
                  ? "bg-amber-800 text-amber-50 shadow-sm"
                  : "text-stone-600 hover:text-stone-900"
              }`}
            >
              🍷 Stella Rosa (18)
            </button>
          </div>
        </div>

        {/* Brand Content */}
        {activeBrandSpotlight === "topshelf" && (
          <div>
            <div className="mb-3 flex items-center justify-between text-xs text-stone-500">
              <span>High-Roller Premium Bottles</span>
              <span className="font-bold text-amber-900">
                Total Luxury Revenue: ${brandData.topshelf.totalRev.toFixed(2)}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {brandData.topshelf.items.map(([name, data]) => (
                <div key={name} className="p-3 bg-stone-50 border border-stone-200 rounded-lg hover:border-amber-400 transition">
                  <div className="text-xs font-bold text-stone-900 truncate" title={name}>
                    {name}
                  </div>
                  <div className="text-[11px] text-stone-500 font-medium mb-1.5">{data.subCat}</div>
                  <div className="flex items-center justify-between text-xs font-extrabold text-stone-900">
                    <span className="text-amber-900 font-bold">${data.price.toFixed(2)} / ea</span>
                    <span className="px-2 py-0.5 bg-amber-100 text-amber-900 rounded font-bold">
                      {data.qty} sold (${data.rev.toFixed(0)})
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeBrandSpotlight === "podium" && (
          <div>
            <div className="mb-3 flex items-center justify-between text-xs text-stone-500">
              <span>Highest Revenue Generating Items (Selected Period)</span>
              <span className="font-bold text-amber-900">
                Top 5 Total: ${topProducts.reduce((a, b) => a + b.revenue, 0).toFixed(2)}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
              {topProducts.map((p, idx) => {
                const medals = ["🥇 #1", "🥈 #2", "🥉 #3", "#4", "#5"];
                return (
                  <div key={p.name} className="p-3 bg-stone-50 border border-stone-200 rounded-lg flex flex-col justify-between hover:border-amber-400 transition">
                    <div>
                      <div className="flex items-center justify-between text-xs font-extrabold text-amber-800 mb-1">
                        <span>{medals[idx]}</span>
                        <span className="text-stone-500 font-semibold">{p.subCat}</span>
                      </div>
                      <div className="text-xs font-bold text-stone-900 truncate" title={p.name}>
                        {p.name}
                      </div>
                    </div>
                    <div className="mt-2 pt-2 border-t border-stone-200/60 flex items-center justify-between text-xs">
                      <span className="font-extrabold text-amber-900">${p.revenue.toFixed(0)}</span>
                      <span className="text-stone-500 font-medium">{p.units} sold</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeBrandSpotlight === "xxl" && (
          <div>
            <div className="mb-3 flex items-center justify-between text-xs text-stone-500">
              <span>All 8 Flavours Tracked Across Both Store Terminals</span>
              <span className="font-bold text-amber-900">
                19 Bottles Sold • Total Revenue: ${brandData.xxl.totalRev.toFixed(2)}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
              {brandData.xxl.items.map(([flavour, data]) => (
                <div key={flavour} className="p-2.5 bg-stone-50 border border-stone-200 rounded-lg text-center hover:border-amber-400 transition">
                  <div className="text-[11px] font-bold text-stone-800 capitalize truncate" title={flavour}>
                    {flavour}
                  </div>
                  <div className="text-base font-extrabold text-amber-900 my-1">{data.qty}</div>
                  <div className="text-[10px] text-stone-500 font-semibold">${data.latestPrice.toFixed(2)}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeBrandSpotlight === "stella" && (
          <div>
            <div className="mb-3 flex items-center justify-between text-xs text-stone-500">
              <span>Stella Rosa Varieties & Sizes</span>
              <span className="font-bold text-amber-900">
                18 Bottles Sold • Total Revenue: ${brandData.stella.totalRev.toFixed(2)}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
              {brandData.stella.items.map(([variety, data]) => (
                <div key={variety} className="p-2.5 bg-stone-50 border border-stone-200 rounded-lg text-center hover:border-amber-400 transition">
                  <div className="text-[11px] font-bold text-stone-800 capitalize truncate" title={variety}>
                    {variety}
                  </div>
                  <div className="text-base font-extrabold text-amber-900 my-1">{data.qty}</div>
                  <div className="text-[10px] text-stone-500 font-semibold">${data.latestPrice.toFixed(2)}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 8. CONTINUOUS CALENDAR HEATMAP & 2x6 SECTION-WISE HOVER BOX */}
      <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h2 className="text-sm font-bold text-stone-900 uppercase tracking-wider flex items-center gap-2">
              <Calendar className="w-4 h-4 text-amber-800" />
              116-Day Sales Heatmap & Section-Wise Performance Box
            </h2>
            <p className="text-xs text-stone-500">
              Hover over any day tile on the right to inspect its exact 2x6 section-by-section sales breakdown on the left.
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-stone-500">
            <span>Low</span>
            <span className="w-3 h-3 rounded bg-amber-100" />
            <span className="w-3 h-3 rounded bg-amber-300" />
            <span className="w-3 h-3 rounded bg-amber-600" />
            <span className="w-3 h-3 rounded bg-amber-800" />
            <span>Peak</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT-HAND SIDE: 2x6 SECTION-WISE BOX & ITEM INSPECTOR */}
          <div className="lg:col-span-5 bg-gradient-to-br from-amber-50/40 via-stone-50 to-white border-2 border-amber-800/30 rounded-xl p-4 shadow-sm space-y-3">
            {/* Box Header */}
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="text-[10px] font-black text-amber-900 uppercase tracking-wider">
                  Settlement Breakdown
                </span>
                <h3 className="text-base font-extrabold text-stone-900 tracking-tight mt-0.5">
                  {activeFormattedDate}
                </h3>
              </div>

              <div className="text-right">
                <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded bg-stone-200/80 text-stone-700 border border-stone-300 mb-1">
                  POS #{activeDaySnapshot.terminal}
                </span>
                <div className="text-sm font-black text-amber-900">
                  ${activeDaySnapshot.totalRev.toFixed(2)}
                </div>
                <div className="text-[10px] text-stone-500 font-semibold">
                  {activeDaySnapshot.totalUnits} items sold
                </div>
              </div>
            </div>

            {/* The 2x6 Section Grid (12 Items) */}
            <div className="pt-2 border-t border-stone-200">
              <div className="text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                <span>Sections (Hover / Click for items)</span>
                <span>Revenue (Units)</span>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {HEATMAP_SECTIONS.map((sec) => {
                  const secData = activeDaySnapshot.sections[sec.id] || { revenue: 0, units: 0 };
                  const hasSales = secData.revenue > 0;
                  const isViewing = currentViewingSection === sec.id;
                  return (
                    <button
                      key={sec.id}
                      onClick={() => setActiveSectionId(activeSectionId === sec.id ? null : sec.id)}
                      onMouseEnter={() => setHoveredSectionId(sec.id)}
                      onMouseLeave={() => setHoveredSectionId(null)}
                      className={`px-2.5 py-1.5 rounded-lg border text-xs transition-all flex items-center justify-between cursor-pointer text-left ${
                        isViewing
                          ? "bg-amber-100/90 border-amber-800 ring-2 ring-amber-800 text-amber-950 font-bold shadow-sm"
                          : hasSales
                          ? "bg-amber-50/80 border-amber-200 text-stone-900 hover:bg-amber-100/60"
                          : "bg-white/80 border-stone-200/60 text-stone-500 hover:bg-stone-50"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 truncate pr-1">
                        <span className="text-xs">{sec.icon}</span>
                        <span className="truncate text-[11px] font-bold">{sec.name}</span>
                      </div>
                      <div className="text-right shrink-0">
                        <div className={`text-[11px] font-extrabold ${hasSales ? "text-amber-950 font-black" : "text-stone-400"}`}>
                          ${secData.revenue.toFixed(0)}
                        </div>
                        {hasSales && (
                          <div className="text-[9px] text-stone-600 font-semibold leading-none">
                            {secData.units} sold
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ITEM DRILL-DOWN PANEL (Shows Item Name, Sold Price, Quantity, Quality) */}
            {activeSectionObj && (
              <div className="pt-2.5 border-t border-stone-200 bg-white/95 rounded-xl p-3 border border-amber-200 shadow-sm space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm">{activeSectionObj.icon}</span>
                    <h4 className="text-xs font-extrabold text-stone-900">
                      {activeSectionObj.name} Items ({currentSectionItems.length})
                    </h4>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-black text-amber-900">
                      ${(activeDaySnapshot.sections[activeSectionObj.id]?.revenue || 0).toFixed(2)}
                    </span>
                    {activeSectionId && (
                      <button
                        onClick={() => setActiveSectionId(null)}
                        className="text-stone-400 hover:text-stone-700 p-0.5 rounded cursor-pointer"
                        title="Close item view"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {currentSectionItems.length > 0 ? (
                  <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
                    {currentSectionItems.map((item) => {
                      const isTop = item.quality.includes("Top Shelf");
                      const isPrem = item.quality.includes("Premium");
                      return (
                        <div
                          key={item.id}
                          className="p-2 rounded-lg bg-stone-50 border border-stone-200/80 hover:border-amber-300 text-xs flex flex-col gap-1 transition"
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-bold text-stone-900 truncate" title={item.name}>
                              {item.name}
                            </span>
                            <span
                              className={`text-[10px] font-extrabold px-1.5 py-0.2 rounded shrink-0 border ${
                                isTop
                                  ? "bg-amber-100 text-amber-900 border-amber-300"
                                  : isPrem
                                  ? "bg-blue-50 text-blue-900 border-blue-200"
                                  : "bg-stone-100 text-stone-600 border-stone-200"
                              }`}
                            >
                              {item.quality}
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-[11px] text-stone-600">
                            <div className="flex items-center gap-2">
                              <span>
                                Price: <strong className="text-stone-900">${item.soldPrice.toFixed(2)}</strong>
                              </span>
                              <span>•</span>
                              <span>
                                Qty: <strong className="text-stone-900">{item.quantity}</strong>
                              </span>
                              <span>•</span>
                              <span>Size: {item.size}</span>
                            </div>
                            <span className="font-black text-amber-900">
                              ${item.totalAmount.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-3 bg-stone-50 rounded-lg text-center text-xs text-stone-500">
                    No {activeSectionObj.name} sales recorded on {activeFormattedDate}.
                  </div>
                )}
              </div>
            )}

            <div className="pt-2 border-t border-stone-200/80 text-[10px] text-stone-500 flex items-center justify-between">
              <span>💡 Touch or click any section card above to inspect items</span>
              <button
                onClick={() => onNavigateToDailyReport && onNavigateToDailyReport(activeHeatmapDate)}
                className="font-bold text-amber-800 hover:text-amber-950 underline cursor-pointer"
              >
                Inspect Settlement →
              </button>
            </div>
          </div>

          {/* RIGHT-HAND SIDE: 116 HEATMAP TILES (STATIONARY - ZERO FLICKER) */}
          <div className="lg:col-span-7 bg-stone-50 border border-stone-200 rounded-xl p-4 shadow-inner">
            <div className="flex items-center justify-between text-xs text-stone-500 mb-2.5">
              <span className="font-bold text-stone-700">June 17 to October 21 (116 Operating Days)</span>
              <span className="text-[11px] text-stone-600">Hover tile to preview date</span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {dailyHeatmap.dates.map((d) => {
                const intensity = d.revenue / dailyHeatmap.maxDay;
                const isSelected = activeHeatmapDate === d.date;

                let bgClass = "bg-amber-100 text-stone-700";
                if (intensity > 0.75) bgClass = "bg-amber-800 text-amber-50 font-bold";
                else if (intensity > 0.5) bgClass = "bg-amber-600 text-white font-semibold";
                else if (intensity > 0.25) bgClass = "bg-amber-300 text-stone-900";

                return (
                  <button
                    key={d.date}
                    onMouseEnter={() => setActiveHeatmapDate(d.date)}
                    onClick={() => {
                      setActiveHeatmapDate(d.date);
                      if (onNavigateToDailyReport) onNavigateToDailyReport(d.date);
                    }}
                    className={`w-7 h-7 rounded text-[10px] flex items-center justify-center transition-none cursor-pointer ${bgClass} ${
                      isSelected
                        ? "ring-2 ring-amber-950 ring-offset-2 bg-amber-950 text-white font-black z-10 shadow-md"
                        : "hover:ring-1 hover:ring-amber-700 font-medium"
                    }`}
                    title={`${d.date}: $${d.revenue.toFixed(2)} (${d.units} units)`}
                  >
                    <span className="pointer-events-none">{d.date.slice(-2)}</span>
                  </button>
                );
              })}
            </div>

            <div className="mt-3 pt-2 border-t border-stone-200 flex items-center justify-between text-[11px] text-stone-500">
              <span>June 2026</span>
              <span>July 2026</span>
              <span>August 2026</span>
              <span>September 2026</span>
              <span>October 2026</span>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Chat Trigger Button (Bottom-Right) */}
      {!isChatOpen && (
        <button
          onClick={() => setIsChatOpen(true)}
          className="fixed bottom-20 md:bottom-6 right-4 md:right-6 z-30 bg-amber-800 hover:bg-amber-900 text-amber-50 p-3 sm:p-3.5 rounded-full shadow-2xl flex items-center gap-2 text-xs font-bold transition transform hover:scale-105 active:scale-95 border-2 border-amber-600 cursor-pointer"
          title="Ask Qilbo AI Assistant"
        >
          <Bot className="w-5 h-5 text-amber-300" />
          <span>Ask Qilbo AI</span>
        </button>
      )}

      {/* Qilbo AI Chatbot Modal */}
      <QilboChatbot
        state={state}
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        initialQuestion={chatInitialQuestion}
      />
    </div>
  );
}

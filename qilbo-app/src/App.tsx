import React, { useState, useEffect, useCallback } from "react";
import {
  LayoutDashboard,
  BarChart3,
  Package,
  Receipt,
  Truck,
  Settings,
  MessageSquare,
  LogOut,
  Lock,
  RefreshCw,
  Store,
  X,
  Sun,
  Moon,
} from "lucide-react";
import type { ApiSummaryResponse, AppState } from "./types";
import { api } from "./lib/api";
import { emptyState } from "./lib/state";
import { CATEGORY_COLORS, getDistributorBadge } from "./lib/colors";

// 5 Main Tabs
import OverviewTab from "./components/dashboard/OverviewTab";
import DailySalesTab from "./components/dashboard/DailySalesTab";
import InventoryTab from "./components/dashboard/InventoryTab";
import InvoicesTab from "./components/dashboard/InvoicesTab";
import OrdersTab from "./components/dashboard/OrdersTab";

// Floating Chat & Logo
import QilboChatbot from "./components/dashboard/QilboChatbot";
import { QilboLogo } from "./components/ui/QilboLogo";

const TABS = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "dailysales", label: "Daily Sales", icon: BarChart3 },
  { id: "inventory", label: "Inventory", icon: Package },
  { id: "invoices", label: "Invoices", icon: Receipt },
  { id: "orders", label: "Orders", icon: Truck },
];

const SIDEBAR_CATEGORIES = [
  { name: "Vodka", count: 137 },
  { name: "Tequila/Mezcal", count: 91 },
  { name: "Whiskey/Bourbon/Scotch", count: 100 },
  { name: "Cognac/Brandy", count: 55 },
  { name: "Rum", count: 31 },
  { name: "Gin", count: 21 },
  { name: "Liqueur/Cordials", count: 310 },
  { name: "Wine", count: 63 },
  { name: "Beer/Malt", count: 161 },
  { name: "RTD/Seltzer", count: 91 },
  { name: "Tobacco", count: 126 },
  { name: "Grocery/Other", count: 309 },
  { name: "Lottery", count: 45 },
];

const SIDEBAR_DISTRIBUTORS = [
  { name: "Southern Glazer's", count: 71 },
  { name: "Breakthru", count: 110 },
  { name: "Gold Coast", count: 44 },
  { name: "Florida Distributors", count: 0 },
  { name: "Wayne Densch", count: 15 },
  { name: "Unknown", count: 1300 },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<string>("overview");
  const [selectedDate, setSelectedDate] = useState<string>("2026-11-05");
  const [summary, setSummary] = useState<ApiSummaryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [passwordInput, setPasswordInput] = useState("");
  const [loginError, setLoginError] = useState(false);
  const [loginSubmitting, setLoginSubmitting] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Global Filter State for Inventory
  const [inventoryCategory, setInventoryCategory] = useState<string>("all");
  const [inventoryDistributor, setInventoryDistributor] = useState<string>("all");

  const dummyState: AppState = emptyState();

  const loadSummaryData = useCallback(async (date: string) => {
    console.log('[loadSummaryData START]');
    setLoading(true);
    try {
      const data = await api.getSummary(date);
      console.log('[loadSummaryData SUCCESS]');
      setSummary(data);
      setAuthenticated(true);
    } catch (err: any) {
      console.log('[loadSummaryData CAUGHT]', err?.status, err?.message);
      if (err?.status === 401 || err?.message?.includes("401") || err?.message?.includes("login") || err?.message?.includes("Login")) {
        setAuthenticated(false);
      } else {
        console.error("Summary fetch error:", err);
        setAuthenticated(false);
      }
    } finally {
      console.log('[loadSummaryData FINALLY]');
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSummaryData(selectedDate);
  }, [loadSummaryData, selectedDate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginSubmitting(true);
    setLoginError(false);
    try {
      const ok = await api.login(passwordInput);
      if (ok) {
        setAuthenticated(true);
        setPasswordInput("");
        await loadSummaryData(selectedDate);
      } else {
        setLoginError(true);
      }
    } catch {
      setLoginError(true);
    } finally {
      setLoginSubmitting(false);
    }
  };

  const handleLogout = async () => {
    try {
      await api.logout();
      setAuthenticated(false);
      setIsSettingsOpen(false);
    } catch (err) {
      console.error("Logout error:", err);
    }
  };

  const handleCategoryClick = (catName: string) => {
    setInventoryCategory(catName);
    setInventoryDistributor("all");
    setActiveTab("inventory");
  };

  const handleDistributorClick = (distName: string) => {
    setInventoryDistributor(distName);
    setInventoryCategory("all");
    setActiveTab("inventory");
  };

  const handleNavigateTab = (tabId: string, filter?: { category?: string; distributor?: string }) => {
    if (filter?.category) setInventoryCategory(filter.category);
    if (filter?.distributor) setInventoryDistributor(filter.distributor);
    setActiveTab(tabId);
  };

  // Toggle dark mode class on html/body
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDarkMode]);

  // 1. Unauthenticated Login Screen (Bright Light Theme)
  if (authenticated === false) {
    return (
      <div className={`min-h-screen bg-[#F6F7FB] dark:bg-slate-950 flex items-center justify-center p-4`}>
        <div className="w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-7 shadow-lg">
          <div className="flex flex-col items-center text-center mb-6">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 flex items-center justify-center text-blue-600 mb-3 shadow-sm">
              <Store className="w-7 h-7" />
            </div>
            <h1 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Discount Liquor
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              2105 E Orange Ave, Eustis FL 32726 • Owner Portal
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            {loginError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 text-center font-semibold">
                Incorrect password. Please try again.
              </div>
            )}
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                Dashboard Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="password"
                  placeholder="Enter store password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  required
                  autoFocus
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loginSubmitting}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold transition shadow-sm disabled:opacity-50"
            >
              {loginSubmitting ? "Signing in..." : "Sign In to Qilbo"}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 text-center text-[11px] text-slate-400">
            Protected Private Portal • Cloudflare Workers + D1 Ledger
          </div>
        </div>
      </div>
    );
  }

  // 2. Initial Loading Screen
  if (authenticated === null && loading) {
    return (
      <div className="min-h-screen bg-[#F6F7FB] dark:bg-slate-950 flex flex-col items-center justify-center text-slate-500">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-600 mb-3" />
        <p className="text-sm font-semibold">Connecting to Discount Liquor Backend...</p>
      </div>
    );
  }

  // 3. Main Dashboard UI (Desktop Left Sidebar + Mobile Bottom Tab Bar)
  return (
    <div className={`min-h-screen bg-[#F6F7FB] dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex ${isDarkMode ? "dark" : ""}`}>
      {/* DESKTOP LEFT SIDEBAR (Like Reference Screenshot) */}
      <aside className="hidden lg:flex flex-col w-64 bg-white dark:bg-slate-900 border-r border-slate-200/80 dark:border-slate-800 sticky top-0 h-screen overflow-y-auto shrink-0 select-none">
        {/* Brand Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3">
          <QilboLogo layout="icon" showTagline={false} size="sm" />
          <div>
            <div className="font-black text-slate-900 dark:text-white text-base tracking-tight">QILBO</div>
            <p className="text-[11px] font-semibold text-slate-400">Discount Liquor • Eustis, FL</p>
          </div>
        </div>

        {/* 5 Main Tabs Navigation */}
        <div className="p-3 space-y-1">
          <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Navigation
          </div>
          {TABS.map((t) => {
            const Icon = t.icon;
            const isActive = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition ${
                  isActive
                    ? "bg-slate-900 text-white shadow-sm dark:bg-blue-600"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900"
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="flex-1 text-left">{t.label}</span>
                {t.id === "invoices" && summary && summary.pending_invoices > 0 && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-500 text-white font-extrabold">
                    {summary.pending_invoices}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* CATEGORIES SECTION (Colored Dot + Name + Count) */}
        <div className="p-3 border-t border-slate-100 dark:border-slate-800 space-y-1">
          <div className="flex items-center justify-between px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            <span>Categories</span>
            <span className="text-[10px] font-mono text-slate-400">13 types</span>
          </div>
          <div className="space-y-0.5 max-h-56 overflow-y-auto pr-1">
            {SIDEBAR_CATEGORIES.map((cat) => {
              const conf = CATEGORY_COLORS[cat.name] || { hex: "#94A3B8" };
              const isSelected = activeTab === "inventory" && inventoryCategory === cat.name;

              return (
                <button
                  key={cat.name}
                  onClick={() => handleCategoryClick(cat.name)}
                  className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    isSelected
                      ? "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 font-extrabold"
                      : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: conf.hex }} />
                    <span className="truncate">{cat.name}</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono shrink-0 ml-1">
                    {cat.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* DISTRIBUTORS SECTION (Colored Badge + Name + Count) */}
        <div className="p-3 border-t border-slate-100 dark:border-slate-800 space-y-1">
          <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Distributors
          </div>
          <div className="space-y-1">
            {SIDEBAR_DISTRIBUTORS.map((dist) => {
              const badge = getDistributorBadge(dist.name);
              const isSelected = activeTab === "inventory" && inventoryDistributor === dist.name;

              return (
                <button
                  key={dist.name}
                  onClick={() => handleDistributorClick(dist.name)}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                    isSelected
                      ? "bg-blue-50 dark:bg-blue-950/60 border border-blue-300 font-extrabold"
                      : "hover:bg-slate-50 dark:hover:bg-slate-800"
                  }`}
                >
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded border ${badge.bg} ${badge.text} ${badge.border}`}
                  >
                    {badge.label}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {dist.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Bottom Sidebar Footer: Theme Toggle & Settings */}
        <div className="mt-auto p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            title="Toggle theme"
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition"
          >
            {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
          </button>

          <button
            onClick={() => setIsSettingsOpen(true)}
            title="Store settings"
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition"
          >
            <Settings className="w-4 h-4" />
          </button>

          <button
            onClick={handleLogout}
            title="Sign out"
            className="p-2 rounded-xl bg-slate-100 hover:bg-red-50 dark:bg-slate-800 text-slate-400 hover:text-red-600 transition"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col min-w-0 pb-20 lg:pb-8">
        {/* Mobile Top Header (< 1024px) */}
        <header className="lg:hidden sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-b border-slate-200/80 dark:border-slate-800 px-4 py-3 flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2.5">
            <QilboLogo layout="icon" showTagline={false} size="sm" />
            <div>
              <div className="font-extrabold text-slate-900 dark:text-white text-sm">QILBO</div>
              <p className="text-[10px] text-slate-400">Discount Liquor • Eustis, FL</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
            >
              {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
            </button>
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Tab Content Container */}
        <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
          {activeTab === "overview" && (
            <OverviewTab
              summary={summary}
              loading={loading}
              onRefresh={() => loadSummaryData(selectedDate)}
              onNavigateTab={handleNavigateTab}
              selectedDate={selectedDate}
              onDateChange={(d) => setSelectedDate(d)}
            />
          )}

          {activeTab === "dailysales" && (
            <DailySalesTab
              selectedDate={selectedDate}
              onDateChange={(d) => setSelectedDate(d)}
            />
          )}

          {activeTab === "inventory" && (
            <InventoryTab
              initialCategory={inventoryCategory}
              initialDistributor={inventoryDistributor}
            />
          )}

          {activeTab === "invoices" && <InvoicesTab />}

          {activeTab === "orders" && <OrdersTab />}
        </main>
      </div>

      {/* MOBILE BOTTOM TAB BAR (< 1024px) */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-t border-slate-200/80 dark:border-slate-800 px-2 py-1.5 shadow-lg">
        <div className="flex items-center justify-around">
          {TABS.map((t) => {
            const Icon = t.icon;
            const isActive = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => {
                  if (t.id === "inventory") {
                    setInventoryCategory("all");
                    setInventoryDistributor("all");
                  }
                  setActiveTab(t.id);
                }}
                className={`flex flex-col items-center py-1 px-2 rounded-xl text-[10px] font-bold transition ${
                  isActive ? "text-blue-600 dark:text-blue-400" : "text-slate-400 hover:text-slate-600"
                }`}
              >
                <Icon className={`w-4 h-4 mb-0.5 ${isActive ? "text-blue-600 dark:text-blue-400" : "text-slate-400"}`} />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Floating AI Assistant Button */}
      <button
        onClick={() => setIsChatOpen(!isChatOpen)}
        title="Open Qilbo AI Assistant"
        className="fixed right-4 bottom-16 lg:bottom-6 z-40 p-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-xl transition transform hover:scale-105 flex items-center justify-center border-2 border-white dark:border-slate-800"
      >
        <MessageSquare className="w-5 h-5" />
      </button>

      {/* Floating AI Chatbot Drawer */}
      <QilboChatbot
        state={dummyState}
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
      />

      {/* Settings Modal (Behind Gear Icon) */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <Settings className="w-5 h-5 text-blue-600" />
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Store Settings & Info</h3>
              </div>
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 p-3.5 rounded-2xl space-y-1.5">
                <div className="font-extrabold text-slate-900 dark:text-white text-sm">Discount Liquor</div>
                <div className="text-slate-500">2105 E Orange Ave, Eustis FL 32726</div>
                <div className="text-slate-500">Owner: Zaheer • Single Store (Registers: 87287, 83954, 60696)</div>
                <div className="text-blue-600 font-mono text-[11px] font-bold pt-1">Florida Tax: 7% Sales Tax Separated</div>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 p-3.5 rounded-2xl space-y-1.5">
                <div className="font-extrabold text-slate-900 dark:text-white text-sm">Theme Preference</div>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-slate-600 dark:text-slate-300">Appearance Mode</span>
                  <button
                    onClick={() => setIsDarkMode(!isDarkMode)}
                    className="px-3 py-1 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-2xs"
                  >
                    {isDarkMode ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5 text-amber-500" />}
                    <span>{isDarkMode ? "Dark Theme" : "Light Theme"}</span>
                  </button>
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 p-3.5 rounded-2xl space-y-1.5">
                <div className="font-extrabold text-slate-900 dark:text-white text-sm">Architecture & Engine</div>
                <div className="text-slate-500">Cloudflare Workers + D1 Stock Ledger Engine</div>
                <div className="text-slate-500">AI Model: Google Gemini 3.5 Flash (Pinned Stable)</div>
                <div className="text-slate-500">Telegram Bot: @DiscountLiquorBot (Private Chat)</div>
              </div>
            </div>

            <div className="pt-2 flex justify-between items-center border-t border-slate-100 dark:border-slate-800">
              <span className="text-xs text-slate-400 font-mono">Qilbo v2.0 Light</span>
              <button
                onClick={handleLogout}
                className="px-4 py-2 bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
              >
                <LogOut className="w-3.5 h-3.5" /> Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

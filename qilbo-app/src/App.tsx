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
} from "lucide-react";
import type { ApiSummaryResponse, AppState } from "./types";
import { api, ApiError } from "./lib/api";
import { emptyState } from "./lib/state";

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

  // Fallback dummy AppState for legacy components that might still reference it
  const dummyState: AppState = emptyState();

  const loadSummaryData = useCallback(async (date: string) => {
    setLoading(true);
    try {
      const data = await api.getSummary(date);
      setSummary(data);
      setAuthenticated(true);
    } catch (err: any) {
      if (err instanceof ApiError && err.status === 401) {
        setAuthenticated(false);
      } else {
        console.error("Summary fetch error:", err);
      }
    } finally {
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

  // 1. Unauthenticated Login Screen
  if (authenticated === false) {
    return (
      <div className="min-h-screen bg-stone-950 flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-stone-900 border border-stone-800 rounded-2xl p-6 sm:p-8 shadow-2xl">
          <div className="flex flex-col items-center text-center mb-6">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-3">
              <Store className="w-7 h-7" />
            </div>
            <h1 className="text-xl font-bold text-white">Discount Liquor</h1>
            <p className="text-xs text-stone-400 mt-1">
              2105 E Orange Ave, Eustis FL 32726 • Owner Dashboard
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            {loginError && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-400 text-center font-medium">
                Incorrect password. Please try again.
              </div>
            )}
            <div>
              <label className="text-xs font-medium text-stone-400 block mb-1.5">
                Dashboard Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-stone-500 absolute left-3 top-3" />
                <input
                  type="password"
                  placeholder="Enter store password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  required
                  autoFocus
                  className="w-full bg-stone-950 border border-stone-700 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500 transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loginSubmitting}
              className="w-full py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-sm font-semibold transition disabled:opacity-50"
            >
              {loginSubmitting ? "Signing in..." : "Sign In to Qilbo"}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-stone-800/80 text-center text-[11px] text-stone-500">
            Protected Private Portal • Cloudflare Workers + D1 Ledger
          </div>
        </div>
      </div>
    );
  }

  // 2. Initial Loading Screen
  if (authenticated === null && loading) {
    return (
      <div className="min-h-screen bg-stone-950 flex flex-col items-center justify-center text-stone-400">
        <RefreshCw className="w-8 h-8 animate-spin text-amber-500 mb-3" />
        <p className="text-sm font-medium">Connecting to Discount Liquor Backend...</p>
      </div>
    );
  }

  // 3. Main Dashboard UI (5 Tabs)
  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 flex flex-col pb-20 sm:pb-8">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-stone-950/90 backdrop-blur border-b border-stone-800 px-4 sm:px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <QilboLogo layout="icon" showTagline={false} size="sm" />
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-white text-sm sm:text-base tracking-tight">QILBO</span>
                <span className="text-[10px] bg-amber-500/20 text-amber-300 font-bold px-1.5 py-0.2 rounded border border-amber-500/30">
                  STORE POS
                </span>
              </div>
              <p className="text-[10px] text-stone-400 hidden sm:block">Discount Liquor • Eustis, FL</p>
            </div>
          </div>

          {/* Desktop Navigation Tabs */}
          <nav className="hidden md:flex items-center bg-stone-900 border border-stone-800 rounded-xl p-1 gap-1">
            {TABS.map((t) => {
              const Icon = t.icon;
              const isActive = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                    isActive
                      ? "bg-amber-600 text-white shadow-sm"
                      : "text-stone-400 hover:text-white hover:bg-stone-800"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Right Controls: Settings Gear */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsSettingsOpen(true)}
              title="Store Settings & Info"
              className="p-2 rounded-xl bg-stone-900 hover:bg-stone-800 border border-stone-800 text-stone-300 transition"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 py-4 sm:py-6">
        {activeTab === "overview" && (
          <OverviewTab
            summary={summary}
            loading={loading}
            onRefresh={() => loadSummaryData(selectedDate)}
            onNavigateTab={(tab) => setActiveTab(tab)}
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

        {activeTab === "inventory" && <InventoryTab />}

        {activeTab === "invoices" && <InvoicesTab />}

        {activeTab === "orders" && <OrdersTab />}
      </main>

      {/* Mobile Bottom Navigation (Phone 390px Optimized) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-stone-950/95 backdrop-blur border-t border-stone-800 px-2 py-1.5">
        <div className="flex items-center justify-around">
          {TABS.map((t) => {
            const Icon = t.icon;
            const isActive = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`flex flex-col items-center py-1 px-2 rounded-lg text-[10px] font-medium transition ${
                  isActive ? "text-amber-400 font-bold" : "text-stone-500 hover:text-stone-300"
                }`}
              >
                <Icon className={`w-4 h-4 mb-0.5 ${isActive ? "text-amber-400" : "text-stone-500"}`} />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Floating AI Chatbot Button */}
      <button
        onClick={() => setIsChatOpen(!isChatOpen)}
        title="Open Qilbo AI Assistant"
        className="fixed right-4 bottom-16 sm:bottom-6 z-40 p-3 bg-amber-600 hover:bg-amber-500 text-white rounded-full shadow-lg border border-amber-400/30 transition transform hover:scale-105 flex items-center justify-center"
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
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-stone-800">
              <div className="flex items-center gap-2.5">
                <Settings className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold text-white">Store Settings & Info</h3>
              </div>
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="p-1 rounded-lg text-stone-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="bg-stone-950 border border-stone-800 p-3 rounded-xl space-y-1.5">
                <div className="font-semibold text-white">Discount Liquor</div>
                <div className="text-stone-400">2105 E Orange Ave, Eustis FL 32726</div>
                <div className="text-stone-400">Owner: Zaheer • Single Store (Registers: 87287, 83954, 60696)</div>
                <div className="text-amber-400 font-mono text-[11px] pt-1">Florida Tax: 7% Sales Tax Separated</div>
              </div>

              <div className="bg-stone-950 border border-stone-800 p-3 rounded-xl space-y-1.5">
                <div className="font-semibold text-white">Backend & Architecture</div>
                <div className="text-stone-400">Cloudflare Workers + D1 Stock Ledger Engine</div>
                <div className="text-stone-400">AI Model: Google Gemini 2.5 Flash</div>
                <div className="text-stone-400">Telegram Bot: @DiscountLiquorBot (Private chat allowed)</div>
              </div>
            </div>

            <div className="pt-2 flex justify-between items-center">
              <span className="text-xs text-stone-500">Qilbo v2.0 Cloudflare</span>
              <button
                onClick={handleLogout}
                className="px-4 py-2 bg-red-600/20 hover:bg-red-600/30 border border-red-600/30 text-red-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition"
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

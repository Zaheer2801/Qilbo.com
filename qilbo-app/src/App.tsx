import { useCallback, useState } from "react";
import {
  AlertTriangle,
  Bell,
  DollarSign,
  LayoutDashboard,
  Loader2,
  Package,
  Receipt,
  ShoppingCart,
  Truck,
  Zap,
  Globe,
  Settings,
  ArrowLeft,
} from "lucide-react";
import type { AppState, Product } from "./types";
import { emptyState } from "./lib/state";
import { loadState, saveState, clearState } from "./lib/storage";

// UI Logo Component
import { QilboLogo } from "./components/ui/QilboLogo";

// Landing components
import LandingNav from "./components/Nav";
import Hero from "./components/Hero";
import BeforeAfter from "./components/BeforeAfter";
import Features from "./components/Features";
import Statement from "./components/Statement";
import Positioning from "./components/Positioning";
import Workflow from "./components/Workflow";
import FAQ from "./components/FAQ";
import FinalCTA from "./components/FinalCTA";
import Footer from "./components/Footer";

// Dashboard components
import Onboarding from "./components/Onboarding";
import Overview from "./components/dashboard/Overview";
import InventoryTab from "./components/dashboard/InventoryTab";
import ProcurementTab from "./components/dashboard/ProcurementTab";
import PricingTab from "./components/dashboard/PricingTab";
import ExpiryTab from "./components/dashboard/ExpiryTab";
import AlertsTab from "./components/dashboard/AlertsTab";
import SettingsTab from "./components/dashboard/SettingsTab";

// Combined Santé + Qilbo New Components
import { POSRegister } from "./components/dashboard/POSRegister";
import { DeliveryEcomHub } from "./components/dashboard/DeliveryEcomHub";

const TABS = [
  { id: "pos", label: "Register POS", icon: ShoppingCart, highlight: true },
  { id: "delivery", label: "Delivery & E-Com", icon: Truck, highlight: true },
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "inventory", label: "Inventory & Audit", icon: Package },
  { id: "procurement", label: "Procurement & POs", icon: Receipt },
  { id: "pricing", label: "Pricing & Margins", icon: DollarSign },
  { id: "expiry", label: "Expiry Tracking", icon: AlertTriangle },
  { id: "alerts", label: "Smart Alerts", icon: Bell },
  { id: "settings", label: "Store Settings", icon: Settings },
];

function initState(): AppState {
  const loaded = loadState();
  return loaded ? { ...emptyState(), ...loaded } : emptyState();
}

export default function App() {
  const [state, setState] = useState(initState);
  const [tab, setTab] = useState("pos");
  const [showLanding, setShowLanding] = useState(true);

  const updateState = useCallback((updater: (prev: AppState) => AppState) => {
    setState((prev) => {
      const next = updater(prev);
      saveState(next);
      return next;
    });
  }, []);

  const handleCompleteSale = (items: { product: Product; qty: number }[], _total: number) => {
    updateState((prev) => {
      const updatedProducts = prev.products.map((p) => {
        const cartItem = items.find((item) => item.product.id === p.id);
        if (cartItem) {
          return { ...p, qty: Math.max(0, p.qty - cartItem.qty) };
        }
        return p;
      });

      const newSales = items.map((item) => ({
        id: `sale-${Date.now()}-${Math.random()}`,
        productId: item.product.id,
        qty: item.qty,
        date: new Date().toISOString().split("T")[0],
      }));

      return {
        ...prev,
        products: updatedProducts,
        sales: [...prev.sales, ...newSales],
      };
    });
  };

  function completeOnboarding(cfg: any, policy: any) {
    updateState((s) => ({ ...s, config: cfg, marginPolicy: policy }));
  }

  function resetAll() {
    const fresh = emptyState();
    setState(fresh);
    clearState();
    setShowLanding(true);
  }

  if (!state) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
        <Loader2 className="animate-spin text-amber-500" size={32} />
      </div>
    );
  }

  // Show landing page mode
  if (showLanding) {
    return (
      <div className="bg-slate-950 text-slate-100 min-h-screen selection:bg-amber-500 selection:text-slate-950">
        <LandingNav
          onGetStarted={() => setShowLanding(false)}
          onOpenPOS={() => {
            setTab("pos");
            setShowLanding(false);
          }}
        />
        <main>
          <Hero
            onGetStarted={() => setShowLanding(false)}
            onOpenPOS={() => {
              setTab("pos");
              setShowLanding(false);
            }}
          />
          <BeforeAfter />
          <Features />
          <Statement />
          <Positioning />
          <Workflow />
          <FAQ />
          <FinalCTA
            onGetStarted={() => setShowLanding(false)}
            onOpenPOS={() => {
              setTab("pos");
              setShowLanding(false);
            }}
          />
        </main>
        <Footer />
      </div>
    );
  }

  // Show onboarding if not complete
  if (!state.config.onboardingComplete) {
    return (
      <div className="min-h-screen bg-slate-950 text-white p-6 flex flex-col justify-center">
        <div className="max-w-2xl mx-auto mb-6 text-center">
          <QilboLogo size="lg" layout="stacked" className="mx-auto" />
        </div>
        <Onboarding
          initialConfig={state.config}
          initialMarginPolicy={state.marginPolicy}
          onComplete={completeOnboarding}
        />
      </div>
    );
  }

  // Show full interactive POS & Dashboard Workspace
  const currentTab = TABS.find((t) => t.id === tab);
  const businessLabel = state.config.dba || state.config.businessName || "Qilbo Liquor & Retail";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col md:flex-row font-sans selection:bg-amber-500 selection:text-slate-950">
      {/* Dark Sidebar (Obsidian Theme) */}
      <aside className="w-full md:w-64 shrink-0 border-r border-slate-800/80 bg-slate-900/90 flex flex-col justify-between backdrop-blur-xl">
        <div>
          {/* Logo & Store Selector Header */}
          <div className="p-5 border-b border-slate-800/80 flex items-center justify-between">
            <button
              onClick={() => setShowLanding(true)}
              className="hover:opacity-90 transition text-left"
              title="Return to Landing Page"
            >
              <QilboLogo size="sm" showTagline={false} />
            </button>
            <button
              onClick={() => setShowLanding(true)}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
              title="Back to Landing Page"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          </div>

          <div className="px-4 py-3 bg-slate-950/60 border-b border-slate-800/60">
            <span className="text-[10px] font-bold text-amber-500/80 uppercase tracking-widest block">
              Active Store Terminal
            </span>
            <span className="text-xs font-bold text-white truncate block mt-0.5">
              {businessLabel}
            </span>
          </div>

          {/* Navigation Links */}
          <nav className="p-3 space-y-1 overflow-y-auto max-h-[calc(100vh-220px)]">
            <div className="px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
              Register & Operations
            </div>
            {TABS.slice(0, 2).map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition ${
                  tab === t.id
                    ? "bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 shadow-lg shadow-amber-500/20"
                    : "text-slate-300 hover:bg-slate-800/80 hover:text-amber-400"
                }`}
              >
                <t.icon className={`w-4 h-4 ${tab === t.id ? "text-slate-950" : "text-amber-400"}`} />
                <span>{t.label}</span>
              </button>
            ))}

            <div className="pt-4 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
              Inventory & Analytics
            </div>
            {TABS.slice(2, 8).map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
                  tab === t.id
                    ? "bg-amber-500/15 border border-amber-500/40 text-amber-400 font-bold"
                    : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
                }`}
              >
                <t.icon className={`w-4 h-4 ${tab === t.id ? "text-amber-400" : "text-slate-500"}`} />
                <span>{t.label}</span>
              </button>
            ))}

            <div className="pt-4 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
              System
            </div>
            <button
              onClick={() => setTab("settings")}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
                tab === "settings"
                  ? "bg-amber-500/15 border border-amber-500/40 text-amber-400 font-bold"
                  : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
              }`}
            >
              <Settings className="w-4 h-4 text-slate-500" />
              <span>Store Settings</span>
            </button>
          </nav>
        </div>

        {/* Footer User Info */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-950/40 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-xs border border-amber-500/30">
              Z
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-white truncate">
                {state.config.ownerName || "Store Owner"}
              </p>
              <p className="text-[10px] text-emerald-400 font-semibold">Qilbo Local POS v2.0</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Workspace Area */}
      <main className="flex-1 min-w-0 flex flex-col bg-slate-950 overflow-y-auto">
        {/* Top Header Bar */}
        <header className="h-16 px-6 border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-xl flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400 font-medium">{businessLabel}</span>
            <span className="text-slate-600">/</span>
            <span className="font-extrabold text-amber-400">{currentTab?.label}</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowLanding(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-800 hover:border-slate-700 bg-slate-900 text-slate-300 text-xs font-semibold transition"
            >
              <Globe className="w-3.5 h-3.5 text-amber-400" /> Landing Site View
            </button>

            <button
              onClick={() => setTab("pos")}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 text-xs font-extrabold shadow-md shadow-amber-500/20 hover:brightness-110 transition"
            >
              <Zap className="w-3.5 h-3.5 fill-slate-950" /> Fast POS Register
            </button>
          </div>
        </header>

        {/* Tab Content Views */}
        <div className="flex-1 p-6 md:p-8">
          {tab === "pos" && (
            <POSRegister products={state.products} onCompleteSale={handleCompleteSale} />
          )}
          {tab === "delivery" && <DeliveryEcomHub />}
          {tab === "overview" && <Overview state={state} />}
          {tab === "inventory" && (
            <InventoryTab state={state} updateState={updateState} />
          )}
          {tab === "procurement" && (
            <ProcurementTab state={state} updateState={updateState} />
          )}
          {tab === "pricing" && (
            <PricingTab state={state} updateState={updateState} />
          )}
          {tab === "expiry" && <ExpiryTab state={state} />}
          {tab === "alerts" && (
            <AlertsTab state={state} updateState={updateState} />
          )}
          {tab === "settings" && (
            <SettingsTab state={state} updateState={updateState} onReset={resetAll} />
          )}
        </div>
      </main>
    </div>
  );
}

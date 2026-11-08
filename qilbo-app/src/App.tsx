import { useCallback, useState } from "react";
import {
  BarChart3,
  Flame,
  LayoutDashboard,
  Loader2,
  Package,
  Receipt,
  Settings,
  RefreshCw,
  Award,
  FileText,
} from "lucide-react";
import type { AppState, Product } from "./types";
import { emptyState } from "./lib/state";
import { loadState, saveState, clearState } from "./lib/storage";
import liveInventory from "./data/live_inventory.json";

// UI Components
import { QilboLogo } from "./components/ui/QilboLogo";
import ExecutivePartnerTab from "./components/dashboard/ExecutivePartnerTab";
import DailySalesReportTab from "./components/dashboard/DailySalesReportTab";
import TopShelfSalesTab from "./components/dashboard/TopShelfSalesTab";
import ProcurementTab from "./components/dashboard/ProcurementTab";
import InventoryTab from "./components/dashboard/InventoryTab";
import Overview from "./components/dashboard/Overview";
import SettingsTab from "./components/dashboard/SettingsTab";
import InvoiceUploadModal from "./components/dashboard/InvoiceUploadModal";

const TABS = [
  { id: "executive", label: "Executive Partner Board", icon: Award },
  { id: "dailysales", label: "Daily Sales Report", icon: BarChart3 },
  { id: "topshelf", label: "Top Shelf Monitor", icon: Flame },
  { id: "procurement", label: "Procurement & POs", icon: Receipt },
  { id: "inventory", label: "Live Stock & Audit", icon: Package },
  { id: "overview", label: "Overview & Metrics", icon: LayoutDashboard },
  { id: "settings", label: "Settings", icon: Settings },
];

function initState(): AppState {
  const loaded = loadState<AppState>();
  // Prefer the freshest live inventory feed if it has more historical sales records
  if (liveInventory && (liveInventory as any).sales && (liveInventory as any).sales.length > (loaded?.sales?.length || 0)) {
    const base = emptyState();
    return {
      ...base,
      products: (liveInventory as any).products as Product[],
      sales: ((liveInventory as any).sales || []) as any,
      config: {
        ...base.config,
        ...(loaded?.config || {}),
        businessName: "Discount Liquor",
        dba: "Discount Liquor",
        vertical: "Liquor Retail",
        onboardingComplete: true,
      },
    };
  }
  if (loaded && loaded.products && loaded.products.length > 0) {
    return { ...emptyState(), ...loaded };
  }
  return emptyState();
}

export default function App() {
  const [state, setState] = useState<AppState>(initState);
  const [tab, setTab] = useState<string>("executive");
  const [selectedReportDate, setSelectedReportDate] = useState<string | undefined>(undefined);
  const [syncingNrs, setSyncingNrs] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);

  const handleApplyInvoice = (updatedProducts: Product[], invoiceMeta: any) => {
    updateState((prev) => ({
      ...prev,
      products: updatedProducts,
    }));
    setSyncMessage(`Invoice #${invoiceMeta.invoiceNo} applied (${invoiceMeta.totalCases} cases)`);
  };

  const updateState = useCallback((updater: (prev: AppState) => AppState) => {
    setState((prev) => {
      const next = updater(prev);
      saveState(next);
      return next;
    });
  }, []);

  const handleSyncNrs = async () => {
    setSyncingNrs(true);
    try {
      const res = await fetch("http://localhost:8787/api/nrs/sync?gmail=true", { method: "POST" });
      const data = await res.json();
      if (data.state && data.state.products) {
        updateState((prev) => ({
          ...prev,
          products: data.state.products,
          sales: data.state.sales || prev.sales,
        }));
        setSyncMessage(`Synced ${data.state.products.length} products from Gmail!`);
      } else {
        setSyncMessage("Sync complete.");
      }
    } catch {
      // Local fallback
      if (liveInventory && (liveInventory as any).products) {
        updateState((prev) => ({
          ...prev,
          products: (liveInventory as any).products,
          sales: (liveInventory as any).sales || prev.sales,
        }));
        setSyncMessage("Updated from latest local report");
      } else {
        setSyncMessage("Run 'npm run server'");
      }
    } finally {
      setSyncingNrs(false);
      setTimeout(() => setSyncMessage(null), 4000);
    }
  };

  function resetAll() {
    clearState();
    setState(emptyState());
  }

  if (!state) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50 text-stone-800">
        <Loader2 className="animate-spin text-amber-800" size={32} />
      </div>
    );
  }

  const currentTab = TABS.find((t) => t.id === tab);
  const businessLabel = state.config.dba || state.config.businessName || "Discount Liquor (87287)";

  return (
    <div className="min-h-screen bg-stone-100 text-stone-900 flex flex-col md:flex-row font-sans selection:bg-amber-200 selection:text-amber-900">
      {/* Desktop Light Sidebar (>= md) */}
      <aside className="hidden md:flex md:w-64 shrink-0 border-r border-stone-200 bg-stone-50 flex-col justify-between">
        <div>
          {/* Brand Header */}
          <div className="p-5 border-b border-stone-200 flex items-center justify-between bg-white">
            <QilboLogo size="sm" showTagline={false} />
          </div>

          {/* Active Store Banner */}
          <div className="px-5 py-3 bg-stone-100/70 border-b border-stone-200">
            <span className="text-[10px] font-bold text-amber-800 uppercase tracking-widest block">
              Connected POS Merchant
            </span>
            <span className="text-xs font-semibold text-stone-900 truncate block mt-0.5">
              {businessLabel}
            </span>
          </div>

          {/* Navigation */}
          <nav className="p-3 space-y-1">
            <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-stone-400">
              Procurement & Inventory
            </div>
            {TABS.map((t) => {
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-md text-xs font-medium transition ${
                    active
                      ? "bg-amber-800 text-amber-50 shadow-sm"
                      : "text-stone-600 hover:bg-stone-200/60 hover:text-stone-900"
                  }`}
                >
                  <t.icon className={`w-4 h-4 ${active ? "text-amber-200" : "text-stone-500"}`} />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* User / Status Footer */}
        <div className="p-4 border-t border-stone-200 bg-white flex items-center justify-between text-xs">
          <div>
            <p className="font-semibold text-stone-900">Discount Liquor</p>
            <p className="text-[11px] text-emerald-700 flex items-center gap-1 font-medium mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
              NRS Feed Connected
            </p>
          </div>
          <button
            onClick={handleSyncNrs}
            disabled={syncingNrs}
            className="p-2 rounded-md hover:bg-stone-100 text-stone-500 hover:text-stone-800 transition disabled:opacity-50"
            title="Sync latest email report"
          >
            <RefreshCw size={14} className={syncingNrs ? "animate-spin" : ""} />
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 flex flex-col bg-stone-100">
        {/* Mobile Top Header Bar (< md) */}
        <header className="md:hidden px-4 py-3 border-b border-stone-200 bg-white flex items-center justify-between sticky top-0 z-20 shadow-xs">
          <div className="flex items-center gap-2.5">
            <QilboLogo size="sm" showTagline={false} />
            <div className="leading-tight">
              <span className="text-xs font-bold text-stone-900 block truncate max-w-[130px]">
                {businessLabel}
              </span>
              <span className="text-[10px] text-amber-800 font-semibold uppercase tracking-wider block">
                {currentTab?.label}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsInvoiceModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-stone-900 text-stone-50 text-[11px] font-bold shadow-xs active:scale-95 transition cursor-pointer"
              title="Snap or upload vendor invoice"
            >
              <FileText size={13} className="text-amber-400" />
              <span>Invoice</span>
            </button>

            <button
              onClick={handleSyncNrs}
              disabled={syncingNrs}
              className="p-2 rounded-xl bg-amber-800 text-amber-50 text-xs font-medium hover:bg-amber-900 transition disabled:opacity-50 active:scale-95 shadow-xs cursor-pointer"
              title="Sync latest NRS report"
            >
              <RefreshCw size={13} className={syncingNrs ? "animate-spin" : ""} />
            </button>
          </div>
        </header>

        {/* Desktop Top Header Bar (>= md) */}
        <header className="hidden md:flex h-16 px-6 md:px-8 border-b border-stone-200 bg-white items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-stone-400 font-medium">{businessLabel}</span>
            <span className="text-stone-300">/</span>
            <span className="font-bold text-amber-900">{currentTab?.label}</span>
          </div>

          <div className="flex items-center gap-3">
            {syncMessage && (
              <span className="text-xs font-semibold px-2.5 py-1 rounded bg-amber-50 text-amber-900 border border-amber-200">
                {syncMessage}
              </span>
            )}

            <button
              onClick={() => setIsInvoiceModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-stone-900 text-stone-50 text-xs font-semibold hover:bg-stone-800 transition shadow-xs cursor-pointer border border-stone-700 active:scale-95"
              title="Upload distributor delivery invoice (PDF, Image, CSV)"
            >
              <FileText size={13} className="text-amber-400" />
              <span>Upload Invoice</span>
            </button>

            <button
              onClick={handleSyncNrs}
              disabled={syncingNrs}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-amber-800 text-amber-50 text-xs font-medium hover:bg-amber-900 transition disabled:opacity-50"
            >
              <RefreshCw size={13} className={syncingNrs ? "animate-spin" : ""} />
              {syncingNrs ? "Fetching from Gmail..." : "Sync Latest NRS Report"}
            </button>
          </div>
        </header>

        {/* Tab Content Area (with pb-24 for mobile bottom nav) */}
        <div className="flex-1 p-4 sm:p-6 md:p-8 pb-24 md:pb-8 overflow-y-auto">
          {tab === "executive" && (
            <ExecutivePartnerTab
              state={state}
              onNavigateToDailyReport={(date) => {
                setSelectedReportDate(date);
                setTab("dailysales");
              }}
            />
          )}
          {tab === "dailysales" && (
            <DailySalesReportTab
              state={state}
              onSyncNrs={handleSyncNrs}
              isSyncing={syncingNrs}
              syncMessage={syncMessage}
              initialDate={selectedReportDate}
            />
          )}
          {tab === "topshelf" && (
            <TopShelfSalesTab
              state={state}
              onSyncNrs={handleSyncNrs}
              isSyncing={syncingNrs}
              syncMessage={syncMessage}
            />
          )}
          {tab === "procurement" && (
            <ProcurementTab state={state} updateState={updateState} />
          )}
          {tab === "inventory" && (
            <InventoryTab state={state} updateState={updateState} />
          )}
          {tab === "overview" && <Overview state={state} />}
          {tab === "settings" && (
            <SettingsTab state={state} updateState={updateState} onReset={resetAll} />
          )}
        </div>
      </main>

      {/* Mobile Fixed Bottom Navigation Bar (< md) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-stone-200 px-2 py-1.5 flex items-center justify-around shadow-lg pb-[env(safe-area-inset-bottom,8px)]">
        {[
          { id: "executive", label: "Board", icon: Award },
          { id: "inventory", label: "Stock", icon: Package },
          { id: "dailysales", label: "Sales", icon: BarChart3 },
          { id: "topshelf", label: "Top Shelf", icon: Flame },
          { id: "settings", label: "More", icon: Settings },
        ].map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition cursor-pointer active:scale-95 ${
                active
                  ? "text-amber-900 font-bold"
                  : "text-stone-500 hover:text-stone-800 font-medium"
              }`}
            >
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center transition ${
                  active ? "bg-amber-100 text-amber-900" : "text-stone-500"
                }`}
              >
                <t.icon size={16} />
              </div>
              <span className="text-[10px] mt-0.5">{t.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Invoice Upload & Inventory Intake Modal */}
      <InvoiceUploadModal
        isOpen={isInvoiceModalOpen}
        onClose={() => setIsInvoiceModalOpen(false)}
        onApplyInvoice={handleApplyInvoice}
        currentProducts={state.products}
      />
    </div>
  );
}

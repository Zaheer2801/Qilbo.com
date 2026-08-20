import React, { useState } from "react";
import {
  ShoppingCart,
  Bot,
  Truck,
  TrendingUp,
  Clock,
  Sparkles,
  CheckCircle2,
} from "lucide-react";

export default function Features() {
  const [active, setActive] = useState(0);

  const featuresList = [
    {
      n: "01",
      icon: ShoppingCart,
      title: "Touchscreen POS Register & 21+ ID Check",
      body: "Lightning-fast barcode scanner, quick key grid, automatic age verification alerts for liquor/tobacco, digital receipts, and split payments.",
    },
    {
      n: "02",
      icon: Bot,
      title: "AI Inventory Auditing & CSV Batch Import",
      body: "Track every bottle, case, and SKU. Bulk import product catalogs via CSV and enrich product photos with AI automatic background removal.",
    },
    {
      n: "03",
      icon: Truck,
      title: "Distributor Receiving & PO Management",
      body: "Scan distributor invoices from Southern Glazer's, Breakthru, and local wholesalers. Automated reorders based on sales velocity.",
    },
    {
      n: "04",
      icon: Sparkles,
      title: "UberEats, DoorDash & Local Web Sync",
      body: "Centralized multi-channel order dispatch. Sync local web store and delivery app orders directly with your main store inventory.",
    },
    {
      n: "05",
      icon: TrendingUp,
      title: "Dynamic Pricing & Margin Protection",
      body: "Set category-aware minimum profit margin guardrails. Automated alerts when distributor price increases threaten your profits.",
    },
    {
      n: "06",
      icon: Clock,
      title: "Expiry Tracking & Low Stock Alerts",
      body: "Track batch expiration dates for craft beers and food items. Receive automated notifications before stock runs out or products expire.",
    },
  ];

  return (
    <section id="features" className="py-24 bg-slate-950 text-white relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 space-y-12">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-amber-400 bg-amber-500/10 border border-amber-500/30 px-3 py-1 rounded-full">
            Complete Feature Matrix
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            Built for how an independent retail store actually runs.
          </h2>
          <p className="text-slate-400 text-sm sm:text-base">
            From register checkout to distributor receiving and multi-channel delivery, Qilbo powers every inch of your business.
          </p>
        </div>

        {/* Feature Interactive Layout */}
        <div className="grid lg:grid-cols-12 gap-8 items-center pt-6">
          {/* Left Column List (6 cols) */}
          <div className="lg:col-span-6 space-y-3">
            {featuresList.map((f, i) => {
              const Icon = f.icon;
              const isSelected = i === active;
              return (
                <button
                  key={f.n}
                  onClick={() => setActive(i)}
                  className={`w-full text-left p-4 rounded-2xl border transition-all duration-200 flex items-start gap-4 ${
                    isSelected
                      ? "bg-slate-900 border-amber-500/60 shadow-xl shadow-amber-500/10"
                      : "bg-slate-950/60 border-slate-800/80 hover:bg-slate-900/60 hover:border-slate-700"
                  }`}
                >
                  <div
                    className={`p-3 rounded-xl shrink-0 transition ${
                      isSelected ? "bg-amber-500 text-slate-950" : "bg-slate-800 text-amber-400"
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-extrabold text-amber-500/80 font-mono">
                        {f.n}
                      </span>
                      <h4
                        className={`text-sm font-bold transition ${
                          isSelected ? "text-white" : "text-slate-300"
                        }`}
                      >
                        {f.title}
                      </h4>
                    </div>
                    {isSelected && (
                      <p className="text-xs text-slate-400 leading-relaxed pt-1 animate-fadeIn">
                        {f.body}
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Right Column Visual Panel (6 cols) */}
          <div className="lg:col-span-6 relative">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl min-h-[420px] flex flex-col justify-center items-center text-center relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 via-transparent to-orange-500/10 pointer-events-none" />
              
              <div className="w-16 h-16 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center mb-6 border border-amber-500/40 shadow-lg shadow-amber-500/20">
                {React.createElement(featuresList[active].icon, { className: "w-8 h-8" })}
              </div>

              <span className="text-sm font-mono font-bold text-amber-400 uppercase tracking-widest mb-2">
                Feature {featuresList[active].n} of 06
              </span>

              <h3 className="text-xl sm:text-2xl font-extrabold text-white max-w-md">
                {featuresList[active].title}
              </h3>

              <p className="text-xs sm:text-sm text-slate-300 max-w-md mt-3 leading-relaxed">
                {featuresList[active].body}
              </p>

              <div className="mt-8 flex items-center gap-2 text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-full">
                <CheckCircle2 className="w-4 h-4" /> Live Interactive Demo Available in App Mode
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

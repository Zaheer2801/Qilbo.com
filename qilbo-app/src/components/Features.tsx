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
      img: "https://images.unsplash.com/photo-1556742049-0a67e5108620?auto=format&fit=crop&w=1200&q=80",
      badge: "Real-time Register Sync",
    },
    {
      n: "02",
      icon: Bot,
      title: "AI Inventory Auditing & CSV Batch Import",
      body: "Track every bottle, case, and SKU. Bulk import product catalogs via CSV and enrich product photos with AI automatic background removal.",
      img: "https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?auto=format&fit=crop&w=1200&q=80",
      badge: "AI Image Extraction",
    },
    {
      n: "03",
      icon: Truck,
      title: "Distributor Receiving & PO Management",
      body: "Scan distributor invoices from Southern Glazer's, Breakthru, and local wholesalers. Automated reorders based on sales velocity.",
      img: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=1200&q=80",
      badge: "Invoice OCR Matcher",
    },
    {
      n: "04",
      icon: Sparkles,
      title: "UberEats, DoorDash & Local Web Sync",
      body: "Centralized multi-channel order dispatch. Sync local web store and delivery app orders directly with your main store inventory.",
      img: "https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?auto=format&fit=crop&w=1200&q=80",
      badge: "Multi-App Delivery",
    },
    {
      n: "05",
      icon: TrendingUp,
      title: "Dynamic Pricing & Margin Protection",
      body: "Set category-aware minimum profit margin guardrails. Automated alerts when distributor price increases threaten your profits.",
      img: "https://images.unsplash.com/photo-1567696911980-2eed69a46042?auto=format&fit=crop&w=1200&q=80",
      badge: "38.4% Margin Guardrail",
    },
    {
      n: "06",
      icon: Clock,
      title: "Expiry Tracking & Low Stock Alerts",
      body: "Track batch expiration dates for craft beers and food items. Receive automated notifications before stock runs out or products expire.",
      img: "https://images.unsplash.com/photo-1516594915697-87eb3b1c14ea?auto=format&fit=crop&w=1200&q=80",
      badge: "Expiry & Stock Alert",
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

          {/* Right Column Visual Panel with Real Photography & UI Overlays (6 cols) */}
          <div className="lg:col-span-6 relative">
            <div className="relative bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl min-h-[460px] group">
              <img
                src={featuresList[active].img}
                alt={featuresList[active].title}
                className="w-full h-[460px] object-cover object-center transform group-hover:scale-105 transition-transform duration-700 brightness-75"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent pointer-events-none" />
              
              {/* Glassmorphic UI Overlay Card */}
              <div className="absolute bottom-6 left-6 right-6 p-6 rounded-2xl bg-slate-950/80 border border-slate-800 backdrop-blur-xl space-y-3 shadow-2xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/40">
                      {React.createElement(featuresList[active].icon, { className: "w-5 h-5" })}
                    </div>
                    <div>
                      <span className="text-[10px] font-mono uppercase font-bold text-amber-400 tracking-wider">
                        Feature {featuresList[active].n} / 06
                      </span>
                      <h3 className="text-base font-extrabold text-white">
                        {featuresList[active].title}
                      </h3>
                    </div>
                  </div>
                  <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full">
                    {featuresList[active].badge}
                  </span>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">
                  {featuresList[active].body}
                </p>

                <div className="pt-1 flex items-center justify-between border-t border-slate-800/80 text-[11px] text-slate-400">
                  <span className="flex items-center gap-1 text-emerald-400 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5" /> High Precision Qilbo Engine
                  </span>
                  <span className="font-mono text-amber-400">Status: Active</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

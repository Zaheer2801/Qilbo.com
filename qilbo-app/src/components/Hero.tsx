import {
  Zap,
  ShieldCheck,
  Truck,
  Scan,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  TrendingUp,
  Store,
} from "lucide-react";

interface HeroProps {
  onGetStarted: () => void;
  onOpenPOS?: () => void;
}

export default function Hero({ onGetStarted, onOpenPOS }: HeroProps) {
  return (
    <section className="relative pt-32 pb-20 md:pt-40 md:pb-28 overflow-hidden bg-slate-950 text-white">
      {/* Dynamic Background Glow & Grid */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(255,110,0,0.18),rgba(255,255,255,0))]" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b15_1px,transparent_1px),linear-gradient(to_bottom,#1e293b15_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 md:px-8 grid lg:grid-cols-12 gap-12 items-center">
        {/* Left Column: Heading & CTAs (7 cols) */}
        <div className="lg:col-span-7 space-y-6 text-left">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold tracking-wide">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>The All-In-One POS & Inventory Intelligence Operating System</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.1]">
            Stock it right. <br />
            <span className="bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500 bg-clip-text text-transparent">
              Qilbo manages your store.
            </span>
          </h1>

          <p className="text-base sm:text-lg text-slate-300 leading-relaxed max-w-2xl">
            Qilbo consolidates fast touchscreen POS checkout, distributor invoice receiving,
            AI inventory auditing, and multi-channel delivery (UberEats, DoorDash, Web) in one powerful platform designed specifically for independent liquor, wine, and retail stores.
          </p>

          {/* Bullet List */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            {[
              "Fast Touchscreen POS & Age 21+ Verification",
              "AI Image Enrichment & CSV Inventory Import",
              "Distributor Invoice Scanner & Reorder Timing",
              "UberEats, DoorDash & Local E-Commerce Sync",
            ].map((feat, idx) => (
              <div key={idx} className="flex items-center gap-2 text-xs font-semibold text-slate-200">
                <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
                <span>{feat}</span>
              </div>
            ))}
          </div>

          {/* CTAs */}
          <div className="pt-4 flex flex-wrap items-center gap-4">
            <button
              onClick={() => {
                if (onOpenPOS) onOpenPOS();
                else onGetStarted();
              }}
              className="px-6 py-3.5 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-slate-950 font-extrabold text-sm flex items-center gap-2 shadow-xl shadow-amber-500/25 hover:brightness-110 active:scale-[0.98] transition"
            >
              <Zap className="w-4 h-4 fill-slate-950" />
              Launch POS Register Demo
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onClick={onGetStarted}
              className="px-6 py-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-white font-bold text-sm flex items-center gap-2 transition"
            >
              <Store className="w-4 h-4 text-amber-400" />
              Setup Store Onboarding
            </button>
          </div>
        </div>

        {/* Right Column: Dynamic Interactive UI Mockup & Photo Terminal (5 cols) */}
        <div className="lg:col-span-5 relative">
          <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-amber-500/30 to-orange-500/30 blur-xl opacity-75 animate-pulse" />
          
          <div className="relative bg-slate-900/90 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl backdrop-blur-xl space-y-4">
            {/* Real Hardware Terminal Photography Header */}
            <div className="relative h-44 overflow-hidden group">
              <img
                src="https://images.unsplash.com/photo-1556742049-0a67e5108620?auto=format&fit=crop&w=1200&q=80"
                alt="Qilbo POS Terminal Checkout"
                className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-700 brightness-90"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/30 to-transparent" />
              
              <div className="absolute top-3 left-3 right-3 flex justify-between items-center">
                <div className="flex items-center gap-2 bg-slate-950/80 backdrop-blur-md px-3 py-1 rounded-full border border-slate-800">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  <span className="text-[11px] font-bold text-white">Qilbo Register Terminal</span>
                </div>
                <span className="text-[10px] uppercase font-mono font-bold text-amber-400 bg-amber-500/20 backdrop-blur-md px-2.5 py-1 rounded-full border border-amber-500/30">
                  Store ID: #8492
                </span>
              </div>
            </div>

            {/* Quick Live Preview Cards */}
            <div className="px-5 pb-5 space-y-3">
              <div className="p-3 bg-slate-950/80 border border-slate-800/80 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-500/10 text-amber-400 rounded-lg">
                    <Scan className="w-4 h-4" />
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-white">Hennessy VS Cognac (750ml)</h5>
                    <p className="text-[11px] text-slate-400">UPC: 088004000109 • Category: Spirits</p>
                  </div>
                </div>
                <span className="text-xs font-extrabold text-amber-400">$46.99</span>
              </div>

              <div className="p-3 bg-slate-950/80 border border-slate-800/80 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-white">Age Compliance Engine</h5>
                    <p className="text-[11px] text-emerald-400">ID Verified 21+ Required</p>
                  </div>
                </div>
                <span className="text-[10px] font-bold px-2 py-1 bg-emerald-500/20 text-emerald-300 rounded-md">
                  PASSED
                </span>
              </div>

              <div className="p-3 bg-slate-950/80 border border-slate-800/80 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-500/10 text-purple-400 rounded-lg">
                    <Truck className="w-4 h-4" />
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-white">UberEats / DoorDash Sync</h5>
                    <p className="text-[11px] text-slate-400">Auto-dispatch incoming web orders</p>
                  </div>
                </div>
                <span className="text-xs font-bold text-slate-300">Active</span>
              </div>

              {/* Live Performance Meter */}
              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 text-slate-400">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                  <span>Today's Store Sales:</span>
                </div>
                <span className="font-extrabold text-white text-sm">$4,892.50</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

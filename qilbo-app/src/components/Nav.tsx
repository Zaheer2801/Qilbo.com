import { QilboLogo } from "./ui/QilboLogo";
import { Store, Zap, ArrowRight } from "lucide-react";

interface NavProps {
  onGetStarted: () => void;
  onOpenPOS?: () => void;
  activeView?: "landing" | "app";
  setActiveView?: (view: "landing" | "app") => void;
}

export default function Nav({ onGetStarted, onOpenPOS, activeView = "landing", setActiveView }: NavProps) {
  return (
    <header className="fixed top-0 inset-x-0 z-50 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 h-16 flex items-center justify-between">
        <button
          onClick={() => setActiveView && setActiveView("landing")}
          className="hover:opacity-90 transition text-left"
        >
          <QilboLogo size="md" />
        </button>

        <nav className="hidden md:flex items-center gap-8 text-xs font-semibold text-slate-300">
          <a href="#features" className="hover:text-amber-400 transition-colors">
            POS & Register
          </a>
          <a href="#inventory" className="hover:text-amber-400 transition-colors">
            AI Inventory & Receiving
          </a>
          <a href="#delivery" className="hover:text-amber-400 transition-colors">
            Delivery Sync
          </a>
          <a href="#workflow" className="hover:text-amber-400 transition-colors">
            How It Works
          </a>
        </nav>

        <div className="flex items-center gap-3">
          {setActiveView && activeView === "landing" ? (
            <button
              onClick={() => setActiveView("app")}
              className="hidden sm:inline-flex items-center gap-1.5 text-xs font-bold text-slate-300 hover:text-amber-400 transition-colors px-3 py-1.5 rounded-lg border border-slate-800 hover:border-amber-500/30"
            >
              <Store className="w-3.5 h-3.5 text-amber-400" /> Launch App Demo
            </button>
          ) : null}

          <button
            onClick={() => {
              if (onOpenPOS) onOpenPOS();
              else onGetStarted();
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-slate-950 text-xs font-extrabold px-4 py-2 hover:brightness-110 transition shadow-lg shadow-amber-500/20 active:scale-[0.98]"
          >
            <Zap className="w-3.5 h-3.5 fill-slate-950" />
            <span>Open Register POS</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
}

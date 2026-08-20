import { Zap, ArrowRight } from "lucide-react";

interface FinalCTAProps {
  onGetStarted: () => void;
  onOpenPOS?: () => void;
}

export default function FinalCTA({ onGetStarted, onOpenPOS }: FinalCTAProps) {
  return (
    <section id="cta" className="relative py-24 bg-slate-950 text-white border-t border-slate-900 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_50%_50%,rgba(255,110,0,0.12),transparent)]" />
      <div className="relative max-w-4xl mx-auto px-6 text-center space-y-6">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-amber-400 bg-amber-500/10 border border-amber-500/30 px-3 py-1 rounded-full">
          Instant Store Onboarding
        </span>
        
        <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight">
          Transform your store with Qilbo today.
        </h2>

        <p className="text-slate-300 text-sm sm:text-base max-w-xl mx-auto leading-relaxed">
          Bring your existing product catalog via CSV or scan distributor invoices to experience full inventory intelligence, fast POS register checkout, and delivery dispatch.
        </p>

        <div className="pt-4 flex flex-wrap justify-center items-center gap-4">
          <button
            onClick={() => {
              if (onOpenPOS) onOpenPOS();
              else onGetStarted();
            }}
            className="px-8 py-4 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-slate-950 font-extrabold text-sm flex items-center gap-2 shadow-xl shadow-amber-500/25 hover:brightness-110 active:scale-[0.98] transition"
          >
            <Zap className="w-4 h-4 fill-slate-950" />
            Launch POS Register Demo
            <ArrowRight className="w-4 h-4" />
          </button>

          <button
            onClick={onGetStarted}
            className="px-8 py-4 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-white font-bold text-sm transition"
          >
            Start Setup Wizard
          </button>
        </div>
      </div>
    </section>
  );
}

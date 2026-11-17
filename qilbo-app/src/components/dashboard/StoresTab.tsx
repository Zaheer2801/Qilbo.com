import { useEffect, useState } from "react";
import { Store, RefreshCw, CheckCircle2, XCircle, Phone, Mail, MapPin, Copy, Check } from "lucide-react";
import { api, type StoreSignup } from "../../lib/api";

// Stores that registered through the /join onboarding page. Approving makes them a pilot store.
const STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: "New signup", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  pilot: { label: "Pilot", cls: "bg-blue-50 text-blue-700 border-blue-200" },
  active: { label: "Live", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  declined: { label: "Declined", cls: "bg-slate-50 text-slate-500 border-slate-200" },
};
const TYPE: Record<string, string> = { liquor: "Liquor store", convenience: "Convenience store", smoke: "Smoke & vape shop", mixed: "Mixed" };

export default function StoresTab() {
  const [stores, setStores] = useState<StoreSignup[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const joinUrl = `${window.location.origin}/join`;

  const load = async () => {
    setLoading(true); setError(null);
    try { setStores((await api.getStores()).stores); }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn't load stores"); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const decide = async (s: StoreSignup, d: "approve" | "decline") => {
    setBusy(s.id);
    try { await api.decideStore(s.id, d); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn't update"); }
    finally { setBusy(null); }
  };

  const copy = async () => {
    try { await navigator.clipboard.writeText(joinUrl); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* ignore */ }
  };

  const pending = stores.filter((s) => s.status === "pending").length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2"><Store className="w-6 h-6 text-blue-600" /> Stores</h1>
          <p className="text-sm text-slate-500 mt-1">Stores that registered for Qilbo. {pending ? `${pending} waiting for you.` : ""}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={copy} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
            {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />} {copied ? "Copied" : "Copy sign-up link"}
          </button>
          <a href="/join" target="_blank" rel="noopener" className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700">Open sign-up page</a>
          <button onClick={load} aria-label="Refresh" className="rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2"><RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /></button>
        </div>
      </div>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <ul className="space-y-3">
        {stores.map((s) => (
          <li key={s.id} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 rounded px-1.5 py-0.5">{s.code || `#${s.id}`}</span>
                  <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${STATUS[s.status]?.cls || ""}`}>{STATUS[s.status]?.label || s.status}</span>
                  <span className="text-[11px] text-slate-400">{TYPE[s.store_type] || s.store_type} · signed up {s.created_at?.slice(0, 10)}</span>
                </div>
                <h3 className="font-semibold text-lg text-slate-900 dark:text-white">{s.name}</h3>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600 dark:text-slate-300 mt-1">
                  {(s.city || s.address) && <span className="inline-flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{[s.address, s.city, s.state, s.zip].filter(Boolean).join(", ")}</span>}
                  {s.owner_name && <span>{s.owner_name}</span>}
                  {s.phone && <span className="inline-flex items-center gap-1"><Phone className="w-3.5 h-3.5" />{s.phone}</span>}
                  {s.email && <span className="inline-flex items-center gap-1"><Mail className="w-3.5 h-3.5" />{s.email}</span>}
                </div>
              </div>
              {s.status === "pending" && (
                <div className="flex gap-2">
                  <button disabled={busy === s.id} onClick={() => decide(s, "approve")} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60"><CheckCircle2 className="w-4 h-4" /> Start pilot</button>
                  <button disabled={busy === s.id} onClick={() => decide(s, "decline")} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-600 disabled:opacity-60"><XCircle className="w-4 h-4" /> Decline</button>
                </div>
              )}
            </div>
            {s.id !== 1 && (
              <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm mt-3 pt-3 border-t border-dashed border-slate-200 dark:border-slate-800">
                <Item k="POS" v={[s.pos, s.profile.registers ? `${s.profile.registers} register(s)` : null, s.profile.report_email ? `daily report email: ${s.profile.report_email}` : null].filter(Boolean).join(" · ")} />
                <Item k="Sales" v={s.profile.sales_range} />
                <Item k="Distributors" v={[...(s.profile.distributors || []), s.profile.distributors_other].filter(Boolean).join(", ")} />
                <Item k="Margin goals" v={s.profile.margin_goals ? Object.entries(s.profile.margin_goals).map(([c, v]) => `${c} ${v}%`).join(" · ") : null} />
                <Item k="Biggest pains" v={(s.profile.problems || []).join(" · ")} />
                <Item k="Morning brief" v={(s.profile.alerts || []).join(", ")} />
                <Item k="Wants" v={s.profile.intent === "demo" ? "A demo first" : "The pilot"} />
                <Item k="Signed up on" v={s.profile.source} />
                <Item k="Best time" v={s.profile.best_time} />
                <Item k="Notes" v={s.profile.notes} />
              </dl>
            )}
          </li>
        ))}
        {!stores.length && !loading && <li className="text-sm text-slate-500">No stores yet. Share the sign-up link with a store owner.</li>}
      </ul>
    </div>
  );
}

function Item({ k, v }: { k: string; v?: string | null }) {
  if (!v) return null;
  return (<div className="flex gap-2 min-w-0"><dt className="text-slate-400 shrink-0 w-28">{k}</dt><dd className="text-slate-700 dark:text-slate-200 min-w-0">{v}</dd></div>);
}

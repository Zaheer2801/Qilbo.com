import { useEffect, useMemo, useState } from "react";
import { Brain, RefreshCw, CheckCircle2, SkipForward, RotateCcw, DollarSign, Receipt, Package, ShieldCheck } from "lucide-react";
import { api, type BrainFinding, type BrainResponse } from "../../lib/api";

// What Qilbo found in last night's checks, with Approve / Skip.
// Approve means "I'll fix it"; the next night's data turns it into Verified once the problem is gone.

const ENGINES: { id: string; label: string; icon: typeof Brain }[] = [
  { id: "all", label: "Everything", icon: Brain },
  { id: "price", label: "Prices & margin", icon: DollarSign },
  { id: "invoice", label: "Invoices & deals", icon: Receipt },
  { id: "stock", label: "Stock & reorder", icon: Package },
];

const SEV: Record<number, { label: string; cls: string }> = {
  1: { label: "Act today", cls: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900" },
  2: { label: "This week", cls: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900" },
  3: { label: "Good to know", cls: "bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700" },
};

const money = (n: number | null | undefined) => (n == null ? "—" : "$" + Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));

export default function BrainTab() {
  const [data, setData] = useState<BrainResponse | null>(null);
  const [view, setView] = useState<"todo" | "done">("todo");
  const [engine, setEngine] = useState("all");
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await api.getBrain(view === "todo" ? "open,approved" : "verified,skipped,cleared"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load findings");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [view]);

  const runNow = async () => {
    setRunning(true);
    try { await api.runBrain(); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Check failed"); }
    finally { setRunning(false); }
  };

  const decide = async (f: BrainFinding, d: "approve" | "skip" | "reopen") => {
    setBusy(f.id);
    try {
      await api.decideFinding(f.id, d);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't update");
    } finally {
      setBusy(null);
    }
  };

  const items = useMemo(() => (data?.items || []).filter((f) => engine === "all" || f.engine === engine), [data, engine]);
  const s = data?.summary;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2"><Brain className="w-6 h-6 text-blue-600" /> Qilbo brain</h1>
          <p className="text-sm text-slate-500 mt-1">
            What last night's checks found in your prices, invoices and stock.
            {data?.last_run ? ` Last check: ${data.last_run.started_at.replace(" ", " at ")} UTC.` : ""}
          </p>
        </div>
        <button onClick={runNow} disabled={running}
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
          <RefreshCw className={`w-4 h-4 ${running ? "animate-spin" : ""}`} /> {running ? "Checking…" : "Check now"}
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="To fix" value={String(s?.open ?? "—")} sub="open findings" />
        <Stat label="Money at stake" value={money(s?.value_open)} sub="estimated per month" />
        <Stat label="You approved" value={String(s?.approved ?? "—")} sub="waiting for proof" />
        <Stat label="Verified fixes" value={String(s?.verified ?? "—")} sub={s?.value_verified ? `${money(s.value_verified)} a month back` : "proved by sales data"} good />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-xl border border-slate-200 dark:border-slate-700 p-1 bg-white dark:bg-slate-900">
          {(["todo", "done"] as const).map((v) => (
            <button key={v} onClick={() => setView(v)}
              className={`px-3 py-1.5 text-sm font-semibold rounded-lg ${view === v ? "bg-blue-600 text-white" : "text-slate-600 dark:text-slate-300"}`}>
              {v === "todo" ? "To fix" : "Done & skipped"}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {ENGINES.map((e) => {
            const Icon = e.icon;
            const n = e.id === "all" ? data?.items.length : data?.items.filter((f) => f.engine === e.id).length;
            return (
              <button key={e.id} onClick={() => setEngine(e.id)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold ${engine === e.id ? "border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300" : "border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300"}`}>
                <Icon className="w-3.5 h-3.5" /> {e.label} {n != null ? <span className="opacity-70">{n}</span> : null}
              </button>
            );
          })}
        </div>
      </div>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {loading && !data ? (
        <div className="text-sm text-slate-500 flex items-center gap-2"><RefreshCw className="w-4 h-4 animate-spin" /> Loading findings…</div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-10 text-center text-slate-500">
          <ShieldCheck className="w-8 h-8 mx-auto text-emerald-500 mb-2" />
          {view === "todo" ? "Nothing to fix here. Qilbo checks again tonight." : "Nothing finished yet. Approved fixes show here once the sales data proves them."}
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((f) => (
            <li key={f.id} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${SEV[f.severity]?.cls || SEV[3].cls}`}>{SEV[f.severity]?.label || "Note"}</span>
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{ENGINES.find((e) => e.id === f.engine)?.label || f.engine}</span>
                    {f.status !== "open" && <StatusPill status={f.status} />}
                  </div>
                  <h3 className="font-semibold text-slate-900 dark:text-white">{f.title}</h3>
                  {f.detail && <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">{f.detail}</p>}
                  {f.action && <p className="text-sm mt-2"><span className="font-semibold text-blue-700 dark:text-blue-300">Suggested: </span>{f.action}</p>}
                </div>
                <div className="text-right shrink-0">
                  {f.value > 0 && <div className="text-lg font-bold text-slate-900 dark:text-white tabular-nums">{money(f.value)}</div>}
                  {f.value > 0 && <div className="text-[11px] text-slate-400">at stake / month</div>}
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                {f.status === "open" && (
                  <>
                    <button disabled={busy === f.id} onClick={() => decide(f, "approve")}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
                      <CheckCircle2 className="w-4 h-4" /> Approve
                    </button>
                    <button disabled={busy === f.id} onClick={() => decide(f, "skip")}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-sm font-semibold text-slate-600 dark:text-slate-300 disabled:opacity-60">
                      <SkipForward className="w-4 h-4" /> Skip
                    </button>
                  </>
                )}
                {(f.status === "approved" || f.status === "skipped") && (
                  <button disabled={busy === f.id} onClick={() => decide(f, "reopen")}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-sm font-semibold text-slate-600 dark:text-slate-300 disabled:opacity-60">
                    <RotateCcw className="w-4 h-4" /> Undo
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Stat({ label, value, sub, good }: { label: string; value: string; sub: string; good?: boolean }) {
  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
      <div className="text-xs font-semibold text-slate-500">{label}</div>
      <div className={`text-2xl font-bold mt-1 tabular-nums ${good ? "text-emerald-600" : "text-slate-900 dark:text-white"}`}>{value}</div>
      <div className="text-[11px] text-slate-400 mt-0.5">{sub}</div>
    </div>
  );
}

function StatusPill({ status }: { status: BrainFinding["status"] }) {
  const map: Record<string, string> = {
    approved: "bg-blue-50 text-blue-700 border-blue-200",
    verified: "bg-emerald-50 text-emerald-700 border-emerald-200",
    skipped: "bg-slate-50 text-slate-500 border-slate-200",
    cleared: "bg-slate-50 text-slate-500 border-slate-200",
  };
  const text: Record<string, string> = { approved: "Approved · checking", verified: "Verified fixed", skipped: "Skipped", cleared: "Cleared on its own" };
  return <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${map[status] || ""}`}>{text[status] || status}</span>;
}

import { useState, useEffect } from "react";
import {
  Copy,
  Check,
  AlertTriangle,
  RefreshCw,
  Truck,
  Plus,
  Minus,
  Trash2,
  Download,
  Printer,
  History,
  CheckCircle2,
  ShoppingBag,
} from "lucide-react";
import type { ApiPurchaseOrder } from "../../types";
import { api } from "../../lib/api";
import { getDistributorBadge } from "../../lib/colors";

export default function OrdersTab() {
  const [draftPOs, setDraftPOs] = useState<ApiPurchaseOrder[]>([]);
  const [poHistory, setPoHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDistributor, setSelectedDistributor] = useState<string>("all");
  const [copiedDist, setCopiedDist] = useState<string | null>(null);
  const [orderedToast, setOrderedToast] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [drafts, hist] = await Promise.all([
        api.getDraftPOs(),
        api.getPOHistory(20),
      ]);
      setDraftPOs(drafts);
      setPoHistory(hist);
    } catch (err) {
      console.error("Failed to load POs:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  // Update cases in line
  const handleUpdateCases = async (lineId: number, currentCases: number, delta: number) => {
    const newCases = Math.max(0, currentCases + delta);
    try {
      const updated = await api.updatePOLine(lineId, newCases);
      setDraftPOs(updated);
    } catch (err) {
      console.error("Failed to update cases:", err);
    }
  };

  // Direct case input change
  const handleSetCases = async (lineId: number, value: number) => {
    if (isNaN(value) || value < 0) return;
    try {
      const updated = await api.updatePOLine(lineId, value);
      setDraftPOs(updated);
    } catch (err) {
      console.error("Failed to update cases:", err);
    }
  };

  // Remove line from PO
  const handleRemoveLine = async (lineId: number) => {
    try {
      const updated = await api.removePOLine({ lineId });
      setDraftPOs(updated);
    } catch (err) {
      console.error("Failed to remove line:", err);
    }
  };

  // Add all REORDER items for distributor
  const handleAddAllReorder = async (distributor: string) => {
    setActionLoading(`reorder-${distributor}`);
    try {
      const updated = await api.addAllReorderToPO(distributor);
      setDraftPOs(updated);
    } catch (err) {
      console.error("Failed to add reorder items:", err);
    } finally {
      setActionLoading(null);
    }
  };

  // Clear PO
  const handleClearPO = async (distributor: string) => {
    if (!confirm(`Are you sure you want to clear the draft PO for ${distributor}?`)) return;
    setActionLoading(`clear-${distributor}`);
    try {
      const updated = await api.clearPO(distributor);
      setDraftPOs(updated);
    } catch (err) {
      console.error("Failed to clear PO:", err);
    } finally {
      setActionLoading(null);
    }
  };

  // Mark PO as ordered
  const handleMarkOrdered = async (distributor: string) => {
    setActionLoading(`order-${distributor}`);
    try {
      const res = await api.markPOOrdered(undefined, distributor);
      setDraftPOs(res.drafts);
      const hist = await api.getPOHistory(20);
      setPoHistory(hist);
      setOrderedToast(`✓ Draft PO for ${distributor} marked as ORDERED and saved in history. Stock will update when invoice arrives.`);
      setTimeout(() => setOrderedToast(null), 5000);
    } catch (err) {
      console.error("Failed to mark PO as ordered:", err);
    } finally {
      setActionLoading(null);
    }
  };

  // Copy PO as text for Rep
  const handleCopyRepText = (po: ApiPurchaseOrder) => {
    const lines = [
      `Discount Liquor – Purchase Order`,
      `Distributor: ${po.distributor}`,
      `Date: ${new Date().toLocaleDateString()}`,
      `Total: ${po.total_cases} cases ($${po.total_cost.toFixed(2)})`,
      ``,
      `Items to order:`,
      ...po.items.map((it) => `• ${it.cases} cs × ${it.name} ${it.size || ""}`),
      ``,
      `Please confirm receipt. Thank you!`,
    ];
    navigator.clipboard.writeText(lines.join("\n"));
    setCopiedDist(po.distributor);
    setTimeout(() => setCopiedDist(null), 2500);
  };

  // Download CSV
  const handleDownloadCsv = (po: ApiPurchaseOrder) => {
    const headers = ["Product", "Size", "Cases", "Case Size", "Case Cost", "Line Total"];
    const rows = po.items.map((it) => [
      `"${it.name.replace(/"/g, '""')}"`,
      `"${it.size || ""}"`,
      it.cases,
      it.case_size,
      it.case_cost.toFixed(2),
      it.line_total.toFixed(2),
    ]);
    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `PO_${po.distributor.replace(/[^a-z0-9]/gi, "_")}_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Download / Print PDF
  const handleDownloadPdf = (po: ApiPurchaseOrder) => {
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
      <!doctype html>
      <html>
      <head>
        <title>Purchase Order - ${po.distributor}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 40px; color: #1e293b; }
          .header { border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: flex-start; }
          h1 { margin: 0; font-size: 24px; color: #0f172a; }
          .sub { color: #64748b; font-size: 14px; margin-top: 4px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 14px; }
          th { text-align: left; padding: 10px; border-bottom: 2px solid #cbd5e1; font-weight: 700; color: #475569; }
          td { padding: 10px; border-bottom: 1px solid #e2e8f0; }
          .num { text-align: right; }
          .total-box { margin-top: 30px; text-align: right; font-size: 16px; font-weight: bold; }
          .note { margin-top: 40px; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 12px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1>Purchase Order (Draft)</h1>
            <div class="sub">Discount Liquor • 2105 E Orange Ave, Eustis FL</div>
            <div class="sub">Distributor: <b>${po.distributor}</b></div>
          </div>
          <div style="text-align: right;">
            <div class="sub">Date: ${new Date().toLocaleDateString()}</div>
            <div class="sub">Status: Draft</div>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Product Description</th>
              <th>Size</th>
              <th class="num">Case Size</th>
              <th class="num">Cases</th>
              <th class="num">Case Cost</th>
              <th class="num">Line Total</th>
            </tr>
          </thead>
          <tbody>
            ${po.items
              .map(
                (it) => `
              <tr>
                <td><b>${it.name}</b></td>
                <td>${it.size || "–"}</td>
                <td class="num">${it.case_size}</td>
                <td class="num"><b>${it.cases}</b></td>
                <td class="num">$${it.case_cost.toFixed(2)}</td>
                <td class="num"><b>$${it.line_total.toFixed(2)}</b></td>
              </tr>
            `
              )
              .join("")}
          </tbody>
        </table>
        <div class="total-box">
          <div>Total Cases: ${po.total_cases}</div>
          <div style="font-size: 20px; margin-top: 6px; color: #059669;">Total Cost: $${po.total_cost.toFixed(2)}</div>
        </div>
        <div class="note">Generated from Discount Liquor Inventory System. For ordering purposes only. Draft only, never automatically submitted.</div>
        <script>
          window.onload = function() { window.print(); };
        </script>
      </body>
      </html>
    `);
    win.document.close();
  };

  const grandTotalCases = draftPOs.reduce((acc, o) => acc + o.total_cases, 0);
  const grandTotalCost = draftPOs.reduce((acc, o) => acc + o.total_cost, 0);
  const activeDraftsCount = draftPOs.filter((o) => o.items && o.items.length > 0).length;

  const filteredPOs = draftPOs.filter((o) => {
    if (selectedDistributor === "all") return true;
    return o.distributor.toLowerCase().includes(selectedDistributor.toLowerCase());
  });

  return (
    <div className="space-y-6">
      {/* Toast Banner */}
      {orderedToast && (
        <div className="bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 px-4 py-3 rounded-2xl flex items-center gap-2 text-xs sm:text-sm font-semibold shadow-sm animate-fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{orderedToast}</span>
        </div>
      )}

      {/* Top Header Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-6 rounded-2xl shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 flex items-center justify-center font-bold shadow-sm">
              <Truck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                Draft Purchase Orders (PO)
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                Draft only • <b>NEVER auto-submitted</b> • Stock updates strictly when invoice arrives
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 shadow-sm ${
                showHistory
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100"
              }`}
            >
              <History className="w-4 h-4" />
              <span>PO History ({poHistory.length})</span>
            </button>

            <button
              onClick={loadAll}
              title="Refresh purchase orders"
              className="p-2 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-600 dark:text-slate-300 transition shadow-sm"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-blue-600" : ""}`} />
            </button>
          </div>
        </div>

        {/* Global Summary Statistics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
          <div>
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Total Draft Cases
            </span>
            <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
              {grandTotalCases} cases
            </div>
          </div>
          <div>
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Total Draft Cost
            </span>
            <div className="text-2xl font-black text-emerald-600 mt-1">
              ${grandTotalCost.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div>
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Active Draft POs
            </span>
            <div className="text-base font-bold text-slate-800 dark:text-slate-200 mt-1">
              {draftPOs.filter((o) => o.items.length > 0).length} of {draftPOs.length} distributors
            </div>
          </div>
          <div>
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Ordering Policy
            </span>
            <div className="text-xs font-semibold text-slate-500 mt-1">
              Minimums checked live
            </div>
          </div>
        </div>

        {/* Distributor Filter Chips */}
        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
          <button
            onClick={() => setSelectedDistributor("all")}
            className={`px-3 py-1 rounded-xl text-xs font-bold transition ${
              selectedDistributor === "all"
                ? "bg-slate-900 text-white"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
            }`}
          >
            All Drafts ({activeDraftsCount})
          </button>
          {draftPOs.map((d) => {
            const badge = getDistributorBadge(d.distributor);
            const isSelected = selectedDistributor.toLowerCase() === d.distributor.toLowerCase();
            return (
              <button
                key={d.distributor}
                onClick={() => setSelectedDistributor(d.distributor)}
                className={`px-3 py-1 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 ${
                  isSelected
                    ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                    : `${badge.bg} ${badge.text} ${badge.border} hover:opacity-80`
                }`}
              >
                <span>{badge.label}</span>
                <span className="text-[10px] opacity-80 font-mono">({d.items.length})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* PO HISTORY VIEW (When toggled) */}
      {showHistory && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <History className="w-5 h-5 text-blue-600" />
              <span>Purchase Order History (Previously Marked Ordered)</span>
            </h3>
            <span className="text-xs text-slate-400">Record only • Stock is adjusted on invoice post</span>
          </div>

          {poHistory.length === 0 ? (
            <p className="text-xs text-slate-400 italic py-4">No previously ordered purchase orders yet.</p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {poHistory.map((hist) => (
                <div key={hist.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <div>
                    <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <span>{hist.distributor}</span>
                      <span className="text-[10px] bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-500 font-mono">
                        PO #{hist.id}
                      </span>
                      <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded font-bold">
                        Ordered
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      Ordered at: {hist.ordered_at || hist.created_at || "–"} • {hist.lines?.length || 0} line items
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-black text-sm text-slate-900 dark:text-white">
                      ${Number(hist.total_cost || 0).toFixed(2)}
                    </span>
                    <span className="text-[11px] text-slate-400 ml-1 font-bold">
                      ({hist.total_cases || 0} cases)
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* DISTRIBUTOR DRAFT PO CARDS */}
      <div className="space-y-6">
        {filteredPOs.map((po) => {
          const badge = getDistributorBadge(po.distributor);
          const hasItems = po.items.length > 0;
          const isCopied = copiedDist === po.distributor;

          return (
            <div
              key={po.distributor}
              className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm"
            >
              {/* Card Header */}
              <div className="p-5 bg-slate-50/70 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span
                      className={`text-xs font-extrabold px-3 py-1 rounded-lg border ${badge.bg} ${badge.text} ${badge.border}`}
                    >
                      {badge.label}
                    </span>

                    {/* Minimum Check Status */}
                    <span
                      className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                        po.meets_minimum
                          ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                          : "bg-red-100 text-red-800 border border-red-200"
                      }`}
                    >
                      {po.meets_minimum ? "✓ Meets Minimum" : "Below Minimum"} ({po.minimum_text})
                    </span>
                  </div>

                  {po.fee_warning && (
                    <div className="text-xs text-amber-600 dark:text-amber-400 mt-1.5 flex items-center gap-1 font-semibold">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>{po.fee_warning}</span>
                    </div>
                  )}
                </div>

                {/* Totals & Status */}
                <div className="flex items-center gap-4 self-start md:self-auto">
                  <div className="text-right">
                    <div className="text-lg font-black text-slate-900 dark:text-white">
                      ${po.total_cost.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </div>
                    <div className="text-xs font-bold text-slate-400">
                      {po.total_cases} cases ({po.items.length} items)
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Toolbar */}
              <div className="px-5 py-3 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  {/* Add All REORDER items button */}
                  <button
                    onClick={() => handleAddAllReorder(po.distributor)}
                    disabled={actionLoading === `reorder-${po.distributor}`}
                    className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-2xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add all REORDER items</span>
                  </button>

                  {/* Copy Rep Text */}
                  {hasItems && (
                    <button
                      onClick={() => handleCopyRepText(po)}
                      className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
                    >
                      {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{isCopied ? "Copied!" : "Copy as text"}</span>
                    </button>
                  )}

                  {/* Download CSV */}
                  {hasItems && (
                    <button
                      onClick={() => handleDownloadCsv(po)}
                      className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>CSV</span>
                    </button>
                  )}

                  {/* Download PDF */}
                  {hasItems && (
                    <button
                      onClick={() => handleDownloadPdf(po)}
                      className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Print / PDF</span>
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {/* Clear PO */}
                  {hasItems && (
                    <button
                      onClick={() => handleClearPO(po.distributor)}
                      disabled={actionLoading === `clear-${po.distributor}`}
                      className="px-3 py-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl text-xs font-bold transition flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Clear PO</span>
                    </button>
                  )}

                  {/* Mark as Ordered */}
                  {hasItems && (
                    <button
                      onClick={() => handleMarkOrdered(po.distributor)}
                      disabled={actionLoading === `order-${po.distributor}`}
                      className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-sm"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Mark as ordered</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Draft Items List */}
              {hasItems ? (
                <>
                  {/* Mobile Cards (< 640px) */}
                  <div className="sm:hidden divide-y divide-slate-100 dark:divide-slate-800 p-3 space-y-2">
                    {po.items.map((it) => (
                      <div
                        key={it.id}
                        className="bg-slate-50/70 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-200/60 dark:border-slate-800 space-y-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="font-extrabold text-slate-900 dark:text-white text-xs truncate">
                              {it.name}
                            </div>
                            <div className="text-[11px] text-slate-400 mt-0.5">
                              {it.size || "unit"} • {it.case_size}/cs • ${it.case_cost.toFixed(2)}/cs
                            </div>
                          </div>
                          <button
                            onClick={() => handleRemoveLine(it.id)}
                            className="text-slate-400 hover:text-red-600 p-1 rounded"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Controls & Line Total */}
                        <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800">
                          {/* Case controls */}
                          <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-0.5">
                            <button
                              onClick={() => handleUpdateCases(it.id, it.cases, -1)}
                              className="w-6 h-6 flex items-center justify-center text-slate-500 hover:text-slate-900 rounded"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="font-extrabold text-xs px-1 text-slate-900 dark:text-white min-w-[24px] text-center">
                              {it.cases} cs
                            </span>
                            <button
                              onClick={() => handleUpdateCases(it.id, it.cases, 1)}
                              className="w-6 h-6 flex items-center justify-center text-slate-500 hover:text-slate-900 rounded"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>

                          <div className="text-right">
                            <span className="font-black text-sm text-slate-900 dark:text-white">
                              ${it.line_total.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Desktop Table (>= 640px) */}
                  <div className="hidden sm:block overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
                      <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-400 uppercase font-bold border-b border-slate-100 dark:border-slate-800">
                        <tr>
                          <th className="py-3 px-5">Product</th>
                          <th className="py-3 px-3 text-center">Case Size</th>
                          <th className="py-3 px-4 text-center font-bold text-blue-600">Cases to Order</th>
                          <th className="py-3 px-4 text-right">Cost / Case</th>
                          <th className="py-3 px-5 text-right font-black">Line Total</th>
                          <th className="py-3 px-3 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {po.items.map((it) => (
                          <tr
                            key={it.id}
                            className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition"
                          >
                            <td className="py-3 px-5">
                              <div className="font-bold text-slate-900 dark:text-white text-sm">
                                {it.name}
                              </div>
                              <div className="text-[11px] text-slate-400 mt-0.5">
                                {it.size || "unit"} {it.brand ? `• ${it.brand}` : ""}
                              </div>
                            </td>
                            <td className="py-3 px-3 text-center font-mono text-slate-500">
                              {it.case_size} btls
                            </td>
                            <td className="py-3 px-4 text-center">
                              <div className="inline-flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-1">
                                <button
                                  onClick={() => handleUpdateCases(it.id, it.cases, -1)}
                                  className="w-6 h-6 flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white rounded"
                                >
                                  <Minus className="w-3 h-3" />
                                </button>
                                <input
                                  type="number"
                                  min={0}
                                  value={it.cases}
                                  onChange={(e) => handleSetCases(it.id, Number(e.target.value))}
                                  className="w-12 text-center font-black text-xs text-blue-600 bg-transparent focus:outline-none"
                                />
                                <button
                                  onClick={() => handleUpdateCases(it.id, it.cases, 1)}
                                  className="w-6 h-6 flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white rounded"
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-right font-mono text-slate-600 dark:text-slate-400">
                              ${it.case_cost.toFixed(2)}
                            </td>
                            <td className="py-3 px-5 text-right font-mono font-black text-slate-900 dark:text-white text-sm">
                              ${it.line_total.toFixed(2)}
                            </td>
                            <td className="py-3 px-3 text-center">
                              <button
                                onClick={() => handleRemoveLine(it.id)}
                                className="text-slate-400 hover:text-red-600 p-1.5 rounded transition"
                                title="Remove line"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <div className="p-8 text-center text-slate-400 text-xs">
                  <ShoppingBag className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                  <p className="font-semibold text-slate-600 dark:text-slate-400">
                    No items in {po.distributor} draft PO.
                  </p>
                  <p className="mt-1">
                    Tap <span className="font-bold text-amber-600">"Add all REORDER items"</span> above or use{" "}
                    <span className="font-bold text-blue-600">"Add to PO"</span> on any product in Inventory.
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

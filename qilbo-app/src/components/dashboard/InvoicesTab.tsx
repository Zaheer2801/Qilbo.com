import { useState, useEffect } from "react";
import {
  UploadCloud,
  CheckCircle2,
  XCircle,
  RefreshCw,
  AlertCircle,
  ChevronRight,
  Receipt,
} from "lucide-react";
import type { ApiInvoice, ApiInvoiceLine } from "../../types";
import { api } from "../../lib/api";
import { getDistributorBadge } from "../../lib/colors";

export default function InvoicesTab() {
  const [invoices, setInvoices] = useState<ApiInvoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<number | null>(null);
  const [invoiceDetail, setInvoiceDetail] = useState<{ invoice: ApiInvoice; lines: ApiInvoiceLine[] } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const [processingAction, setProcessingAction] = useState<number | null>(null);

  const loadInvoices = async () => {
    setLoading(true);
    try {
      const data = await api.getInvoices();
      setInvoices(data);
    } catch (err) {
      console.error("Failed to load invoices:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInvoices();
  }, []);

  const loadDetail = async (id: number) => {
    try {
      const data = await api.getInvoice(id);
      setInvoiceDetail(data);
      setSelectedInvoiceId(id);
    } catch (err) {
      console.error("Failed to load invoice detail:", err);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadMsg("Reading invoice with Gemini AI & calculating units... (10s)");
    try {
      const res = await api.uploadFile(file);
      setUploadMsg(`Document uploaded successfully! Staged as ${res.distributor || "invoice"} #${res.invoice_no || ""}.`);
      await loadInvoices();
      if (res.id) loadDetail(res.id);
    } catch (err: any) {
      setUploadMsg(`Upload failed: ${err.message}`);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handlePostInvoice = async (id: number) => {
    setProcessingAction(id);
    try {
      const res = await api.postInvoice(id);
      setUploadMsg(`Invoice approved! Added ${res.lines} line items to stock ledger.`);
      await loadInvoices();
      if (selectedInvoiceId === id) loadDetail(id);
    } catch (err: any) {
      setUploadMsg(`Error saving invoice: ${err.message}`);
    } finally {
      setProcessingAction(null);
    }
  };

  const handleDiscardInvoice = async (id: number) => {
    if (!window.confirm("Are you sure you want to discard this pending invoice? Nothing will be saved.")) return;
    setProcessingAction(id);
    try {
      await api.discardInvoice(id);
      setUploadMsg("Invoice discarded.");
      setSelectedInvoiceId(null);
      setInvoiceDetail(null);
      await loadInvoices();
    } catch (err: any) {
      setUploadMsg(`Error discarding invoice: ${err.message}`);
    } finally {
      setProcessingAction(null);
    }
  };

  const pending = invoices.filter((i) => i.status === "pending");
  const posted = invoices.filter((i) => i.status === "posted");

  return (
    <div className="space-y-6">
      {/* Header & Upload Box */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-6 rounded-2xl shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 flex items-center justify-center font-bold shadow-sm">
              <Receipt className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                Distributor Invoices & Document Staging
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                Upload invoices (PDF or photo) • Staged for review with Save / Discard approval
              </p>
            </div>
          </div>
          <button
            onClick={loadInvoices}
            className="p-2.5 self-start sm:self-auto bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-600 dark:text-slate-300 transition shadow-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-blue-600" : ""}`} />
          </button>
        </div>

        {/* Drag & Drop Upload Input */}
        <label className="border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-blue-500 rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer bg-slate-50/50 hover:bg-blue-50/30 transition group">
          <UploadCloud className="w-10 h-10 text-slate-400 group-hover:text-blue-600 mb-2 transition" />
          <div className="text-sm font-bold text-slate-800 dark:text-slate-200">
            {uploading ? "Extracting line items with Gemini AI..." : "Click or drag to upload invoice PDF, photo, or sales CSV"}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            Wayne Densch, Southern Glazer's, Breakthru, Gold Coast, or NRS daily CSV
          </div>
          <input
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.csv"
            onChange={handleFileUpload}
            disabled={uploading}
            className="hidden"
          />
        </label>

        {uploadMsg && (
          <div className="p-3.5 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-xl text-xs text-blue-800 dark:text-blue-300 font-semibold">
            {uploadMsg}
          </div>
        )}
      </div>

      {/* Pending Invoices (Always Ask Before Saving) */}
      {pending.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 p-6 rounded-2xl space-y-4 shadow-sm">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 text-amber-600" />
            <h3 className="text-sm font-extrabold text-amber-900 dark:text-amber-200">
              Pending Invoices ({pending.length}) – Review Required Before Saving
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pending.map((inv) => {
              const badge = getDistributorBadge(inv.distributor);
              return (
                <div
                  key={inv.id}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4 shadow-sm"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded border ${badge.bg} ${badge.text} ${badge.border}`}>
                          {badge.label}
                        </span>
                        <span className="font-mono text-xs text-slate-400">#{inv.invoice_no}</span>
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        Delivered: {inv.invoice_date || "No date recorded"}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-black text-slate-900 dark:text-white">
                        ${inv.total?.toFixed(2) || "0.00"}
                      </div>
                      <span className="text-[10px] bg-amber-100 text-amber-900 font-bold px-2 py-0.5 rounded-full">
                        PENDING
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <button
                      onClick={() => loadDetail(inv.id)}
                      className="flex-1 py-2 px-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition"
                    >
                      View {inv.line_count || 0} Lines
                    </button>
                    <button
                      onClick={() => handlePostInvoice(inv.id)}
                      disabled={processingAction === inv.id}
                      className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition shadow-sm"
                    >
                      <CheckCircle2 className="w-4 h-4" /> Save to Stock
                    </button>
                    <button
                      onClick={() => handleDiscardInvoice(inv.id)}
                      disabled={processingAction === inv.id}
                      className="py-2 px-3 bg-slate-100 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-xl text-xs font-bold transition"
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Selected Invoice Breakdown Modal/Card */}
      {invoiceDetail && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 space-y-4 shadow-sm">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base text-slate-900 dark:text-white">{invoiceDetail.invoice.distributor}</span>
                <span className="font-mono text-xs text-slate-400">#{invoiceDetail.invoice.invoice_no}</span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Delivered: {invoiceDetail.invoice.invoice_date || "N/A"} • Total: ${invoiceDetail.invoice.total?.toFixed(2)}
              </p>
            </div>

            <div className="flex items-center gap-2">
              {invoiceDetail.invoice.status === "pending" && (
                <>
                  <button
                    onClick={() => handlePostInvoice(invoiceDetail.invoice.id)}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm"
                  >
                    <CheckCircle2 className="w-4 h-4" /> Save to Inventory
                  </button>
                  <button
                    onClick={() => handleDiscardInvoice(invoiceDetail.invoice.id)}
                    className="px-4 py-2 bg-slate-100 hover:bg-red-50 text-red-600 rounded-xl text-xs font-bold"
                  >
                    Discard
                  </button>
                </>
              )}
              <button
                onClick={() => setInvoiceDetail(null)}
                className="text-slate-400 hover:text-slate-700 text-xs px-2.5 py-1.5"
              >
                Close
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
              <thead className="bg-slate-50 dark:bg-slate-800 text-slate-400 uppercase font-bold border-b border-slate-100 dark:border-slate-800">
                <tr>
                  <th className="py-2.5 px-4">Description</th>
                  <th className="py-2.5 px-4">Matched SKU</th>
                  <th className="py-2.5 px-4 text-right">Cases</th>
                  <th className="py-2.5 px-4 text-right font-black text-blue-600">Bottles/Units</th>
                  <th className="py-2.5 px-4 text-right">Unit Cost</th>
                  <th className="py-2.5 px-4 text-right font-black">Extended Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {invoiceDetail.lines.map((l, i) => (
                  <tr key={i} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                    <td className="py-2.5 px-4 font-bold text-slate-900 dark:text-white">{l.description}</td>
                    <td className="py-2.5 px-4 text-slate-600 dark:text-slate-300">
                      {l.clean_name || l.product_name || (
                        <span className="text-amber-600 font-bold">🆕 New Product</span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono text-slate-400">{l.cases || "–"}</td>
                    <td className="py-2.5 px-4 text-right font-mono font-black text-blue-600 text-sm">+{l.bottles}</td>
                    <td className="py-2.5 px-4 text-right font-mono text-slate-600">
                      ${l.unit_cost?.toFixed(2) || "–"}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono font-black text-slate-900 dark:text-white text-sm">
                      ${l.line_total?.toFixed(2) || (l.bottles * (l.unit_cost || 0)).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Historical Posted Invoices Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Historical Posted Invoices ({posted.length})</h3>
            <p className="text-xs text-slate-400 mt-0.5">Verified deliveries posted to store ledger</p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg">
            Active Stock Updates
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
            <thead className="bg-slate-50 dark:bg-slate-800 text-slate-400 uppercase font-bold border-b border-slate-100 dark:border-slate-800">
              <tr>
                <th className="py-3 px-5">Date</th>
                <th className="py-3 px-5">Distributor</th>
                <th className="py-3 px-5">Invoice #</th>
                <th className="py-3 px-5 text-center">Lines</th>
                <th className="py-3 px-5 text-right font-black">Total Amount</th>
                <th className="py-3 px-5 text-center">Status</th>
                <th className="py-3 px-5 text-center">View</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {posted.map((inv) => {
                const badge = getDistributorBadge(inv.distributor);
                return (
                  <tr
                    key={inv.id}
                    onClick={() => loadDetail(inv.id)}
                    className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 cursor-pointer transition"
                  >
                    <td className="py-3 px-5 text-slate-500 font-mono">{inv.invoice_date || "–"}</td>
                    <td className="py-3 px-5 font-bold text-slate-900 dark:text-white">
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded border ${badge.bg} ${badge.text} ${badge.border}`}>
                        {badge.label}
                      </span>
                    </td>
                    <td className="py-3 px-5 font-mono text-slate-600 dark:text-slate-300">{inv.invoice_no}</td>
                    <td className="py-3 px-5 text-center text-slate-500">{inv.line_count} lines</td>
                    <td className="py-3 px-5 text-right font-mono font-black text-slate-900 dark:text-white text-sm">
                      ${inv.total?.toLocaleString("en-US", { minimumFractionDigits: 2 }) || "–"}
                    </td>
                    <td className="py-3 px-5 text-center">
                      <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full font-bold">
                        POSTED
                      </span>
                    </td>
                    <td className="py-3 px-5 text-center text-slate-400 hover:text-blue-600">
                      <ChevronRight className="w-4 h-4 mx-auto" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect } from "react";
import {
  UploadCloud,
  CheckCircle2,
  XCircle,
  RefreshCw,
  AlertCircle,
  ChevronRight,
} from "lucide-react";
import type { ApiInvoice, ApiInvoiceLine } from "../../types";
import { api } from "../../lib/api";

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
    setUploadMsg("Reading document with Gemini AI & staging invoice... (30s)");
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
      {/* Top Header & Upload Area */}
      <div className="bg-stone-900 border border-stone-800 p-5 rounded-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-white">Distributor Invoices & Document Staging</h2>
            <p className="text-xs text-stone-400">
              Upload invoices (PDF or photo) • Staged for review with Save/Discard approval
            </p>
          </div>
          <button
            onClick={loadInvoices}
            className="p-2 self-start sm:self-auto bg-stone-800 hover:bg-stone-700 border border-stone-700 rounded-lg text-stone-300 transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Drag & Drop Upload Input */}
        <label className="border-2 border-dashed border-stone-700 hover:border-amber-500 rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer bg-stone-950/50 hover:bg-stone-800/30 transition group">
          <UploadCloud className="w-8 h-8 text-stone-500 group-hover:text-amber-400 mb-2 transition" />
          <div className="text-xs font-semibold text-stone-200">
            {uploading ? "Extracting line items..." : "Click to upload distributor invoice PDF, photo, or sales CSV"}
          </div>
          <div className="text-[11px] text-stone-400 mt-0.5">
            Southern Glazer's, Breakthru, Gold Coast, Wayne Densch, or NRS daily CSV
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
          <div className="p-3 bg-stone-950 border border-stone-800 rounded-xl text-xs text-amber-300 font-medium">
            {uploadMsg}
          </div>
        )}
      </div>

      {/* Pending Invoices (Always Ask Before Saving) */}
      {pending.length > 0 && (
        <div className="bg-amber-950/30 border border-amber-800/60 p-5 rounded-xl space-y-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-amber-400" />
            <h3 className="text-sm font-bold text-amber-200">
              Pending Invoices ({pending.length}) – Review Required Before Saving
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pending.map((inv) => (
              <div key={inv.id} className="bg-stone-900 border border-stone-800 rounded-xl p-4 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-semibold text-white text-sm">{inv.distributor}</div>
                    <div className="text-xs text-stone-400">
                      Invoice #{inv.invoice_no} • {inv.invoice_date || "No date"}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-base font-bold text-amber-400">
                      ${inv.total?.toFixed(2) || "0.00"}
                    </div>
                    <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full font-bold">
                      PENDING REVIEW
                    </span>
                  </div>
                </div>

                <div className="flex gap-2 pt-2 border-t border-stone-800">
                  <button
                    onClick={() => loadDetail(inv.id)}
                    className="flex-1 py-1.5 px-3 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-lg text-xs font-medium transition"
                  >
                    View {inv.line_count || 0} Lines
                  </button>
                  <button
                    onClick={() => handlePostInvoice(inv.id)}
                    disabled={processingAction === inv.id}
                    className="flex-1 py-1.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> Save to Stock
                  </button>
                  <button
                    onClick={() => handleDiscardInvoice(inv.id)}
                    disabled={processingAction === inv.id}
                    className="py-1.5 px-3 bg-stone-800 hover:bg-red-900/40 text-stone-400 hover:text-red-300 rounded-lg text-xs font-medium transition"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Selected Invoice Detail Breakdown */}
      {invoiceDetail && (
        <div className="bg-stone-900 border border-stone-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-stone-800">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>{invoiceDetail.invoice.distributor}</span>
                <span className="font-mono text-stone-400">#{invoiceDetail.invoice.invoice_no}</span>
              </h3>
              <p className="text-xs text-stone-400">
                Delivered: {invoiceDetail.invoice.invoice_date || "N/A"} • Total: ${invoiceDetail.invoice.total?.toFixed(2)}
              </p>
            </div>

            <div className="flex items-center gap-2">
              {invoiceDetail.invoice.status === "pending" && (
                <>
                  <button
                    onClick={() => handlePostInvoice(invoiceDetail.invoice.id)}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> Save to Inventory
                  </button>
                  <button
                    onClick={() => handleDiscardInvoice(invoiceDetail.invoice.id)}
                    className="px-3 py-1.5 bg-red-600/30 hover:bg-red-600/50 text-red-300 rounded-lg text-xs font-medium"
                  >
                    Discard
                  </button>
                </>
              )}
              <button
                onClick={() => setInvoiceDetail(null)}
                className="text-stone-400 hover:text-white text-xs px-2 py-1"
              >
                Close
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-stone-300">
              <thead className="bg-stone-950 text-stone-400 uppercase font-medium border-b border-stone-800">
                <tr>
                  <th className="py-2 px-3">Description</th>
                  <th className="py-2 px-3">Matched SKU</th>
                  <th className="py-2 px-3 text-right">Cases</th>
                  <th className="py-2 px-3 text-right">Bottles/Units</th>
                  <th className="py-2 px-3 text-right">Unit Cost</th>
                  <th className="py-2 px-3 text-right">Extended Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-800">
                {invoiceDetail.lines.map((l, i) => (
                  <tr key={i} className="hover:bg-stone-800/40">
                    <td className="py-2 px-3 font-medium text-white">{l.description}</td>
                    <td className="py-2 px-3 text-stone-300">
                      {l.clean_name || l.product_name || (
                        <span className="text-amber-400 italic">🆕 New Product</span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-right text-stone-400">{l.cases || "–"}</td>
                    <td className="py-2 px-3 text-right font-bold text-white">+{l.bottles}</td>
                    <td className="py-2 px-3 text-right text-stone-200">
                      ${l.unit_cost?.toFixed(2) || "–"}
                    </td>
                    <td className="py-2 px-3 text-right font-semibold text-amber-300">
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
      <div className="bg-stone-900 border border-stone-800 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-stone-800 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Historical Posted Invoices ({posted.length})</h3>
          <span className="text-xs text-stone-400">Active Stock Updates</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-stone-300">
            <thead className="bg-stone-950 text-stone-400 uppercase font-medium border-b border-stone-800">
              <tr>
                <th className="py-2.5 px-4">Date</th>
                <th className="py-2.5 px-4">Distributor</th>
                <th className="py-2.5 px-4">Invoice #</th>
                <th className="py-2.5 px-4 text-center">Lines</th>
                <th className="py-2.5 px-4 text-right">Total Amount</th>
                <th className="py-2.5 px-4 text-center">Status</th>
                <th className="py-2.5 px-4 text-center">View</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-800">
              {posted.map((inv) => (
                <tr
                  key={inv.id}
                  onClick={() => loadDetail(inv.id)}
                  className="hover:bg-stone-800/40 cursor-pointer transition"
                >
                  <td className="py-2.5 px-4 text-stone-400">{inv.invoice_date || "–"}</td>
                  <td className="py-2.5 px-4 font-semibold text-white">{inv.distributor}</td>
                  <td className="py-2.5 px-4 font-mono text-stone-300">{inv.invoice_no}</td>
                  <td className="py-2.5 px-4 text-center text-stone-400">{inv.line_count} lines</td>
                  <td className="py-2.5 px-4 text-right font-bold text-amber-300">
                    ${inv.total?.toLocaleString("en-US", { minimumFractionDigits: 2 }) || "–"}
                  </td>
                  <td className="py-2.5 px-4 text-center">
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-bold">
                      POSTED
                    </span>
                  </td>
                  <td className="py-2.5 px-4 text-center">
                    <ChevronRight className="w-4 h-4 text-stone-500 mx-auto" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

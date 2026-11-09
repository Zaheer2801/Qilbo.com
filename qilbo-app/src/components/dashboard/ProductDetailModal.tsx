import { useState, useEffect, type FormEvent } from "react";
import {
  X,
  Package,
  DollarSign,
  MinusCircle,
  RefreshCw,
  Ban,
} from "lucide-react";
import type { ApiLedgerDetail } from "../../types";
import { api } from "../../lib/api";

interface Props {
  productId: number;
  onClose: () => void;
  onStockUpdated: () => void;
}

export default function ProductDetailModal({ productId, onClose, onStockUpdated }: Props) {
  const [detail, setDetail] = useState<ApiLedgerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeAction, setActiveAction] = useState<"count" | "adjust" | "price" | null>(null);

  // Form states
  const [countInput, setCountInput] = useState("");
  const [countNote, setCountNote] = useState("");
  const [adjustDelta, setAdjustDelta] = useState("-1");
  const [adjustReason, setAdjustReason] = useState("broken");
  const [priceInput, setPriceInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const loadProduct = async () => {
    setLoading(true);
    try {
      const data = await api.getProduct(productId);
      setDetail(data);
      if (data.product.price != null) {
        setPriceInput(String(data.product.price));
      }
    } catch (err) {
      console.error("Failed to load product ledger:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProduct();
  }, [productId]);

  const handleSaveCount = async (e: FormEvent) => {
    e.preventDefault();
    const qty = Number(countInput);
    if (isNaN(qty)) return;
    setSaving(true);
    try {
      const res = await api.setCount(productId, qty, countNote || "dashboard count");
      setStatusMsg(`Shelf count saved! Stock updated to ${res.after}`);
      setActiveAction(null);
      await loadProduct();
      onStockUpdated();
    } catch (err: any) {
      setStatusMsg(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAdjust = async (e: FormEvent) => {
    e.preventDefault();
    const delta = Number(adjustDelta);
    if (isNaN(delta) || delta === 0) return;
    setSaving(true);
    try {
      const res = await api.adjustStock(productId, delta, adjustReason || "dashboard adjustment");
      setStatusMsg(`Stock adjusted! Now ${res.on_hand} on hand`);
      setActiveAction(null);
      await loadProduct();
      onStockUpdated();
    } catch (err: any) {
      setStatusMsg(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleSavePrice = async (e: FormEvent) => {
    e.preventDefault();
    const price = Number(priceInput);
    if (isNaN(price)) return;
    setSaving(true);
    try {
      await api.setPrice(productId, price, detail?.product.cost);
      setStatusMsg(`Price updated to $${price.toFixed(2)} (manual)`);
      setActiveAction(null);
      await loadProduct();
      onStockUpdated();
    } catch (err: any) {
      setStatusMsg(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleNoReorder = async () => {
    if (!detail) return;
    setSaving(true);
    try {
      const nextVal = !detail.product.do_not_reorder;
      await api.toggleNoReorder(productId, nextVal);
      setStatusMsg(nextVal ? "Flagged: Do Not Reorder (excluded from order suggestions)" : "Reorder restored");
      await loadProduct();
      onStockUpdated();
    } catch (err: any) {
      setStatusMsg(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-stone-900 border border-stone-800 rounded-2xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-stone-800 flex items-start justify-between bg-stone-950">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white">
                {detail?.product.clean_name || detail?.product.name || "Product Audit & Ledger"}
              </h2>
              {detail?.product.size && (
                <span className="text-xs bg-stone-800 text-stone-300 px-2 py-0.5 rounded font-mono">
                  {detail.product.size}
                </span>
              )}
            </div>
            <p className="text-xs text-stone-400 mt-1">
              Distributor: {detail?.product.distributor || "Unknown"} • Category: {detail?.product.category || "Liquor"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-white hover:bg-stone-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1">
          {loading && !detail ? (
            <div className="flex flex-col items-center justify-center py-16 text-stone-400">
              <RefreshCw className="w-6 h-6 animate-spin text-amber-500 mb-2" />
              <p className="text-xs">Calculating ledger arithmetic...</p>
            </div>
          ) : detail ? (() => {
            const stock = detail.stock;
            const onHand = stock?.on_hand ?? null;
            const arithmetic = stock?.arithmetic ?? "No shelf count or delivery yet.";
            const basis = stock?.basis ?? "no invoice or shelf count yet";
            const deliveries = detail.recent_deliveries || [];
            const sales = detail.recent_sales_days || [];
            const counts = detail.counts || [];
            const adjustments = detail.adjustments || [];

            return (
            <>
              {statusMsg && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-300 font-medium">
                  {statusMsg}
                </div>
              )}

              {/* On Hand & Arithmetic Banner */}
              <div className="bg-stone-950 border border-stone-800 p-4 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs text-stone-400">Current Stock On Hand</div>
                    <div className="text-3xl font-extrabold text-white mt-0.5">
                      {onHand != null ? (
                        onHand
                      ) : (
                        <span className="text-stone-500 text-xl font-normal">Not Counted</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-stone-400">Pre-Tax Shelf Price</div>
                    <div className="text-xl font-bold text-amber-400">
                      {detail.product.display_price || "–"}
                    </div>
                    <div className="text-[10px] text-stone-400">
                      Source: {detail.product.price_source}
                    </div>
                    {detail.product.price_warning && (
                      <span className="inline-block mt-1 px-1.5 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded text-[10px] font-semibold">
                        ⚠ {detail.product.price_warning}
                      </span>
                    )}
                  </div>
                </div>

                {/* Arithmetic Breakdown */}
                <div className="pt-3 border-t border-stone-800 text-xs">
                  <div className="text-stone-400 font-medium mb-1">Ledger Arithmetic Formula:</div>
                  <div className="font-mono text-amber-200 bg-stone-900 p-2.5 rounded-lg border border-stone-800 break-words">
                    {arithmetic}
                  </div>
                  <div className="text-stone-400 text-[11px] mt-1.5 italic">
                    Basis: {basis}
                  </div>
                </div>
              </div>

              {/* Quick Actions Row */}
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setActiveAction(activeAction === "count" ? null : "count")}
                  className="px-3 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
                >
                  <Package className="w-3.5 h-3.5" /> /count Shelf Count
                </button>
                <button
                  onClick={() => setActiveAction(activeAction === "adjust" ? null : "adjust")}
                  className="px-3 py-2 bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
                >
                  <MinusCircle className="w-3.5 h-3.5 text-red-400" /> /adjust (Breakage / Found)
                </button>
                <button
                  onClick={() => setActiveAction(activeAction === "price" ? null : "price")}
                  className="px-3 py-2 bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
                >
                  <DollarSign className="w-3.5 h-3.5 text-amber-400" /> /price (Manual Override)
                </button>
                <button
                  type="button"
                  onClick={handleToggleNoReorder}
                  className={`px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition border ${
                    detail.product.do_not_reorder
                      ? "bg-red-950/60 text-red-300 border-red-700/60"
                      : "bg-stone-800 hover:bg-stone-700 text-stone-200 border-stone-700"
                  }`}
                >
                  <Ban className="w-3.5 h-3.5 text-red-400" />
                  {detail.product.do_not_reorder ? "Do Not Reorder (Active)" : "Do Not Reorder"}
                </button>
              </div>

              {/* Inline Action Forms */}
              {activeAction === "count" && (
                <form onSubmit={handleSaveCount} className="p-4 bg-stone-950 border border-amber-600/40 rounded-xl space-y-3">
                  <h4 className="text-xs font-bold text-amber-300">Record Physical Shelf Count</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] text-stone-400 block mb-1">Bottles physically on shelf right now</label>
                      <input
                        type="number"
                        step="1"
                        placeholder="e.g. 4"
                        value={countInput}
                        onChange={(e) => setCountInput(e.target.value)}
                        required
                        className="w-full bg-stone-900 border border-stone-700 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-amber-500"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-stone-400 block mb-1">Optional Note</label>
                      <input
                        type="text"
                        placeholder="e.g. front display + backroom"
                        value={countNote}
                        onChange={(e) => setCountNote(e.target.value)}
                        className="w-full bg-stone-900 border border-stone-700 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setActiveAction(null)}
                      className="px-3 py-1.5 text-xs text-stone-400 hover:text-white"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={saving}
                      className="px-4 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-semibold"
                    >
                      {saving ? "Saving..." : "Save Count"}
                    </button>
                  </div>
                </form>
              )}

              {activeAction === "adjust" && (
                <form onSubmit={handleSaveAdjust} className="p-4 bg-stone-950 border border-stone-700 rounded-xl space-y-3">
                  <h4 className="text-xs font-bold text-white">Adjust Stock (Breakage, Giveaway, Found)</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] text-stone-400 block mb-1">Bottle Delta (+/-)</label>
                      <input
                        type="number"
                        step="1"
                        placeholder="e.g. -1"
                        value={adjustDelta}
                        onChange={(e) => setAdjustDelta(e.target.value)}
                        required
                        className="w-full bg-stone-900 border border-stone-700 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-amber-500"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-stone-400 block mb-1">Reason</label>
                      <input
                        type="text"
                        placeholder="e.g. broken, dropped by customer"
                        value={adjustReason}
                        onChange={(e) => setAdjustReason(e.target.value)}
                        required
                        className="w-full bg-stone-900 border border-stone-700 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setActiveAction(null)}
                      className="px-3 py-1.5 text-xs text-stone-400 hover:text-white"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={saving}
                      className="px-4 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-semibold"
                    >
                      {saving ? "Saving..." : "Save Adjustment"}
                    </button>
                  </div>
                </form>
              )}

              {activeAction === "price" && (
                <form onSubmit={handleSavePrice} className="p-4 bg-stone-950 border border-stone-700 rounded-xl space-y-3">
                  <h4 className="text-xs font-bold text-white">Set Shelf Price (Pre-Tax)</h4>
                  <div>
                    <label className="text-[11px] text-stone-400 block mb-1">
                      New Shelf Price ($ before 7% FL tax)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="e.g. 59.99"
                      value={priceInput}
                      onChange={(e) => setPriceInput(e.target.value)}
                      required
                      className="w-full bg-stone-900 border border-stone-700 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setActiveAction(null)}
                      className="px-3 py-1.5 text-xs text-stone-400 hover:text-white"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={saving}
                      className="px-4 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-semibold"
                    >
                      {saving ? "Saving..." : "Save Price (Manual)"}
                    </button>
                  </div>
                </form>
              )}

              {/* History Tables Tabs */}
              <div className="space-y-4">
                {/* Deliveries */}
                <div className="bg-stone-950 border border-stone-800 rounded-xl p-4">
                  <h4 className="text-xs font-semibold text-white mb-2 flex items-center justify-between">
                    <span>Deliveries Received ({deliveries.length})</span>
                    <span className="text-[11px] text-stone-500">From posted distributor invoices</span>
                  </h4>
                  {deliveries.length ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs text-stone-300">
                        <thead className="text-[10px] uppercase text-stone-500 border-b border-stone-800">
                          <tr>
                            <th className="py-1.5 px-2">Date</th>
                            <th className="py-1.5 px-2">Invoice #</th>
                            <th className="py-1.5 px-2">Distributor</th>
                            <th className="py-1.5 px-2 text-right">Units</th>
                            <th className="py-1.5 px-2 text-right">Unit Cost</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-800/60">
                          {deliveries.map((d, i) => (
                            <tr key={i}>
                              <td className="py-1.5 px-2 text-stone-400">{d.invoice_date}</td>
                              <td className="py-1.5 px-2 font-mono">{d.invoice_no}</td>
                              <td className="py-1.5 px-2 text-stone-300">{d.distributor}</td>
                              <td className="py-1.5 px-2 text-right font-bold text-emerald-400">+{d.bottles}</td>
                              <td className="py-1.5 px-2 text-right">${d.unit_cost?.toFixed(2) || "–"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-xs text-stone-500 italic">No distributor deliveries recorded yet.</p>
                  )}
                </div>

                {/* Daily Register Sales */}
                <div className="bg-stone-950 border border-stone-800 rounded-xl p-4">
                  <h4 className="text-xs font-semibold text-white mb-2 flex items-center justify-between">
                    <span>Recent Sales Deductions ({sales.length} days)</span>
                    <span className="text-[11px] text-stone-500">Rung at register</span>
                  </h4>
                  {sales.length ? (
                    <div className="overflow-x-auto max-h-48">
                      <table className="w-full text-left text-xs text-stone-300">
                        <thead className="text-[10px] uppercase text-stone-500 border-b border-stone-800 sticky top-0 bg-stone-950">
                          <tr>
                            <th className="py-1.5 px-2">Date</th>
                            <th className="py-1.5 px-2 text-right">Units Sold</th>
                            <th className="py-1.5 px-2 text-right">Register Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-800/60">
                          {sales.map((s, i) => (
                            <tr key={i}>
                              <td className="py-1.5 px-2 text-stone-400">{s.sale_date}</td>
                              <td className="py-1.5 px-2 text-right font-bold text-red-400">−{s.qty}</td>
                              <td className="py-1.5 px-2 text-right text-stone-300">${s.amount.toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-xs text-stone-500 italic">No sales recorded since count.</p>
                  )}
                </div>

                {/* Adjustments & Counts */}
                {(counts.length > 0 || adjustments.length > 0) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {counts.length > 0 && (
                      <div className="bg-stone-950 border border-stone-800 rounded-xl p-3">
                        <h5 className="text-xs font-semibold text-white mb-1.5">Shelf Counts</h5>
                        <div className="space-y-1 text-xs">
                          {counts.map((c, i) => (
                            <div key={i} className="flex justify-between text-stone-300 py-1 border-b border-stone-800/40 last:border-0">
                              <span>{c.counted_at.slice(0, 10)}: <b>{c.qty} btl</b></span>
                              <span className="text-stone-500 italic">{c.note || "count"}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {adjustments.length > 0 && (
                      <div className="bg-stone-950 border border-stone-800 rounded-xl p-3">
                        <h5 className="text-xs font-semibold text-white mb-1.5">Adjustments</h5>
                        <div className="space-y-1 text-xs">
                          {adjustments.map((a, i) => (
                            <div key={i} className="flex justify-between text-stone-300 py-1 border-b border-stone-800/40 last:border-0">
                              <span>{a.created_at.slice(0, 10)}: <b className={a.delta < 0 ? "text-red-400" : "text-emerald-400"}>{a.delta > 0 ? `+${a.delta}` : a.delta}</b></span>
                              <span className="text-stone-500 italic">{a.reason}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
            );
          })() : null}
        </div>
      </div>
    </div>
  );
}

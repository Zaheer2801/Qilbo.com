import { useState, useEffect, type FormEvent } from "react";
import {
  X,
  Package,
  MinusCircle,
  RefreshCw,
  Ban,
  Tag,
} from "lucide-react";
import type { ApiLedgerDetail } from "../../types";
import { api } from "../../lib/api";
import {
  CATEGORY_COLORS,
  getCategoryConfig,
  getBrandChipStyle,
  getBrandInitials,
  getDistributorBadge,
} from "../../lib/colors";

interface Props {
  productId: number;
  onClose: () => void;
  onStockUpdated: () => void;
}

export default function ProductDetailModal({ productId, onClose, onStockUpdated }: Props) {
  const [detail, setDetail] = useState<ApiLedgerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeAction, setActiveAction] = useState<"count" | "adjust" | "edit" | null>(null);

  // Form states
  const [countInput, setCountInput] = useState("");
  const [countNote, setCountNote] = useState("");
  const [adjustDelta, setAdjustDelta] = useState("-1");
  const [adjustReason, setAdjustReason] = useState("broken");

  // Editable product info
  const [editBrand, setEditBrand] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editDistributor, setEditDistributor] = useState("");
  const [editPrice, setEditPrice] = useState("");

  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const loadProduct = async () => {
    setLoading(true);
    try {
      const data = await api.getProduct(productId);
      setDetail(data);
      setEditBrand(data.product.brand || "");
      setEditCategory(data.product.category || "Liquor");
      setEditDistributor(data.product.distributor || "");
      if (data.product.price != null) {
        setEditPrice(String(data.product.price));
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

  const handleSaveProductEdit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.updateProduct({
        id: productId,
        brand: editBrand.trim() || undefined,
        category: editCategory || undefined,
        distributor: editDistributor || undefined,
        price: editPrice ? Number(editPrice) : undefined,
      });
      setStatusMsg("Product details updated successfully!");
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
      setStatusMsg(nextVal ? "Flagged: Do Not Reorder" : "Reorder restored");
      await loadProduct();
      onStockUpdated();
    } catch (err: any) {
      setStatusMsg(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const catConf = getCategoryConfig(detail?.product.category);
  const brandStyle = getBrandChipStyle(detail?.product.category, detail?.product.brand);
  const distBadge = getDistributorBadge(detail?.product.distributor);
  const initials = getBrandInitials(detail?.product.brand, detail?.product.clean_name || detail?.product.name);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between bg-slate-50/70 dark:bg-slate-800/40">
          <div className="flex items-center gap-3.5">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center font-extrabold text-base border shadow-sm"
              style={{
                backgroundColor: `${catConf.hex}18`,
                color: catConf.hex,
                borderColor: `${catConf.hex}30`,
              }}
            >
              {initials}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
                  {detail?.product.clean_name || detail?.product.name || "Product Audit & Ledger"}
                </h2>
                {detail?.product.size && (
                  <span className="text-xs bg-slate-200/70 dark:bg-slate-700 text-slate-800 dark:text-slate-200 px-2 py-0.5 rounded font-mono font-bold">
                    {detail.product.size}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span
                  className={`text-[11px] font-bold px-2 py-0.5 rounded-md border ${brandStyle.bg} ${brandStyle.text} ${brandStyle.border}`}
                >
                  {detail?.product.brand || "Brand"}
                </span>
                <span
                  className={`text-[11px] font-semibold px-2 py-0.5 rounded-md border ${distBadge.bg} ${distBadge.text} ${distBadge.border}`}
                >
                  {distBadge.label}
                </span>
                <span className="text-xs text-slate-400">• {detail?.product.category}</span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1">
          {loading && !detail ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <RefreshCw className="w-6 h-6 animate-spin text-blue-600 mb-2" />
              <p className="text-xs font-medium">Calculating ledger arithmetic...</p>
            </div>
          ) : detail ? (() => {
            const stock = detail.stock;
            const onHand = stock?.on_hand ?? null;
            const arithmetic = stock?.arithmetic ?? "No shelf count or delivery yet.";
            const basis = stock?.basis ?? "no invoice or shelf count yet";
            const deliveries = detail.recent_deliveries || [];
            const sales = detail.recent_sales_days || [];

            return (
              <>
                {statusMsg && (
                  <div className="p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-xl text-xs text-blue-800 dark:text-blue-300 font-semibold">
                    {statusMsg}
                  </div>
                )}

                {/* Stock on Hand & Shelf Price Card */}
                <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 p-5 rounded-2xl space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                        Verified Stock On Hand
                      </span>
                      <div className="text-3xl font-extrabold text-slate-900 dark:text-white mt-0.5">
                        {onHand != null ? onHand : <span className="text-slate-400 text-xl font-normal">Not Counted</span>}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                        Pre-Tax Shelf Price
                      </span>
                      <div className="text-2xl font-black text-slate-900 dark:text-white mt-0.5">
                        {detail.product.display_price || "–"}
                      </div>
                      <span className="text-[11px] text-slate-400 block mt-0.5">
                        Source: {detail.product.price_source}
                      </span>
                      {detail.product.price_warning && (
                        <span className="inline-block mt-1 px-2 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 rounded text-[10px] font-bold">
                          ⚠ {detail.product.price_warning}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Arithmetic Explanation */}
                  <div className="pt-3 border-t border-slate-200/60 dark:border-slate-700/60 text-xs">
                    <span className="text-slate-500 font-bold block mb-1">Ledger Arithmetic Formula:</span>
                    <div className="font-mono text-slate-800 dark:text-amber-200 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 break-words shadow-2xs font-semibold">
                      {arithmetic}
                    </div>
                    <span className="text-slate-400 text-[11px] mt-1.5 block italic">
                      Basis: {basis}
                    </span>
                  </div>
                </div>

                {/* Quick Action Buttons */}
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setActiveAction(activeAction === "count" ? null : "count")}
                    className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-sm"
                  >
                    <Package className="w-3.5 h-3.5" /> /count Shelf Count
                  </button>
                  <button
                    onClick={() => setActiveAction(activeAction === "adjust" ? null : "adjust")}
                    className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-sm"
                  >
                    <MinusCircle className="w-3.5 h-3.5 text-red-500" /> /adjust (Breakage / Found)
                  </button>
                  <button
                    onClick={() => setActiveAction(activeAction === "edit" ? null : "edit")}
                    className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-sm"
                  >
                    <Tag className="w-3.5 h-3.5 text-purple-600" /> Edit Brand / Details
                  </button>
                  <button
                    type="button"
                    onClick={handleToggleNoReorder}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition border shadow-sm ${
                      detail.product.do_not_reorder
                        ? "bg-rose-100 text-rose-800 border-rose-300"
                        : "bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-200"
                    }`}
                  >
                    <Ban className="w-3.5 h-3.5 text-rose-500" />
                    {detail.product.do_not_reorder ? "Do Not Reorder (Active)" : "Do Not Reorder"}
                  </button>
                </div>

                {/* Inline Action Forms */}
                {activeAction === "count" && (
                  <form onSubmit={handleSaveCount} className="p-4 bg-slate-50 dark:bg-slate-800/60 border border-blue-300 dark:border-blue-700 rounded-2xl space-y-3 shadow-sm">
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white">Record Physical Shelf Count</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] font-semibold text-slate-500 block mb-1">Bottles physically on shelf</label>
                        <input
                          type="number"
                          step="1"
                          placeholder="e.g. 5"
                          value={countInput}
                          onChange={(e) => setCountInput(e.target.value)}
                          required
                          className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-slate-500 block mb-1">Optional Note</label>
                        <input
                          type="text"
                          placeholder="e.g. Saturday count"
                          value={countNote}
                          onChange={(e) => setCountNote(e.target.value)}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-1">
                      <button type="button" onClick={() => setActiveAction(null)} className="px-3 py-1.5 text-xs text-slate-500 font-bold">
                        Cancel
                      </button>
                      <button type="submit" disabled={saving} className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm">
                        {saving ? "Saving..." : "Set Count"}
                      </button>
                    </div>
                  </form>
                )}

                {activeAction === "adjust" && (
                  <form onSubmit={handleSaveAdjust} className="p-4 bg-slate-50 dark:bg-slate-800/60 border border-red-300 dark:border-red-700 rounded-2xl space-y-3 shadow-sm">
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white">Stock Adjustment (Breakage / Correction)</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] font-semibold text-slate-500 block mb-1">Adjustment delta (e.g. -1 broken, +2 found)</label>
                        <input
                          type="number"
                          step="1"
                          value={adjustDelta}
                          onChange={(e) => setAdjustDelta(e.target.value)}
                          required
                          className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-red-500"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-slate-500 block mb-1">Reason</label>
                        <select
                          value={adjustReason}
                          onChange={(e) => setAdjustReason(e.target.value)}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none"
                        >
                          <option value="broken">Broken bottle</option>
                          <option value="theft">Theft / shrinkage</option>
                          <option value="found">Found / miscount</option>
                          <option value="return">Customer return</option>
                        </select>
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-1">
                      <button type="button" onClick={() => setActiveAction(null)} className="px-3 py-1.5 text-xs text-slate-500 font-bold">
                        Cancel
                      </button>
                      <button type="submit" disabled={saving} className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-sm">
                        {saving ? "Saving..." : "Record Adjustment"}
                      </button>
                    </div>
                  </form>
                )}

                {activeAction === "edit" && (
                  <form onSubmit={handleSaveProductEdit} className="p-4 bg-slate-50 dark:bg-slate-800/60 border border-purple-300 dark:border-purple-700 rounded-2xl space-y-3 shadow-sm">
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white">Edit Product Brand & Details</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] font-semibold text-slate-500 block mb-1">Brand Name</label>
                        <input
                          type="text"
                          value={editBrand}
                          onChange={(e) => setEditBrand(e.target.value)}
                          placeholder="e.g. Don Julio, Hennessy, Tito's"
                          className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-purple-500"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-slate-500 block mb-1">Category</label>
                        <select
                          value={editCategory}
                          onChange={(e) => setEditCategory(e.target.value)}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-white focus:outline-none"
                        >
                          {Object.keys(CATEGORY_COLORS).map((c) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-slate-500 block mb-1">Distributor</label>
                        <select
                          value={editDistributor}
                          onChange={(e) => setEditDistributor(e.target.value)}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-white focus:outline-none"
                        >
                          <option value="">Unknown / None</option>
                          <option value="Breakthru">Breakthru</option>
                          <option value="Southern Glazer's">Southern Glazer's</option>
                          <option value="Gold Coast">Gold Coast</option>
                          <option value="Florida Distributors">Florida Distributors</option>
                          <option value="Wayne Densch">Wayne Densch</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-slate-500 block mb-1">Pre-Tax Shelf Price ($)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={editPrice}
                          onChange={(e) => setEditPrice(e.target.value)}
                          placeholder="e.g. 52.99"
                          className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-white focus:outline-none"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-1">
                      <button type="button" onClick={() => setActiveAction(null)} className="px-3 py-1.5 text-xs text-slate-500 font-bold">
                        Cancel
                      </button>
                      <button type="submit" disabled={saving} className="px-4 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-sm">
                        {saving ? "Saving..." : "Save Product Details"}
                      </button>
                    </div>
                  </form>
                )}

                {/* Audit Tabs: Deliveries vs Recent Sales vs Counts */}
                <div className="space-y-4 pt-2">
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                    Recent Verified Deliveries ({deliveries.length})
                  </h4>
                  {deliveries.length === 0 ? (
                    <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl text-xs text-slate-400 italic">
                      No invoices posted yet for this product.
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200/80 dark:border-slate-800 rounded-xl overflow-hidden text-xs">
                      {deliveries.map((d, i) => (
                        <div key={i} className="p-3 bg-white dark:bg-slate-900 flex items-center justify-between">
                          <div>
                            <span className="font-bold text-slate-900 dark:text-white">{d.distributor}</span>
                            <span className="text-slate-400 text-[11px] ml-2">Inv #{d.invoice_no}</span>
                            <div className="text-[10px] text-slate-400 mt-0.5">{d.invoice_date}</div>
                          </div>
                          <div className="text-right">
                            <span className="font-extrabold text-blue-600 font-mono text-sm">+{d.bottles} bottles</span>
                            {d.unit_cost != null && (
                              <div className="text-[11px] text-slate-400 font-mono">${d.unit_cost.toFixed(2)} /unit</div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider pt-2">
                    Recent Register Sales Days ({sales.length})
                  </h4>
                  {sales.length === 0 ? (
                    <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl text-xs text-slate-400 italic">
                      No sales recorded yet.
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200/80 dark:border-slate-800 rounded-xl overflow-hidden text-xs">
                      {sales.slice(0, 5).map((s, i) => (
                        <div key={i} className="p-3 bg-white dark:bg-slate-900 flex items-center justify-between">
                          <span className="font-semibold text-slate-700 dark:text-slate-300">{s.sale_date}</span>
                          <div className="text-right font-mono">
                            <span className="font-bold text-slate-900 dark:text-white">−{s.qty} units</span>
                            <span className="text-slate-400 text-[11px] ml-2">(${s.amount.toFixed(2)})</span>
                          </div>
                        </div>
                      ))}
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

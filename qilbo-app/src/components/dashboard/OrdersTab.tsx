import { useState, useEffect } from "react";
import {
  Copy,
  Check,
  AlertTriangle,
  RefreshCw,
  Truck,
} from "lucide-react";
import type { ApiDistributorOrder } from "../../types";
import { api } from "../../lib/api";

export default function OrdersTab() {
  const [orders, setOrders] = useState<ApiDistributorOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [copiedRep, setCopiedRep] = useState(false);

  const loadOrders = async () => {
    setLoading(true);
    try {
      const data = await api.getOrders();
      setOrders(data);
    } catch (err) {
      console.error("Failed to load distributor order suggestions:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  const handleCopyRepText = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedRep(true);
    setTimeout(() => setCopiedRep(false), 2500);
  };

  if (loading && !orders.length) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-stone-400">
        <RefreshCw className="w-8 h-8 animate-spin mb-3 text-amber-500" />
        <p className="text-sm font-medium">Calculating 2-week order demand from 30-day sales velocity...</p>
      </div>
    );
  }

  const grandTotalCases = orders.reduce((acc, o) => acc + o.total_cases, 0);
  const grandTotalCost = orders.reduce((acc, o) => acc + o.total_cost, 0);

  return (
    <div className="space-y-6">
      {/* Header & Notice */}
      <div className="bg-stone-900 border border-stone-800 p-5 rounded-xl space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Suggested Distributor Orders</h2>
              <p className="text-xs text-stone-400">
                2-week stock coverage based on 30-day register velocity • Rounded to full cases • <b>Suggest only (never auto-orders)</b>
              </p>
            </div>
          </div>
          <button
            onClick={loadOrders}
            className="p-2 self-start sm:self-auto bg-stone-800 hover:bg-stone-700 border border-stone-700 rounded-lg text-stone-300 transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Global Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-stone-800">
          <div>
            <div className="text-[11px] text-stone-500">Total Cases Suggested</div>
            <div className="text-xl font-bold text-white">{grandTotalCases} cases</div>
          </div>
          <div>
            <div className="text-[11px] text-stone-500">Total Estimated Cost</div>
            <div className="text-xl font-bold text-amber-400">
              ${grandTotalCost.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-stone-500">Coverage Horizon</div>
            <div className="text-sm font-semibold text-stone-300">14 Days (2 Weeks)</div>
          </div>
          <div>
            <div className="text-[11px] text-stone-500">Distributors Active</div>
            <div className="text-sm font-semibold text-stone-300">{orders.filter(o => o.total_cases > 0).length} of {orders.length}</div>
          </div>
        </div>
      </div>

      {/* Distributor Order Sections */}
      <div className="space-y-6">
        {orders.map((d) => {
          const hasItems = d.items.length > 0;

          return (
            <div key={d.distributor} className="bg-stone-900 border border-stone-800 rounded-xl overflow-hidden">
              {/* Distributor Card Header */}
              <div className="p-4 bg-stone-950 border-b border-stone-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-white">{d.distributor}</h3>
                    {d.minimum_rule && (
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          d.meets_minimum
                            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                            : "bg-red-500/20 text-red-400 border border-red-500/30"
                        }`}
                      >
                        {d.meets_minimum ? "Meets Minimum" : "Below Minimum"} ({d.minimum_rule})
                      </span>
                    )}
                  </div>
                  {d.fee_warning && (
                    <div className="text-xs text-amber-400 mt-1 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>{d.fee_warning}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-4 self-start sm:self-auto">
                  <div className="text-right">
                    <div className="text-sm font-bold text-amber-400">
                      ${d.total_cost.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </div>
                    <div className="text-xs text-stone-400">{d.total_cases} cases suggested</div>
                  </div>

                  {d.rep_text && (
                    <button
                      onClick={() => handleCopyRepText(d.rep_text!)}
                      className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
                    >
                      {copiedRep ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedRep ? "Copied!" : "Copy Rep Text"}
                    </button>
                  )}
                </div>
              </div>

              {/* Items List */}
              {hasItems ? (
                <>
                  {/* Mobile Cards (< 640px) */}
                  <div className="sm:hidden divide-y divide-stone-800">
                    {d.items.map((it) => (
                      <div key={it.product_id} className="p-3.5 space-y-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-white text-sm leading-tight truncate">
                              {it.name}
                            </div>
                            <div className="text-[11px] text-stone-400 flex items-center gap-1.5 mt-0.5">
                              {it.size && <span className="font-mono bg-stone-800 text-stone-300 px-1 rounded">{it.size}</span>}
                              <span>•</span>
                              <span>{it.case_size}/cs</span>
                              <span>•</span>
                              <span>30d: {it.sold30} sold</span>
                            </div>
                          </div>
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
                              it.status === "OUT"
                                ? "bg-red-500/20 text-red-400"
                                : it.status === "REORDER"
                                ? "bg-amber-500/20 text-amber-300"
                                : "bg-stone-700 text-stone-300"
                            }`}
                          >
                            {it.status}
                          </span>
                        </div>

                        {/* Metrics Grid */}
                        <div className="grid grid-cols-3 gap-2 bg-stone-950/80 p-2.5 rounded-lg border border-stone-800/80 text-center">
                          <div>
                            <div className="text-[10px] uppercase text-stone-400 font-medium">On Hand</div>
                            <div className="text-xl font-black text-white mt-0.5">
                              {it.on_hand ?? "–"}
                            </div>
                          </div>
                          <div className="border-x border-stone-800/80">
                            <div className="text-[10px] uppercase text-amber-400 font-bold">To Order</div>
                            <div className="text-xl font-black text-amber-300 mt-0.5">
                              {it.cases_suggested} cs
                            </div>
                          </div>
                          <div>
                            <div className="text-[10px] uppercase text-stone-400 font-medium">Est. Cost</div>
                            <div className="text-sm font-bold text-white mt-1">
                              ${it.line_total.toFixed(2)}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Desktop Table (>= 640px) */}
                  <div className="hidden sm:block overflow-x-auto">
                    <table className="w-full text-left text-xs text-stone-300">
                      <thead className="bg-stone-950/60 text-stone-400 uppercase font-medium border-b border-stone-800">
                        <tr>
                          <th className="py-2.5 px-4">Item Name</th>
                          <th className="py-2.5 px-4">Size</th>
                          <th className="py-2.5 px-4 text-center">Status</th>
                          <th className="py-2.5 px-4 text-right">On Hand</th>
                          <th className="py-2.5 px-4 text-right">30d Velocity</th>
                          <th className="py-2.5 px-4 text-right">2-Wk Demand</th>
                          <th className="py-2.5 px-4 text-right">Case Size</th>
                          <th className="py-2.5 px-4 text-right font-bold text-white">Suggested Cases</th>
                          <th className="py-2.5 px-4 text-right">Est. Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-800">
                        {d.items.map((it) => (
                          <tr key={it.product_id} className="hover:bg-stone-800/40 transition">
                            <td className="py-2.5 px-4 font-medium text-white">{it.name}</td>
                            <td className="py-2.5 px-4 text-stone-400">{it.size || "–"}</td>
                            <td className="py-2.5 px-4 text-center">
                              <span
                                className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                  it.status === "OUT"
                                    ? "bg-red-500/20 text-red-400"
                                    : it.status === "REORDER"
                                    ? "bg-amber-500/20 text-amber-300"
                                    : "bg-stone-700 text-stone-300"
                                }`}
                              >
                                {it.status}
                              </span>
                            </td>
                            <td className="py-2.5 px-4 text-right font-mono">{it.on_hand ?? "–"}</td>
                            <td className="py-2.5 px-4 text-right text-stone-400">{it.sold30} sold</td>
                            <td className="py-2.5 px-4 text-right text-stone-300 font-medium">{it.two_week_demand} btl</td>
                            <td className="py-2.5 px-4 text-right text-stone-400">{it.case_size}/cs</td>
                            <td className="py-2.5 px-4 text-right font-bold text-amber-300 text-sm">
                              {it.cases_suggested} cs
                            </td>
                            <td className="py-2.5 px-4 text-right font-semibold text-white">
                              ${it.line_total.toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <div className="p-6 text-center text-xs text-stone-500 italic">
                  No orders needed for {d.distributor} (stock levels adequately cover 2 weeks of sales).
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

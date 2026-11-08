import { useState } from "react";
import { RefreshCw, TrendingUp, AlertCircle, CheckCircle, Flame } from "lucide-react";
import type { AppState } from "../../types";
import { velocityPerDay, round2 } from "../../lib/businessLogic";
import { card, btnPrimary } from "../ui";
import { titleCase } from "../../lib/format";

export default function TopShelfSalesTab({
  state,
  onSyncNrs,
  isSyncing,
  syncMessage,
}: {
  state: AppState;
  onSyncNrs: () => void;
  isSyncing: boolean;
  syncMessage: string | null;
}) {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  // Top shelf products
  const topShelfProducts = state.products.filter((p) => p.isTopShelf);

  // Categories present in top shelf
  const categories = Array.from(new Set(topShelfProducts.map((p) => p.category))).sort();

  // Filtered list
  const filtered = selectedCategory === "all"
    ? topShelfProducts
    : topShelfProducts.filter((p) => p.category === selectedCategory);

  // Low stock count
  const lowStockCount = topShelfProducts.filter((p) => p.qty <= p.reorderPoint).length;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Top Banner / Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 rounded-lg border border-stone-200">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl">⭐</span>
            <h1 className="text-xl font-bold text-stone-900 tracking-tight">
              Top Shelf Daily Sales & Inventory
            </h1>
          </div>
          <p className="text-xs text-stone-500 mt-1">
            Real-time feed extracted from your NRS daily sales reports to streamline procurement.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {syncMessage && (
            <span className="text-xs font-semibold px-2.5 py-1 rounded bg-amber-50 text-amber-900 border border-amber-200">
              {syncMessage}
            </span>
          )}
          <button
            onClick={onSyncNrs}
            disabled={isSyncing}
            className={`${btnPrimary} flex items-center gap-1.5`}
            title="Fetch today's NRS report from Gmail"
          >
            <RefreshCw size={14} className={isSyncing ? "animate-spin" : ""} />
            {isSyncing ? "Syncing NRS..." : "Sync Today's Report"}
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className={card}>
          <div className="flex items-center justify-between text-stone-500 text-xs font-medium mb-1">
            <span>Top Shelf SKUs Tracked</span>
            <Flame size={16} className="text-amber-700" />
          </div>
          <div className="text-2xl font-bold text-stone-900">{topShelfProducts.length}</div>
          <div className="text-[11px] text-stone-400 mt-0.5">High-value spirits & liquors</div>
        </div>

        <div className={card}>
          <div className="flex items-center justify-between text-stone-500 text-xs font-medium mb-1">
            <span>Units Sold Today</span>
            <TrendingUp size={16} className="text-emerald-700" />
          </div>
          <div className="text-2xl font-bold text-emerald-800">
            {state.sales.filter((s) => {
              const prod = state.products.find((p) => p.id === s.productId);
              return prod?.isTopShelf;
            }).reduce((sum, s) => sum + s.qty, 0)}
          </div>
          <div className="text-[11px] text-stone-400 mt-0.5">From latest NRS daily report</div>
        </div>

        <div className={card}>
          <div className="flex items-center justify-between text-stone-500 text-xs font-medium mb-1">
            <span>Low Stock / Reorder Needed</span>
            <AlertCircle size={16} className={lowStockCount > 0 ? "text-red-700" : "text-stone-400"} />
          </div>
          <div className={`text-2xl font-bold ${lowStockCount > 0 ? "text-red-700" : "text-stone-900"}`}>
            {lowStockCount}
          </div>
          <div className="text-[11px] text-stone-400 mt-0.5">
            {lowStockCount > 0 ? "Requires reordering" : "All bottles at healthy stock"}
          </div>
        </div>
      </div>

      {/* Category Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setSelectedCategory("all")}
          className={`text-xs px-3 py-1.5 rounded-md font-medium transition ${
            selectedCategory === "all"
              ? "bg-amber-800 text-amber-50"
              : "bg-white border border-stone-200 text-stone-600 hover:bg-stone-50"
          }`}
        >
          All Top Shelf ({topShelfProducts.length})
        </button>
        {categories.map((cat) => {
          const count = topShelfProducts.filter((p) => p.category === cat).length;
          return (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`text-xs px-3 py-1.5 rounded-md font-medium transition ${
                selectedCategory === cat
                  ? "bg-amber-800 text-amber-50"
                  : "bg-white border border-stone-200 text-stone-600 hover:bg-stone-50"
              }`}
            >
              {cat} ({count})
            </button>
          );
        })}
      </div>

      {/* Main Table: Top Shelf Performance & Stock */}
      <div className={card}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-stone-900">
            Top Shelf Inventory & Daily Sales Movement
          </h2>
          <span className="text-xs text-stone-400">
            Showing {filtered.length} products
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-stone-200 text-xs font-semibold text-stone-500 uppercase tracking-wider">
                <th className="pb-3 pr-4">Bottle / Product Name</th>
                <th className="pb-3 pr-4">Category</th>
                <th className="pb-3 pr-4">Bottle Size</th>
                <th className="pb-3 pr-4">Selling Price</th>
                <th className="pb-3 pr-4 text-center">Sold Today</th>
                <th className="pb-3 pr-4 text-center">Current Stock</th>
                <th className="pb-3 pr-4">Days Left</th>
                <th className="pb-3 text-right">Procurement Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filtered.map((p) => {
                const vel = round2(velocityPerDay(p.id, state.sales));
                const daysRemaining = vel > 0 ? (p.qty / vel).toFixed(1) : "—";
                const isLow = p.qty <= p.reorderPoint;
                const todaySold = state.sales
                  .filter((s) => s.productId === p.id)
                  .reduce((sum, s) => sum + s.qty, 0);

                return (
                  <tr key={p.id} className="hover:bg-stone-50/80 transition-colors">
                    <td className="py-3 pr-4 font-medium text-stone-900">
                      <div className="flex items-center gap-2">
                        <span className="text-amber-600 text-xs">⭐</span>
                        <span>{titleCase(p.name)}</span>
                      </div>
                      {p.id && (
                        <span className="text-[10px] text-stone-400 font-mono block ml-4">
                          UPC: {p.id}
                        </span>
                      )}
                    </td>
                    <td className="py-3 pr-4 text-stone-600">
                      <span className="inline-block text-xs px-2 py-0.5 rounded bg-stone-100 text-stone-700">
                        {p.category}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-stone-600">{p.size || "750ml"}</td>
                    <td className="py-3 pr-4 font-medium text-stone-900">
                      ${p.sellingPrice.toFixed(2)}
                    </td>
                    <td className="py-3 pr-4 text-center font-semibold text-stone-900">
                      {todaySold > 0 ? (
                        <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 text-xs font-bold border border-emerald-200">
                          {todaySold} sold
                        </span>
                      ) : (
                        <span className="text-stone-400 text-xs">0</span>
                      )}
                    </td>
                    <td className="py-3 pr-4 text-center">
                      <span
                        className={`text-xs px-2.5 py-1 rounded-full font-bold ${
                          isLow
                            ? "bg-red-100 text-red-800 border border-red-200"
                            : "bg-stone-100 text-stone-800"
                        }`}
                      >
                        {p.qty} on hand
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-xs font-medium text-stone-600">
                      {daysRemaining !== "—" ? `${daysRemaining} days` : "Healthy"}
                    </td>
                    <td className="py-3 text-right">
                      {isLow ? (
                        <span className="inline-flex items-center gap-1 text-xs text-red-700 font-bold bg-red-50 border border-red-200 px-2 py-1 rounded">
                          <AlertCircle size={12} />
                          Reorder {p.reorderPoint * 2 - p.qty} bottles
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-700 font-medium">
                          <CheckCircle size={12} />
                          Sufficient
                        </span>
                      )}
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

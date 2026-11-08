import { useState, useEffect } from "react";
import {
  Search,
  Wine,
  RefreshCw,
  ChevronRight,
} from "lucide-react";
import type { ApiInventoryItem } from "../../types";
import { api } from "../../lib/api";
import ProductDetailModal from "./ProductDetailModal";

interface Props {
  initialTopShelfFilter?: boolean;
}

export default function InventoryTab({ initialTopShelfFilter = false }: Props) {
  const [items, setItems] = useState<ApiInventoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [distributor, setDistributor] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [topShelfOnly, setTopShelfOnly] = useState<boolean>(initialTopShelfFilter);
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);

  const loadInventory = async () => {
    setLoading(true);
    try {
      const data = await api.getInventory({
        category: category !== "all" ? category : undefined,
        distributor: distributor !== "all" ? distributor : undefined,
        status: statusFilter !== "all" ? statusFilter : undefined,
        top_shelf: topShelfOnly,
        all: true,
      });
      setItems(data);
    } catch (err) {
      console.error("Failed to load inventory:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInventory();
  }, [category, distributor, statusFilter, topShelfOnly]);

  const filtered = items.filter((it) => {
    if (search) {
      const q = search.toLowerCase();
      const matchName = it.name.toLowerCase().includes(q);
      const matchClean = it.clean_name.toLowerCase().includes(q);
      if (!matchName && !matchClean) return false;
    }
    return true;
  });

  const counts = {
    OUT: items.filter((i) => i.status === "OUT").length,
    REORDER: items.filter((i) => i.status === "REORDER").length,
    OVERSTOCK: items.filter((i) => i.status === "OVERSTOCK").length,
    "NOT SELLING": items.filter((i) => i.status === "NOT SELLING").length,
    "NOT COUNTED": items.filter((i) => i.status === "NOT COUNTED").length,
    OK: items.filter((i) => i.status === "OK").length,
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Search Controls */}
      <div className="bg-stone-900 border border-stone-800 p-4 rounded-xl space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-white">Live Stock Ledger & Audit</h2>
            <p className="text-xs text-stone-400">
              Deterministic stock on hand calculated from deliveries, sales, and verified shelf counts
            </p>
          </div>
          <button
            onClick={loadInventory}
            className="p-2 self-start sm:self-auto bg-stone-800 hover:bg-stone-700 border border-stone-700 rounded-lg text-stone-300 transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Filter Pills / Counters */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-stone-800/80">
          <button
            onClick={() => setStatusFilter("all")}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
              statusFilter === "all" ? "bg-stone-100 text-stone-900" : "bg-stone-800 text-stone-400 hover:text-white"
            }`}
          >
            All ({items.length})
          </button>
          <button
            onClick={() => setStatusFilter("OUT")}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
              statusFilter === "OUT" ? "bg-red-500 text-white" : "bg-stone-800 text-red-400 hover:bg-stone-700"
            }`}
          >
            OUT ({counts.OUT})
          </button>
          <button
            onClick={() => setStatusFilter("REORDER")}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
              statusFilter === "REORDER" ? "bg-amber-500 text-stone-900" : "bg-stone-800 text-amber-400 hover:bg-stone-700"
            }`}
          >
            Reorder ({counts.REORDER})
          </button>
          <button
            onClick={() => setStatusFilter("NOT SELLING")}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
              statusFilter === "NOT SELLING" ? "bg-stone-500 text-white" : "bg-stone-800 text-stone-400 hover:bg-stone-700"
            }`}
          >
            Not Selling ({counts["NOT SELLING"]})
          </button>
          <button
            onClick={() => setStatusFilter("OVERSTOCK")}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
              statusFilter === "OVERSTOCK" ? "bg-purple-600 text-white" : "bg-stone-800 text-purple-400 hover:bg-stone-700"
            }`}
          >
            Overstock ({counts.OVERSTOCK})
          </button>
          <button
            onClick={() => setStatusFilter("NOT COUNTED")}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
              statusFilter === "NOT COUNTED" ? "bg-blue-600 text-white" : "bg-stone-800 text-blue-400 hover:bg-stone-700"
            }`}
          >
            Not Counted ({counts["NOT COUNTED"]})
          </button>
          <button
            onClick={() => setStatusFilter("OK")}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
              statusFilter === "OK" ? "bg-emerald-600 text-white" : "bg-stone-800 text-emerald-400 hover:bg-stone-700"
            }`}
          >
            OK ({counts.OK})
          </button>
        </div>

        {/* Search & Filter Row */}
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 pt-2">
          <div className="sm:col-span-2 relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-stone-500" />
            <input
              type="text"
              placeholder="Search by product name or size..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-stone-800 border border-stone-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-stone-500 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-stone-800 border border-stone-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
            >
              <option value="all">All Categories</option>
              <option value="Liquor">Liquor</option>
              <option value="Beer/RTD">Beer & RTD</option>
              <option value="Wine">Wine</option>
            </select>
          </div>

          <div>
            <select
              value={distributor}
              onChange={(e) => setDistributor(e.target.value)}
              className="w-full bg-stone-800 border border-stone-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
            >
              <option value="all">All Distributors</option>
              <option value="Southern Glazer's">Southern Glazer's</option>
              <option value="Breakthru">Breakthru</option>
              <option value="Gold Coast">Gold Coast</option>
              <option value="Florida Distributors">Florida Dist (FDI)</option>
              <option value="Wayne Densch">Wayne Densch</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setTopShelfOnly(!topShelfOnly)}
              className={`flex-1 py-1.5 px-2.5 rounded-lg text-xs font-medium border flex items-center justify-center gap-1.5 transition ${
                topShelfOnly
                  ? "bg-amber-500/20 border-amber-500 text-amber-300"
                  : "bg-stone-800 border-stone-700 text-stone-400 hover:text-white"
              }`}
            >
              <Wine className="w-3.5 h-3.5" /> Top Shelf
            </button>
          </div>
        </div>
      </div>

      {/* Inventory Items List */}
      <div className="bg-stone-900 border border-stone-800 rounded-xl overflow-hidden">
        {/* Mobile View (< 640px): Responsive Cards */}
        <div className="sm:hidden divide-y divide-stone-800/80">
          {filtered.slice(0, 150).map((it) => {
            const isOut = it.status === "OUT";
            const isReorder = it.status === "REORDER";
            const isNotCounted = it.status === "NOT COUNTED";

            return (
              <div
                key={it.id}
                onClick={() => setSelectedProductId(it.id)}
                className="p-3.5 hover:bg-stone-800/40 active:bg-stone-800 cursor-pointer transition flex flex-col gap-2"
              >
                {/* Row 1: Name, Size, Status Badge */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-white text-sm leading-tight truncate">
                      {it.clean_name || it.name}
                    </div>
                    <div className="text-[11px] text-stone-400 flex items-center gap-1.5 mt-0.5">
                      {it.size && <span className="font-mono bg-stone-800 text-stone-300 px-1 rounded">{it.size}</span>}
                      <span>•</span>
                      <span className="truncate">{it.distributor || "Unknown"}</span>
                      {it.is_top_shelf === 1 && (
                        <>
                          <span>•</span>
                          <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1 rounded font-semibold">Top Shelf</span>
                        </>
                      )}
                      {it.do_not_reorder === 1 && (
                        <>
                          <span>•</span>
                          <span className="text-[10px] bg-red-500/20 text-red-300 px-1 rounded font-semibold">No Reorder</span>
                        </>
                      )}
                    </div>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                      isOut
                        ? "bg-red-500/20 text-red-400 border border-red-500/30"
                        : isReorder
                        ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                        : isNotCounted
                        ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                        : it.status === "NOT SELLING"
                        ? "bg-stone-500/20 text-stone-400 border border-stone-500/30"
                        : it.status === "OVERSTOCK"
                        ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                        : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                    }`}
                  >
                    {it.status}
                  </span>
                </div>

                {/* Row 2: Big ON HAND, Weeks Left, Price */}
                <div className="flex items-end justify-between bg-stone-950/70 p-2.5 rounded-lg border border-stone-800/60">
                  <div>
                    <div className="text-[10px] uppercase text-stone-400 tracking-wider font-medium">On Hand</div>
                    <div className="text-2xl font-black mt-0.5">
                      {it.on_hand != null ? (
                        <span className={isOut ? "text-red-400" : isReorder ? "text-amber-400" : "text-white"}>
                          {it.on_hand}
                        </span>
                      ) : (
                        <span className="text-stone-400 text-sm font-normal italic">Not Counted</span>
                      )}
                    </div>
                  </div>

                  <div className="text-center">
                    <div className="text-[10px] uppercase text-stone-400 tracking-wider font-medium">Weeks Left</div>
                    <div className={`text-sm font-bold mt-0.5 ${
                      it.weeks_left != null && it.weeks_left <= 1.5 ? "text-red-400" : "text-stone-200"
                    }`}>
                      {it.weeks_left != null ? `${it.weeks_left.toFixed(1)} wks` : "–"}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-[10px] uppercase text-stone-400 tracking-wider font-medium">Pre-Tax Price</div>
                    <div className="text-sm font-bold text-amber-300 mt-0.5">
                      {it.display_price || "–"}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Desktop View (>= 640px): Standard Table */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-left text-xs text-stone-300">
            <thead className="bg-stone-950 text-stone-400 uppercase font-medium border-b border-stone-800">
              <tr>
                <th className="py-2.5 px-4">Product</th>
                <th className="py-2.5 px-4 text-center">Status</th>
                <th className="py-2.5 px-4 text-right">On Hand</th>
                <th className="py-2.5 px-4 text-right">Pre-Tax Price</th>
                <th className="py-2.5 px-4 text-right">Velocity</th>
                <th className="py-2.5 px-4 text-right">Weeks Left</th>
                <th className="py-2.5 px-4 text-center">Audit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-800">
              {filtered.slice(0, 150).map((it) => {
                const isOut = it.status === "OUT";
                const isReorder = it.status === "REORDER";
                const isNotCounted = it.status === "NOT COUNTED";

                return (
                  <tr
                    key={it.id}
                    onClick={() => setSelectedProductId(it.id)}
                    className="hover:bg-stone-800/40 cursor-pointer transition"
                  >
                    <td className="py-2.5 px-4">
                      <div className="font-medium text-white flex items-center gap-1.5">
                        <span>{it.clean_name || it.name}</span>
                        {it.is_top_shelf === 1 && (
                          <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.2 rounded border border-amber-500/30">
                            Top Shelf
                          </span>
                        )}
                        {it.needs_count && (
                          <span className="text-[10px] bg-blue-500/20 text-blue-300 px-1.5 py-0.2 rounded border border-blue-500/30">
                            Count Needed
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-stone-400 flex items-center gap-2 mt-0.5">
                        <span>{it.size || "unit"}</span>
                        <span>•</span>
                        <span>{it.distributor || "Unknown"}</span>
                        <span>•</span>
                        <span className="font-mono text-stone-400">{it.basis}</span>
                      </div>
                    </td>

                    <td className="py-2.5 px-4 text-center">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isOut
                            ? "bg-red-500/20 text-red-400 border border-red-500/30"
                            : isReorder
                            ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                            : isNotCounted
                            ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                            : it.status === "NOT SELLING"
                            ? "bg-stone-500/20 text-stone-400 border border-stone-500/30"
                            : it.status === "OVERSTOCK"
                            ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                            : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                        }`}
                      >
                        {it.status}
                      </span>
                    </td>

                    <td className="py-2.5 px-4 text-right">
                      {it.on_hand != null ? (
                        <span
                          className={`font-mono font-bold text-sm ${
                            isOut
                              ? "text-red-400"
                              : isReorder
                              ? "text-amber-400"
                              : "text-white"
                          }`}
                        >
                          {it.on_hand}
                        </span>
                      ) : (
                        <span className="text-stone-400 text-xs italic">Not Counted</span>
                      )}
                    </td>

                    <td className="py-2.5 px-4 text-right font-medium text-stone-200">
                      <span className={it.price_source === "estimated" ? "text-stone-400" : "text-amber-300"}>
                        {it.display_price || "–"}
                      </span>
                    </td>

                    <td className="py-2.5 px-4 text-right text-stone-400">
                      {it.per_week > 0 ? `~${it.per_week}/wk` : "0/wk"}
                    </td>

                    <td className="py-2.5 px-4 text-right text-stone-400">
                      {it.weeks_left != null ? (
                        <span className={it.weeks_left < 2 ? "text-red-400 font-semibold" : "text-stone-300"}>
                          {it.weeks_left.toFixed(1)} wks
                        </span>
                      ) : (
                        "–"
                      )}
                    </td>

                    <td className="py-2.5 px-4 text-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedProductId(it.id);
                        }}
                        className="p-1 rounded hover:bg-stone-700 text-stone-400 hover:text-white transition"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Product Detail & Audit Modal */}
      {selectedProductId && (
        <ProductDetailModal
          productId={selectedProductId}
          onClose={() => setSelectedProductId(null)}
          onStockUpdated={loadInventory}
        />
      )}
    </div>
  );
}

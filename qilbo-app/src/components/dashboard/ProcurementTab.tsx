import type { AppState, POStatus } from "../../types";
import {
  reorderSuggestion,
  round2,
  velocityPerDay,
} from "../../lib/businessLogic";
import { btnSmall, card, Tag } from "../ui";
import { HoverableProductName } from "./ProductThumb";
import { titleCase } from "../../lib/format";

export default function ProcurementTab({
  state,
  updateState,
}: {
  state: AppState;
  updateState: (updater: (s: AppState) => AppState) => void;
}) {
  const flagged = state.products.filter((p) => p.qty <= p.reorderPoint);

  // Approval-gated: this only ever creates a `draft` PO. Nothing here places an
  // order or contacts a vendor — that's a separate, explicit click on an
  // already-approved PO, matching orchestration.md / vendor-voice-agent.md.
  function draftPO(productId: string) {
    const product = state.products.find((p) => p.id === productId);
    if (!product) return;
    const { qty, unit } = reorderSuggestion(product, state.config);
    updateState((s) => ({
      ...s,
      purchaseOrders: [
        ...s.purchaseOrders,
        {
          id: "PO-" + Date.now(),
          productId: product.id,
          productName: `${product.name} ${product.size}`,
          qty,
          unit,
          unitCost: product.purchasePrice,
          status: "draft",
          createdDate: new Date().toISOString().slice(0, 10),
        },
      ],
    }));
  }

  function setStatus(id: string, status: POStatus) {
    updateState((s) => ({
      ...s,
      purchaseOrders: s.purchaseOrders.map((po) =>
        po.id === id ? { ...po, status } : po,
      ),
    }));
  }

  return (
    <div className="space-y-6">
      {/* Top-Shelf Sales & Inventory Monitor */}
      <div className={`${card} border-l-4 border-amber-500`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">⭐</span>
            <h3 className="text-sm font-bold text-stone-900 tracking-tight">
              Top Shelf Spirits & Premium Inventory
            </h3>
          </div>
          <span className="text-xs px-2.5 py-1 bg-amber-100 text-amber-900 font-semibold rounded-full">
            {state.products.filter((p) => p.isTopShelf).length} Top Shelf Bottles Tracked
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {state.products
            .filter((p) => p.isTopShelf)
            .map((p) => {
              const vel = round2(velocityPerDay(p.id, state.sales));
              const daysLeft = vel > 0 ? (p.qty / vel).toFixed(1) : "N/A";
              const isLow = p.qty <= p.reorderPoint;
              return (
                <div
                  key={p.id}
                  className={`p-3 rounded-lg border text-sm flex flex-col justify-between ${
                    isLow ? "bg-red-50/60 border-red-200" : "bg-stone-50/70 border-stone-200"
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-semibold text-stone-900 block truncate max-w-[180px]">
                        {titleCase(p.name)}
                      </span>
                      <span className="text-xs text-stone-500">
                        {p.size} · ${p.sellingPrice.toFixed(2)}
                      </span>
                    </div>
                    <span
                      className={`text-xs px-2 py-0.5 rounded font-bold ${
                        isLow ? "bg-red-600 text-white" : "bg-emerald-100 text-emerald-800"
                      }`}
                    >
                      {p.qty} in stock
                    </span>
                  </div>
                  <div className="mt-3 pt-2 border-t border-stone-200/60 flex items-center justify-between text-xs text-stone-600">
                    <span>
                      {vel > 0 ? `${vel}/day` : "0 sold today"}
                    </span>
                    <span className="font-medium text-stone-700">
                      {daysLeft !== "N/A" ? `${daysLeft} days left` : "Healthy"}
                    </span>
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      <div className={card}>
        <h3 className="text-sm font-semibold mb-3">
          At or below reorder point
        </h3>
        {flagged.length === 0 && (
          <p className="text-stone-400 italic text-sm">
            Nothing flagged right now.
          </p>
        )}
        {flagged.map((p) => {
          const vel = round2(velocityPerDay(p.id, state.sales));
          const already = state.purchaseOrders.some(
            (po) => po.productId === p.id && po.status !== "rejected",
          );
          const suggestion = reorderSuggestion(p, state.config);
          return (
            <div
              key={p.id}
              className="flex items-center justify-between py-2 border-b border-stone-50 text-sm"
            >
              <div>
                <HoverableProductName product={p} className="font-medium">
                  {titleCase(p.name)} {p.size}
                </HoverableProductName>
                <span className="text-stone-500 ml-2">
                  {p.qty} on hand / reorder pt {p.reorderPoint} · {vel}/day
                  recent pace
                </span>
                {vel === 0 && (
                  <Tag tone="amber">
                    zero recent sales — review before reordering
                  </Tag>
                )}
              </div>
              {already ? (
                <Tag tone="gray">already drafted</Tag>
              ) : (
                <button onClick={() => draftPO(p.id)} className={btnSmall}>
                  Draft PO ({suggestion.qty} {suggestion.unit})
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className={card}>
        <h3 className="text-sm font-semibold mb-3">Purchase orders</h3>
        {state.purchaseOrders.length === 0 && (
          <p className="text-stone-400 italic text-sm">None yet.</p>
        )}
        {state.purchaseOrders.map((po) => {
          const product = state.products.find((p) => p.id === po.productId);
          return (
            <div
              key={po.id}
              className="flex items-center justify-between py-2 border-b border-stone-50 text-sm"
            >
              <div>
                {po.id} —{" "}
                {product ? (
                  <HoverableProductName product={product}>
                    {titleCase(product.name)} {product.size}
                  </HoverableProductName>
                ) : (
                  po.productName
                )}
                , {po.qty} {po.unit || "units"} @ ${po.unitCost}
              </div>
              <div className="flex items-center gap-2">
                <Tag
                  tone={
                    po.status === "approved"
                      ? "green"
                      : po.status === "rejected"
                        ? "red"
                        : "amber"
                  }
                >
                  {po.status}
                </Tag>
                {po.status === "draft" && (
                  <>
                    <button
                      onClick={() => setStatus(po.id, "approved")}
                      className={btnSmall}
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => setStatus(po.id, "rejected")}
                      className={btnSmall}
                    >
                      Reject
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

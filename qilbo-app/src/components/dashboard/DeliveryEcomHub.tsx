import React, { useState } from "react";
import {
  Truck,
  Globe,
  ShoppingBag,
  Clock,
  CheckCircle2,
  MapPin,
  Phone,
  RefreshCw,
} from "lucide-react";

interface DeliveryOrder {
  id: string;
  source: "UberEats" | "DoorDash" | "Drizly" | "WebStore";
  customerName: string;
  phone: string;
  address: string;
  items: { name: string; qty: number; price: number }[];
  total: number;
  status: "Pending" | "Packing" | "Out for Delivery" | "Delivered";
  timePlaced: string;
  ageVerified: boolean;
}

export const DeliveryEcomHub: React.FC = () => {
  const [orders, setOrders] = useState<DeliveryOrder[]>([
    {
      id: "ORD-9402",
      source: "UberEats",
      customerName: "Alex Mercer",
      phone: "(917) 555-0192",
      address: "450 W 42nd St, Apt 18B, NYC",
      items: [
        { name: "Hennessy VS Cognac (750ml)", qty: 1, price: 46.99 },
        { name: "Fever-Tree Ginger Beer (4-pack)", qty: 2, price: 13.98 },
      ],
      total: 60.97,
      status: "Pending",
      timePlaced: "5 mins ago",
      ageVerified: true,
    },
    {
      id: "ORD-9401",
      source: "Drizly",
      customerName: "Sophia Lin",
      phone: "(646) 555-0834",
      address: "128 E 34th St, Fl 3, NYC",
      items: [
        { name: "Veuve Clicquot Brut Champagne (750ml)", qty: 2, price: 129.98 },
        { name: "Prosecco Superiore DOCG", qty: 1, price: 24.99 },
      ],
      total: 154.97,
      status: "Packing",
      timePlaced: "12 mins ago",
      ageVerified: true,
    },
    {
      id: "ORD-9400",
      source: "DoorDash",
      customerName: "Marcus Vance",
      phone: "(212) 555-0911",
      address: "88 Greenwich St, Apt 9A, NYC",
      items: [{ name: "Casamigos Reposado Tequila (750ml)", qty: 1, price: 58.99 }],
      total: 58.99,
      status: "Out for Delivery",
      timePlaced: "24 mins ago",
      ageVerified: true,
    },
    {
      id: "ORD-9398",
      source: "WebStore",
      customerName: "Elena Rostova",
      phone: "(917) 555-0422",
      address: "15 Park Row, Suite 4A, NYC",
      items: [
        { name: "Macallan 12 Single Malt (750ml)", qty: 1, price: 84.99 },
        { name: "Whiskey Stones Gift Set", qty: 1, price: 19.99 },
      ],
      total: 104.98,
      status: "Delivered",
      timePlaced: "1 hour ago",
      ageVerified: true,
    },
  ]);

  const updateOrderStatus = (orderId: string, nextStatus: DeliveryOrder["status"]) => {
    setOrders((prev) =>
      prev.map((ord) => (ord.id === orderId ? { ...ord, status: nextStatus } : ord))
    );
  };

  const getSourceBadge = (source: DeliveryOrder["source"]) => {
    switch (source) {
      case "UberEats":
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
      case "DoorDash":
        return "bg-rose-500/10 text-rose-400 border-rose-500/30";
      case "Drizly":
        return "bg-purple-500/10 text-purple-400 border-purple-500/30";
      case "WebStore":
        return "bg-amber-500/10 text-amber-400 border-amber-500/30";
    }
  };

  const getStatusStyle = (status: DeliveryOrder["status"]) => {
    switch (status) {
      case "Pending":
        return "bg-amber-500/20 text-amber-300 border-amber-500/50";
      case "Packing":
        return "bg-blue-500/20 text-blue-300 border-blue-500/50";
      case "Out for Delivery":
        return "bg-purple-500/20 text-purple-300 border-purple-500/50";
      case "Delivered":
        return "bg-emerald-500/20 text-emerald-300 border-emerald-500/50";
    }
  };

  return (
    <div className="space-y-6">
      {/* Overview Stats Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex items-center gap-3 shadow-lg">
          <div className="p-3 bg-amber-500/10 text-amber-400 rounded-xl">
            <ShoppingBag className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-medium">Pending Orders</p>
            <h4 className="text-xl font-extrabold text-white">
              {orders.filter((o) => o.status === "Pending").length}
            </h4>
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex items-center gap-3 shadow-lg">
          <div className="p-3 bg-blue-500/10 text-blue-400 rounded-xl">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-medium">Being Packed</p>
            <h4 className="text-xl font-extrabold text-white">
              {orders.filter((o) => o.status === "Packing").length}
            </h4>
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex items-center gap-3 shadow-lg">
          <div className="p-3 bg-purple-500/10 text-purple-400 rounded-xl">
            <Truck className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-medium">Out for Delivery</p>
            <h4 className="text-xl font-extrabold text-white">
              {orders.filter((o) => o.status === "Out for Delivery").length}
            </h4>
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex items-center gap-3 shadow-lg">
          <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-medium">Completed Today</p>
            <h4 className="text-xl font-extrabold text-white">24 Orders</h4>
          </div>
        </div>
      </div>

      {/* Main Channel Dispatch Grid */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 backdrop-blur-xl space-y-4">
        <div className="flex justify-between items-center pb-4 border-b border-slate-800">
          <div>
            <h3 className="text-lg font-extrabold text-white flex items-center gap-2">
              <Globe className="w-5 h-5 text-amber-400" /> Multi-Channel E-Commerce & Delivery Hub
            </h3>
            <p className="text-xs text-slate-400">
              Live sync from UberEats, DoorDash, Drizly, and Qilbo Web Store
            </p>
          </div>

          <button className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 rounded-xl transition">
            <RefreshCw className="w-3.5 h-3.5" /> Auto-Sync (Live)
          </button>
        </div>

        {/* Orders List */}
        <div className="space-y-4">
          {orders.map((ord) => (
            <div
              key={ord.id}
              className="bg-slate-950/80 border border-slate-800/80 hover:border-slate-700/80 rounded-xl p-4 flex flex-col md:flex-row justify-between gap-4 transition shadow-md"
            >
              {/* Order Info & Channel */}
              <div className="space-y-2 flex-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${getSourceBadge(
                      ord.source
                    )}`}
                  >
                    {ord.source}
                  </span>
                  <span className="text-sm font-extrabold text-white">{ord.id}</span>
                  <span className="text-xs text-slate-500">• {ord.timePlaced}</span>
                </div>

                <div className="flex items-center gap-4 text-xs text-slate-300">
                  <span className="font-bold text-white">{ord.customerName}</span>
                  <span className="flex items-center gap-1 text-slate-400">
                    <Phone className="w-3 h-3 text-slate-500" /> {ord.phone}
                  </span>
                </div>

                <div className="flex items-center gap-1 text-xs text-slate-400">
                  <MapPin className="w-3.5 h-3.5 text-amber-400/80 shrink-0" /> {ord.address}
                </div>

                {/* Items preview */}
                <div className="pt-2 flex flex-wrap gap-2">
                  {ord.items.map((item, idx) => (
                    <span
                      key={idx}
                      className="text-[11px] font-semibold bg-slate-900 border border-slate-800 text-slate-300 px-2 py-1 rounded-md"
                    >
                      {item.qty}x {item.name}
                    </span>
                  ))}
                </div>
              </div>

              {/* Status Actions & Total */}
              <div className="flex md:flex-col justify-between items-end gap-3 border-t md:border-t-0 md:border-l border-slate-800 pt-3 md:pt-0 md:pl-4 min-w-[200px]">
                <div className="text-right">
                  <span className="text-xs text-slate-400 block">Total Amount</span>
                  <span className="text-lg font-extrabold text-amber-400">
                    ${ord.total.toFixed(2)}
                  </span>
                </div>

                {/* Status Dropdown/Action */}
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs font-bold px-3 py-1 rounded-lg border ${getStatusStyle(
                      ord.status
                    )}`}
                  >
                    {ord.status}
                  </span>

                  {ord.status === "Pending" && (
                    <button
                      onClick={() => updateOrderStatus(ord.id, "Packing")}
                      className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs rounded-lg transition shadow-md shadow-amber-500/20"
                    >
                      Accept & Pack
                    </button>
                  )}

                  {ord.status === "Packing" && (
                    <button
                      onClick={() => updateOrderStatus(ord.id, "Out for Delivery")}
                      className="px-3 py-1.5 bg-purple-500 hover:bg-purple-400 text-white font-extrabold text-xs rounded-lg transition shadow-md shadow-purple-500/20"
                    >
                      Dispatch Driver
                    </button>
                  )}

                  {ord.status === "Out for Delivery" && (
                    <button
                      onClick={() => updateOrderStatus(ord.id, "Delivered")}
                      className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs rounded-lg transition shadow-md shadow-emerald-500/20"
                    >
                      Mark Delivered
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

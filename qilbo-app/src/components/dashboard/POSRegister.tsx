import React, { useState } from "react";
import type { Product } from "../../types";
import {
  Search,
  ShoppingCart,
  ShieldCheck,
  CreditCard,
  Banknote,
  Smartphone,
  Trash2,
  Plus,
  Minus,
  CheckCircle2,
  Wine,
  Beer,
  Tag,
  Zap,
  UserCheck,
  Receipt,
  Scan,
} from "lucide-react";

interface POSRegisterProps {
  products: Product[];
  onCompleteSale?: (items: { product: Product; qty: number }[], total: number) => void;
}

interface CartItem {
  product: Product;
  qty: number;
}

export const POSRegister: React.FC<POSRegisterProps> = ({ products, onCompleteSale }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showAgeVerification, setShowAgeVerification] = useState(false);
  const [ageVerified, setAgeVerified] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"card" | "cash" | "apple">("card");
  const [receiptSuccess, setReceiptSuccess] = useState<string | null>(null);

  const categories = ["All", "Spirits", "Wine", "Beer", "Tobacco", "Non-Alcoholic"];

  const filteredProducts = products.filter((p) => {
    const matchesCategory =
      selectedCategory === "All" ||
      p.category.toLowerCase().includes(selectedCategory.toLowerCase());
    const matchesSearch =
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.brand && p.brand.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  const addToCart = (product: Product) => {
    // Check if age sensitive category
    const isAgeRestricted = ["spirits", "wine", "beer", "tobacco", "liquor"].some((cat) =>
      product.category.toLowerCase().includes(cat)
    );

    if (isAgeRestricted && !ageVerified) {
      setShowAgeVerification(true);
    }

    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id ? { ...item, qty: item.qty + 1 } : item
        );
      }
      return [...prev, { product, qty: 1 }];
    });
  };

  const updateCartQty = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.product.id === productId) {
            const newQty = item.qty + delta;
            return newQty > 0 ? { ...item, qty: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const subtotal = cart.reduce((sum, item) => sum + item.product.sellingPrice * item.qty, 0);
  const tax = subtotal * 0.08875; // NYC / standard retail liquor tax estimate
  const total = subtotal + tax;

  const handleCheckout = () => {
    if (cart.length === 0) return;
    setPaymentModalOpen(true);
  };

  const handlePay = () => {
    const receiptId = `REC-${Math.floor(100000 + Math.random() * 900000)}`;
    if (onCompleteSale) {
      onCompleteSale(cart, total);
    }
    setPaymentModalOpen(false);
    setReceiptSuccess(receiptId);
    setCart([]);
    setAgeVerified(false);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full min-h-[750px]">
      {/* Product Catalog Grid (Left 7 Cols) */}
      <div className="lg:col-span-7 flex flex-col gap-4 bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 backdrop-blur-xl">
        {/* Top Header & Search */}
        <div className="flex flex-col sm:flex-row gap-3 justify-between items-stretch sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search product name, brand or scan barcode..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/60 transition"
            />
            <button className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 bg-slate-800 hover:bg-slate-700 text-amber-400 rounded-lg transition" title="Scan Barcode">
              <Scan className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-medium">Age Verification:</span>
            {ageVerified ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold rounded-lg">
                <UserCheck className="w-3.5 h-3.5" /> ID Verified 21+
              </span>
            ) : (
              <button
                onClick={() => setShowAgeVerification(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 text-amber-400 text-xs font-semibold rounded-lg transition"
              >
                <ShieldCheck className="w-3.5 h-3.5" /> Check ID
              </button>
            )}
          </div>
        </div>

        {/* Category Selector Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-2 text-xs font-semibold rounded-xl whitespace-nowrap transition ${
                selectedCategory === cat
                  ? "bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-bold shadow-lg shadow-amber-500/20"
                  : "bg-slate-800/60 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-700/50"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Products Touch Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 overflow-y-auto max-h-[560px] pr-1">
          {filteredProducts.map((p) => (
            <button
              key={p.id}
              onClick={() => addToCart(p)}
              className="group relative flex flex-col justify-between bg-slate-950/60 hover:bg-slate-800/80 border border-slate-800/80 hover:border-amber-500/50 rounded-xl p-3.5 text-left transition duration-200 shadow-md hover:shadow-amber-500/10"
            >
              <div className="flex justify-between items-start mb-2">
                <div className="p-2 bg-amber-500/10 rounded-lg text-amber-400 group-hover:scale-105 transition">
                  {p.category.toLowerCase().includes("wine") ? (
                    <Wine className="w-5 h-5" />
                  ) : p.category.toLowerCase().includes("beer") ? (
                    <Beer className="w-5 h-5" />
                  ) : (
                    <Tag className="w-5 h-5" />
                  )}
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
                  Stock: {p.qty}
                </span>
              </div>

              <div>
                <h4 className="text-xs font-bold text-white line-clamp-1 group-hover:text-amber-400 transition">
                  {p.name}
                </h4>
                <p className="text-[11px] text-slate-400 line-clamp-1">{p.brand || p.size}</p>
              </div>

              <div className="mt-3 flex justify-between items-center pt-2 border-t border-slate-800/60">
                <span className="text-sm font-extrabold text-amber-400">
                  ${p.sellingPrice.toFixed(2)}
                </span>
                <span className="p-1 rounded-md bg-amber-500/10 text-amber-400 opacity-0 group-hover:opacity-100 transition">
                  <Plus className="w-3.5 h-3.5" />
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Register Cart & Checkout Panel (Right 5 Cols) */}
      <div className="lg:col-span-5 flex flex-col justify-between bg-slate-900/90 border border-slate-800/90 rounded-2xl p-5 shadow-2xl">
        <div>
          <div className="flex justify-between items-center pb-4 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-amber-500/20 text-amber-400 rounded-xl">
                <ShoppingCart className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-white text-base">Current Cart</h3>
                <p className="text-xs text-slate-400">{cart.length} unique items</p>
              </div>
            </div>
            {cart.length > 0 && (
              <button
                onClick={() => setCart([])}
                className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" /> Clear
              </button>
            )}
          </div>

          {/* Cart Item List */}
          <div className="mt-4 space-y-3 max-h-[360px] overflow-y-auto pr-1">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center text-slate-500">
                <ShoppingCart className="w-12 h-12 stroke-[1.5] mb-3 text-slate-600" />
                <p className="text-sm font-semibold text-slate-400">Cart is empty</p>
                <p className="text-xs text-slate-500 max-w-[200px] mt-1">
                  Tap any product on the left catalog or scan barcode to add items
                </p>
              </div>
            ) : (
              cart.map((item) => (
                <div
                  key={item.product.id}
                  className="flex items-center justify-between p-3 bg-slate-950/80 border border-slate-800/80 rounded-xl"
                >
                  <div className="flex-1 min-w-0 pr-2">
                    <h5 className="text-xs font-bold text-white truncate">{item.product.name}</h5>
                    <p className="text-[11px] text-amber-400/90 font-medium">
                      ${item.product.sellingPrice.toFixed(2)} each
                    </p>
                  </div>

                  {/* Quantity Controls */}
                  <div className="flex items-center gap-2">
                    <div className="flex items-center bg-slate-900 border border-slate-700/60 rounded-lg p-0.5">
                      <button
                        onClick={() => updateCartQty(item.product.id, -1)}
                        className="p-1 text-slate-400 hover:text-white transition"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-6 text-center text-xs font-bold text-white">
                        {item.qty}
                      </span>
                      <button
                        onClick={() => updateCartQty(item.product.id, 1)}
                        className="p-1 text-slate-400 hover:text-white transition"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    <span className="text-xs font-extrabold text-white w-14 text-right">
                      ${(item.product.sellingPrice * item.qty).toFixed(2)}
                    </span>

                    <button
                      onClick={() => removeFromCart(item.product.id)}
                      className="p-1 text-slate-500 hover:text-rose-400 transition"
                      title="Remove item"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Cart Totals & Pay CTA */}
        <div className="mt-6 pt-4 border-t border-slate-800 space-y-2">
          <div className="flex justify-between text-xs text-slate-400">
            <span>Subtotal</span>
            <span className="font-semibold text-slate-200">${subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-xs text-slate-400">
            <span>Estimated Tax (8.875%)</span>
            <span className="font-semibold text-slate-200">${tax.toFixed(2)}</span>
          </div>

          <div className="flex justify-between text-base font-extrabold text-white pt-2 border-t border-slate-800/80">
            <span>Total</span>
            <span className="text-amber-400 text-lg">${total.toFixed(2)}</span>
          </div>

          <button
            onClick={handleCheckout}
            disabled={cart.length === 0}
            className={`w-full mt-4 py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-xl transition ${
              cart.length > 0
                ? "bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-slate-950 hover:brightness-110 shadow-amber-500/25 active:scale-[0.99]"
                : "bg-slate-800 text-slate-500 cursor-not-allowed"
            }`}
          >
            <Zap className="w-4 h-4 fill-slate-950" /> Complete Checkout (${total.toFixed(2)})
          </button>
        </div>
      </div>

      {/* Age Verification Modal */}
      {showAgeVerification && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 text-center space-y-4 shadow-2xl">
            <div className="w-14 h-14 bg-amber-500/20 text-amber-400 rounded-2xl flex items-center justify-center mx-auto border border-amber-500/30">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-white">Age Verification Required</h3>
              <p className="text-xs text-slate-400 mt-1">
                This transaction includes regulated age-restricted items (Liquor / Spirits / Tobacco). Verify customer date of birth (21+).
              </p>
            </div>

            <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-left text-xs space-y-1 text-slate-300">
              <div className="flex justify-between">
                <span className="text-slate-500">Legal Minimum Age:</span>
                <span className="font-bold text-amber-400">21 Years Old</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Required DOB On/Before:</span>
                <span className="font-bold text-white">August 20, 2005</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowAgeVerification(false)}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setAgeVerified(true);
                  setShowAgeVerification(false);
                }}
                className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs rounded-xl transition shadow-lg shadow-emerald-500/20"
              >
                Verify ID (Pass 21+)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Selection Modal */}
      {paymentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="flex justify-between items-center pb-3 border-b border-slate-800">
              <h3 className="font-extrabold text-white text-base">Select Payment Method</h3>
              <span className="text-amber-400 font-extrabold text-lg">${total.toFixed(2)}</span>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => setPaymentMethod("card")}
                className={`p-4 rounded-xl border flex flex-col items-center gap-2 text-xs font-bold transition ${
                  paymentMethod === "card"
                    ? "bg-amber-500/20 border-amber-500 text-white"
                    : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                }`}
              >
                <CreditCard className="w-6 h-6 text-amber-400" />
                Credit Card
              </button>

              <button
                onClick={() => setPaymentMethod("cash")}
                className={`p-4 rounded-xl border flex flex-col items-center gap-2 text-xs font-bold transition ${
                  paymentMethod === "cash"
                    ? "bg-amber-500/20 border-amber-500 text-white"
                    : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                }`}
              >
                <Banknote className="w-6 h-6 text-emerald-400" />
                Cash
              </button>

              <button
                onClick={() => setPaymentMethod("apple")}
                className={`p-4 rounded-xl border flex flex-col items-center gap-2 text-xs font-bold transition ${
                  paymentMethod === "apple"
                    ? "bg-amber-500/20 border-amber-500 text-white"
                    : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                }`}
              >
                <Smartphone className="w-6 h-6 text-cyan-400" />
                Contactless
              </button>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setPaymentModalOpen(false)}
                className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition"
              >
                Cancel
              </button>
              <button
                onClick={handlePay}
                className="flex-1 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-extrabold text-xs rounded-xl shadow-lg shadow-amber-500/20 hover:brightness-110 transition"
              >
                Process Payment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Receipt Banner Modal */}
      {receiptSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-6 text-center space-y-4 shadow-2xl">
            <div className="w-14 h-14 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-white">Payment Complete!</h3>
              <p className="text-xs text-slate-400 mt-1">Transaction recorded successfully.</p>
              <p className="text-xs font-mono font-semibold text-amber-400 mt-2">{receiptSuccess}</p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setReceiptSuccess(null)}
                className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-2"
              >
                <Receipt className="w-4 h-4" /> Done / Next Order
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

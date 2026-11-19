import type {
  ApiSummaryResponse,
  ApiInventoryItem,
  ApiSalesSummary,
  ApiLedgerDetail,
  ApiInvoice,
  ApiInvoiceLine,
  ApiDistributorOrder,
  ApiPurchaseOrder,
} from "../types";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  console.log('[API REQ]', path);
  const headers = new Headers(options.headers || {});
  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  try {
    const res = await fetch(path, {
      ...options,
      headers,
      credentials: "include", // Include HttpOnly signed cookie `dl`
    });
    console.log('[API RES STATUS]', path, res.status);

    if (res.status === 401) {
      throw new ApiError("Login required", 401);
    }

    if (!res.ok) {
      let errorMsg = `Request failed (${res.status})`;
      try {
        const errJson = await res.json();
        if (errJson.error) errorMsg = errJson.error;
      } catch {
        // Use fallback
      }
      throw new ApiError(errorMsg, res.status);
    }

    return res.json() as Promise<T>;
  } catch (e) {
    console.log('[API FETCH THREW]', path, e);
    throw e;
  }
}

export type BrainFinding = {
  id: number; key: string; engine: string; type: string; severity: number; product_id: number | null;
  title: string; detail: string | null; action: string | null; value: number; data: Record<string, unknown>;
  status: "open" | "approved" | "skipped" | "verified" | "cleared"; first_seen: string; last_seen: string;
  decided_at: string | null; resolved_at: string | null;
};
export type BrainResponse = {
  items: BrainFinding[];
  summary: { open: number; approved: number; verified: number; value_open: number; value_verified: number; by_engine: Record<string, Record<string, number>> };
  last_run: { started_at: string; raised: number; refreshed: number; closed: number; errors: string | null } | null;
};

export type StoreSignup = {
  id: number; code: string | null; name: string; store_type: string; status: "pending" | "pilot" | "active" | "declined";
  owner_name: string | null; phone: string | null; email: string | null; address: string | null; city: string | null; state: string | null; zip: string | null;
  pos: string | null; created_at: string; decided_at: string | null;
  profile: { distributors?: string[]; distributors_other?: string; registers?: number | null; sales_range?: string | null; report_email?: string | null;
    margin_goals?: Record<string, number>; problems?: string[]; alerts?: string[]; best_time?: string; notes?: string; intent?: string; source?: string };
  // Pilot stores only: their private setup link and how far along they are
  setup_url?: string; tg_connected?: boolean;
  onboarding?: { pct: number; done: number; total: number; ready: boolean;
    steps: { key: string; title: string; detail: string; done: boolean; progress?: number }[];
    counts: { items: number; sales: number; sales_days: number; invoice: number; deals: number; other: number } };
  files?: { id: number; kind: string; file_name: string; source: string; report_date: string | null; created_at: string }[];
};

export const api = {
  // Stores that registered through /join
  getStores: (): Promise<{ stores: StoreSignup[] }> => request(`/api/stores`),
  decideStore: (id: number, decision: "approve" | "decline"): Promise<{ id: number; status: string }> =>
    request(`/api/stores/${id}/${decision}`, { method: "POST" }),

  // Qilbo brain
  getBrain: (status = "open,approved"): Promise<BrainResponse> => request<BrainResponse>(`/api/brain?status=${encodeURIComponent(status)}`),
  runBrain: (): Promise<{ raised: number; refreshed: number; closed: number; total: number; errors: string[] }> =>
    request(`/api/brain/run`, { method: "POST" }),
  decideFinding: (id: number, decision: "approve" | "skip" | "reopen"): Promise<{ id: number; status: string }> =>
    request(`/api/brain/${id}/${decision}`, { method: "POST" }),

  // Login / Logout
  login: async (password: string): Promise<boolean> => {
    const res = await fetch("/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
      credentials: "include",
    });
    return res.ok;
  },

  logout: async (): Promise<void> => {
    await fetch("/logout", { method: "POST", credentials: "include" });
  },

  // Summary & Overview
  getSummary: (date?: string, days = 30, start?: string, end?: string): Promise<ApiSummaryResponse> => {
    const params = new URLSearchParams();
    if (date) params.set("date", date);
    if (days) params.set("days", String(days));
    if (start) params.set("start", start);
    if (end) params.set("end", end);
    return request<ApiSummaryResponse>(`/api/summary?${params.toString()}`);
  },

  // Inventory & Live Stock
  getInventory: (params: {
    category?: string;
    sub_category?: string;
    distributor?: string;
    brand?: string;
    status?: string;
    top_shelf?: boolean;
    all?: boolean;
    start?: string;
    end?: string;
    days?: number;
  } = {}): Promise<ApiInventoryItem[]> => {
    const q = new URLSearchParams();
    if (params.category) q.set("category", params.category);
    if (params.sub_category) q.set("sub_category", params.sub_category);
    if (params.distributor) q.set("distributor", params.distributor);
    if (params.brand) q.set("brand", params.brand);
    if (params.status) q.set("status", params.status);
    if (params.top_shelf) q.set("top_shelf", "1");
    if (params.all) q.set("all", "1");
    if (params.start) q.set("start", params.start);
    if (params.end) q.set("end", params.end);
    if (params.days) q.set("days", String(params.days));
    return request<ApiInventoryItem[]>(`/api/inventory?${q.toString()}`);
  },

  // Sales Reports
  getSales: (start?: string, end?: string): Promise<ApiSalesSummary> => {
    const q = new URLSearchParams();
    if (start) q.set("start", start);
    if (end) q.set("end", end);
    return request<ApiSalesSummary>(`/api/sales?${q.toString()}`);
  },

  // Single Product Ledger & History
  getProduct: (id: number): Promise<ApiLedgerDetail> => {
    return request<ApiLedgerDetail>(`/api/product?id=${id}`);
  },

  // Search
  search: (query: string): Promise<any[]> => {
    return request<any[]>(`/api/search?q=${encodeURIComponent(query)}`);
  },

  // Stock Actions
  setCount: (productId: number, qty: number, note?: string) => {
    return request<{ saved: boolean; before: number | null; after: number }>("/api/count", {
      method: "POST",
      body: JSON.stringify({ product_id: productId, qty, note }),
    });
  },

  adjustStock: (productId: number, delta: number, reason: string) => {
    return request<{ saved: boolean; on_hand: number }>("/api/adjust", {
      method: "POST",
      body: JSON.stringify({ product_id: productId, delta, reason }),
    });
  },

  setPrice: (productId: number, price?: number | null, cost?: number | null) => {
    return request<{ ok: boolean }>("/api/price", {
      method: "POST",
      body: JSON.stringify({ product_id: productId, price, cost }),
    });
  },

  toggleNoReorder: (productId: number, doNotReorder: boolean) => {
    return request<{ ok: boolean; product_id: number; do_not_reorder: number }>("/api/product/toggle-no-reorder", {
      method: "POST",
      body: JSON.stringify({ product_id: productId, do_not_reorder: doNotReorder ? 1 : 0 }),
    });
  },

  updateProduct: (data: { id: number; brand?: string; category?: string; distributor?: string; price?: number }) => {
    return request<{ ok: boolean }>("/api/product/update", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  undo: () => {
    return request<{ message: string }>("/api/undo", { method: "POST" });
  },

  // Invoices
  getInvoices: (): Promise<ApiInvoice[]> => {
    return request<ApiInvoice[]>("/api/invoices");
  },

  getInvoice: (id: number): Promise<{ invoice: ApiInvoice; lines: ApiInvoiceLine[] }> => {
    return request<{ invoice: ApiInvoice; lines: ApiInvoiceLine[] }>(`/api/invoice?id=${id}`);
  },

  postInvoice: (id: number) => {
    return request<{ posted: boolean; lines: number; new_products: number }>("/api/invoice/post", {
      method: "POST",
      body: JSON.stringify({ id }),
    });
  },

  discardInvoice: (id: number) => {
    return request<{ ok: boolean }>("/api/invoice/discard", {
      method: "POST",
      body: JSON.stringify({ id }),
    });
  },

  // Orders
  getOrders: (): Promise<ApiDistributorOrder[]> => {
    return request<ApiDistributorOrder[]>("/api/orders");
  },

  // Purchase Orders (Draft & Ordered)
  getDraftPOs: (): Promise<ApiPurchaseOrder[]> => {
    return request<ApiPurchaseOrder[]>("/api/po/drafts");
  },

  getPOHistory: (limit = 50): Promise<ApiPurchaseOrder[]> => {
    return request<ApiPurchaseOrder[]>(`/api/po/history?limit=${limit}`);
  },

  addToDraftPO: (productId: number, cases = 1, distributor?: string): Promise<ApiPurchaseOrder[]> => {
    return request<ApiPurchaseOrder[]>("/api/po/item", {
      method: "POST",
      body: JSON.stringify({ product_id: productId, cases, distributor }),
    });
  },

  updatePOLine: (lineId: number, cases: number): Promise<ApiPurchaseOrder[]> => {
    return request<ApiPurchaseOrder[]>("/api/po/item/update", {
      method: "POST",
      body: JSON.stringify({ line_id: lineId, cases }),
    });
  },

  removePOLine: (params: { lineId?: number; poId?: number; productId?: number }): Promise<ApiPurchaseOrder[]> => {
    return request<ApiPurchaseOrder[]>("/api/po/item/delete", {
      method: "POST",
      body: JSON.stringify({ line_id: params.lineId, po_id: params.poId, product_id: params.productId }),
    });
  },

  addAllReorderToPO: (distributor: string): Promise<ApiPurchaseOrder[]> => {
    return request<ApiPurchaseOrder[]>("/api/po/add-reorder", {
      method: "POST",
      body: JSON.stringify({ distributor }),
    });
  },

  clearPO: (distributor?: string, poId?: number): Promise<ApiPurchaseOrder[]> => {
    return request<ApiPurchaseOrder[]>("/api/po/clear", {
      method: "POST",
      body: JSON.stringify({ distributor, po_id: poId }),
    });
  },

  markPOOrdered: (poId?: number, distributor?: string): Promise<{ orderedPoId: number; drafts: ApiPurchaseOrder[] }> => {
    return request<{ orderedPoId: number; drafts: ApiPurchaseOrder[] }>("/api/po/order", {
      method: "POST",
      body: JSON.stringify({ po_id: poId, distributor }),
    });
  },

  // Upload File (Invoice PDF/image or Sales CSV)
  uploadFile: (file: File, date?: string) => {
    const data = new FormData();
    data.append("file", file);
    if (date) data.append("date", date);
    return request<any>("/api/upload", {
      method: "POST",
      body: data,
    });
  },

  // AI Chat Assistant
  ask: (question: string, history: any[] = []): Promise<{ answer: string }> => {
    return request<{ answer: string }>("/api/ask", {
      method: "POST",
      body: JSON.stringify({ question, history }),
    });
  },
};

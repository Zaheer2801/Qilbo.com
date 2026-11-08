import type {
  ApiSummaryResponse,
  ApiInventoryItem,
  ApiSalesSummary,
  ApiLedgerDetail,
  ApiInvoice,
  ApiInvoiceLine,
  ApiDistributorOrder,
} from "../types";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(path, {
    ...options,
    headers,
    credentials: "include", // Include HttpOnly signed cookie `dl`
  });

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
}

export const api = {
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
  getSummary: (date?: string, days = 30): Promise<ApiSummaryResponse> => {
    const params = new URLSearchParams();
    if (date) params.set("date", date);
    if (days) params.set("days", String(days));
    return request<ApiSummaryResponse>(`/api/summary?${params.toString()}`);
  },

  // Inventory & Live Stock
  getInventory: (params: {
    category?: string;
    sub_category?: string;
    distributor?: string;
    status?: string;
    top_shelf?: boolean;
    all?: boolean;
  } = {}): Promise<ApiInventoryItem[]> => {
    const q = new URLSearchParams();
    if (params.category) q.set("category", params.category);
    if (params.sub_category) q.set("sub_category", params.sub_category);
    if (params.distributor) q.set("distributor", params.distributor);
    if (params.status) q.set("status", params.status);
    if (params.top_shelf) q.set("top_shelf", "1");
    if (params.all) q.set("all", "1");
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

export interface UtilityLine {
  name: string;
  amount: string;
}

export type InvoiceMethod = "gmail" | "photo" | "other";
export type ApprovalStyle = "always" | "threshold";
export type ExpiryDefault = "always_ask" | "suggest_discount";
export type ReorderUnit = "cases" | "units" | "boxes";

/** US-only for now — nothing else in this schema (EIN format, liquor license,
 * the timezone list) supports another country yet. Split fields instead of a
 * free-text blob so the state can drive timezone lookup directly and reorder
 * summaries/reporting can group by state reliably later. */
export interface AddressFields {
  street: string;
  city: string;
  state: string; // two-letter USPS code, e.g. "FL"
  zip: string;
  country: string; // "US" — only option for now, see note above
}

export type DayOfWeek = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";

export interface DayHours {
  day: DayOfWeek;
  closed: boolean;
  open: string; // "HH:MM", 24h
  close: string; // "HH:MM", 24h
}

export type HolidaySchedule = "same" | "closed";

export interface BusinessConfig {
  businessName: string;
  dba: string;
  address: AddressFields;
  ownerName: string;
  ein: string;
  phone: string;
  email: string;

  vertical: string;
  licenseNumber: string;
  licenseExpiry: string;
  hours: DayHours[];
  holidaySchedule: HolidaySchedule;
  timezone: string;
  paymentMethods: string;

  taxRate: string;
  rent: string;
  utilities: UtilityLine[];

  invoiceMethods: InvoiceMethod[];
  approvalStyle: ApprovalStyle;
  approvalThreshold: string;
  reorderMultiple: string;
  reorderUnit: ReorderUnit;
  backupApprover: string;

  returnWindowDays: string;
  requireReceipt: boolean;
  requireInspection: boolean;
  expiryDefault: ExpiryDefault;

  whatsapp: string;
  gmailAddress: string;
  alertThreshold: string;

  onboardingComplete: boolean;
}

export interface MarginPolicyRow {
  category: string;
  minMarginPct: number;
}

export interface Product {
  id: string;
  name: string;
  brand?: string; // optional — distinct from `name` for CSV imports that carry both (e.g. name "VS", brand "Hennessy")
  department?: string; // Top-level department: Liquor, Beer, Tobacco, Beverages, Wine, Lottery
  category: string;
  subCategory?: string; // Sub-category: Whiskey, Tequila, Cognac, Vodka, Rum, Gin, Cutwaters, etc.
  size: string; // free-form — "50ml", "750ml", "6-pack", "12oz", etc.
  qty: number;
  reorderPoint: number;
  purchasePrice: number; // owner-only in principle — see InventoryTab's note on why that's just a label, not real access control, in this single-user prototype
  sellingPrice: number;
  expiryDate: string;
  vendor?: string; // who this is procured from — optional, older/manually-added products may not have one on record
  receivedDate?: string; // when the current stock actually arrived — drives "days on shelf"; optional for the same reason
  imageUrl?: string; // optional — falls back to a placeholder icon when absent, never fabricated
  isTopShelf?: boolean; // tagged for premium / high-value spirits and top-shelf inventory
  upc?: string; // barcode / UPC identifier from POS
}

export interface Sale {
  id: string;
  productId: string;
  productName?: string;
  storeId?: string;
  storeName?: string;
  department?: string;
  subCategory?: string;
  size?: string;
  qty: number;
  unitPrice?: number;
  amount?: number;
  date: string;
  isTopShelf?: boolean;
}

export interface Inquiry {
  id: string;
  product: string;
  date: string;
  carried: boolean;
}

export type POStatus = "draft" | "approved" | "rejected";

export interface PurchaseOrder {
  id: string;
  productId: string;
  productName: string;
  qty: number;
  unit: ReorderUnit | "units";
  unitCost: number;
  status: POStatus;
  createdDate: string;
}

export type OverrideStatus = "pending" | "approved" | "rejected";

export interface MarginOverride {
  id: string;
  productId: string;
  requestedMargin: string;
  approvedMargin: string;
  reason: string;
  status: OverrideStatus;
}

export interface AlertItem {
  id: string;
  type: "demand";
  message: string;
  date: string;
}

// Predefined reasons for a manual quantity change — multi-select, so a
// single count can be tagged e.g. "Stock take" + "Correction" at once.
export const QTY_CHANGE_REASONS = [
  "Stock take / physical count",
  "Received shipment",
  "Damaged / spoiled",
  "Theft / shrinkage",
  "Return to vendor",
  "Correction (data entry error)",
  "Other",
] as const;
export type QtyChangeReason = (typeof QTY_CHANGE_REASONS)[number];

export interface QtyLogEntry {
  id: string;
  productId: string;
  productName: string;
  previousQty: number;
  newQty: number;
  changedBy: string; // free-text — no auth/staff accounts exist in this prototype, see about_me.md
  reasons: QtyChangeReason[];
  note?: string;
  date: string;
}

export interface AppState {
  config: BusinessConfig;
  marginPolicy: MarginPolicyRow[];
  products: Product[];
  sales: Sale[];
  inquiries: Inquiry[];
  purchaseOrders: PurchaseOrder[];
  marginOverrides: MarginOverride[];
  alerts: AlertItem[];
  alertState: Record<string, number>;
  qtyLog: QtyLogEntry[];
}

export interface ExpiryRisk {
  days: number;
  vel: number;
  remainPct: number;
  tier: "Low" | "Medium" | "High";
  reason: string;
}

// ==========================================
// QILBO CLOUDFLARE D1 LIVE LEDGER API TYPES
// ==========================================

export type InventoryStatus = 'OUT' | 'REORDER' | 'OVERSTOCK' | 'NOT SELLING' | 'NOT COUNTED' | 'OK';
export type PriceSource = 'manual' | 'register' | 'estimated';

export interface ApiInventoryItem {
  id: number;
  name: string;
  clean_name: string;
  size: string | null;
  category: string;
  department: string;
  sub_category: string;
  distributor: string | null;
  brand: string | null;
  case_size: number | null;
  units_per_case: number | null;
  cost: number | null;
  price: number | null;
  price_source: PriceSource;
  price_warning?: string | null;
  display_price: string | null;
  on_hand: number | null;
  basis: string;
  arithmetic: string;
  needs_count: boolean;
  sold30: number;
  sold60: number;
  last_sold: string | null;
  per_week: number;
  weeks_left: number | null;
  reorder_point: number;
  status: InventoryStatus;
  avg_price: number | null;
  margin: number | null;
  stock_value: number | null;
  is_top_shelf: number;
  do_not_reorder?: number;
  suggested_cases?: number;
  profit_per_bottle?: number | null;
  margin_pct?: number | null;
  case_cost?: number | null;
  sales_range_amount?: number | null;
  sold_range?: number;
}

export interface ApiSalesSummary {
  start: string;
  end: string;
  store_sales: number;
  scanned_sales?: number;
  dept_sales?: number;
  scanned_items: number;
  by_category: { category: string; qty: number; amount: number }[];
  departments: { department: string; qty: number; amount: number }[];
  top_items: { name: string; size: string | null; qty: number; amount: number }[];
  top_brands?: { brand: string; category: string; qty: number; amount: number }[];
  daily: { d: string; amount: number }[];
  tracked_profit: number;
  tracked_margin: number | null;
  top_shelf?: { amount: number; qty: number; share: number };
  prev_period?: {
    start: string;
    end: string;
    store_sales: number;
    scanned_items: number;
  };
  sales_change_pct?: number | null;
  items_change_pct?: number | null;
}

export interface ApiDistributorOrder {
  distributor: string;
  total_cases: number;
  total_cost: number;
  meets_minimum: boolean;
  minimum_rule: string;
  fee_warning: string | null;
  is_monday: boolean;
  rep_text: string | null;
  items: {
    product_id: number;
    name: string;
    size: string | null;
    on_hand: number | null;
    sold30: number;
    two_week_demand: number;
    case_size: number;
    cases_suggested: number;
    unit_cost: number;
    case_cost: number;
    line_total: number;
    status: InventoryStatus;
  }[];
}

export interface ApiSummaryResponse {
  day: ApiSalesSummary;
  range: ApiSalesSummary;
  inventory: {
    counts: Record<InventoryStatus, number>;
    stock_value: number;
    tracked: number;
    total_products: number;
    needs_count: number;
  };
  pending_invoices: number;
  distributor_orders: ApiDistributorOrder[];
}

export interface ApiInvoice {
  id: number;
  distributor: string;
  invoice_no: string;
  invoice_date: string | null;
  total: number | null;
  status: 'pending' | 'posted' | 'rejected';
  source: string | null;
  file_key: string | null;
  created_at: string;
  line_count: number;
}

export interface ApiInvoiceLine {
  id: number;
  invoice_id: number;
  product_id: number | null;
  description: string | null;
  item_code: string | null;
  upc: string | null;
  cases: number | null;
  bottles: number;
  unit_cost: number | null;
  line_total: number | null;
  product_name?: string;
  clean_name?: string;
  size?: string;
  current_cost?: number;
  current_price?: number;
  matched?: string;
  how?: string;
}

export interface ApiLedgerDetail {
  product: {
    id: number;
    name: string;
    clean_name: string;
    size: string | null;
    category: string;
    department: string;
    sub_category: string;
    distributor: string | null;
  brand: string | null;
    cost: number | null;
    price: number | null;
    price_source: PriceSource;
    price_warning?: string | null;
    display_price: string | null;
    reorder_point: number | null;
    is_top_shelf: number;
    do_not_reorder?: number;
  };
  upcs?: string[];
  stock: {
    known: boolean;
    on_hand: number | null;
    basis: string;
    base: number;
    received: number;
    sold: number;
    adjusted: number;
    sales_from: string | null;
    needs_count: boolean;
    arithmetic: string;
  };
  velocity_30d?: {
    qty: number;
    amount: number;
    per_week: number;
  };
  recent_deliveries: {
    invoice_id: number;
    invoice_no: string;
    invoice_date: string;
    distributor: string;
    bottles: number;
    unit_cost: number | null;
  }[];
  recent_sales_days: {
    sale_date: string;
    qty: number;
    amount: number;
  }[];
  counts: {
    counted_at: string;
    qty: number;
    note: string | null;
  }[];
  adjustments: {
    created_at: string;
    delta: number;
    reason: string;
  }[];
}

export interface ApiPurchaseOrderLine {
  id: number;
  po_id: number;
  product_id: number;
  name: string;
  size: string | null;
  brand?: string | null;
  category?: string;
  cases: number;
  bottles: number;
  case_size: number;
  units_per_case?: number | null;
  cost: number | null;
  price: number | null;
  case_cost: number;
  line_total: number;
}

export interface ApiPurchaseOrder {
  id: number;
  distributor: string;
  status: 'draft' | 'ordered';
  total_cases: number;
  total_cost: number;
  meets_minimum: boolean;
  minimum_text: string;
  fee_warning: string | null;
  items: ApiPurchaseOrderLine[];
  ordered_at?: string | null;
  created_at?: string;
  updated_at?: string;
}



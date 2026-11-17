# Qilbo brain: every store problem, and the engine that solves it

Qilbo is read-only toward the store. It reads POS reports, invoices and the owner's own inputs, raises
findings every morning, and the owner approves or skips. An approved finding becomes **verified** when the
next day's data shows the problem is gone.

Status: ✅ built (Phase 1) · 🔜 next phase · 🔌 partner connection later

## 1. Price & margin (`engine = price`)
| Problem | Check | Status |
|---|---|---|
| Items rang up at $0.00 | `zero_price_sale` | ✅ |
| Selling under cost | `below_cost` | ✅ |
| Under the margin goal (per category: spirits 35%, wine 30%, beer 20%) | `low_margin` | ✅ |
| Distributor raised cost, shelf price didn't follow | `cost_increase` | ✅ |
| Small bottle cheaper per ml than a bigger one | `size_ladder` | ✅ |
| Rang under the shelf price (discounts, old register price) | `rang_under` | ✅ |
| Too expensive / too cheap vs nearby stores | competitor price list | 🔜 |
| Singles and broken cases priced wrong | break-pack pricing | 🔜 |
| Card surcharge / cash price set up wrong | surcharge check | 🔜 |

## 2. Invoices & deals (`engine = invoice`)
| Problem | Check | Status |
|---|---|---|
| Delivery short of what was ordered | `short_delivery` (PO vs invoice) | ✅ |
| New item received but never set up in the POS | `not_in_pos` | ✅ |
| Missed case, mix-and-match and combo deals | deals catalog from distributor portals | 🔜 |
| Credit memos never followed up | credit tracking | 🔜 |
| Hours typing invoices | invoice photo/PDF reading (exists: Telegram upload) | ✅ |
| Cheaper at another distributor | cross-distributor cost compare | 🔜 |
| Manufacturer rebates and buydowns | rebate tracker | 🔜 |

## 3. Stock & reorder (`engine = stock`)
| Problem | Check | Status |
|---|---|---|
| Best sellers out of stock | `out_of_stock` | ✅ |
| About to run out | `running_low` | ✅ |
| Money stuck in dead stock | `dead_stock` | ✅ |
| Over-ordering slow items to hit a deal | deal vs pace check | 🔜 |
| Stock count drifting | count reminders (exists: needs_count) | 🔜 |
| Holiday and game-day planning | calendar-aware reorder | 🔜 |

## 4. Loss watch (`engine = loss`) 🔜
$0 and heavy manual discounts (partly in price engine), voids/refunds/no-sales by shift and cashier, counts vs sales.
Cameras: 🔌 partner.

## 5. Customers (`engine = customer`) 🔜
Customer requests (table `customer_requests` is in place) raised when ordering from that distributor;
repeat-buyer items. Loyalty and texts: 🔌 partner. Delivery apps: 🔌 partner.

## 6. Ops & staff (`engine = ops`) 🔜
Daily brief for staff, shelf tag vs register mismatch, custom UPCs and barcode labels. Scheduling and payroll: 🔌 partner.

## 7. Compliance & cash (`engine = compliance`) 🔜
License and permit renewals, items in the wrong tax department, big invoices due in a slow week, flavor bans,
state minimum-price rules. ID scanning: 🔌 partner.

## 8. Store-type packs 🔜
Liquor (special orders, slow wine), convenience (lottery and bill pay kept out of margins, short-dated food),
smoke and vape (carton/pack/single, flavors, age-restricted items).

## How it runs
- `src/brain.js` holds the checks. `runBrain(db)` runs them all, saves findings in `findings`, refreshes ones
  that are still true, and closes ones that went away (approved → verified, untouched → cleared).
- The 9:45 AM cron runs the brain after the morning report and sends the top findings to Telegram with
  Approve / Skip buttons. `/brain` (or `/brain run`) in Telegram does the same on demand.
- Dashboard: **Brain** tab (`qilbo-app/src/components/dashboard/BrainTab.tsx`), API `GET /api/brain`,
  `POST /api/brain/run`, `POST /api/brain/:id/approve|skip|reopen`.
- Settings keys: `margin_target`, `margin_target_beer`, `margin_target_wine`, `margin_target_other`.
- Tests: `node test/brain.test.js` (built-in fixture) or `node test/brain.test.js path/to/store.db`.

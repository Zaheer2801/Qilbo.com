# Qilbo - NRS Daily Sales & Live Stock Ingestion Pipeline

This pipeline automatically extracts your **NRS (National Retail Solutions)** daily sales reports from **Gmail**, archives raw backup copies to **Google Drive**, ingests product sales into the **Database**, and updates **Qilbo's Live Stock & Procurement Monitor**.

---

## 🏗️ Architecture

```
[ NRS Email in Gmail (no-reply@nrsplus.com) ]
                      │
                      ▼
            [ nrs_pipeline/ ]
   ├── gmail_scraper.py   -> Fetches daily email attachment
   ├── gdrive_uploader.py -> Archives raw CSV to Google Drive
   ├── parser.py          -> Parses UPCs, sales qty, revenues & top-shelf spirits
   └── db.py              -> Updates SQLite / Cloud DB (deducts stock & calculates pace)
                      │
                      ▼
              [ Qilbo App ]
   ├── Top Shelf Monitor  -> Live tracking of high-value bottles (Tequila, Cognac, Bourbon)
   ├── Live Stock Count   -> Remaining inventory on hand
   └── Procurement POs    -> Reorder recommendations based on actual daily sales
```

---

## ⚡ Quick Start

### 1. Configure Gmail Credentials
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Open `.env` and fill in:
* `GMAIL_USER`: Your Gmail address (e.g. `zshaik2801@gmail.com`)
* `GMAIL_APP_PASSWORD`: A 16-character Google App Password
  *(Generate in 30 seconds at: [Google Account Security](https://myaccount.google.com/security) → 2-Step Verification → App Passwords → Name it "Qilbo")*

---

### 2. Available Commands

| Command | Description |
| :--- | :--- |
| `npm run sync:gmail` | Checks Gmail, downloads today's NRS report, archives it, and updates Qilbo |
| `npm run sync:sample` | Ingests the sample report (`Sample Data/nrs_sample_report_2026-10-19.csv`) for testing |
| `npm run summary` | Prints the terminal Executive Summary (Top-shelf sales & stock alerts) |
| `npm run server` | Starts the Qilbo local API server (`http://localhost:8787`) |
| `npm run web` | Launches the interactive Qilbo Web App (`http://localhost:5173`) |

---

### 3. Using the Web Dashboard
1. Start the server & web app:
   ```bash
   npm run server
   npm run web
   ```
2. Open `http://localhost:5173/` in your browser.
3. Click the **"Sync NRS Feed"** button in the top header to trigger an instant update.
4. Go to **Procurement & POs** to see:
   * **⭐ Top Shelf Spirits & Premium Inventory**: Dedicated cards for Tequila Corralejo, Don Julio Reposado, Courvoisier, Hennessy, Jim Beam, Crown Royal, showing current bottles in stock and days of inventory left.
   * **At or Below Reorder Point**: 1-click **Draft PO** buttons with suggested order quantities based on real daily sales volume.

---

## ⏰ Automated Daily Scheduling (macOS)

To have your report fetched automatically every morning at 8:30 AM without opening a terminal:

Create a `cron` job by running:
```bash
crontab -e
```
Add the following line:
```cron
30 8 * * * cd "/Users/zaheer/Daily Reports" && /usr/bin/python3 -m nrs_pipeline.sync_engine --fetch-gmail >> sync.log 2>&1
```

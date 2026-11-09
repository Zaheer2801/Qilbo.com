# QILBO – Discount Liquor (Production Setup & Operations Manual)

**Store:** Discount Liquor, 2105 E Orange Ave, Eustis FL 32726  
**Owner:** Zaheer Shaikh  
**Production URL:** [https://discount-liquor.zshaik2801.workers.dev](https://discount-liquor.zshaik2801.workers.dev)  
**Cloudflare Account:** `29fc52eb0b2fc68ce0d5685fad523d73`  
**D1 Database:** `discount-liquor` (`6c243ecc-4805-49f3-b0f0-6a4b5504bcd0`)  
**R2 Bucket:** `discount-liquor-files`  

---

## 1. System Overview

QILBO is a serverless retail management stack deployed on Cloudflare Workers:
- **Backend (`src/index.js`):** REST API, webhooks, Gemini AI integration, stock ledger logic.
- **Frontend (`qilbo-app/`):** React + Tailwind mobile-first PWA served via Cloudflare Workers Static Assets.
- **Database (Cloudflare D1):** Edge SQLite database storing products, UPCs, sales, invoices, and stock counts.
- **File Storage (Cloudflare R2):** Encrypted object store for invoice PDFs and receipt photos.
- **Automation Triggers:**
  - Scheduled hourly cron checking Daylight Saving time (`America/New_York`) to dispatch 9:45 AM daily summaries and Monday 9:30 AM orders report to Telegram.
  - Google Apps Script auto-syncing Gmail NRS sales CSVs and Wayne Densch invoices.

---

## 2. Managing Credentials & Secrets

All secrets are stored securely in Cloudflare's encrypted secret store and never committed to git.

### Changing the Dashboard Password
To change the password you use to log into the web app:
```bash
echo -n "NewPasswordHere" | npx wrangler secret put DASHBOARD_PASSWORD
```

### Rotating the Gemini API Key
If you rotate your Gemini API key:
```bash
echo -n "NewGeminiApiKey" | npx wrangler secret put GEMINI_API_KEY
```

### Changing the AI Model
The model is set to the stable release: `gemini-3.5-flash`.
To switch models (e.g. to a future release):
1. Update `wrangler.toml`:
   ```toml
   [vars]
   GEMINI_MODEL = "gemini-3.5-flash"
   ```
2. Deploy the change:
   ```bash
   npx wrangler deploy
   ```

### Rotating Telegram Bot Token & Webhook Secret
```bash
# 1. Update bot token
echo -n "YOUR_NEW_BOT_TOKEN" | npx wrangler secret put TELEGRAM_BOT_TOKEN

# 2. Update webhook secret
SECRET=$(openssl rand -hex 24)
echo -n "$SECRET" | npx wrangler secret put TELEGRAM_WEBHOOK_SECRET

# 3. Register webhook with Telegram
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://discount-liquor.zshaik2801.workers.dev/telegram","secret_token":"'"$SECRET"'"}'
```

---

## 3. Google Apps Script Setup (Automated Sales & Invoices)

The script in `google_cloud_sync/DailyReportSync.gs` automates downloading daily sales reports and Wayne Densch invoices from Gmail directly to your Cloudflare app.

### Steps to Deploy in Google:
1. Open [script.google.com](https://script.google.com/) and open your existing project (or create a new project named **QILBO Daily Report Sync**).
2. Open the file `Code.gs` in the editor.
3. Replace all existing contents with the code inside `google_cloud_sync/DailyReportSync.gs`.
4. Click **Save** (💾).
5. In the toolbar function dropdown, select **`setupHourlyTrigger`** and click **Run**.
   - If prompted for permissions, click **Review Permissions** $\rightarrow$ select your Google account $\rightarrow$ Advanced $\rightarrow$ Go to project (unsafe) $\rightarrow$ **Allow**.
6. Select **`autoSync`** from the function dropdown and click **Run** to execute an immediate test sync. Check **View $\rightarrow$ Execution Log** to confirm it processed recent reports.

---

## 4. Backups and Database Maintenance

### Export D1 Database Backup:
```bash
npx wrangler d1 export discount-liquor --remote --output=./backup-$(date +%F).sql
```

### Querying Remote Database Directly:
```bash
npx wrangler d1 execute discount-liquor --remote --command="SELECT COUNT(*) FROM products;"
```

---

## 5. Daily Operations & Telegram Commands

| Command | Action |
| :--- | :--- |
| `/stock <item>` | Check current stock, units received, sold, and arithmetic |
| `/setcount <item> <qty>` | Record an exact shelf count (sets the new ledger baseline) |
| `/noreorder <item>` | Toggle do-not-reorder flag for discontinued/overstock products |
| `/price <item> <price>` | Set a fixed manual shelf price (overrides register estimate) |
| `/sales [date]` | View store sales, scanned items, and top categories |
| `/orders` | View suggested purchase orders based on 30-day velocity |
| `/undo` | Roll back the most recent stock count or adjustment |

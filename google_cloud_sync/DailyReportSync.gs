/**
 * DISCOUNT LIQUOR – EMAIL -> DRIVE -> CLOUDFLARE FEED  (replaces the old DailyReportSync)
 *
 * Every hour:
 *  1. Copies new NRS "Daily Sales Report" CSVs from Gmail into Drive (same as before).
 *  2. Sends every new daily report to your Cloudflare app (sales + Telegram summary).
 *  3. Sends new Wayne Densch invoice PDFs (from Rt04@wdi.com) to the app –
 *     the bot reads them and asks you on Telegram before saving.
 *
 * ONE-TIME SETUP
 *  a) Fill in WORKER_URL and INGEST_KEY below (from the setup guide).
 *  b) Run  setupHourlyTrigger  once (approve permissions).
 *  c) Run  autoSync  once to test – check View > Logs.
 */

const GDRIVE_FOLDER_ID = "1gAbnMOPg6v42wzxWrzB57a-4-m8Igpwm";   // Discount_Liquors_2026 > Daily_reports
const WORKER_URL = "https://discount-liquor.zshaik2801.workers.dev";  // ← paste your app address
const INGEST_KEY = "PASTE_INGEST_KEY_HERE";                               // ← same value you saved in Cloudflare

const SALES_QUERY = 'from:no-reply@nrsplus.com subject:"Daily Sales Report" has:attachment';
const WDI_QUERY   = 'from:Rt04@wdi.com has:attachment';

function autoSync() {
  syncSalesReportsToDrive_();
  pushNewReportsToApp_();
  pushWayneDenschInvoices_();
}

function setupHourlyTrigger() {
  ScriptApp.getProjectTriggers().forEach(t => {
    const fn = t.getHandlerFunction();
    if (fn === "autoSync" || fn === "autoSyncDailySalesReports") ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger("autoSync").timeBased().everyHours(1).create();
  Logger.log("✅ Hourly trigger registered");
}

/* ---------- 1. Gmail -> Drive ---------- */
function syncSalesReportsToDrive_() {
  const folder = DriveApp.getFolderById(GDRIVE_FOLDER_ID);
  const existing = new Set(); const it = folder.getFiles();
  while (it.hasNext()) existing.add(it.next().getName());
  GmailApp.search(SALES_QUERY + " newer_than:3d", 0, 20).forEach(th => th.getMessages().forEach(msg => {
    msg.getAttachments().forEach(att => {
      if (!/\.csv$/i.test(att.getName()) && att.getContentType() !== "text/csv") return;
      const name = formatFilename(msg.getSubject(), att.getName());
      if (existing.has(name)) return;
      folder.createFile(att.copyBlob().setName(name)); existing.add(name);
      Logger.log("✅ Saved to Drive: " + name);
    });
  }));
}

/* ---------- 2. Drive -> Cloudflare ---------- */
function pushNewReportsToApp_() {
  const props = PropertiesService.getScriptProperties();
  const sent = JSON.parse(props.getProperty("sentReports") || "[]");
  const folder = DriveApp.getFolderById(GDRIVE_FOLDER_ID);
  const files = folder.searchFiles('modifiedDate > "' + isoDaysAgo_(5) + '" and title contains "Daily_Sales_Report"');
  while (files.hasNext()) {
    const f = files.next(); const name = f.getName();
    if (sent.indexOf(name) >= 0 || !/\d{4}-\d{2}-\d{2}/.test(name)) continue;
    const res = UrlFetchApp.fetch(WORKER_URL + "/ingest/sales?file=" + encodeURIComponent(name), {
      method: "post", contentType: "text/csv", payload: f.getBlob().getDataAsString(),
      headers: { "x-ingest-key": INGEST_KEY }, muteHttpExceptions: true });
    Logger.log(name + " -> " + res.getResponseCode() + " " + res.getContentText().slice(0, 200));
    if (res.getResponseCode() === 200) sent.push(name);
  }
  props.setProperty("sentReports", JSON.stringify(sent.slice(-120)));
}

/* ---------- 3. Wayne Densch invoices -> Cloudflare ---------- */
function pushWayneDenschInvoices_() {
  const props = PropertiesService.getScriptProperties();
  const sent = JSON.parse(props.getProperty("sentInvoices") || "[]");
  GmailApp.search(WDI_QUERY + " newer_than:3d", 0, 20).forEach(th => th.getMessages().forEach(msg => {
    msg.getAttachments().forEach(att => {
      const id = msg.getId() + "|" + att.getName();
      if (sent.indexOf(id) >= 0) return;
      const type = att.getContentType();
      if (!/pdf|image/.test(type)) return;
      const res = UrlFetchApp.fetch(WORKER_URL + "/ingest/invoice?distributor=" + encodeURIComponent("Wayne Densch") +
          "&file=" + encodeURIComponent(att.getName()), {
        method: "post", contentType: type, payload: att.getBytes(), headers: { "x-ingest-key": INGEST_KEY }, muteHttpExceptions: true });
      Logger.log("WDI " + att.getName() + " -> " + res.getResponseCode());
      if (res.getResponseCode() === 200) sent.push(id);
    });
  }));
  props.setProperty("sentInvoices", JSON.stringify(sent.slice(-200)));
}

/* ---------- helpers ---------- */
function isoDaysAgo_(n) { const d = new Date(Date.now() - n * 864e5); return d.toISOString(); }

/** "Daily Sales Report (87287) Nov 5, 2026"  ->  Daily_Sales_Report_87287_2026-11-05.csv */
function formatFilename(subject, fallback) {
  let store = "Store";
  const s = subject.match(/\((\d{5,6})\)/); if (s) store = s[1];
  const d = subject.match(/([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(\d{4})/);
  if (!d) return fallback;
  const months = { jan:"01", feb:"02", mar:"03", apr:"04", may:"05", jun:"06", jul:"07", aug:"08", sep:"09", oct:"10", nov:"11", dec:"12" };
  return "Daily_Sales_Report_" + store + "_" + d[3] + "-" + (months[d[1].slice(0, 3).toLowerCase()] || "00") + "-" + ("0" + d[2]).slice(-2) + ".csv";
}

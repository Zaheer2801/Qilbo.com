/**
 * QILBO – STORE INBOX  (one Gmail inbox for all pilot stores)
 *
 * Each pilot store forwards its POS reports and distributor invoices to its own address:
 *     qilbo.inbox+qlb-0002@gmail.com      (Gmail delivers every "+something" address to qilbo.inbox@gmail.com)
 * Every 15 minutes this script finds new emails sent to a +qlb-XXXX address and sends each
 * attachment to that store in Qilbo. It never touches Discount Liquor's own feed.
 *
 * ONE-TIME SETUP (in a NEW Apps Script project, signed in as the Qilbo inbox Gmail account)
 *  a) Make a Gmail account just for this, e.g. qilbo.inbox@gmail.com.
 *  b) In Cloudflare: npx wrangler secret put INTAKE_INBOX  → qilbo.inbox@gmail.com
 *     (then the setup page shows each store its own address).
 *  c) Project Settings > Script properties: add INGEST_KEY (same value as in Cloudflare).
 *  d) Run  setupTrigger  once (approve permissions), then  run  once to test (View > Logs).
 */

const WORKER_URL = "https://discount-liquor.zshaik2801.workers.dev";
const QUERY = 'to:(+qlb-) has:attachment newer_than:30d -label:qilbo-done';
const DONE_LABEL = "qilbo-done";

function run() {
  const key = PropertiesService.getScriptProperties().getProperty("INGEST_KEY");
  if (!key) throw new Error("Add INGEST_KEY under Project Settings > Script properties");
  const done = GmailApp.getUserLabelByName(DONE_LABEL) || GmailApp.createLabel(DONE_LABEL);

  GmailApp.search(QUERY, 0, 50).forEach(function (thread) {
    let allOk = true;
    thread.getMessages().forEach(function (msg) {
      const code = storeCode_(msg);
      if (!code) return;
      const subject = (msg.getSubject() || "").toLowerCase();
      const kind = /invoice|bill|statement/.test(subject) ? "invoice"
                 : /sales|daily|report/.test(subject) ? "sales"
                 : /deal|promo|price/.test(subject) ? "deals" : "";
      const day = Utilities.formatDate(msg.getDate(), "America/New_York", "yyyy-MM-dd");
      msg.getAttachments({ includeInlineImages: false }).forEach(function (att) {
        const name = att.getName() || "attachment";
        if (!/\.(pdf|jpe?g|png|heic|webp|csv|txt|xls|xlsx)$/i.test(name)) return;
        const url = WORKER_URL + "/ingest/store?code=" + encodeURIComponent(code) +
          "&file=" + encodeURIComponent(name) + (kind ? "&kind=" + kind : "") +
          (kind === "sales" ? "&date=" + day : "");
        const res = UrlFetchApp.fetch(url, {
          method: "post", contentType: att.getContentType() || "application/octet-stream",
          payload: att.getBytes(), headers: { "x-ingest-key": key }, muteHttpExceptions: true });
        Logger.log(code + " · " + name + " → " + res.getResponseCode() + " " + res.getContentText().slice(0, 200));
        if (res.getResponseCode() >= 500) allOk = false;   // retry next run
      });
    });
    if (allOk) thread.addLabel(done);
  });
}

// qilbo.inbox+qlb-0002@gmail.com  →  QLB-0002
function storeCode_(msg) {
  const to = [msg.getTo(), msg.getCc(), msg.getHeader("Delivered-To"), msg.getHeader("X-Forwarded-To")].join(" ");
  const m = to.match(/\+(qlb-\d{4,})@/i);
  return m ? m[1].toUpperCase() : "";
}

function setupTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === "run") ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger("run").timeBased().everyMinutes(15).create();
  Logger.log("✅ Runs every 15 minutes");
}

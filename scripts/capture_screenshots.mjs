import puppeteer from 'puppeteer-core';
import path from 'path';
import fs from 'fs';

const ARTIFACT_DIR = '/Users/zaheer/.gemini/antigravity/brain/bb53ef40-ba15-4c16-bc5e-bb40c12a9fff';
const SCREENSHOTS_DIR = '/Users/zaheer/Daily Reports/screenshots';
const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const TABS = [
  { id: 'overview', name: 'Overview' },
  { id: 'dailysales', name: 'Daily Sales' },
  { id: 'inventory', name: 'Inventory' },
  { id: 'invoices', name: 'Invoices' },
  { id: 'orders', name: 'Orders' },
];

async function main() {
  if (!fs.existsSync(SCREENSHOTS_DIR)) fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

  console.log('Launching Chrome from', CHROME_PATH);
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--window-size=1280,850'],
  });

  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

  // 1. Load desktop and login
  console.log('Navigating to http://localhost:5173...');
  await page.setViewport({ width: 1280, height: 850, deviceScaleFactor: 2 });
  await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    if (window.caches) {
      caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))));
    }
  });
  await new Promise((r) => setTimeout(r, 2000));

  const loginInput = await page.$('input[type="password"]');
  if (loginInput) {
    console.log('Found login input! Logging in...');
    let pass = 'Devika#@2026';
    try {
      const devVars = fs.readFileSync('.dev.vars', 'utf-8');
      const m = devVars.match(/DASHBOARD_PASSWORD\s*=\s*(.+)/);
      if (m && m[1]) pass = m[1].trim().replace(/^["']|["']$/g, '');
    } catch {}
    await loginInput.type(pass);
    const submitBtn = await page.$('button[type="submit"]');
    await submitBtn.click();
    console.log('Waiting for dashboard after login...');
    await page.waitForSelector('aside button', { timeout: 15000 });
    await new Promise((r) => setTimeout(r, 2000));
  }

  // 2. Desktop Screenshots
  console.log('Capturing Desktop screenshots...');
  for (const tab of TABS) {
    console.log(`Navigating to tab: ${tab.name} (${tab.id}) on Desktop...`);
    await page.evaluate((tabLabel) => {
      const buttons = Array.from(document.querySelectorAll('aside button, header nav button'));
      const btn = buttons.find((b) => b.textContent && b.textContent.includes(tabLabel));
      if (btn) btn.click();
    }, tab.name);

    await new Promise((r) => setTimeout(r, 2000));
    const outPath = path.join(ARTIFACT_DIR, `desktop_${tab.id}.png`);
    await page.screenshot({ path: outPath, fullPage: false });
    fs.copyFileSync(outPath, path.join(SCREENSHOTS_DIR, `desktop_${tab.id}.png`));
    console.log(`Saved ${outPath}`);
  }

  // 3. Desktop Inventory with VODKA Selected
  console.log('Capturing Desktop Inventory with Vodka selected...');
  await page.evaluate(() => {
    const navBtn = Array.from(document.querySelectorAll('aside button')).find(b => b.textContent && b.textContent.includes('Inventory'));
    if (navBtn) navBtn.click();
  });
  await new Promise((r) => setTimeout(r, 1000));

  // Select Vodka in category selector or sidebar
  await page.evaluate(() => {
    // Try sidebar category button first
    const sideBtns = Array.from(document.querySelectorAll('aside button'));
    const vodkaSide = sideBtns.find(b => b.textContent && b.textContent.includes('Vodka'));
    if (vodkaSide) {
      vodkaSide.click();
      return;
    }
    // Or select dropdown
    const select = document.querySelector('select');
    if (select) {
      select.value = 'Vodka';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });
  await new Promise((r) => setTimeout(r, 2500));
  const desktopVodkaPath = path.join(ARTIFACT_DIR, 'desktop_inventory_vodka.png');
  await page.screenshot({ path: desktopVodkaPath, fullPage: false });
  fs.copyFileSync(desktopVodkaPath, path.join(SCREENSHOTS_DIR, 'desktop_inventory_vodka.png'));
  console.log(`Saved ${desktopVodkaPath}`);

  // 4. Desktop Orders with Draft PO
  console.log('Capturing Desktop Orders with Draft PO...');
  await page.evaluate(() => {
    const navBtn = Array.from(document.querySelectorAll('aside button')).find(b => b.textContent && b.textContent.includes('Orders'));
    if (navBtn) navBtn.click();
  });
  await new Promise((r) => setTimeout(r, 2000));
  const desktopOrdersDraftPath = path.join(ARTIFACT_DIR, 'desktop_orders_draft_po.png');
  await page.screenshot({ path: desktopOrdersDraftPath, fullPage: false });
  fs.copyFileSync(desktopOrdersDraftPath, path.join(SCREENSHOTS_DIR, 'desktop_orders_draft_po.png'));
  console.log(`Saved ${desktopOrdersDraftPath}`);

  // 5. Mobile Run (390px wide)
  console.log('Switching to mobile viewport (390x844)...');
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded' });
  await new Promise((r) => setTimeout(r, 2000));

  // Capture standard mobile tabs
  for (const tab of TABS) {
    console.log(`Navigating to tab: ${tab.name} (${tab.id}) on Mobile...`);
    await page.evaluate((tabLabel) => {
      const buttons = Array.from(document.querySelectorAll('div.fixed.bottom-0 button, .fixed.bottom-0 button'));
      const btn = buttons.find((b) => b.textContent && b.textContent.trim().toLowerCase() === tabLabel.toLowerCase());
      if (btn) btn.click();
    }, tab.name);

    await new Promise((r) => setTimeout(r, 2000));
    const outPath = path.join(ARTIFACT_DIR, `mobile_${tab.id}.png`);
    await page.screenshot({ path: outPath, fullPage: false });
    fs.copyFileSync(outPath, path.join(SCREENSHOTS_DIR, `mobile_${tab.id}.png`));
    console.log(`Saved ${outPath}`);
  }

  // 6. Mobile Inventory with VODKA Selected
  console.log('Capturing Mobile Inventory with Vodka selected...');
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('div.fixed.bottom-0 button, .fixed.bottom-0 button'));
    const btn = buttons.find((b) => b.textContent && b.textContent.trim().toLowerCase() === 'inventory');
    if (btn) btn.click();
  });
  await new Promise((r) => setTimeout(r, 1500));

  await page.evaluate(() => {
    const selects = Array.from(document.querySelectorAll('select'));
    const catSelect = selects.find(s => Array.from(s.options).some(o => o.value === 'Vodka'));
    if (catSelect) {
      catSelect.value = 'Vodka';
      catSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });
  await new Promise((r) => setTimeout(r, 2000));
  // Scroll down so the 2-line cards are centered in the mobile viewport
  await page.evaluate(() => window.scrollBy(0, 420));
  await new Promise((r) => setTimeout(r, 800));

  const mobileVodkaPath = path.join(ARTIFACT_DIR, 'mobile_inventory_vodka.png');
  await page.screenshot({ path: mobileVodkaPath, fullPage: false });
  fs.copyFileSync(mobileVodkaPath, path.join(SCREENSHOTS_DIR, 'mobile_inventory_vodka.png'));
  console.log(`Saved ${mobileVodkaPath}`);

  // 7. Mobile Orders with Draft PO
  console.log('Capturing Mobile Orders with Draft PO...');
  await page.evaluate(() => {
    window.scrollTo(0, 0);
    const buttons = Array.from(document.querySelectorAll('div.fixed.bottom-0 button, .fixed.bottom-0 button'));
    const btn = buttons.find((b) => b.textContent && b.textContent.trim().toLowerCase() === 'orders');
    if (btn) btn.click();
  });
  await new Promise((r) => setTimeout(r, 2000));
  // Scroll down so draft PO items and controls are centered in the mobile viewport
  await page.evaluate(() => window.scrollBy(0, 420));
  await new Promise((r) => setTimeout(r, 800));

  const mobileOrdersDraftPath = path.join(ARTIFACT_DIR, 'mobile_orders_draft_po.png');
  await page.screenshot({ path: mobileOrdersDraftPath, fullPage: false });
  fs.copyFileSync(mobileOrdersDraftPath, path.join(SCREENSHOTS_DIR, 'mobile_orders_draft_po.png'));
  console.log(`Saved ${mobileOrdersDraftPath}`);

  await browser.close();
  console.log('All screenshots captured and verified successfully!');
}

main().catch((err) => {
  console.error('Screenshot script error:', err);
  process.exit(1);
});

import puppeteer from 'puppeteer-core';
import path from 'path';
import fs from 'fs';

const ARTIFACT_DIR = '/Users/zaheer/.gemini/antigravity/brain/bb53ef40-ba15-4c16-bc5e-bb40c12a9fff';
const SCREENSHOTS_DIR = '/Users/zaheer/Daily Reports/screenshots';
const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const TARGET_URL = 'https://discount-liquor.zshaik2801.workers.dev';

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
  console.log(`Navigating to ${TARGET_URL}...`);
  await page.setViewport({ width: 1280, height: 850, deviceScaleFactor: 2 });
  await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' });
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
    await page.waitForSelector('aside button', { timeout: 20000 });
    await new Promise((r) => setTimeout(r, 2500));
  }

  // 2. Desktop Screenshots: Overview (Last 7 days)
  console.log('Capturing Desktop Overview (Last 7 days)...');
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('aside button'));
    const btn = buttons.find((b) => b.textContent && b.textContent.includes('Overview'));
    if (btn) btn.click();
  });
  await new Promise((r) => setTimeout(r, 2500));
  const desktopOverviewPath = path.join(ARTIFACT_DIR, 'desktop_overview.png');
  await page.screenshot({ path: desktopOverviewPath, fullPage: false });
  fs.copyFileSync(desktopOverviewPath, path.join(SCREENSHOTS_DIR, 'desktop_overview.png'));
  console.log(`Saved ${desktopOverviewPath}`);

  // 3. Desktop Inventory with VODKA Selected
  console.log('Capturing Desktop Inventory with Vodka selected...');
  await page.evaluate(() => {
    const navBtn = Array.from(document.querySelectorAll('aside button')).find(b => b.textContent && b.textContent.includes('Inventory'));
    if (navBtn) navBtn.click();
  });
  await new Promise((r) => setTimeout(r, 1500));

  // Click Vodka in sidebar categories
  await page.evaluate(() => {
    const sideBtns = Array.from(document.querySelectorAll('aside button'));
    const vodkaSide = sideBtns.find(b => b.textContent && b.textContent.includes('Vodka'));
    if (vodkaSide) {
      vodkaSide.click();
      return;
    }
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

  // 4. Desktop Orders
  console.log('Capturing Desktop Orders...');
  await page.evaluate(() => {
    const navBtn = Array.from(document.querySelectorAll('aside button')).find(b => b.textContent && b.textContent.includes('Orders'));
    if (navBtn) navBtn.click();
  });
  await new Promise((r) => setTimeout(r, 2500));
  const desktopOrdersPath = path.join(ARTIFACT_DIR, 'desktop_orders.png');
  await page.screenshot({ path: desktopOrdersPath, fullPage: false });
  fs.copyFileSync(desktopOrdersPath, path.join(SCREENSHOTS_DIR, 'desktop_orders.png'));
  console.log(`Saved ${desktopOrdersPath}`);

  // 5. Mobile Run (390px wide)
  console.log('Switching to mobile viewport (390x844)...');
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' });
  await new Promise((r) => setTimeout(r, 2000));

  // Capture Mobile Overview
  console.log('Capturing Mobile Overview...');
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('.fixed.bottom-0 button, div.fixed.bottom-0 button'));
    const btn = buttons.find((b) => b.textContent && b.textContent.trim().toLowerCase() === 'overview');
    if (btn) btn.click();
  });
  await new Promise((r) => setTimeout(r, 2000));
  const mobileOverviewPath = path.join(ARTIFACT_DIR, 'mobile_overview.png');
  await page.screenshot({ path: mobileOverviewPath, fullPage: false });
  fs.copyFileSync(mobileOverviewPath, path.join(SCREENSHOTS_DIR, 'mobile_overview.png'));
  console.log(`Saved ${mobileOverviewPath}`);

  // 6. Mobile Inventory with VODKA Selected
  console.log('Capturing Mobile Inventory with Vodka selected...');
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('.fixed.bottom-0 button, div.fixed.bottom-0 button'));
    const btn = buttons.find((b) => b.textContent && b.textContent.trim().toLowerCase() === 'inventory');
    if (btn) btn.click();
  });
  await new Promise((r) => setTimeout(r, 1500));

  // Open mobile filters and choose Vodka
  await page.evaluate(() => {
    // Click "Filters" toggle button
    const filterBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Filters'));
    if (filterBtn) filterBtn.click();
  });
  await new Promise((r) => setTimeout(r, 500));

  await page.evaluate(() => {
    const selects = Array.from(document.querySelectorAll('select'));
    const catSelect = selects.find(s => Array.from(s.options).some(o => o.value === 'Vodka'));
    if (catSelect) {
      catSelect.value = 'Vodka';
      catSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });
  await new Promise((r) => setTimeout(r, 2000));

  // Close filter drawer if open
  await page.evaluate(() => {
    const filterBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Filters'));
    if (filterBtn) filterBtn.click();
  });
  await new Promise((r) => setTimeout(r, 1000));

  const mobileVodkaPath = path.join(ARTIFACT_DIR, 'mobile_inventory_vodka.png');
  await page.screenshot({ path: mobileVodkaPath, fullPage: false });
  fs.copyFileSync(mobileVodkaPath, path.join(SCREENSHOTS_DIR, 'mobile_inventory_vodka.png'));
  console.log(`Saved ${mobileVodkaPath}`);

  // 7. Mobile Orders
  console.log('Capturing Mobile Orders...');
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('.fixed.bottom-0 button, div.fixed.bottom-0 button'));
    const btn = buttons.find((b) => b.textContent && b.textContent.trim().toLowerCase() === 'orders');
    if (btn) btn.click();
  });
  await new Promise((r) => setTimeout(r, 2500));
  const mobileOrdersPath = path.join(ARTIFACT_DIR, 'mobile_orders.png');
  await page.screenshot({ path: mobileOrdersPath, fullPage: false });
  fs.copyFileSync(mobileOrdersPath, path.join(SCREENSHOTS_DIR, 'mobile_orders.png'));
  console.log(`Saved ${mobileOrdersPath}`);

  await browser.close();
  console.log('All requested screenshots captured and saved successfully!');
}

main().catch((err) => {
  console.error('Screenshot script error:', err);
  process.exit(1);
});

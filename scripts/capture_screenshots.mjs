import puppeteer from 'puppeteer-core';
import path from 'path';
import fs from 'fs';

const ARTIFACT_DIR = '/Users/zaheer/.gemini/antigravity/brain/bb53ef40-ba15-4c16-bc5e-bb40c12a9fff';
const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const TABS = [
  { id: 'overview', name: 'Overview' },
  { id: 'dailysales', name: 'Daily Sales' },
  { id: 'inventory', name: 'Inventory' },
  { id: 'invoices', name: 'Invoices' },
  { id: 'orders', name: 'Orders' },
];

async function main() {
  console.log('Launching Chrome from', CHROME_PATH);
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--window-size=1280,800'],
  });

  const page = await browser.newPage();
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

  // 1. Load desktop and login
  console.log('Navigating to http://localhost:5173...');
  await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 2 });
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle0' });

  // Check if login form is present
  const loginInput = await page.$('input[type="password"]');
  if (loginInput) {
    console.log('Logging in with test password...');
    await loginInput.type('test-password-123');
    const submitBtn = await page.$('button[type="submit"]');
    await submitBtn.click();
    await page.waitForFunction(() => !document.querySelector('input[type="password"]'), { timeout: 10000 });
    await new Promise((r) => setTimeout(r, 1500));
  } else {
    console.log('Already logged in or no password prompt.');
  }

  // 2. Desktop Screenshots (5 Tabs)
  console.log('Capturing Desktop screenshots...');
  await page.setViewport({ width: 1280, height: 850, deviceScaleFactor: 2 });

  for (const tab of TABS) {
    console.log(`Navigating to tab: ${tab.name} (${tab.id}) on Desktop...`);
    await page.evaluate((tabLabel) => {
      const buttons = Array.from(document.querySelectorAll('header nav button'));
      const btn = buttons.find((b) => b.textContent && b.textContent.includes(tabLabel));
      if (btn) btn.click();
    }, tab.name);

    await new Promise((r) => setTimeout(r, 2000));
    const outPath = path.join(ARTIFACT_DIR, `desktop_${tab.id}.png`);
    await page.screenshot({ path: outPath, fullPage: false });
    console.log(`Saved ${outPath}`);
  }

  // Desktop Modal Audit Demo
  console.log('Capturing Desktop Product Audit Modal...');
  await page.evaluate(() => {
    const navBtn = Array.from(document.querySelectorAll('header nav button')).find(b => b.textContent && b.textContent.includes('Inventory'));
    if (navBtn) navBtn.click();
  });
  await new Promise((r) => setTimeout(r, 1500));
  await page.evaluate(() => {
    const rows = document.querySelectorAll('tbody tr');
    if (rows.length > 5) rows[5].click();
    else if (rows.length > 0) rows[0].click();
  });
  await new Promise((r) => setTimeout(r, 1500));
  const desktopModalPath = path.join(ARTIFACT_DIR, 'desktop_modal_audit.png');
  await page.screenshot({ path: desktopModalPath, fullPage: false });
  console.log(`Saved ${desktopModalPath}`);

  // Refresh page before mobile run
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 1500));

  // 3. Mobile Screenshots (390px wide, 5 Tabs)
  console.log('Capturing Mobile (390px) screenshots...');
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });

  for (const tab of TABS) {
    console.log(`Navigating to tab: ${tab.name} (${tab.id}) on Mobile...`);
    await page.evaluate((tabLabel) => {
      const buttons = Array.from(document.querySelectorAll('div.fixed.bottom-0 button'));
      const btn = buttons.find((b) => b.textContent && b.textContent.trim().toLowerCase() === tabLabel.toLowerCase());
      if (btn) btn.click();
    }, tab.name);

    await new Promise((r) => setTimeout(r, 2000));
    const outPath = path.join(ARTIFACT_DIR, `mobile_${tab.id}.png`);
    await page.screenshot({ path: outPath, fullPage: false });
    console.log(`Saved ${outPath}`);
  }

  // Mobile Modal Audit Demo
  console.log('Capturing Mobile Product Audit Modal...');
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('div.fixed.bottom-0 button'));
    const btn = buttons.find((b) => b.textContent && b.textContent.trim().toLowerCase() === 'inventory');
    if (btn) btn.click();
  });
  await new Promise((r) => setTimeout(r, 1500));
  await page.evaluate(() => {
    const rows = document.querySelectorAll('tbody tr');
    if (rows.length > 5) rows[5].click();
    else if (rows.length > 0) rows[0].click();
  });
  await new Promise((r) => setTimeout(r, 1500));
  const mobileModalPath = path.join(ARTIFACT_DIR, 'mobile_modal_audit.png');
  await page.screenshot({ path: mobileModalPath, fullPage: false });
  console.log(`Saved ${mobileModalPath}`);

  await browser.close();
  console.log('All screenshots captured successfully!');
}

main().catch((err) => {
  console.error('Screenshot script error:', err);
  process.exit(1);
});

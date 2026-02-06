import { chromium } from 'playwright-core';

const url = 'http://localhost:3002/?token=test-token';
const executablePath = '/Users/yunxuanhan/Library/Caches/ms-playwright/chromium-1208/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';

const browser = await chromium.launch({ headless: true, executablePath });
const page = await browser.newPage();
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await page.screenshot({ path: '/tmp/mb_web_recon.png', fullPage: true });

const inputs = await page.locator('input, textarea').all();
console.log('INPUT_COUNT', inputs.length);
for (let i = 0; i < Math.min(inputs.length, 20); i += 1) {
  const el = inputs[i];
  const type = await el.getAttribute('type');
  const name = await el.getAttribute('name');
  const placeholder = await el.getAttribute('placeholder');
  console.log('INPUT', i, type, name, placeholder);
}

const buttons = await page.locator('button').all();
console.log('BUTTON_COUNT', buttons.length);
for (let i = 0; i < Math.min(buttons.length, 30); i += 1) {
  const text = (await buttons[i].innerText())?.trim().replace(/\n/g, ' ') || '';
  console.log('BUTTON', i, text.slice(0, 60));
}

await browser.close();

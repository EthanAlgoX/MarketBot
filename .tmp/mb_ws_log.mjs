import { chromium } from 'playwright-core';

const url = 'http://localhost:3002/?token=test-token';
const executablePath = '/Users/yunxuanhan/Library/Caches/ms-playwright/chromium-1208/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';

const browser = await chromium.launch({ headless: true, executablePath });
const page = await browser.newPage();
page.on('websocket', (ws) => {
  ws.on('framesent', (frame) => {
    try {
      const msg = JSON.parse(frame.payload);
      if (msg?.method === 'connect') {
        console.log('CONNECT_SENT', msg);
      }
    } catch {}
  });
  ws.on('framereceived', (frame) => {
    // console.log('RECV', frame.payload);
  });
});

await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(3000);
await browser.close();

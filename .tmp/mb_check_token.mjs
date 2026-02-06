import { chromium } from 'playwright-core';

const url = 'http://localhost:3002/?token=test-token';
const executablePath = '/Users/yunxuanhan/Library/Caches/ms-playwright/chromium-1208/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';

const browser = await chromium.launch({ headless: true, executablePath });
const page = await browser.newPage();
await page.goto(url, { waitUntil: 'networkidle' });
const token = await page.evaluate(() => new URLSearchParams(window.location.search).get('token'));
console.log('TOKEN', token);
await browser.close();

import { chromium } from 'playwright-core';

const url = 'http://localhost:3002/?token=test-token';
const executablePath = '/Users/yunxuanhan/Library/Caches/ms-playwright/chromium-1208/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';

const browser = await chromium.launch({ headless: true, executablePath });
const page = await browser.newPage();
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

const prompt = '分析黄金行情，并检查分析输出的流程是否合理准确（不使用web_search；如需外部数据只用可直接访问的web_fetch或本地skills）。';
const promptInput = page.getByPlaceholder('Direct MarketBot intelligence...');
await promptInput.fill(prompt);

const runButton = page.getByRole('button', { name: 'RUN' });
await runButton.click();

await page.waitForTimeout(90000);

await page.screenshot({ path: '/tmp/mb_web_run.png', fullPage: true });
const bodyText = await page.evaluate(() => document.body.innerText);
await browser.close();

console.log('BODY_TEXT_START');
console.log(bodyText);
console.log('BODY_TEXT_END');

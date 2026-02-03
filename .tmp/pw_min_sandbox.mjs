import { chromium } from "playwright";
const browser = await chromium.launch({ headless: true, chromiumSandbox: true });
const page = await browser.newPage();
await page.goto("about:blank");
await browser.close();
console.log("OK");

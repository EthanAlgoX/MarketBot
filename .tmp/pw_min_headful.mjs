import { chromium } from "playwright";
const browser = await chromium.launch({ headless: false });
const page = await browser.newPage();
await page.goto("about:blank");
await browser.close();
console.log("OK");

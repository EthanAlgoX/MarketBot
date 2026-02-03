import { firefox } from "playwright";
const browser = await firefox.launch({ headless: true });
const page = await browser.newPage();
await page.goto("about:blank");
await browser.close();
console.log("OK");

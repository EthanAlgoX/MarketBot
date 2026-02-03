import { chromium } from "playwright";
const browser = await chromium.launch({
  headless: true,
  channel: "chrome",
  args: [
    "--disable-crash-reporter",
    "--disable-crashpad",
    "--no-crash-upload",
    "--disable-features=Crashpad",
  ],
});
const page = await browser.newPage();
await page.goto("about:blank");
await browser.close();
console.log("OK");

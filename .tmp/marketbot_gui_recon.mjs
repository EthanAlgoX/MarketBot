import { chromium } from "playwright";
import fs from "node:fs";

const URL = "http://localhost:3002/?token=test-token";
const EXECUTABLE_PATH = "/Users/yunxuanhan/Library/Caches/ms-playwright/chromium-1208/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing";

const browser = await chromium.launch({ headless: true, executablePath: EXECUTABLE_PATH });
const page = await browser.newPage();

const report = {
  url: URL,
  title: null,
  final_url: null,
  console_errors: [],
  page_errors: [],
  bad_responses: [],
  screenshots: [],
  elements: [],
  accessibility: null,
};

page.on("console", (msg) => {
  if (["error", "warning"].includes(msg.type())) {
    report.console_errors.push({ type: msg.type(), text: msg.text() });
  }
});
page.on("pageerror", (err) => report.page_errors.push(String(err)));
page.on("response", (resp) => {
  const status = resp.status();
  const type = resp.request().resourceType();
  if (status >= 400 && ["document", "xhr", "fetch"].includes(type)) {
    report.bad_responses.push({ status, url: resp.url(), type });
  }
});

await page.goto(URL, { waitUntil: "networkidle" });
report.title = await page.title();
report.final_url = page.url();

const screenshotPath = "/tmp/marketbot_gui_recon.png";
await page.screenshot({ path: screenshotPath, fullPage: true });
report.screenshots.push(screenshotPath);

report.accessibility = await page.accessibility.snapshot({ interestingOnly: true });

report.elements = await page.evaluate(() => {
  const selectors = [
    "button",
    "a",
    "input",
    "textarea",
    "select",
    "[role=button]",
    "[role=link]",
    "[role=tab]",
    "[role=menuitem]",
    "[role=combobox]",
    "[role=searchbox]",
    "[role=dialog]",
    "[role=alertdialog]",
    "[role=checkbox]",
    "[role=radio]",
  ];

  const pickText = (el) => {
    const text = (el.textContent || "").replace(/\s+/g, " ").trim();
    return text;
  };

  const items = [];
  const seen = new Set();
  const all = document.querySelectorAll(selectors.join(","));
  for (const el of all) {
    if (seen.has(el)) continue;
    seen.add(el);
    const rect = el.getBoundingClientRect();
    items.push({
      tag: el.tagName.toLowerCase(),
      role: el.getAttribute("role"),
      type: el.getAttribute("type"),
      id: el.id || null,
      name: el.getAttribute("name"),
      placeholder: el.getAttribute("placeholder"),
      ariaLabel: el.getAttribute("aria-label"),
      title: el.getAttribute("title"),
      text: pickText(el),
      disabled: el.hasAttribute("disabled"),
      dataTestId: el.getAttribute("data-testid") || el.getAttribute("data-test") || el.getAttribute("data-test-id"),
      className: el.className || null,
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      w: Math.round(rect.width),
      h: Math.round(rect.height),
    });
  }
  return items;
});

await browser.close();

fs.writeFileSync("/tmp/marketbot_gui_recon.json", JSON.stringify(report, null, 2));
console.log("OK");

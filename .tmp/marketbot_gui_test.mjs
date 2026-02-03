import { chromium } from "playwright";
import fs from "node:fs";

const URL = "http://localhost:3002/?token=test-token";
const MAX_CLICKS = 6;

const DANGER_WORDS = new Set([
  "delete",
  "remove",
  "destroy",
  "logout",
  "log out",
  "sign out",
  "signout",
  "reset",
  "wipe",
  "purge",
  "drop",
  "revoke",
  "disable",
  "stop",
  "shutdown",
  "kill",
  "ban",
  "block",
  "uninstall",
]);

const norm = (text) => text.replace(/\s+/g, " ").trim().toLowerCase();
const isSafe = (label) => {
  const t = norm(label || "");
  if (!t) return false;
  for (const w of DANGER_WORDS) {
    if (t.includes(w)) return false;
  }
  return true;
};

const report = {
  url: URL,
  title: null,
  final_url: null,
  counts: {},
  clicked: [],
  skipped: [],
  console_errors: [],
  page_errors: [],
  bad_responses: [],
  screenshots: [],
};

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

page.on("console", (msg) => {
  if (["error", "warning"].includes(msg.type())) {
    report.console_errors.push({ type: msg.type(), text: msg.text() });
  }
});

page.on("pageerror", (err) => {
  report.page_errors.push(String(err));
});

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

const screenshotPath = "/tmp/marketbot_gui_home.png";
await page.screenshot({ path: screenshotPath, fullPage: true });
report.screenshots.push(screenshotPath);

report.counts.buttons = await page.getByRole("button").count();
report.counts.links = await page.getByRole("link").count();
report.counts.textboxes = await page.getByRole("textbox").count();

const labelFor = async (locator, fallback) => {
  let label = "";
  try {
    label = (await locator.innerText()).trim();
  } catch {
    // ignore
  }
  if (!label) {
    try {
      label = String(await locator.getAttribute("aria-label")) || "";
      label = label.trim();
    } catch {
      // ignore
    }
  }
  if (!label) {
    try {
      label = String(await locator.getAttribute("title")) || "";
      label = label.trim();
    } catch {
      // ignore
    }
  }
  return label || fallback;
};

const clickSome = async (role, typeLabel) => {
  const items = page.getByRole(role);
  const count = await items.count();
  for (let i = 0; i < Math.min(count, MAX_CLICKS); i += 1) {
    const item = items.nth(i);
    const label = await labelFor(item, `${typeLabel}#${i}`);

    if (!isSafe(label)) {
      report.skipped.push({ type: typeLabel, label, reason: "unsafe-label" });
      continue;
    }

    try {
      const visible = await item.isVisible();
      const enabled = await item.isEnabled();
      if (!visible || !enabled) {
        report.skipped.push({ type: typeLabel, label, reason: "not-interactable" });
        continue;
      }
    } catch {
      // ignore visibility check errors and proceed to click
    }

    const beforeUrl = page.url();
    try {
      await item.click({ timeout: 2000 });
      try {
        await page.waitForLoadState("networkidle", { timeout: 5000 });
      } catch {
        // ignore
      }
      report.clicked.push({ type: typeLabel, label });

      if (page.url() !== beforeUrl) {
        await page.goBack({ waitUntil: "networkidle" });
      }
    } catch (err) {
      report.skipped.push({ type: typeLabel, label, reason: `click-error: ${err}` });
    }
  }
};

await clickSome("button", "button");
await clickSome("link", "link");

await browser.close();

fs.writeFileSync("/tmp/marketbot_gui_report.json", JSON.stringify(report, null, 2));
console.log("OK");

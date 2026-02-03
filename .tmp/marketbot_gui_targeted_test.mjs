import os from "node:os";
import fs from "node:fs";

const URL = "http://localhost:3002/?token=test-token";

if (!process.env.PLAYWRIGHT_HOST_PLATFORM_OVERRIDE) {
  if (os.platform() === "darwin" && os.arch() === "arm64") {
    const major = Number.parseInt(os.release().split(".")[0] || "15", 10);
    const macMajor = Number.isNaN(major) ? 15 : Math.min(major - 9, 15);
    process.env.PLAYWRIGHT_HOST_PLATFORM_OVERRIDE = `mac${macMajor}-arm64`;
  }
}

const { chromium } = await import("playwright");

const report = {
  url: URL,
  title: null,
  final_url: null,
  steps: [],
  console_errors: [],
  page_errors: [],
  bad_responses: [],
  screenshots: [],
};

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

const addStep = (name, status, details) => {
  report.steps.push({ name, status, details });
};

page.on("console", (msg) => {
  if (["error", "warning"].includes(msg.type())) {
    report.console_errors.push({ type: msg.type(), text: msg.text() });
  }
});
page.on("pageerror", (err) => report.page_errors.push(String(err)));
page.on("response", async (resp) => {
  const status = resp.status();
  const type = resp.request().resourceType();
  const url = resp.url();
  if (status >= 400 && ["document", "xhr", "fetch"].includes(type)) {
    let body = null;
    if (url.includes("/api/")) {
      try {
        body = await resp.text();
      } catch {
        // ignore
      }
    }
    report.bad_responses.push({ status, url, type, body });
  }
});

const screenshot = async (name) => {
  const path = `/tmp/marketbot_gui_${name}.png`;
  await page.screenshot({ path, fullPage: true });
  report.screenshots.push(path);
};

await page.goto(URL, { waitUntil: "networkidle" });
report.title = await page.title();
report.final_url = page.url();
await screenshot("targeted_home");

// Search input
const searchInput = page.locator('input[placeholder="Search tasks..."]');
if (await searchInput.count()) {
  await searchInput.first().fill("test");
  await searchInput.first().press("Enter");
  addStep("search", "done", "filled Search tasks... and pressed Enter");
  await screenshot("targeted_after_search");
} else {
  addStep("search", "skipped", "Search tasks... input not found");
}

// New Task button
const newTaskButton = page.locator('button[title="New Task"]');
if (await newTaskButton.count()) {
  await newTaskButton.first().click();
  await page.waitForTimeout(500);
  addStep("new-task", "clicked", "button[title=New Task]");
  await screenshot("targeted_after_new_task");

  const dialog = page.getByRole("dialog");
  if ((await dialog.count()) > 0) {
    addStep("modal", "detected", "dialog appeared after New Task");
  }
} else {
  addStep("new-task", "skipped", "New Task button not found");
}

// Fill direct input
const directInput = page.locator('input[placeholder="Direct MarketBot intelligence..."]');
if (await directInput.count()) {
  await directInput.first().fill("Test task from automation");
  addStep("direct-input", "done", "filled Direct MarketBot intelligence...");
} else {
  addStep("direct-input", "skipped", "Direct MarketBot intelligence... input not found");
}

// Try to enable and click Run
const runButton = page.getByRole("button", { name: /run/i });
if (await runButton.count()) {
  const btn = runButton.first();
  const enabled = await btn.isEnabled().catch(() => false);
  if (enabled) {
    await btn.click();
    await page.waitForTimeout(500);
    addStep("run", "clicked", "Run button enabled");
    await screenshot("targeted_after_run");
  } else {
    addStep("run", "skipped", "Run button still disabled");
  }
} else {
  addStep("run", "skipped", "Run button not found");
}

// Top-right round button (likely menu)
const roundButton = page.locator('button.rounded-full');
if (await roundButton.count()) {
  await roundButton.first().click();
  await page.waitForTimeout(300);
  addStep("menu", "clicked", "button.rounded-full");
  const menuItems = page.getByRole("menuitem");
  if ((await menuItems.count()) > 0) {
    addStep("menu-items", "detected", `${await menuItems.count()} menuitem(s)`);
    await screenshot("targeted_menu");
  }
} else {
  addStep("menu", "skipped", "rounded-full button not found");
}

await browser.close();

fs.writeFileSync("/tmp/marketbot_gui_targeted_report.json", JSON.stringify(report, null, 2));
console.log("OK");

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

const report = {
  url: URL,
  title: null,
  final_url: null,
  steps: [],
  console_errors: [],
  page_errors: [],
  bad_responses: [],
  screenshots: [],
  elements: [],
};

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

const addStep = (name, status, details) => {
  report.steps.push({ name, status, details });
};

const norm = (text) => (text || "").replace(/\s+/g, " ").trim().toLowerCase();
const isSafe = (label) => {
  const t = norm(label);
  if (!t) return false;
  for (const w of DANGER_WORDS) {
    if (t.includes(w)) return false;
  }
  return true;
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

const screenshot = async (name) => {
  const path = `/tmp/marketbot_gui_${name}.png`;
  await page.screenshot({ path, fullPage: true });
  report.screenshots.push(path);
};

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

const clickFirstByRoleName = async (role, regex, stepName) => {
  const locator = page.getByRole(role, { name: regex });
  const count = await locator.count();
  if (count === 0) {
    addStep(stepName, "skipped", `no ${role} matching ${regex}`);
    return false;
  }

  for (let i = 0; i < count; i += 1) {
    const item = locator.nth(i);
    const label = await labelFor(item, `${role}#${i}`);
    if (!isSafe(label)) continue;

    try {
      const visible = await item.isVisible();
      const enabled = await item.isEnabled();
      if (!visible || !enabled) continue;
    } catch {
      // ignore
    }

    try {
      await item.click({ timeout: 2000 });
      try {
        await page.waitForLoadState("networkidle", { timeout: 5000 });
      } catch {
        // ignore
      }
      addStep(stepName, "clicked", label);
      return true;
    } catch (err) {
      addStep(stepName, "failed", `${label}: ${err}`);
      return false;
    }
  }

  addStep(stepName, "skipped", "no interactable safe element found");
  return false;
};

await page.goto(URL, { waitUntil: "networkidle" });
report.title = await page.title();
report.final_url = page.url();
await screenshot("home");

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

  const pickText = (el) => (el.textContent || "").replace(/\s+/g, " ").trim();
  const items = [];
  const seen = new Set();
  for (const el of document.querySelectorAll(selectors.join(","))) {
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

// Config page
const configClicked =
  (await clickFirstByRoleName("link", /(config|settings|setup|preferences|配置|设置)/i, "open-config-link")) ||
  (await clickFirstByRoleName("button", /(config|settings|setup|preferences|配置|设置)/i, "open-config-button")) ||
  (await clickFirstByRoleName("tab", /(config|settings|setup|preferences|配置|设置)/i, "open-config-tab"));
if (configClicked) {
  await screenshot("config");
}

// Fill form fields
const textboxes = page.getByRole("textbox");
const textboxCount = await textboxes.count();
let filled = 0;
for (let i = 0; i < textboxCount; i += 1) {
  const box = textboxes.nth(i);
  try {
    const visible = await box.isVisible();
    const enabled = await box.isEnabled();
    if (!visible || !enabled) continue;
    await box.fill(`test-${i + 1}`);
    filled += 1;
  } catch {
    // ignore
  }
}
addStep("fill-form", "done", `filled ${filled} textbox(es)`);

// Try submit/save
const submitClicked =
  (await clickFirstByRoleName("button", /(save|apply|submit|update|confirm|确定|保存|提交)/i, "submit-form")) ||
  (await clickFirstByRoleName("link", /(save|apply|submit|update|confirm|确定|保存|提交)/i, "submit-form-link"));
if (submitClicked) {
  await screenshot("after-submit");
}

// Search / filter
const searchBox = page.getByRole("searchbox");
if ((await searchBox.count()) > 0) {
  const box = searchBox.first();
  await box.fill("test");
  await box.press("Enter");
  addStep("search", "done", "filled role=searchbox and pressed Enter");
  await screenshot("after-search");
} else {
  const placeholderSearch = page.getByPlaceholder(/search|filter|查询|筛选/i);
  if ((await placeholderSearch.count()) > 0) {
    const box = placeholderSearch.first();
    await box.fill("test");
    await box.press("Enter");
    addStep("search", "done", "filled placeholder search/filter and pressed Enter");
    await screenshot("after-search");
  } else {
    addStep("search", "skipped", "no search box found");
  }
}

const filterCombo = page.getByRole("combobox", { name: /filter|筛选|类型|状态/i });
if ((await filterCombo.count()) > 0) {
  const combo = filterCombo.first();
  try {
    await combo.click();
    const options = page.getByRole("option");
    if ((await options.count()) > 0) {
      await options.first().click();
      addStep("filter", "done", "selected first option in combobox");
      await screenshot("after-filter");
    } else {
      addStep("filter", "skipped", "no options in combobox");
    }
  } catch (err) {
    addStep("filter", "failed", String(err));
  }
} else {
  addStep("filter", "skipped", "no filter combobox found");
}

// Modal
const modalClicked =
  (await clickFirstByRoleName("button", /(details|more|advanced|add|new|create|详情|更多|高级|新建|创建|设置|配置)/i, "open-modal")) ||
  (await clickFirstByRoleName("link", /(details|more|advanced|add|new|create|详情|更多|高级|新建|创建|设置|配置)/i, "open-modal-link"));
if (modalClicked) {
  const dialog = page.getByRole("dialog");
  if ((await dialog.count()) > 0) {
    addStep("modal-detected", "done", "dialog detected");
    await screenshot("modal");
    await clickFirstByRoleName("button", /(close|cancel|ok|done|确认|确定|取消|关闭)/i, "close-modal");
  } else {
    addStep("modal-detected", "skipped", "no dialog found after click");
  }
}

// Execute task
const runButton = page.getByRole("button", { name: /(run|execute|start|launch|执行|运行|开始)/i });
if ((await runButton.count()) > 0) {
  const btn = runButton.first();
  const label = await labelFor(btn, "run");
  const enabled = await btn.isEnabled().catch(() => false);
  if (!enabled) {
    addStep("run", "skipped", `${label} not enabled`);
  } else if (!isSafe(label)) {
    addStep("run", "skipped", `${label} flagged unsafe`);
  } else {
    await btn.click();
    try {
      await page.waitForLoadState("networkidle", { timeout: 5000 });
    } catch {
      // ignore
    }
    addStep("run", "clicked", label);
    await screenshot("after-run");
  }
} else {
  addStep("run", "skipped", "no run/execute button found");
}

await browser.close();

fs.writeFileSync("/tmp/marketbot_gui_deep_report.json", JSON.stringify(report, null, 2));
console.log("OK");

// Modified for marketbot on 2026-10-13; see MODIFICATIONS.md.
import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { captureScreenshot, completeOnboarding, signup } from "./helpers";

function rosterRow(page: Page, name: RegExp) {
  return page.locator("[data-sidebar-group] [data-roster-bot-id]").filter({
    has: page.locator("[data-roster-bot-name]").filter({ hasText: name }),
  });
}

test("spawned bots nest under their parent and collapse", async ({ page }, testInfo) => {
  const stamp = Date.now();
  await signup(page, `reporting-tree-${stamp}@marketbot.test`, "password12", "Tree User");
  await completeOnboarding(page);

  const composer = page.locator('textarea[name="chat-message"]');
  await composer.fill("spawn a bot named Scout to research venues");
  await page.keyboard.press("Enter");

  const scout = rosterRow(page, /Scout/);
  await expect(scout).toBeVisible({ timeout: 30_000 });
  await expect(scout).toHaveAttribute("data-roster-depth", "1");
  await expect(rosterRow(page, /^Chief/)).toHaveAttribute("data-roster-depth", "0");

  const sidebar = page.locator("aside").first();
  const toggle = sidebar.getByRole("button", { name: "Collapse Chief" });
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await sidebar.getByPlaceholder("Search").hover();
  await captureScreenshot(page, testInfo, "sidebar-reporting-tree-expanded");

  await toggle.click();
  await expect(scout).toHaveCount(0);
  const expand = sidebar.getByRole("button", { name: "Expand Chief" });
  await expect(expand).toHaveAttribute("aria-expanded", "false");
  await sidebar.getByPlaceholder("Search").hover();
  await captureScreenshot(page, testInfo, "sidebar-reporting-tree-collapsed");

  await page.reload();
  await expect(sidebar.getByRole("button", { name: "Expand Chief" })).toBeVisible();
  await expect(scout).toHaveCount(0);

  await sidebar.getByRole("button", { name: "Expand Chief" }).click();
  await expect(scout).toBeVisible();

  // Alt+Arrow reorders among visible siblings, so the move shows in the tree.
  await rosterRow(page, /^Chief/).click();
  await composer.fill("spawn a bot named Ranger to scout venues");
  await page.keyboard.press("Enter");
  const ranger = rosterRow(page, /Ranger/);
  await expect(ranger).toHaveAttribute("data-roster-depth", "1", { timeout: 30_000 });
  const childOrder = () =>
    page
      .locator('[data-sidebar-group] [data-roster-depth="1"] [data-roster-bot-name]')
      .allTextContents();
  const before = await childOrder();
  expect(before).toHaveLength(2);
  const last = before[1] === "Ranger" ? ranger : scout;
  await last.focus();
  await page.keyboard.press("Alt+ArrowUp");
  await expect.poll(childOrder).toEqual([before[1], before[0]]);
});

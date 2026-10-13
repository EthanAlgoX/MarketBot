// Modified for marketbot on 2026-10-13; see MODIFICATIONS.md.

import type { MemoryDocument } from "@marketbot/contracts";
import { expect, test } from "@playwright/test";
import { completeOnboarding, rpc, signup } from "./helpers";

test("shared memory save writes without an approval card", async ({ page }) => {
  const stamp = Date.now();
  const content = `Printing jobs go to Clyde. ${stamp}`;
  await signup(page, `shared-memory-${stamp}@marketbot.test`, "password12", "Shared Memory");
  await completeOnboarding(page);

  const composer = page.getByRole("combobox", { name: "Message Chief" });
  await composer.fill(`save shared memory MEMORY.md with: ${content}`);
  await composer.press("Enter");

  await expect
    .poll(
      async () => {
        const documents = await rpc<MemoryDocument[]>(page, "memory/list", { scope: "user" });
        return documents.find((document) => document.path === "MEMORY.md")?.content;
      },
      { timeout: 30_000 },
    )
    .toBe(content);
  await expect(page.getByRole("button", { name: "Allow once", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Deny", exact: true })).toHaveCount(0);
  await expect(page.getByText(/Review before saving shared memory/)).toHaveCount(0);
});

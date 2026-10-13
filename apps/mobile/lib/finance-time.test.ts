import { expect, it } from "vitest";
import { formatFinancialDateTime } from "./finance-time";

it("uses the saved brief timezone across the midnight boundary", () => {
  const archivedAt = "2026-10-11T17:22:00Z";
  expect(formatFinancialDateTime(archivedAt, "Asia/Shanghai", "en-GB")).toBe("12/10/2026, 01:22");
  expect(formatFinancialDateTime(archivedAt, "America/New_York", "en-GB")).toBe(
    "11/10/2026, 13:22",
  );
});

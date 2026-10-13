import { expect, it } from "vitest";
import { formatFinancialDateTime as webFormat } from "./finance-time";

it.each([webFormat])("uses the saved brief timezone across the midnight boundary", (format) => {
  const archivedAt = "2026-10-11T17:22:00Z";
  expect(format(archivedAt, "Asia/Shanghai", "en-GB")).toBe("12/10/2026, 01:22");
  expect(format(archivedAt, "America/New_York", "en-GB")).toBe("11/10/2026, 13:22");
});

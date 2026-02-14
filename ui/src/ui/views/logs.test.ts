import { render } from "lit";
import { describe, expect, it, vi } from "vitest";

import { renderLogs, type LogsProps } from "./logs";

function createProps(overrides: Partial<LogsProps> = {}): LogsProps {
  return {
    language: "en",
    loading: false,
    error: null,
    file: "/tmp/marketbot.log",
    entries: [],
    filterText: "",
    levelFilters: {
      trace: true,
      debug: true,
      info: true,
      warn: true,
      error: true,
      fatal: true,
    },
    autoFollow: false,
    truncated: false,
    onFilterTextChange: () => undefined,
    onLevelToggle: () => undefined,
    onToggleAutoFollow: () => undefined,
    onRefresh: () => undefined,
    onExport: () => undefined,
    onScroll: () => undefined,
    ...overrides,
  };
}

describe("logs view", () => {
  it("renders summary stats and file basename", () => {
    const container = document.createElement("div");
    render(
      renderLogs(
        createProps({
          entries: [
            { raw: "a", level: "info", message: "info 1" },
            { raw: "b", level: "warn", message: "warn 1" },
            { raw: "c", level: "error", message: "error 1" },
          ],
        }),
      ),
      container,
    );

    expect(container.textContent).toContain("Total Entries");
    expect(container.textContent).toContain("3");
    expect(container.textContent).toContain("Warnings");
    expect(container.textContent).toContain("1");
    expect(container.textContent).toContain("Errors");
    expect(container.textContent).toContain("marketbot.log");
  });

  it("shows active-filters callout and exports filtered lines", () => {
    const container = document.createElement("div");
    const onExport = vi.fn();
    render(
      renderLogs(
        createProps({
          entries: [
            { raw: "a", level: "info", message: "gateway ok" },
            { raw: "b", level: "error", message: "gateway failed" },
          ],
          filterText: "failed",
          onExport,
        }),
      ),
      container,
    );

    expect(container.textContent).toContain("Active filters applied.");
    const exportBtn = Array.from(container.querySelectorAll("button")).find(
      (btn) => btn.textContent?.includes("Export"),
    );
    expect(exportBtn).toBeTruthy();
    exportBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(onExport).toHaveBeenCalledWith(["b"], "filtered");
  });
});

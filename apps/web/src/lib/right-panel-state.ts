// Modified for marketbot on 2026-10-13; see MODIFICATIONS.md.
export type Panel =
  | "computer"
  | "settings"
  | "routine"
  | "create"
  | "create-group"
  | "group-settings"
  | null;
export type RightPanelState = { panel: Panel; routineId?: string };

/** Panels that are safe to remember across reloads. Create flows stay ephemeral. */
const durablePanels: readonly Panel[] = ["computer", "settings", "routine", "group-settings", null];

export function rightPanelStorageKey(
  userId: string,
  spaceId: string,
  kind: "bot" | "group",
  targetId: string,
): string {
  return `marketbot:right-panel-state:${userId}:${spaceId}:${kind}:${targetId}`;
}

export function readRightPanelState(key: string): RightPanelState {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) ?? "null");
    if (
      !value ||
      typeof value !== "object" ||
      !("panel" in value) ||
      !durablePanels.includes(value.panel as Panel)
    )
      return { panel: null };
    return {
      panel: value.panel as Panel,
      ...(value.panel === "routine" &&
      "routineId" in value &&
      typeof value.routineId === "string" &&
      value.routineId
        ? { routineId: value.routineId }
        : {}),
    };
  } catch {
    return { panel: null };
  }
}

export function writeRightPanelState(key: string, panel: Panel, routineId?: string) {
  // Keep the last durable preference while create/create-group is open.
  if (panel === "create" || panel === "create-group") return;
  try {
    localStorage.setItem(
      key,
      JSON.stringify({ panel, ...(panel === "routine" && routineId ? { routineId } : {}) }),
    );
  } catch {
    // Restricted storage must not prevent opening or closing the panel.
  }
}

/*
 * Copyright (C) 2026 MarketBot
 */

import { Type } from "@sinclair/typebox";
import { stringEnum } from "../schema/typebox.js";

const DESKTOP_TOOL_ACTIONS = ["screenshot", "click", "type", "move", "wait"] as const;

export const DesktopToolSchema = Type.Object({
  action: stringEnum(DESKTOP_TOOL_ACTIONS),
  x: Type.Optional(Type.Number({ description: "Normalized X coordinate (0-1000)" })),
  y: Type.Optional(Type.Number({ description: "Normalized Y coordinate (0-1000)" })),
  text: Type.Optional(Type.String({ description: "Text to type" })),
  timeMs: Type.Optional(Type.Number({ description: "Time to wait in ms" })),
});

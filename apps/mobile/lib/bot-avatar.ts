// Modified for marketbot on 2026-10-13; see MODIFICATIONS.md.
import type { ParsedBotAvatar } from "@marketbot/contracts";
import { parseBotAvatarValue } from "@marketbot/contracts";
import { resolvePersonaColorDef, shippedBotAvatarShapePath } from "@marketbot/core";

export type MobileBotAvatarPresentation =
  | Exclude<ParsedBotAvatar, { kind: "shape" }>
  | { kind: "shape"; color: string; shapeIndex: number; shapePath: string; eyeColor: string };

/** Resolve a stored `bots.color` value for native rendering, including shape paths. */
export function mobileBotAvatarPresentation(color: string): MobileBotAvatarPresentation {
  const parsed = parseBotAvatarValue(color);
  if (parsed.kind !== "shape") return parsed;
  return {
    ...parsed,
    shapePath: shippedBotAvatarShapePath(parsed.shapeIndex),
    eyeColor: resolvePersonaColorDef("preview", parsed.color).eyeColor,
  };
}

// Modified for marketbot on 2026-10-13; see MODIFICATIONS.md.
import type { MessageBlock } from "@marketbot/contracts";

export function isToolActivityBlock(block: MessageBlock): boolean {
  return block.kind === "steps" || (block.kind === "progress" && block.activity === true);
}

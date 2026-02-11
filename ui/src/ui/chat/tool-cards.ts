import { html, nothing } from "lit";

import { formatToolDetail, resolveToolDisplay } from "../tool-display";
import { icons } from "../icons";
import type { ToolCard } from "../types/chat-types";
import {
  formatToolOutputForSidebar,
} from "./tool-helpers";
import { isToolResultMessage } from "./message-normalizer";
import { extractTextCached } from "./message-extract";

export function extractToolCards(message: unknown): ToolCard[] {
  const m = message as Record<string, unknown>;
  const content = normalizeContent(m.content);
  const cards: ToolCard[] = [];

  for (const item of content) {
    const kind = String(item.type ?? "").toLowerCase();
    const isToolCall =
      ["toolcall", "tool_call", "tooluse", "tool_use"].includes(kind) ||
      (typeof item.name === "string" && item.arguments != null);
    if (isToolCall) {
      const phase = typeof item.phase === "string" ? item.phase : undefined;
      cards.push({
        kind: "call",
        name: (item.name as string) ?? "tool",
        args: coerceArgs(item.arguments ?? item.args),
        phase,
      });
    }
  }

  for (const item of content) {
    const kind = String(item.type ?? "").toLowerCase();
    if (kind !== "toolresult" && kind !== "tool_result") continue;
    const text = extractToolText(item);
    const name = typeof item.name === "string" ? item.name : "tool";
    const phase = typeof item.phase === "string" ? item.phase : undefined;
    cards.push({ kind: "result", name, text, phase });
  }

  if (
    isToolResultMessage(message) &&
    !cards.some((card) => card.kind === "result")
  ) {
    const name =
      (typeof m.toolName === "string" && m.toolName) ||
      (typeof m.tool_name === "string" && m.tool_name) ||
      "tool";
    const text = extractTextCached(message) ?? undefined;
    cards.push({ kind: "result", name, text });
  }

  return cards;
}

/**
 * Renders a tool step as a compact inline indicator.
 *
 * - Executing: single-line with spinner + label + "..."
 * - Completed: single-line with check icon + label, muted, clickable for output
 *
 * Designed to feel transient (like a chat "typing..." indicator) rather than
 * a heavyweight block card.
 */
export function renderToolCardSidebar(
  card: ToolCard,
  onOpenSidebar?: (content: string) => void,
) {
  const display = resolveToolDisplay({ name: card.name, args: card.args });
  const detail = formatToolDetail(display);
  const hasText = Boolean(card.text?.trim());

  // A tool is executing if it has a phase that isn't "result",
  // or if it's a call card with no corresponding result yet.
  const isExecuting =
    card.phase != null && card.phase !== "result";

  const canClick = Boolean(onOpenSidebar) && !isExecuting;
  const handleClick = canClick
    ? () => {
        if (hasText) {
          onOpenSidebar!(formatToolOutputForSidebar(card.text!));
          return;
        }
        const info = `## ${display.label}\n\n${
          detail ? `**Command:** \`${detail}\`\n\n` : ""
        }*No output — tool completed successfully.*`;
        onOpenSidebar!(info);
      }
    : undefined;

  // --- Executing: transient inline indicator ---
  if (isExecuting) {
    const summary = detail ? `${display.label}: ${detail}` : display.label;
    return html`
      <div class="tool-step tool-step--executing">
        <span class="tool-step__spinner">${icons.loader}</span>
        <span class="tool-step__label">${summary}</span>
        <span class="tool-step__dots">
          <span></span><span></span><span></span>
        </span>
      </div>
    `;
  }

  // --- Completed: compact one-liner ---
  const summary = detail ? `${display.label}: ${detail}` : display.label;
  return html`
    <div
      class="tool-step tool-step--done${canClick ? " tool-step--clickable" : ""}"
      @click=${handleClick}
      role=${canClick ? "button" : nothing}
      tabindex=${canClick ? "0" : nothing}
      @keydown=${canClick
        ? (e: KeyboardEvent) => {
            if (e.key !== "Enter" && e.key !== " ") return;
            e.preventDefault();
            handleClick?.();
          }
        : nothing}
    >
      <span class="tool-step__icon">${icons.check}</span>
      <span class="tool-step__label">${summary}</span>
      ${hasText && canClick
        ? html`<span class="tool-step__view">View</span>`
        : nothing}
    </div>
  `;
}

function normalizeContent(content: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(content)) return [];
  return content.filter(Boolean) as Array<Record<string, unknown>>;
}

function coerceArgs(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed) return value;
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return value;
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

function extractToolText(item: Record<string, unknown>): string | undefined {
  if (typeof item.text === "string") return item.text;
  if (typeof item.content === "string") return item.content;
  return undefined;
}

import { html, nothing } from "lit";

import { formatToolDetail, resolveToolDisplay } from "../tool-display";
import { icons, type IconName } from "../icons";
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

// ---------------------------------------------------------------------------
// Timeline rendering — groups tool steps into a vertical timeline
// with collapsible completed sections and per-tool-type icons.
// ---------------------------------------------------------------------------

/**
 * Renders a single tool step as a timeline row.
 *
 * - Executing: accent-coloured row with spinner icon + label + dots animation
 * - Completed: muted row with tool-type icon + label, clickable for sidebar
 */
export function renderToolCardSidebar(
  card: ToolCard,
  onOpenSidebar?: (content: string) => void,
) {
  const display = resolveToolDisplay({ name: card.name, args: card.args });
  const detail = formatToolDetail(display);
  const hasText = Boolean(card.text?.trim());

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

  const toolIcon = display.icon in icons
    ? icons[display.icon as IconName]
    : icons.puzzle;

  // --- Executing: prominent inline indicator ---
  if (isExecuting) {
    const summary = detail ? `${display.label}: ${detail}` : display.label;
    return html`
      <div class="tool-step tool-step--executing">
        <span class="tool-step__connector"></span>
        <span class="tool-step__node tool-step__node--active">
          <span class="tool-step__spinner">${icons.loader}</span>
        </span>
        <span class="tool-step__body">
          <span class="tool-step__label">${summary}</span>
          <span class="tool-step__dots">
            <span></span><span></span><span></span>
          </span>
        </span>
      </div>
    `;
  }

  // --- Completed: compact one-liner with tool-type icon ---
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
      <span class="tool-step__connector"></span>
      <span class="tool-step__node">
        <span class="tool-step__icon">${toolIcon}</span>
      </span>
      <span class="tool-step__body">
        <span class="tool-step__label">${summary}</span>
        ${hasText && canClick
          ? html`<span class="tool-step__view">View</span>`
          : nothing}
      </span>
    </div>
  `;
}

// ---------------------------------------------------------------------------
// Smart grouping — groups consecutive completed tool steps into a
// collapsible timeline section. Executing steps stay ungrouped.
// ---------------------------------------------------------------------------

/** Minimum completed steps required to auto-collapse into a group. */
const COLLAPSE_THRESHOLD = 3;

type ToolStepGroup =
  | { kind: "executing"; card: ToolCard }
  | { kind: "completed"; cards: ToolCard[] };

function groupToolCards(cards: ToolCard[]): ToolStepGroup[] {
  const groups: ToolStepGroup[] = [];
  let pending: ToolCard[] = [];

  for (const card of cards) {
    const isExec = card.phase != null && card.phase !== "result";
    if (isExec) {
      if (pending.length) {
        groups.push({ kind: "completed", cards: pending });
        pending = [];
      }
      groups.push({ kind: "executing", card });
    } else {
      pending.push(card);
    }
  }
  if (pending.length) {
    groups.push({ kind: "completed", cards: pending });
  }
  return groups;
}

/**
 * Renders an array of tool cards as a timeline with smart grouping.
 *
 * - Completed steps that exceed COLLAPSE_THRESHOLD are collapsed into
 *   a summary row ("N steps completed ▸") that expands on click.
 * - Executing steps are always shown.
 */
export function renderToolStepsTimeline(
  cards: ToolCard[],
  onOpenSidebar?: (content: string) => void,
) {
  if (cards.length === 0) return nothing;

  const groups = groupToolCards(cards);

  return html`
    <div class="tool-timeline">
      ${groups.map((group) => {
        if (group.kind === "executing") {
          return renderToolCardSidebar(group.card, onOpenSidebar);
        }
        // Completed group
        const { cards: completed } = group;
        if (completed.length < COLLAPSE_THRESHOLD) {
          // Few enough — render inline, no collapsible
          return completed.map((card) =>
            renderToolCardSidebar(card, onOpenSidebar),
          );
        }
        // Collapsible group
        return renderCollapsibleGroup(completed, onOpenSidebar);
      })}
    </div>
  `;
}

function renderCollapsibleGroup(
  cards: ToolCard[],
  onOpenSidebar?: (content: string) => void,
) {
  const handleToggle = (e: Event) => {
    const details = e.currentTarget as HTMLDetailsElement;
    // Animate open/close via CSS — no JS needed
    details.classList.toggle(
      "tool-group--open",
      details.open,
    );
  };

  return html`
    <details class="tool-group" @toggle=${handleToggle}>
      <summary class="tool-group__summary">
        <span class="tool-group__connector"></span>
        <span class="tool-group__node">
          <span class="tool-group__icon">${icons.check}</span>
        </span>
        <span class="tool-group__count">${cards.length} steps completed</span>
        <span class="tool-group__chevron">${chevronRight}</span>
      </summary>
      <div class="tool-group__body">
        ${cards.map((card) => renderToolCardSidebar(card, onOpenSidebar))}
      </div>
    </details>
  `;
}

const chevronRight = html`<svg viewBox="0 0 24 24" class="tool-group__chevron-svg"><path d="m9 18 6-6-6-6"/></svg>`;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

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

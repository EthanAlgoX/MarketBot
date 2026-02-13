import { html, nothing } from "lit";

import { formatToolDetail, resolveToolDisplay } from "../tool-display";
import { icons, type IconName } from "../icons";
import type { ToolCard } from "../types/chat-types";
import {
  formatToolOutputForSidebar,
} from "./tool-helpers";
import { isToolResultMessage } from "./message-normalizer";
import { extractTextCached } from "./message-extract";

// ---------------------------------------------------------------------------
// i18n text
// ---------------------------------------------------------------------------

type ToolTextMap = {
  stepsCompleted: (n: number) => string;
  view: string;
  elapsed: (s: string) => string;
  totalTime: (s: string) => string;
};

const TOOL_TEXT: Record<string, ToolTextMap> = {
  en: {
    stepsCompleted: (n: number) => `${n} steps completed`,
    view: "View",
    elapsed: (s: string) => s,
    totalTime: (s: string) => `${s}`,
  },
  zh: {
    stepsCompleted: (n: number) => `${n} 个步骤已完成`,
    view: "查看",
    elapsed: (s: string) => s,
    totalTime: (s: string) => `${s}`,
  },
};

function resolveToolText(language?: string): ToolTextMap {
  return TOOL_TEXT[language ?? "en"] ?? TOOL_TEXT.en;
}

// ---------------------------------------------------------------------------
// Duration formatting
// ---------------------------------------------------------------------------

function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.round((ms % 60_000) / 1000);
  return `${minutes}m${seconds}s`;
}

function formatElapsedLive(startedAt: number): string {
  const elapsed = Date.now() - startedAt;
  if (elapsed < 1000) return "0s";
  return `${Math.floor(elapsed / 1000)}s`;
}

// ---------------------------------------------------------------------------
// Tool output preview
// ---------------------------------------------------------------------------

const PREVIEW_CHAR_LIMIT = 80;

function getOutputPreview(text?: string): string | undefined {
  if (!text?.trim()) return undefined;
  const trimmed = text.trim();
  const structuredPreview = getStructuredPreview(trimmed);
  if (structuredPreview) {
    return truncatePreview(structuredPreview);
  }
  const firstLine = trimmed.split(/\r?\n/)[0]?.trim() ?? "";
  if (!firstLine) return undefined;
  if (firstLine === "{" || firstLine === "[") return undefined;
  return truncatePreview(firstLine);
}

function truncatePreview(value: string): string {
  if (value.length <= PREVIEW_CHAR_LIMIT) return value;
  return `${value.slice(0, PREVIEW_CHAR_LIMIT - 1)}…`;
}

function getStructuredPreview(trimmed: string): string | undefined {
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return undefined;
  try {
    const parsed = JSON.parse(trimmed);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return undefined;
    }
    const record = parsed as Record<string, unknown>;
    const error =
      typeof record.error === "string" ? record.error.trim() : "";
    const message =
      typeof record.message === "string" ? record.message.trim() : "";
    const status =
      typeof record.status === "string" ? record.status.trim() : "";
    if (error && message) return `${error}: ${message}`;
    if (error) return error;
    if (status && message) return `${status}: ${message}`;
    if (message) return message;
    if (status) return `status: ${status}`;
    return undefined;
  } catch {
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// Error detection in tool output
// ---------------------------------------------------------------------------

const ERROR_PATTERNS = /\b(error|exception|fail(ed|ure)?|ENOENT|EACCES|EPERM|denied|refused|timeout)\b/i;

function looksLikeError(text?: string): boolean {
  if (!text) return false;
  // Only check first 500 chars to avoid scanning huge outputs
  const sample = text.slice(0, 500);
  return ERROR_PATTERNS.test(sample);
}

// ---------------------------------------------------------------------------
// Extract tool cards from a message
// ---------------------------------------------------------------------------

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
      const startedAt = typeof item.startedAt === "number" ? item.startedAt : undefined;
      const durationMs = typeof item.durationMs === "number" ? item.durationMs : undefined;
      cards.push({
        kind: "call",
        name: (item.name as string) ?? "tool",
        args: coerceArgs(item.arguments ?? item.args),
        phase,
        startedAt,
        durationMs,
      });
    }
  }

  for (const item of content) {
    const kind = String(item.type ?? "").toLowerCase();
    if (kind !== "toolresult" && kind !== "tool_result") continue;
    const text = extractToolText(item);
    const name = typeof item.name === "string" ? item.name : "tool";
    const phase = typeof item.phase === "string" ? item.phase : undefined;
    const startedAt = typeof item.startedAt === "number" ? item.startedAt : undefined;
    const durationMs = typeof item.durationMs === "number" ? item.durationMs : undefined;
    cards.push({ kind: "result", name, text, phase, startedAt, durationMs });
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
 * - Executing: accent-coloured row with spinner icon + label + dots animation + live timer
 * - Completed: muted row with status icon + label + duration badge + output preview
 */
export function renderToolCardSidebar(
  card: ToolCard,
  onOpenSidebar?: (content: string) => void,
  language?: string,
) {
  const text = resolveToolText(language);
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
      const info = `## ${display.label}\n\n${detail ? `**Command:** \`${detail}\`\n\n` : ""
        }*No output — tool completed successfully.*`;
      onOpenSidebar!(info);
    }
    : undefined;

  const toolIcon = display.icon in icons
    ? icons[display.icon as IconName]
    : icons.puzzle;

  // --- Executing: prominent inline indicator with live timer ---
  if (isExecuting) {
    const summary = detail ? `${display.label}: ${detail}` : display.label;
    const elapsed = card.startedAt ? formatElapsedLive(card.startedAt) : null;
    return html`
      <div class="tool-step tool-step--executing">
        <span class="tool-step__connector"></span>
        <span class="tool-step__node tool-step__node--active">
          <span class="tool-step__spinner">${icons.loader}</span>
        </span>
        <span class="tool-step__body">
          <span class="tool-step__label">${summary}</span>
          ${elapsed != null
        ? html`<span class="tool-step__elapsed tool-step__elapsed--live">${text.elapsed(elapsed)}</span>`
        : nothing}
          <span class="tool-step__dots">
            <span></span><span></span><span></span>
          </span>
        </span>
      </div>
    `;
  }

  // --- Completed: compact one-liner with status icon + duration + preview ---
  const summary = detail ? `${display.label}: ${detail}` : display.label;
  const isError = looksLikeError(card.text);
  const nodeClass = isError ? "tool-step__node--error" : "tool-step__node--success";
  const statusIcon = isError ? icons.x : icons.check;
  const duration = card.durationMs != null ? formatDuration(card.durationMs) : null;
  const preview = getOutputPreview(card.text);

  return html`
    <div
      class="tool-step tool-step--done${canClick ? " tool-step--clickable" : ""}${isError ? " tool-step--error" : ""}"
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
      <span class="tool-step__node ${nodeClass}">
        <span class="tool-step__icon">${statusIcon}</span>
      </span>
      <span class="tool-step__body">
        <span class="tool-step__row">
          <span class="tool-step__label">${summary}</span>
          ${duration != null
      ? html`<span class="tool-step__elapsed">${duration}</span>`
      : nothing}
          ${hasText && canClick
      ? html`<span class="tool-step__view">${text.view}</span>`
      : nothing}
        </span>
        ${preview
      ? html`<span class="tool-step__preview">${preview}</span>`
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
 * Computes the total duration of a group of completed cards.
 */
function groupTotalDuration(cards: ToolCard[]): number | null {
  let total = 0;
  let hasAny = false;
  for (const card of cards) {
    if (card.durationMs != null) {
      total += card.durationMs;
      hasAny = true;
    }
  }
  return hasAny ? total : null;
}

/**
 * Renders an array of tool cards as a timeline with smart grouping.
 *
 * - Completed steps that exceed COLLAPSE_THRESHOLD are collapsed into
 *   a summary row ("N steps completed · Xs") that expands on click.
 * - Executing steps are always shown.
 */
export function renderToolStepsTimeline(
  cards: ToolCard[],
  onOpenSidebar?: (content: string) => void,
  language?: string,
) {
  if (cards.length === 0) return nothing;

  const groups = groupToolCards(cards);

  return html`
    <div class="tool-timeline">
      ${groups.map((group) => {
    if (group.kind === "executing") {
      return renderToolCardSidebar(group.card, onOpenSidebar, language);
    }
    // Completed group
    const { cards: completed } = group;
    if (completed.length < COLLAPSE_THRESHOLD) {
      // Few enough — render inline, no collapsible
      return completed.map((card) =>
        renderToolCardSidebar(card, onOpenSidebar, language),
      );
    }
    // Collapsible group
    return renderCollapsibleGroup(completed, onOpenSidebar, language);
  })}
    </div>
  `;
}

function renderCollapsibleGroup(
  cards: ToolCard[],
  onOpenSidebar?: (content: string) => void,
  language?: string,
) {
  const text = resolveToolText(language);
  const totalMs = groupTotalDuration(cards);
  const totalLabel = totalMs != null ? ` · ${formatDuration(totalMs)}` : "";

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
        <span class="tool-group__count">${text.stepsCompleted(cards.length)}${totalLabel}</span>
        <span class="tool-group__chevron">${chevronRight}</span>
      </summary>
      <div class="tool-group__body">
        ${cards.map((card) => renderToolCardSidebar(card, onOpenSidebar, language))}
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

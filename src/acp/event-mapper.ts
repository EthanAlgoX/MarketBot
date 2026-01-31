/*
 * Copyright (C) 2026 MarketBot
 *
 * This file is part of MarketBot.
 *
 * MarketBot is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * MarketBot is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with MarketBot.  If not, see <https://www.gnu.org/licenses/>.
 */

import type { ContentBlock, ImageContent, ToolKind } from "@agentclientprotocol/sdk";

export type GatewayAttachment = {
  type: string;
  mimeType: string;
  content: string;
};

export function extractTextFromPrompt(prompt: ContentBlock[]): string {
  const parts: string[] = [];
  for (const block of prompt) {
    if (block.type === "text") {
      parts.push(block.text);
      continue;
    }
    if (block.type === "resource") {
      const resource = block.resource as { text?: string } | undefined;
      if (resource?.text) {
        parts.push(resource.text);
      }
      continue;
    }
    if (block.type === "resource_link") {
      const title = block.title ? ` (${block.title})` : "";
      const uri = block.uri ?? "";
      const line = uri ? `[Resource link${title}] ${uri}` : `[Resource link${title}]`;
      parts.push(line);
    }
  }
  return parts.join("\n");
}

export function extractAttachmentsFromPrompt(prompt: ContentBlock[]): GatewayAttachment[] {
  const attachments: GatewayAttachment[] = [];
  for (const block of prompt) {
    if (block.type !== "image") {
      continue;
    }
    const image = block as ImageContent;
    if (!image.data || !image.mimeType) {
      continue;
    }
    attachments.push({
      type: "image",
      mimeType: image.mimeType,
      content: image.data,
    });
  }
  return attachments;
}

export function formatToolTitle(
  name: string | undefined,
  args: Record<string, unknown> | undefined,
): string {
  const base = name ?? "tool";
  if (!args || Object.keys(args).length === 0) {
    return base;
  }
  const parts = Object.entries(args).map(([key, value]) => {
    const raw = typeof value === "string" ? value : JSON.stringify(value);
    const safe = raw.length > 100 ? `${raw.slice(0, 100)}...` : raw;
    return `${key}: ${safe}`;
  });
  return `${base}: ${parts.join(", ")}`;
}

export function inferToolKind(name?: string): ToolKind {
  if (!name) {
    return "other";
  }
  const normalized = name.toLowerCase();
  if (normalized.includes("read")) {
    return "read";
  }
  if (normalized.includes("write") || normalized.includes("edit")) {
    return "edit";
  }
  if (normalized.includes("delete") || normalized.includes("remove")) {
    return "delete";
  }
  if (normalized.includes("move") || normalized.includes("rename")) {
    return "move";
  }
  if (normalized.includes("search") || normalized.includes("find")) {
    return "search";
  }
  if (normalized.includes("exec") || normalized.includes("run") || normalized.includes("bash")) {
    return "execute";
  }
  if (normalized.includes("fetch") || normalized.includes("http")) {
    return "fetch";
  }
  return "other";
}

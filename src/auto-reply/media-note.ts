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

import type { MsgContext } from "./templating.js";

function formatMediaAttachedLine(params: {
  path: string;
  url?: string;
  type?: string;
  index?: number;
  total?: number;
}): string {
  const prefix =
    typeof params.index === "number" && typeof params.total === "number"
      ? `[media attached ${params.index}/${params.total}: `
      : "[media attached: ";
  const typePart = params.type?.trim() ? ` (${params.type.trim()})` : "";
  const urlRaw = params.url?.trim();
  const urlPart = urlRaw ? ` | ${urlRaw}` : "";
  return `${prefix}${params.path}${typePart}${urlPart}]`;
}

export function buildInboundMediaNote(ctx: MsgContext): string | undefined {
  // Attachment indices follow MediaPaths/MediaUrls ordering as supplied by the channel.
  const suppressed = new Set<number>();
  if (Array.isArray(ctx.MediaUnderstanding)) {
    for (const output of ctx.MediaUnderstanding) {
      suppressed.add(output.attachmentIndex);
    }
  }
  if (Array.isArray(ctx.MediaUnderstandingDecisions)) {
    for (const decision of ctx.MediaUnderstandingDecisions) {
      if (decision.outcome !== "success") {
        continue;
      }
      for (const attachment of decision.attachments) {
        if (attachment.chosen?.outcome === "success") {
          suppressed.add(attachment.attachmentIndex);
        }
      }
    }
  }
  const pathsFromArray = Array.isArray(ctx.MediaPaths) ? ctx.MediaPaths : undefined;
  const paths =
    pathsFromArray && pathsFromArray.length > 0
      ? pathsFromArray
      : ctx.MediaPath?.trim()
        ? [ctx.MediaPath.trim()]
        : [];
  if (paths.length === 0) {
    return undefined;
  }

  const urls =
    Array.isArray(ctx.MediaUrls) && ctx.MediaUrls.length === paths.length
      ? ctx.MediaUrls
      : undefined;
  const types =
    Array.isArray(ctx.MediaTypes) && ctx.MediaTypes.length === paths.length
      ? ctx.MediaTypes
      : undefined;

  const entries = paths
    .map((entry, index) => ({
      path: entry ?? "",
      type: types?.[index] ?? ctx.MediaType,
      url: urls?.[index] ?? ctx.MediaUrl,
      index,
    }))
    .filter((entry) => !suppressed.has(entry.index));
  if (entries.length === 0) {
    return undefined;
  }
  if (entries.length === 1) {
    return formatMediaAttachedLine({
      path: entries[0]?.path ?? "",
      type: entries[0]?.type,
      url: entries[0]?.url,
    });
  }

  const count = entries.length;
  const lines: string[] = [`[media attached: ${count} files]`];
  for (const [idx, entry] of entries.entries()) {
    lines.push(
      formatMediaAttachedLine({
        path: entry.path,
        index: idx + 1,
        total: count,
        type: entry.type,
        url: entry.url,
      }),
    );
  }
  return lines.join("\n");
}

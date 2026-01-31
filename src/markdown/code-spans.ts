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

import { parseFenceSpans, type FenceSpan } from "./fences.js";

export type InlineCodeState = {
  open: boolean;
  ticks: number;
};

export function createInlineCodeState(): InlineCodeState {
  return { open: false, ticks: 0 };
}

type InlineCodeSpansResult = {
  spans: Array<[number, number]>;
  state: InlineCodeState;
};

export type CodeSpanIndex = {
  inlineState: InlineCodeState;
  isInside: (index: number) => boolean;
};

export function buildCodeSpanIndex(text: string, inlineState?: InlineCodeState): CodeSpanIndex {
  const fenceSpans = parseFenceSpans(text);
  const startState = inlineState
    ? { open: inlineState.open, ticks: inlineState.ticks }
    : createInlineCodeState();
  const { spans: inlineSpans, state: nextInlineState } = parseInlineCodeSpans(
    text,
    fenceSpans,
    startState,
  );

  return {
    inlineState: nextInlineState,
    isInside: (index: number) =>
      isInsideFenceSpan(index, fenceSpans) || isInsideInlineSpan(index, inlineSpans),
  };
}

function parseInlineCodeSpans(
  text: string,
  fenceSpans: FenceSpan[],
  initialState: InlineCodeState,
): InlineCodeSpansResult {
  const spans: Array<[number, number]> = [];
  let open = initialState.open;
  let ticks = initialState.ticks;
  let openStart = open ? 0 : -1;

  let i = 0;
  while (i < text.length) {
    const fence = findFenceSpanAtInclusive(fenceSpans, i);
    if (fence) {
      i = fence.end;
      continue;
    }

    if (text[i] !== "`") {
      i += 1;
      continue;
    }

    const runStart = i;
    let runLength = 0;
    while (i < text.length && text[i] === "`") {
      runLength += 1;
      i += 1;
    }

    if (!open) {
      open = true;
      ticks = runLength;
      openStart = runStart;
      continue;
    }

    if (runLength === ticks) {
      spans.push([openStart, i]);
      open = false;
      ticks = 0;
      openStart = -1;
    }
  }

  if (open) {
    spans.push([openStart, text.length]);
  }

  return {
    spans,
    state: { open, ticks },
  };
}

function findFenceSpanAtInclusive(spans: FenceSpan[], index: number): FenceSpan | undefined {
  return spans.find((span) => index >= span.start && index < span.end);
}

function isInsideFenceSpan(index: number, spans: FenceSpan[]): boolean {
  return spans.some((span) => index >= span.start && index < span.end);
}

function isInsideInlineSpan(index: number, spans: Array<[number, number]>): boolean {
  return spans.some(([start, end]) => index >= start && index < end);
}

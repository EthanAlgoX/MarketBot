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

import type { EventEmitter } from "node:events";

export type DiscordGatewayHandle = {
  emitter?: Pick<EventEmitter, "on" | "removeListener">;
  disconnect?: () => void;
};

export function getDiscordGatewayEmitter(gateway?: unknown): EventEmitter | undefined {
  return (gateway as { emitter?: EventEmitter } | undefined)?.emitter;
}

export async function waitForDiscordGatewayStop(params: {
  gateway?: DiscordGatewayHandle;
  abortSignal?: AbortSignal;
  onGatewayError?: (err: unknown) => void;
  shouldStopOnError?: (err: unknown) => boolean;
}): Promise<void> {
  const { gateway, abortSignal, onGatewayError, shouldStopOnError } = params;
  const emitter = gateway?.emitter;
  return await new Promise<void>((resolve, reject) => {
    let settled = false;
    const cleanup = () => {
      abortSignal?.removeEventListener("abort", onAbort);
      emitter?.removeListener("error", onGatewayErrorEvent);
    };
    const finishResolve = () => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      try {
        gateway?.disconnect?.();
      } finally {
        resolve();
      }
    };
    const finishReject = (err: unknown) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      try {
        gateway?.disconnect?.();
      } finally {
        reject(err);
      }
    };
    const onAbort = () => {
      finishResolve();
    };
    const onGatewayErrorEvent = (err: unknown) => {
      onGatewayError?.(err);
      const shouldStop = shouldStopOnError?.(err) ?? true;
      if (shouldStop) {
        finishReject(err);
      }
    };

    if (abortSignal?.aborted) {
      onAbort();
      return;
    }

    abortSignal?.addEventListener("abort", onAbort, { once: true });
    emitter?.on("error", onGatewayErrorEvent);
  });
}

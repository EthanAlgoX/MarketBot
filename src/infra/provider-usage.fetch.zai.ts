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

import { fetchJson } from "./provider-usage.fetch.shared.js";
import { clampPercent, PROVIDER_LABELS } from "./provider-usage.shared.js";
import type { ProviderUsageSnapshot, UsageWindow } from "./provider-usage.types.js";

type ZaiUsageResponse = {
  success?: boolean;
  code?: number;
  msg?: string;
  data?: {
    planName?: string;
    plan?: string;
    limits?: Array<{
      type?: string;
      percentage?: number;
      unit?: number;
      number?: number;
      nextResetTime?: string;
    }>;
  };
};

export async function fetchZaiUsage(
  apiKey: string,
  timeoutMs: number,
  fetchFn: typeof fetch,
): Promise<ProviderUsageSnapshot> {
  const res = await fetchJson(
    "https://api.z.ai/api/monitor/usage/quota/limit",
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
    },
    timeoutMs,
    fetchFn,
  );

  if (!res.ok) {
    return {
      provider: "zai",
      displayName: PROVIDER_LABELS.zai,
      windows: [],
      error: `HTTP ${res.status}`,
    };
  }

  const data = (await res.json()) as ZaiUsageResponse;
  if (!data.success || data.code !== 200) {
    return {
      provider: "zai",
      displayName: PROVIDER_LABELS.zai,
      windows: [],
      error: data.msg || "API error",
    };
  }

  const windows: UsageWindow[] = [];
  const limits = data.data?.limits || [];

  for (const limit of limits) {
    const percent = clampPercent(limit.percentage || 0);
    const nextReset = limit.nextResetTime ? new Date(limit.nextResetTime).getTime() : undefined;
    let windowLabel = "Limit";
    if (limit.unit === 1) {
      windowLabel = `${limit.number}d`;
    } else if (limit.unit === 3) {
      windowLabel = `${limit.number}h`;
    } else if (limit.unit === 5) {
      windowLabel = `${limit.number}m`;
    }

    if (limit.type === "TOKENS_LIMIT") {
      windows.push({
        label: `Tokens (${windowLabel})`,
        usedPercent: percent,
        resetAt: nextReset,
      });
    } else if (limit.type === "TIME_LIMIT") {
      windows.push({
        label: "Monthly",
        usedPercent: percent,
        resetAt: nextReset,
      });
    }
  }

  const planName = data.data?.planName || data.data?.plan || undefined;
  return {
    provider: "zai",
    displayName: PROVIDER_LABELS.zai,
    windows,
    plan: planName,
  };
}

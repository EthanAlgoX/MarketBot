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

import { z } from "zod";

export const HookMappingSchema = z
  .object({
    id: z.string().optional(),
    match: z
      .object({
        path: z.string().optional(),
        source: z.string().optional(),
      })
      .optional(),
    action: z.union([z.literal("wake"), z.literal("agent")]).optional(),
    wakeMode: z.union([z.literal("now"), z.literal("next-heartbeat")]).optional(),
    name: z.string().optional(),
    sessionKey: z.string().optional(),
    messageTemplate: z.string().optional(),
    textTemplate: z.string().optional(),
    deliver: z.boolean().optional(),
    allowUnsafeExternalContent: z.boolean().optional(),
    channel: z
      .union([
        z.literal("last"),
        z.literal("whatsapp"),
        z.literal("telegram"),
        z.literal("discord"),
        z.literal("slack"),
        z.literal("signal"),
        z.literal("imessage"),
        z.literal("msteams"),
      ])
      .optional(),
    to: z.string().optional(),
    model: z.string().optional(),
    thinking: z.string().optional(),
    timeoutSeconds: z.number().int().positive().optional(),
    transform: z
      .object({
        module: z.string(),
        export: z.string().optional(),
      })
      .strict()
      .optional(),
  })
  .strict()
  .optional();

export const InternalHookHandlerSchema = z
  .object({
    event: z.string(),
    module: z.string(),
    export: z.string().optional(),
  })
  .strict();

const HookConfigSchema = z
  .object({
    enabled: z.boolean().optional(),
    env: z.record(z.string(), z.string()).optional(),
  })
  .strict();

const HookInstallRecordSchema = z
  .object({
    source: z.union([z.literal("npm"), z.literal("archive"), z.literal("path")]),
    spec: z.string().optional(),
    sourcePath: z.string().optional(),
    installPath: z.string().optional(),
    version: z.string().optional(),
    installedAt: z.string().optional(),
    hooks: z.array(z.string()).optional(),
  })
  .strict();

export const InternalHooksSchema = z
  .object({
    enabled: z.boolean().optional(),
    handlers: z.array(InternalHookHandlerSchema).optional(),
    entries: z.record(z.string(), HookConfigSchema).optional(),
    load: z
      .object({
        extraDirs: z.array(z.string()).optional(),
      })
      .strict()
      .optional(),
    installs: z.record(z.string(), HookInstallRecordSchema).optional(),
  })
  .strict()
  .optional();

export const HooksGmailSchema = z
  .object({
    account: z.string().optional(),
    label: z.string().optional(),
    topic: z.string().optional(),
    subscription: z.string().optional(),
    pushToken: z.string().optional(),
    hookUrl: z.string().optional(),
    includeBody: z.boolean().optional(),
    maxBytes: z.number().int().positive().optional(),
    renewEveryMinutes: z.number().int().positive().optional(),
    allowUnsafeExternalContent: z.boolean().optional(),
    serve: z
      .object({
        bind: z.string().optional(),
        port: z.number().int().positive().optional(),
        path: z.string().optional(),
      })
      .strict()
      .optional(),
    tailscale: z
      .object({
        mode: z.union([z.literal("off"), z.literal("serve"), z.literal("funnel")]).optional(),
        path: z.string().optional(),
        target: z.string().optional(),
      })
      .strict()
      .optional(),
    model: z.string().optional(),
    thinking: z
      .union([
        z.literal("off"),
        z.literal("minimal"),
        z.literal("low"),
        z.literal("medium"),
        z.literal("high"),
      ])
      .optional(),
  })
  .strict()
  .optional();

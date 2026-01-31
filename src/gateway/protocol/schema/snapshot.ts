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

import { Type } from "@sinclair/typebox";
import { NonEmptyString } from "./primitives.js";

export const PresenceEntrySchema = Type.Object(
  {
    host: Type.Optional(NonEmptyString),
    ip: Type.Optional(NonEmptyString),
    version: Type.Optional(NonEmptyString),
    platform: Type.Optional(NonEmptyString),
    deviceFamily: Type.Optional(NonEmptyString),
    modelIdentifier: Type.Optional(NonEmptyString),
    mode: Type.Optional(NonEmptyString),
    lastInputSeconds: Type.Optional(Type.Integer({ minimum: 0 })),
    reason: Type.Optional(NonEmptyString),
    tags: Type.Optional(Type.Array(NonEmptyString)),
    text: Type.Optional(Type.String()),
    ts: Type.Integer({ minimum: 0 }),
    deviceId: Type.Optional(NonEmptyString),
    roles: Type.Optional(Type.Array(NonEmptyString)),
    scopes: Type.Optional(Type.Array(NonEmptyString)),
    instanceId: Type.Optional(NonEmptyString),
  },
  { additionalProperties: false },
);

export const HealthSnapshotSchema = Type.Any();

export const SessionDefaultsSchema = Type.Object(
  {
    defaultAgentId: NonEmptyString,
    mainKey: NonEmptyString,
    mainSessionKey: NonEmptyString,
    scope: Type.Optional(NonEmptyString),
  },
  { additionalProperties: false },
);

export const StateVersionSchema = Type.Object(
  {
    presence: Type.Integer({ minimum: 0 }),
    health: Type.Integer({ minimum: 0 }),
  },
  { additionalProperties: false },
);

export const SnapshotSchema = Type.Object(
  {
    presence: Type.Array(PresenceEntrySchema),
    health: HealthSnapshotSchema,
    stateVersion: StateVersionSchema,
    uptimeMs: Type.Integer({ minimum: 0 }),
    configPath: Type.Optional(NonEmptyString),
    stateDir: Type.Optional(NonEmptyString),
    sessionDefaults: Type.Optional(SessionDefaultsSchema),
  },
  { additionalProperties: false },
);

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

export const NodePairRequestParamsSchema = Type.Object(
  {
    nodeId: NonEmptyString,
    displayName: Type.Optional(NonEmptyString),
    platform: Type.Optional(NonEmptyString),
    version: Type.Optional(NonEmptyString),
    coreVersion: Type.Optional(NonEmptyString),
    uiVersion: Type.Optional(NonEmptyString),
    deviceFamily: Type.Optional(NonEmptyString),
    modelIdentifier: Type.Optional(NonEmptyString),
    caps: Type.Optional(Type.Array(NonEmptyString)),
    commands: Type.Optional(Type.Array(NonEmptyString)),
    remoteIp: Type.Optional(NonEmptyString),
    silent: Type.Optional(Type.Boolean()),
  },
  { additionalProperties: false },
);

export const NodePairListParamsSchema = Type.Object({}, { additionalProperties: false });

export const NodePairApproveParamsSchema = Type.Object(
  { requestId: NonEmptyString },
  { additionalProperties: false },
);

export const NodePairRejectParamsSchema = Type.Object(
  { requestId: NonEmptyString },
  { additionalProperties: false },
);

export const NodePairVerifyParamsSchema = Type.Object(
  { nodeId: NonEmptyString, token: NonEmptyString },
  { additionalProperties: false },
);

export const NodeRenameParamsSchema = Type.Object(
  { nodeId: NonEmptyString, displayName: NonEmptyString },
  { additionalProperties: false },
);

export const NodeListParamsSchema = Type.Object({}, { additionalProperties: false });

export const NodeDescribeParamsSchema = Type.Object(
  { nodeId: NonEmptyString },
  { additionalProperties: false },
);

export const NodeInvokeParamsSchema = Type.Object(
  {
    nodeId: NonEmptyString,
    command: NonEmptyString,
    params: Type.Optional(Type.Unknown()),
    timeoutMs: Type.Optional(Type.Integer({ minimum: 0 })),
    idempotencyKey: NonEmptyString,
  },
  { additionalProperties: false },
);

export const NodeInvokeResultParamsSchema = Type.Object(
  {
    id: NonEmptyString,
    nodeId: NonEmptyString,
    ok: Type.Boolean(),
    payload: Type.Optional(Type.Unknown()),
    payloadJSON: Type.Optional(Type.String()),
    error: Type.Optional(
      Type.Object(
        {
          code: Type.Optional(NonEmptyString),
          message: Type.Optional(NonEmptyString),
        },
        { additionalProperties: false },
      ),
    ),
  },
  { additionalProperties: false },
);

export const NodeEventParamsSchema = Type.Object(
  {
    event: NonEmptyString,
    payload: Type.Optional(Type.Unknown()),
    payloadJSON: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
);

export const NodeInvokeRequestEventSchema = Type.Object(
  {
    id: NonEmptyString,
    nodeId: NonEmptyString,
    command: NonEmptyString,
    paramsJSON: Type.Optional(Type.String()),
    timeoutMs: Type.Optional(Type.Integer({ minimum: 0 })),
    idempotencyKey: Type.Optional(NonEmptyString),
  },
  { additionalProperties: false },
);

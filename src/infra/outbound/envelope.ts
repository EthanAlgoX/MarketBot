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

import type { ReplyPayload } from "../../auto-reply/types.js";
import type { OutboundDeliveryJson } from "./format.js";
import { normalizeOutboundPayloadsForJson, type OutboundPayloadJson } from "./payloads.js";

export type OutboundResultEnvelope = {
  payloads?: OutboundPayloadJson[];
  meta?: unknown;
  delivery?: OutboundDeliveryJson;
};

type BuildEnvelopeParams = {
  payloads?: ReplyPayload[] | OutboundPayloadJson[];
  meta?: unknown;
  delivery?: OutboundDeliveryJson;
  flattenDelivery?: boolean;
};

const isOutboundPayloadJson = (
  payload: ReplyPayload | OutboundPayloadJson,
): payload is OutboundPayloadJson => "mediaUrl" in payload;

export function buildOutboundResultEnvelope(
  params: BuildEnvelopeParams,
): OutboundResultEnvelope | OutboundDeliveryJson {
  const hasPayloads = params.payloads !== undefined;
  const payloads =
    params.payloads === undefined
      ? undefined
      : params.payloads.length === 0
        ? []
        : isOutboundPayloadJson(params.payloads[0])
          ? (params.payloads as OutboundPayloadJson[])
          : normalizeOutboundPayloadsForJson(params.payloads as ReplyPayload[]);

  if (params.flattenDelivery !== false && params.delivery && !params.meta && !hasPayloads) {
    return params.delivery;
  }

  return {
    ...(hasPayloads ? { payloads } : {}),
    ...(params.meta ? { meta: params.meta } : {}),
    ...(params.delivery ? { delivery: params.delivery } : {}),
  };
}

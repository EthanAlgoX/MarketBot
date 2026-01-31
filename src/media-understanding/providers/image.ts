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

import type { Api, Context, Model } from "@mariozechner/pi-ai";
import { complete } from "@mariozechner/pi-ai";
import { discoverAuthStorage, discoverModels } from "../../agents/pi-model-discovery.js";

import { getApiKeyForModel, requireApiKey } from "../../agents/model-auth.js";
import { ensureMarketBotModelsJson } from "../../agents/models-config.js";
import { minimaxUnderstandImage } from "../../agents/minimax-vlm.js";
import { coerceImageAssistantText } from "../../agents/tools/image-tool.helpers.js";
import type { ImageDescriptionRequest, ImageDescriptionResult } from "../types.js";

export async function describeImageWithModel(
  params: ImageDescriptionRequest,
): Promise<ImageDescriptionResult> {
  await ensureMarketBotModelsJson(params.cfg, params.agentDir);
  const authStorage = discoverAuthStorage(params.agentDir);
  const modelRegistry = discoverModels(authStorage, params.agentDir);
  const model = modelRegistry.find(params.provider, params.model) as Model<Api> | null;
  if (!model) {
    throw new Error(`Unknown model: ${params.provider}/${params.model}`);
  }
  if (!model.input?.includes("image")) {
    throw new Error(`Model does not support images: ${params.provider}/${params.model}`);
  }
  const apiKeyInfo = await getApiKeyForModel({
    model,
    cfg: params.cfg,
    agentDir: params.agentDir,
    profileId: params.profile,
    preferredProfile: params.preferredProfile,
  });
  const apiKey = requireApiKey(apiKeyInfo, model.provider);
  authStorage.setRuntimeApiKey(model.provider, apiKey);

  const base64 = params.buffer.toString("base64");
  if (model.provider === "minimax") {
    const text = await minimaxUnderstandImage({
      apiKey,
      prompt: params.prompt ?? "Describe the image.",
      imageDataUrl: `data:${params.mime ?? "image/jpeg"};base64,${base64}`,
      modelBaseUrl: model.baseUrl,
    });
    return { text, model: model.id };
  }

  const context: Context = {
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: params.prompt ?? "Describe the image." },
          { type: "image", data: base64, mimeType: params.mime ?? "image/jpeg" },
        ],
        timestamp: Date.now(),
      },
    ],
  };
  const message = await complete(model, context, {
    apiKey,
    maxTokens: params.maxTokens ?? 512,
  });
  const text = coerceImageAssistantText({
    message,
    provider: model.provider,
    model: model.id,
  });
  return { text, model: model.id };
}

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

import type { AudioTranscriptionRequest, AudioTranscriptionResult } from "../../types.js";
import { normalizeGoogleModelId } from "../../../agents/models-config.providers.js";
import { fetchWithTimeout, normalizeBaseUrl, readErrorResponse } from "../shared.js";

export const DEFAULT_GOOGLE_AUDIO_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
const DEFAULT_GOOGLE_AUDIO_MODEL = "gemini-3-flash-preview";
const DEFAULT_GOOGLE_AUDIO_PROMPT = "Transcribe the audio.";

function resolveModel(model?: string): string {
  const trimmed = model?.trim();
  if (!trimmed) {
    return DEFAULT_GOOGLE_AUDIO_MODEL;
  }
  return normalizeGoogleModelId(trimmed);
}

function resolvePrompt(prompt?: string): string {
  const trimmed = prompt?.trim();
  return trimmed || DEFAULT_GOOGLE_AUDIO_PROMPT;
}

export async function transcribeGeminiAudio(
  params: AudioTranscriptionRequest,
): Promise<AudioTranscriptionResult> {
  const fetchFn = params.fetchFn ?? fetch;
  const baseUrl = normalizeBaseUrl(params.baseUrl, DEFAULT_GOOGLE_AUDIO_BASE_URL);
  const model = resolveModel(params.model);
  const url = `${baseUrl}/models/${model}:generateContent`;

  const headers = new Headers(params.headers);
  if (!headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  if (!headers.has("x-goog-api-key")) {
    headers.set("x-goog-api-key", params.apiKey);
  }

  const body = {
    contents: [
      {
        role: "user",
        parts: [
          { text: resolvePrompt(params.prompt) },
          {
            inline_data: {
              mime_type: params.mime ?? "audio/wav",
              data: params.buffer.toString("base64"),
            },
          },
        ],
      },
    ],
  };

  const res = await fetchWithTimeout(
    url,
    {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    },
    params.timeoutMs,
    fetchFn,
  );

  if (!res.ok) {
    const detail = await readErrorResponse(res);
    const suffix = detail ? `: ${detail}` : "";
    throw new Error(`Audio transcription failed (HTTP ${res.status})${suffix}`);
  }

  const payload = (await res.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
    }>;
  };
  const parts = payload.candidates?.[0]?.content?.parts ?? [];
  const text = parts
    .map((part) => part?.text?.trim())
    .filter(Boolean)
    .join("\n");
  if (!text) {
    throw new Error("Audio transcription response missing text");
  }
  return { text, model };
}

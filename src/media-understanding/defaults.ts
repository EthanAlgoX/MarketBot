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

import type { MediaUnderstandingCapability } from "./types.js";

const MB = 1024 * 1024;

export const DEFAULT_MAX_CHARS = 500;
export const DEFAULT_MAX_CHARS_BY_CAPABILITY: Record<
  MediaUnderstandingCapability,
  number | undefined
> = {
  image: DEFAULT_MAX_CHARS,
  audio: undefined,
  video: DEFAULT_MAX_CHARS,
};
export const DEFAULT_MAX_BYTES: Record<MediaUnderstandingCapability, number> = {
  image: 10 * MB,
  audio: 20 * MB,
  video: 50 * MB,
};
export const DEFAULT_TIMEOUT_SECONDS: Record<MediaUnderstandingCapability, number> = {
  image: 60,
  audio: 60,
  video: 120,
};
export const DEFAULT_PROMPT: Record<MediaUnderstandingCapability, string> = {
  image: "Describe the image.",
  audio: "Transcribe the audio.",
  video: "Describe the video.",
};
export const DEFAULT_VIDEO_MAX_BASE64_BYTES = 70 * MB;
export const DEFAULT_AUDIO_MODELS: Record<string, string> = {
  groq: "whisper-large-v3-turbo",
  openai: "gpt-4o-mini-transcribe",
  deepgram: "nova-3",
};
export const CLI_OUTPUT_MAX_BUFFER = 5 * MB;
export const DEFAULT_MEDIA_CONCURRENCY = 2;

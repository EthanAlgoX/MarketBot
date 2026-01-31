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

declare module "node-llama-cpp" {
  export enum LlamaLogLevel {
    error = 0,
  }

  export type LlamaEmbedding = { vector: Float32Array | number[] };

  export type LlamaEmbeddingContext = {
    getEmbeddingFor: (text: string) => Promise<LlamaEmbedding>;
  };

  export type LlamaModel = {
    createEmbeddingContext: () => Promise<LlamaEmbeddingContext>;
  };

  export type Llama = {
    loadModel: (params: { modelPath: string }) => Promise<LlamaModel>;
  };

  export function getLlama(params: { logLevel: LlamaLogLevel }): Promise<Llama>;
  export function resolveModelFile(modelPath: string, cacheDir?: string): Promise<string>;
}

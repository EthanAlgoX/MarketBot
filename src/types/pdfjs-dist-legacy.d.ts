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

declare module "pdfjs-dist/legacy/build/pdf.mjs" {
  export type TextItem = {
    str: string;
  };

  export type TextMarkedContent = {
    type?: string;
  };

  export type TextContent = {
    items: Array<TextItem | TextMarkedContent>;
  };

  export type Viewport = {
    width: number;
    height: number;
  };

  export type PDFPageProxy = {
    getTextContent(): Promise<TextContent>;
    getViewport(params: { scale: number }): Viewport;
    render(params: { canvas: unknown; viewport: Viewport }): { promise: Promise<void> };
  };

  export type PDFDocumentProxy = {
    numPages: number;
    getPage(pageNumber: number): Promise<PDFPageProxy>;
  };

  export function getDocument(params: { data: Uint8Array; disableWorker?: boolean }): {
    promise: Promise<PDFDocumentProxy>;
  };
}

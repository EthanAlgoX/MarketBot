// Modified for marketbot on 2026-10-13; see MODIFICATIONS.md.
import { plainTextFromMarkdown } from "@marketbot/core";

const MAX_PREVIEW_WORDS = 12;

export function previewSnippet(markdown: string, maxWords = MAX_PREVIEW_WORDS): string {
  const words = plainTextFromMarkdown(markdown).split(/\s+/).filter(Boolean);
  return words.slice(0, maxWords).join(" ");
}

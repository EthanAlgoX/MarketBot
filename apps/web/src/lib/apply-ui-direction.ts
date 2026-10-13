// Modified for marketbot on 2026-10-13; see MODIFICATIONS.md.
import { textDirectionForLocale } from "@marketbot/core";
import { resolveUiLocale } from "./ui-locale";

export function applyUiDirection(locale: string = resolveUiLocale()) {
  const direction = textDirectionForLocale(locale);
  document.documentElement.dir = direction;
  document.documentElement.lang = locale;
  return direction;
}

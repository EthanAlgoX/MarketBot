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

export const browserCoreExamples = [
  "marketbot browser status",
  "marketbot browser start",
  "marketbot browser stop",
  "marketbot browser tabs",
  "marketbot browser open https://example.com",
  "marketbot browser focus abcd1234",
  "marketbot browser close abcd1234",
  "marketbot browser screenshot",
  "marketbot browser screenshot --full-page",
  "marketbot browser screenshot --ref 12",
  "marketbot browser snapshot",
  "marketbot browser snapshot --format aria --limit 200",
  "marketbot browser snapshot --efficient",
  "marketbot browser snapshot --labels",
];

export const browserActionExamples = [
  "marketbot browser navigate https://example.com",
  "marketbot browser resize 1280 720",
  "marketbot browser click 12 --double",
  'marketbot browser type 23 "hello" --submit',
  "marketbot browser press Enter",
  "marketbot browser hover 44",
  "marketbot browser drag 10 11",
  "marketbot browser select 9 OptionA OptionB",
  "marketbot browser upload /tmp/file.pdf",
  'marketbot browser fill --fields \'[{"ref":"1","value":"Ada"}]\'',
  "marketbot browser dialog --accept",
  'marketbot browser wait --text "Done"',
  "marketbot browser evaluate --fn '(el) => el.textContent' --ref 7",
  "marketbot browser console --level error",
  "marketbot browser pdf",
];

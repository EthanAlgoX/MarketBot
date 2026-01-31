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

const DEFAULT_TAGLINE = "MarketBot: Precision Intelligence for Every Trade.";

const HOLIDAY_TAGLINES = {
  newYear:
    "New Year's Day: A new year of market trends and fresh opportunities to optimize your analysis.",
  lunarNewYear:
    "Lunar New Year: Wishing you a year of prosperous trades, stable growth, and minimal volatility.",
  christmas:
    "Christmas: MarketBot is auditing your portfolio list—checking those support levels twice.",
  eid: "Eid al-Fitr: Celebrating success: trades executed, analysis finalized, and goals achieved.",
  diwali:
    "Diwali: Lighting up the charts with deep insights—may your financial future be bright and stable.",
  easter:
    "Easter: Discovering hidden alpha—consider it a data-driven hunt for market opportunities.",
  hanukkah:
    "Hanukkah: Eight days of insights, eight nights of analysis—keeping your market outlook steady and bright.",
  halloween:
    "Halloween: Spooky market behavior? No haunt is too deep for our sentiment analysis tools.",
  thanksgiving:
    "Thanksgiving: Grateful for liquid markets, clean data, and the insights that power every decision.",
  valentines:
    "Valentine's Day: Analyzing the heart of the market—let's keep your trading strategy elegant and effective.",
} as const;

const TAGLINES: string[] = [
  "Your financial intelligence is online—type a query to start the deep analysis.",
  "Welcome to MarketBot: Where deep reasoning meets real-time market data.",
  "Analyzing volatility, sentiment, and technicals so you can trade with confidence.",
  "Market intelligence online—maintaining a professional outlook on every asset.",
  "I speak fluent technical analysis, macroeconomics, and real-time market sentiment.",
  "One interface to analyze them all—from crypto to equities and beyond.",
  "Success in trading is 10% strategy and 90% acting on the right insights.",
  "Advanced reasoning engaged—ready to dissect the latest earnings and trends.",
  "Your financial data is secure; now let's find some actionable opportunities.",
  "I'll handle the complex data scraping while you focus on the high-level strategy.",
  "I'm not saying your portfolio is volatile... I'm just bringing a stabilizer and a report.",
  "Type your analysis request—MarketBot will provide the deep reasoning required.",
  "I don't judge asset choices, but your missing API keys are limiting our edge.",
  "I can grep the news, script the analysis, and summarize the macro—pick your focus.",
  "Real-time data for long-term growth—bridging the gap between news and profit.",
  "I'm the assistant your trading desk demanded and your analysis workflow needed.",
  "Maintaining precision in every report... unless you forget to update the data sources.",
  "Financial Intel Engine: Minimal noise, maximal insight.",
  "I'm like a Bloomberg terminal, but with more conversational dexterity and automation.",
  "If the market looks irrational, run the analysis; if you're wise, run the risk model.",
  "Your analysis has been queued; your market edge has been upgraded.",
  "I can't predict the black swans, but I can help you spot the grey ones.",
  "Persistent analysis through every market cycle—bull, bear, or sideways.",
  'It\'s not "volatility," it\'s "a collection of data points awaiting your decision."',
  "Give me a ticker and I'll give you sentiment, technicals, and fundamental truth.",
  "I read the filings so you can keep focusing on the big picture.",
  "If a trade goes south, I'll provide the post-mortem to ensure a better next move.",
  "I'll refactor your research workflow like it's a high-frequency algorithm.",
  'Say "analyze" and I\'ll start—say "report" and we\'ll both learn the alpha.',
  "I'm the reason your trading research looks like a professional desk montage.",
  "Efficient, intelligent, and focused—MarketBot is your companion in the chaos.",
  "I can run macro scans, micro audits, or pure sentiment analysis—results driven by data.",
  "If you can describe the strategy, I can probably analyze it—or at least quantify it.",
  "Your data is valid, your risk assumptions are now being stress-tested.",
  "I don't just find news—I provide the context required for high-stakes decisions.",
  "Less noise, more signal, fewer 'where did the price go' moments.",
  "Orders in, analysis out—let's find some market discrepancies.",
  "I'll optimize your portfolio like a hedge fund: efficient, insightful, and precise.",
  "Market intelligence—I'm here to find the discrepancies and leave you the profits.",
  "Because keeping track of every macro trend is a 24/7 job.",
  "Your data, your analysis, your market edge.",
  'Turning "what happened?" into "here is the precise data-driven reason why."',
  "The only quant in your contacts you actually want to hear from. 📈",
  "Analysis automation for people who require deep insights.",
  "Because the right answer is usually a data-driven report.",
  "IPC, but it's your professional analysis desk.",
  "The UNIX philosophy meets your market research.",
  "curl for market intelligence.",
  "Less middlemen, more insights.",
  "End-to-end encrypted, noise-to-noise excluded.",
  "The only bot that focuses purely on your alpha.",
  'Market automation without the "noise".',
  "Market APIs that don't require external dependencies.",
  "We ship features faster than the market shifts.",
  "Your AI financial assistant, now with deep reasoning.",
  "Think different. Actually analyze.",
  "Greetings, Professor Falken",
  HOLIDAY_TAGLINES.newYear,
  HOLIDAY_TAGLINES.lunarNewYear,
  HOLIDAY_TAGLINES.christmas,
  HOLIDAY_TAGLINES.eid,
  HOLIDAY_TAGLINES.diwali,
  HOLIDAY_TAGLINES.easter,
  HOLIDAY_TAGLINES.hanukkah,
  HOLIDAY_TAGLINES.halloween,
  HOLIDAY_TAGLINES.thanksgiving,
  HOLIDAY_TAGLINES.valentines,
];

type HolidayRule = (date: Date) => boolean;

const DAY_MS = 24 * 60 * 60 * 1000;

function utcParts(date: Date) {
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth(),
    day: date.getUTCDate(),
  };
}

const onMonthDay =
  (month: number, day: number): HolidayRule =>
  (date) => {
    const parts = utcParts(date);
    return parts.month === month && parts.day === day;
  };

const onSpecificDates =
  (dates: Array<[number, number, number]>, durationDays = 1): HolidayRule =>
  (date) => {
    const parts = utcParts(date);
    return dates.some(([year, month, day]) => {
      if (parts.year !== year) {
        return false;
      }
      const start = Date.UTC(year, month, day);
      const current = Date.UTC(parts.year, parts.month, parts.day);
      return current >= start && current < start + durationDays * DAY_MS;
    });
  };

const inYearWindow =
  (
    windows: Array<{
      year: number;
      month: number;
      day: number;
      duration: number;
    }>,
  ): HolidayRule =>
  (date) => {
    const parts = utcParts(date);
    const window = windows.find((entry) => entry.year === parts.year);
    if (!window) {
      return false;
    }
    const start = Date.UTC(window.year, window.month, window.day);
    const current = Date.UTC(parts.year, parts.month, parts.day);
    return current >= start && current < start + window.duration * DAY_MS;
  };

const isFourthThursdayOfNovember: HolidayRule = (date) => {
  const parts = utcParts(date);
  if (parts.month !== 10) {
    return false;
  } // November
  const firstDay = new Date(Date.UTC(parts.year, 10, 1)).getUTCDay();
  const offsetToThursday = (4 - firstDay + 7) % 7; // 4 = Thursday
  const fourthThursday = 1 + offsetToThursday + 21; // 1st + offset + 3 weeks
  return parts.day === fourthThursday;
};

const HOLIDAY_RULES = new Map<string, HolidayRule>([
  [HOLIDAY_TAGLINES.newYear, onMonthDay(0, 1)],
  [
    HOLIDAY_TAGLINES.lunarNewYear,
    onSpecificDates(
      [
        [2025, 0, 29],
        [2026, 1, 17],
        [2027, 1, 6],
      ],
      1,
    ),
  ],
  [
    HOLIDAY_TAGLINES.eid,
    onSpecificDates(
      [
        [2025, 2, 30],
        [2025, 2, 31],
        [2026, 2, 20],
        [2027, 2, 10],
      ],
      1,
    ),
  ],
  [
    HOLIDAY_TAGLINES.diwali,
    onSpecificDates(
      [
        [2025, 9, 20],
        [2026, 10, 8],
        [2027, 9, 28],
      ],
      1,
    ),
  ],
  [
    HOLIDAY_TAGLINES.easter,
    onSpecificDates(
      [
        [2025, 3, 20],
        [2026, 3, 5],
        [2027, 2, 28],
      ],
      1,
    ),
  ],
  [
    HOLIDAY_TAGLINES.hanukkah,
    inYearWindow([
      { year: 2025, month: 11, day: 15, duration: 8 },
      { year: 2026, month: 11, day: 5, duration: 8 },
      { year: 2027, month: 11, day: 25, duration: 8 },
    ]),
  ],
  [HOLIDAY_TAGLINES.halloween, onMonthDay(9, 31)],
  [HOLIDAY_TAGLINES.thanksgiving, isFourthThursdayOfNovember],
  [HOLIDAY_TAGLINES.valentines, onMonthDay(1, 14)],
  [HOLIDAY_TAGLINES.christmas, onMonthDay(11, 25)],
]);

function isTaglineActive(tagline: string, date: Date): boolean {
  const rule = HOLIDAY_RULES.get(tagline);
  if (!rule) {
    return true;
  }
  return rule(date);
}

export interface TaglineOptions {
  env?: NodeJS.ProcessEnv;
  random?: () => number;
  now?: () => Date;
}

export function activeTaglines(options: TaglineOptions = {}): string[] {
  if (TAGLINES.length === 0) {
    return [DEFAULT_TAGLINE];
  }
  const today = options.now ? options.now() : new Date();
  const filtered = TAGLINES.filter((tagline) => isTaglineActive(tagline, today));
  return filtered.length > 0 ? filtered : TAGLINES;
}

export function pickTagline(options: TaglineOptions = {}): string {
  const env = options.env ?? process.env;
  const override = env?.MARKETBOT_TAGLINE_INDEX;
  if (override !== undefined) {
    const parsed = Number.parseInt(override, 10);
    if (!Number.isNaN(parsed) && parsed >= 0) {
      const pool = TAGLINES.length > 0 ? TAGLINES : [DEFAULT_TAGLINE];
      return pool[parsed % pool.length];
    }
  }
  const pool = activeTaglines(options);
  const rand = options.random ?? Math.random;
  const index = Math.floor(rand() * pool.length) % pool.length;
  return pool[index];
}

export { TAGLINES, HOLIDAY_RULES, DEFAULT_TAGLINE };

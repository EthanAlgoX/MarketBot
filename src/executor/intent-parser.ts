/*
 * Copyright (C) 2026 MarketBot
 *
 * This file is part of MarketBot.
 */

import path from "node:path";
import os from "node:os";
import { runEmbeddedPiAgent } from "../agents/pi-embedded.js";
import { loadConfig } from "../config/config.js";
import type { Intent } from "./types.js";

const SYSTEM_PROMPT = `
You are the MarketBot Intent Parser. Your job is to convert user natural language requests into a structured JSON execution plan.

## Available Actions
- \`fetch.market_data\`: Get historical price data. Params: \`symbol\`, \`timeframe\`, \`limit\`.
- \`news.headlines\`: Get market news headlines. Params: \`query\`, \`limit\`, \`locale\`.
- \`analysis.technicals\`: Perform technical analysis. Params: \`data\` or \`symbol\`, \`timeframe\`.
- \`analysis.fundamentals\`: Fetch fundamental data for a symbol. Params: \`symbol\`.
- \`analysis.risk\`: Compute risk metrics. Params: \`data\` or \`symbol\`, \`timeframe\`.
- \`analysis.summary\`: Full market summary (technicals + fundamentals + risk). Params: \`symbol\`, \`timeframe\`.
- \`strategy.run\`: Execute a trading strategy. Params: \`strategy_id\`, \`symbol\`, \`params\`.
- \`portfolio.overview\`: Summarize portfolio positions. Params: \`positions\` (symbol, quantity, costBasis).
- \`portfolio_risk\`: Compute portfolio risk metrics. Params: \`positions\`, \`weights?\`, \`timeframe?\`, \`benchmark?\`.
- \`compare\`: Compare multiple symbols. Params: \`symbols\`, \`timeframe?\`, \`benchmark?\`.
- \`brief\`: Build a news-driven brief. Params: \`symbol?\`, \`query?\`, \`timeframe?\`, \`limit?\`, \`locale?\`, \`noSymbol?\`.
- \`notify.user\`: Send a message to the user. Params: \`channel\`, \`message\`.
- \`desktop.screenshot\`: Capture full system screen.
- \`desktop.click\`: Click at coordinates. Params: \`x\`, \`y\` (0-1000).
- \`desktop.type\`: Type text. Params: \`text\`.
- \`desktop.wait\`: Wait. Params: \`timeMs\`.

## Visual Reasoning (UI-TARS Style)
When a screenshot is available, you MUST use it to identify UI elements.
1. **Locate Landmarks**: Identify major UI components (Dock, Menu Bar, Window Titles).
2. **Estimate Coordinates**: Coordinates are normalized (0-1000). 
   - [0, 0] is Top-Left.
   - [1000, 1000] is Bottom-Right.
3. **Chain of Thought**: In the "thought" field, describe the visual landmark and how you derived the coordinates.
   - Example: "I see the Chrome icon in the dock. The dock is centered at the bottom [~500, 950]. Chrome is the 3rd icon from the left, so I estimate [420, 950]."

## Response Format
You MUST respond with a VALID JSON object encased in a markdown code block.
DO NOT include any conversational text, preamble, or explanations outside the JSON block.

Example:
\`\`\`json
{
  "intent": "browser_interaction",
  "steps": [...]
}
\`\`\`

## Variables
Use \`<step_id.output.property>\` to reference previous results.

## Example
User: "Search for Bitcoin on Google in Safari"
Response:
{
  "intent": "web_search_safari",
  "steps": [
    {
      "id": "ss",
      "thought": "I need to see the desktop to find Safari.",
      "action": "desktop.screenshot",
      "input": {}
    },
    {
      "id": "click_safari",
      "thought": "Safari is in the dock, usually near the left. I'll click at [120, 950].",
      "action": "desktop.click",
      "input": { "x": 120, "y": 950 }
    }
  ]
}
`;

export class IntentParser {
  async parse(text: string): Promise<Intent> {
    const cfg = loadConfig();

    const ts = Date.now();
    const sessionId = "intent-parse-" + ts;
    const forcefulPrompt = `USER TASK: "${text}"\n\nCRITICAL: You MUST respond with a VALID JSON execution plan of steps. Follow the Response Format in the system prompt. DO NOT CHAT. ONLY JSON.`;

    const result = await runEmbeddedPiAgent({
      prompt: forcefulPrompt,
      extraSystemPrompt: SYSTEM_PROMPT,
      config: cfg,
      workspaceDir: process.cwd(),
      sessionId: sessionId,
      sessionFile: path.join(os.tmpdir(), "mb-intent-" + sessionId + ".json"),
      timeoutMs: 30000,
      runId: sessionId,
      thinkLevel: "high",
    });

    const content = result.payloads?.[0]?.text ?? "";
    try {
      let jsonStr = content;

      // Attempt to extract from markdown code blocks first
      const mdMatch =
        content.match(/```json\s*([\s\S]*?)\s*```/) || content.match(/```\s*([\s\S]*?)\s*```/);
      if (mdMatch) {
        jsonStr = mdMatch[1];
      } else {
        // Fallback to finding the first { and last }
        const jsonStart = content.indexOf("{");
        const jsonEnd = content.lastIndexOf("}");
        if (jsonStart !== -1 && jsonEnd !== -1) {
          jsonStr = content.substring(jsonStart, jsonEnd + 1);
        }
      }

      const intent = JSON.parse(jsonStr) as Intent;
      if (!intent.id) {
        intent.id = "intent-" + Date.now();
      }
      return intent;
    } catch (err) {
      throw new Error("Failed to parse Intent JSON: " + String(err) + "\nRaw content: " + content, {
        cause: err,
      });
    }
  }
}

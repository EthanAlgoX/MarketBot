/*
 * Copyright (C) 2026 MarketBot
 *
 * This file is part of MarketBot.
 */

import { IntentParser } from "../../executor/intent-parser.js";
import { TaskExecutor } from "../../executor/task-executor.js";
import { ErrorCodes, errorShape } from "../protocol/index.js";
import type { GatewayRequestHandlers } from "./types.js";
import { createMarketBotTools } from "../../agents/marketbot-tools.js";
import { loadConfig } from "../../config/config.js";
import { createFinanceSkills } from "../../executor/finance-skills.js";

const parser = new IntentParser();
const executor = new TaskExecutor();

function registerToolsAsSkills() {
  const cfg = loadConfig();
  const tools = createMarketBotTools({ config: cfg });
  for (const skill of createFinanceSkills({ profile: "marketbot" })) {
    executor.registerSkill(skill);
  }

  for (const tool of tools) {
    executor.registerSkill({
      name: tool.name,
      description: tool.description,
      schema: tool.parameters,
      execute: (input) =>
        tool.execute(`call-${Date.now()}`, input, new AbortController().signal, () => {}),
    });
  }
}

// Initial registration
registerToolsAsSkills();

export const executorHandlers: GatewayRequestHandlers = {
  "executor.parse": async ({ params, respond }) => {
    const p = params as { text: string };
    if (!p.text) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "text is required"));
      return;
    }

    try {
      const intent = await parser.parse(p.text);
      respond(true, intent, undefined, undefined);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(err)), undefined);
    }
  },

  "executor.run": async ({ params, respond, context }) => {
    const intent = params as any; // Cast to Intent
    if (!intent.steps || !Array.isArray(intent.steps)) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.INVALID_REQUEST, "Valid intent with steps required"),
      );
      return;
    }

    // Acknowledge start
    respond(true, { ok: true, intentId: intent.id }, undefined, undefined);

    // Hook up listener to broadcast updates
    const onUpdate = (update: any) => {
      context.broadcast("executor.update", update);
    };

    executor.on("update", onUpdate);

    try {
      await executor.run(intent);
    } finally {
      executor.off("update", onUpdate);
    }
  },
};

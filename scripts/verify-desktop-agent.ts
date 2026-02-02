/*
 * Copyright (C) 2026 MarketBot
 */

import { IntentParser } from "../src/executor/intent-parser.js";
import { TaskExecutor } from "../src/executor/task-executor.js";
import { createMarketBotTools } from "../src/agents/marketbot-tools.js";
import { createSubsystemLogger } from "../src/logging/subsystem.js";

const logger = createSubsystemLogger("test-desktop");

async function main() {
    console.log("🚀 Starting Desktop Agent Verification...");

    const parser = new IntentParser();
    const executor = new TaskExecutor();

    // Register all tools including the new DesktopTool
    const tools = createMarketBotTools();
    for (const tool of tools) {
        executor.registerSkill({
            name: tool.name,
            description: tool.description || "",
            schema: tool.parameters || {},
            execute: async (input) => {
                // Bridge AgentTool to Skill
                const result = await tool.execute("test-call", input);
                return result.details || result;
            }
        });
    }

    // Subscribe to updates to verify rich trace data
    executor.on("update", (update) => {
        console.log(`\n[UPDATE] Action: ${update.actionId}, Status: ${update.status}`);
        if (update.thought) console.log(`💭 Thought: ${update.thought}`);
        if (update.observation) console.log(`👁️ Observation: ${update.observation}`);
        if (update.point) console.log(`📍 Point: [${update.point.x}, ${update.point.y}]`);
        if (update.screenshots && update.screenshots.length > 0) {
            console.log(`📸 Screenshots: ${update.screenshots.length} captured`);
            console.log(`🖼️ Latest: ${update.screenshots[update.screenshots.length - 1]}`);
        }
    });

    const defaultPrompt = "Capture a desktop screenshot and click near the bottom dock center";
    const testPrompt = process.argv[2] || defaultPrompt;
    console.log(`\n💬 Prompt: "${testPrompt}"`);

    try {
        console.log("🧠 Parsing intent...");
        const intent = await parser.parse(testPrompt);
        console.log(`✅ Intent parsed: ${intent.intent}`);
        console.log("Steps:", JSON.stringify(intent.steps, null, 2));

        console.log("\n🏃 Executing actions...");
        await executor.run(intent);
        console.log("\n🏁 Execution finished successfully!");
    } catch (err) {
        console.error("\n❌ Execution failed:", err);
        process.exit(1);
    }
}

main();

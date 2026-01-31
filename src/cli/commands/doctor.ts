import { Command } from "commander";
import { loadConfig } from "../../config/io.js";
import { createProviderFromConfigAsync } from "../../core/providers/registry.js";
import { fetchYahooQuoteFromHtml } from "../../data/providers/yahooFinance.js";
import { buildSkillStatus } from "../../skills/status.js";
import { createDefaultToolRegistry } from "../../tools/registry.js";

export function doctorCommand(): Command {
    return new Command("doctor")
        .description("Check the health of the MarketBot system")
        .action(async () => {
            console.log("🦞 MarketBot Doctor - Diagnosing system health...\n");

            // 1. Config & LLM Check
            try {
                const config = await loadConfig(process.cwd(), { validate: true });
                console.log("✅ Configuration: OK");

                const provider = await createProviderFromConfigAsync(config);
                console.log(`✅ LLM Provider: OK (${config.llm?.provider || "default"})`);

                // Simple connectivity test
                const testPrompt = "Ping";
                try {
                    await provider.complete(testPrompt);
                    console.log("✅ LLM Connectivity: OK");
                } catch (err) {
                    console.error(`❌ LLM Connectivity: Failed (${err instanceof Error ? err.message : String(err)})`);
                }
            } catch (err) {
                console.error(`❌ Configuration/LLM: Failed (${err instanceof Error ? err.message : String(err)})`);
            }

            // 2. Data Source Check (Yahoo Scraper)
            console.log("\n--- Data Sources ---");
            try {
                const quote = await fetchYahooQuoteFromHtml("GOOGL");
                if (quote && !isNaN(quote.price)) {
                    console.log(`✅ Yahoo Finance Scraper: OK (GOOGL price: ${quote.price})`);
                } else {
                    console.log("❌ Yahoo Finance Scraper: Returned invalid data");
                }
            } catch (err) {
                console.error(`❌ Yahoo Finance Scraper: Failed (${err instanceof Error ? err.message : String(err)})`);
            }

            // 3. Dynamic Skills Check
            console.log("\n--- Dynamic Skills & Tools ---");
            try {
                const registry = await createDefaultToolRegistry();
                const tools = registry.list();
                console.log(`✅ Dynamic Tool Discovery: OK (${tools.length} tools found)`);

                const status = await buildSkillStatus(await loadConfig(process.cwd()));
                const eligible = status.skills.filter(s => s.eligible).length;
                console.log(`✅ Skill Eligibility: OK (${eligible}/${status.skills.length} eligible)`);

                if (status.skills.some(s => s.disabled)) {
                    const disabled = status.skills.filter(s => s.disabled).map(s => s.name).join(", ");
                    console.log(`ℹ️ Disabled Skills: ${disabled}`);
                }
            } catch (err) {
                console.error(`❌ Skills Registry: Failed (${err instanceof Error ? err.message : String(err)})`);
            }

            console.log("\nDiagnosis complete.");
        });
}

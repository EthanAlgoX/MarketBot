
import { createDefaultToolRegistry } from "../src/tools/registry.js";

async function main() {
    console.log("Loading tool registry...");
    try {
        const registry = await createDefaultToolRegistry();
        const tools = registry.list();
        console.log(`\nSuccessfully loaded ${tools.length} tools:`);
        tools.forEach(t => {
            console.log(`- ${t.name}: ${t.description.substring(0, 50)}...`);
        });
    } catch (error) {
        console.error("Registry load failed:", error);
    }
}

main();

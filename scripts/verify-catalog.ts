
import { loadModelCatalog } from "../src/agents/model-catalog.js";
import { defaultRuntime } from "../src/runtime.js";

async function verifyCatalog() {
    console.log("Verifying model catalog...");

    try {
        const catalog = await loadModelCatalog({ useCache: false });
        console.log(`Loaded ${catalog.length} models.`);

        if (catalog.length === 0) {
            console.error("❌ Catalog is empty!");
            process.exit(1);
        }

        const ids = new Set<string>();
        const duplicates: string[] = [];

        for (const model of catalog) {
            if (ids.has(model.id)) {
                duplicates.push(model.id);
            }
            ids.add(model.id);
        }

        if (duplicates.length > 0) {
            console.error("❌ Duplicate model IDs found:", duplicates);
            process.exit(1);
        } else {
            console.log("✅ No duplicate IDs found.");
        }

        // Check for essential models
        const requiredModels = ["gpt-4o", "claude-3-5-sonnet-latest"];
        const missing = requiredModels.filter(req => !ids.has(req) && !catalog.find(m => m.id.includes(req)));

        if (missing.length > 0) {
            console.warn("⚠️ Warning: Some common models appear missing or renamed:", missing);
        } else {
            console.log("✅ Essential models present.");
        }

        console.log("Catalog verification passed.");
        process.exit(0);

    } catch (error) {
        console.error("❌ Failed to load catalog:", error);
        process.exit(1);
    }
}

verifyCatalog();

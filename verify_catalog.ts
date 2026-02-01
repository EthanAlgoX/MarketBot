import { loadModelCatalog } from "./src/agents/model-catalog.js";

async function verify() {
    const catalog = await loadModelCatalog({ useCache: false });
    const providers = new Set(catalog.map(e => e.provider));
    console.log("Providers in catalog:", Array.from(providers).sort());

    if (providers.has("kimi-coding")) {
        console.log("✅ kimi-coding found in catalog");
    } else {
        console.log("❌ kimi-coding NOT found in catalog");
    }

    if (providers.has("zai")) {
        console.log("✅ zai found in catalog");
    } else {
        console.log("❌ zai NOT found in catalog");
    }
}

verify().catch(console.error);

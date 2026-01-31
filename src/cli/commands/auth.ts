
import { Command } from "commander";
import { login, logout, getCredentials, type OAuthProvider } from "../../core/auth/oauth.js";

const SUPPORTED_PROVIDERS: OAuthProvider[] = ["google", "openai-codex"];

function parseProvider(raw?: string): OAuthProvider | "all" {
    const value = (raw || "google").toLowerCase();
    if (value === "all") return "all";
    if (value === "google" || value === "openai-codex") return value;
    throw new Error(`Unsupported provider "${raw}". Use: ${SUPPORTED_PROVIDERS.join(", ")}.`);
}

export function createAuthCommand(): Command {
    const cmd = new Command("auth")
        .description("Manage authentication for LLM subscriptions");

    cmd.command("login")
        .description("Log in via OAuth")
        .option("--provider <provider>", `Provider (${SUPPORTED_PROVIDERS.join(", ")})`, "google")
        .action(async (opts) => {
            try {
                const provider = parseProvider(opts.provider);
                if (provider === "all") {
                    throw new Error("Login does not support provider=all");
                }
                await login(provider);
            } catch (err) {
                console.error("Login failed:", err);
                process.exit(1);
            }
        });

    cmd.command("logout")
        .description("Log out and clear credentials")
        .option("--provider <provider>", `Provider (${SUPPORTED_PROVIDERS.join(", ")} or all)`, "google")
        .action(async (opts) => {
            try {
                const provider = parseProvider(opts.provider);
                await logout(provider);
            } catch (err) {
                console.error("Logout failed:", err);
                process.exit(1);
            }
        });

    cmd.command("status")
        .description("Check current authentication status")
        .option("--provider <provider>", `Provider (${SUPPORTED_PROVIDERS.join(", ")} or all)`, "google")
        .action(async (opts) => {
            const provider = parseProvider(opts.provider);
            if (provider === "all") {
                for (const p of SUPPORTED_PROVIDERS) {
                    const creds = await getCredentials(p);
                    if (creds) {
                        console.log(`[${p}] Authenticated`);
                        console.log(`[${p}] Expires at: ${new Date(creds.expires_at).toISOString()}`);
                    } else {
                        console.log(`[${p}] Not authenticated`);
                    }
                }
                return;
            }

            const creds = await getCredentials(provider);
            if (creds) {
                console.log("Authenticated");
                console.log(`Expires at: ${new Date(creds.expires_at).toISOString()}`);
            } else {
                console.log("Not authenticated");
            }
        });

    return cmd;
}

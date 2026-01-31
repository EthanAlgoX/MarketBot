
import { Command } from "commander";
import { login, logout, getCredentials } from "../../core/auth/oauth.js";

export function createAuthCommand(): Command {
    const cmd = new Command("auth")
        .description("Manage authentication for LLM subscriptions");

    cmd.command("login")
        .description("Log in via Google OAuth")
        .action(async () => {
            try {
                await login();
            } catch (err) {
                console.error("Login failed:", err);
                process.exit(1);
            }
        });

    cmd.command("logout")
        .description("Log out and clear credentials")
        .action(async () => {
            try {
                await logout();
            } catch (err) {
                console.error("Logout failed:", err);
                process.exit(1);
            }
        });

    cmd.command("status")
        .description("Check current authentication status")
        .action(async () => {
            const creds = await getCredentials();
            if (creds) {
                console.log("Authenticated");
                console.log(`Expires at: ${new Date(creds.expires_at).toISOString()}`);
            } else {
                console.log("Not authenticated");
            }
        });

    return cmd;
}

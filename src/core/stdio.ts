// Standard I/O utilities for CLI

import * as readline from "node:readline";

/**
 * Read all input from stdin until EOF.
 * Returns empty string if stdin is a TTY (interactive terminal).
 */
export async function readStdin(): Promise<string> {
    // Skip if running in interactive mode
    if (process.stdin.isTTY) {
        return "";
    }

    return new Promise<string>((resolve) => {
        const chunks: string[] = [];
        const rl = readline.createInterface({
            input: process.stdin,
            crlfDelay: Infinity,
        });

        rl.on("line", (line) => {
            chunks.push(line);
        });

        rl.on("close", () => {
            resolve(chunks.join("\n"));
        });

        rl.on("error", () => {
            resolve("");
        });

        // Timeout after 100ms if no data
        setTimeout(() => {
            rl.close();
        }, 100);
    });
}

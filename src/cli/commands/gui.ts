import { spawn } from "node:child_process";
import { loadConfig } from "../../config/io.js";
import { startHttpServer } from "../../server/httpServer.js";

export async function guiCommand(opts: { host?: string; port?: number; open?: boolean } = {}) {
  const config = await loadConfig(process.cwd());
  const envPort = process.env.MARKETBOT_SERVER_PORT
    ? Number(process.env.MARKETBOT_SERVER_PORT)
    : process.env.TRADEBOT_SERVER_PORT
      ? Number(process.env.TRADEBOT_SERVER_PORT)
      : undefined;
  const envHost = process.env.MARKETBOT_SERVER_HOST?.trim() ?? process.env.TRADEBOT_SERVER_HOST?.trim();

  const host = opts.host ?? envHost ?? config.server?.host ?? "127.0.0.1";
  const port = opts.port ?? envPort ?? config.server?.port ?? 8787;
  const shouldOpen = opts.open !== false;

  await startHttpServer({ host, port, enableGui: true });
  const url = `http://${host}:${port}/`;

  console.log(`MarketBot GUI listening on ${url}`);
  if (!shouldOpen) return;

  try {
    await openUrl(url);
  } catch (err) {
    console.warn(`Failed to open browser: ${err instanceof Error ? err.message : String(err)}`);
  }
}

function openUrl(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const platform = process.platform;
    const command =
      platform === "darwin"
        ? "open"
        : platform === "win32"
          ? "cmd"
          : "xdg-open";
    const args =
      platform === "win32"
        ? ["/c", "start", "", url]
        : [url];

    const child = spawn(command, args, { stdio: "ignore", detached: true });
    child.on("error", reject);
    child.unref();
    resolve();
  });
}

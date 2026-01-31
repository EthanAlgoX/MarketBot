import { loadConfig } from "../../config/io.js";
import { startHttpServer } from "../../server/httpServer.js";

export async function serverCommand(
  opts: { host?: string; port?: number; enableGui?: boolean } = {},
): Promise<void> {
  const config = await loadConfig(process.cwd());
  const envPort = process.env.MARKETBOT_SERVER_PORT
    ? Number(process.env.MARKETBOT_SERVER_PORT)
    : process.env.TRADEBOT_SERVER_PORT
      ? Number(process.env.TRADEBOT_SERVER_PORT)
      : undefined;
  const envHost = process.env.MARKETBOT_SERVER_HOST?.trim() ?? process.env.TRADEBOT_SERVER_HOST?.trim();

  const host = opts.host ?? envHost ?? config.server?.host ?? "127.0.0.1";
  const port = opts.port ?? envPort ?? config.server?.port ?? 8787;

  await startHttpServer({ host, port, enableGui: opts.enableGui });
  const base = `http://${host}:${port}`;
  console.log(`MarketBot HTTP server listening on ${base}`);
  if (opts.enableGui) {
    console.log(`MarketBot GUI available at ${base}/`);
  }
}

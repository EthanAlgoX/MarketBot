import { defineConfig } from "astro/config";
import { resolveWwwPort } from "./www-port.mjs";

const siteUrl = process.env.PUBLIC_SITE_URL?.trim();
if (siteUrl && !/^https?:\/\//.test(siteUrl)) {
  throw new Error("PUBLIC_SITE_URL must be an absolute HTTP or HTTPS URL");
}

export default defineConfig({
  ...(siteUrl ? { site: new URL(siteUrl).origin } : {}),
  output: "static",
  server: { host: "127.0.0.1", port: resolveWwwPort(), strictPort: true },
  preview: { host: "127.0.0.1", port: resolveWwwPort() },
});

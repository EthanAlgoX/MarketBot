import { MarkdownConfigSchema } from "marketbot/plugin-sdk";
import { z } from "zod";

const allowFromEntry = z.union([z.string(), z.number()]);

const wecomAccountSchema = z.object({
  name: z.string().optional(),
  enabled: z.boolean().optional(),
  markdown: MarkdownConfigSchema,

  /**
   * WeCom "AI bot" webhook security:
   * token + encodingAesKey are used for signature + AES encrypt/decrypt.
   */
  token: z.string().optional(),
  encodingAesKey: z.string().optional(),
  corpId: z.string().optional(),

  /**
   * Webhook routing.
   * If webhookUrl is set, we only use it to infer the path (optional).
   */
  webhookUrl: z.string().optional(),
  webhookPath: z.string().optional(),

  dmPolicy: z.enum(["pairing", "allowlist", "open", "disabled"]).optional(),
  allowFrom: z.array(allowFromEntry).optional(),
});

export const WecomConfigSchema = wecomAccountSchema.extend({
  accounts: z.object({}).catchall(wecomAccountSchema).optional(),
  defaultAccount: z.string().optional(),
});


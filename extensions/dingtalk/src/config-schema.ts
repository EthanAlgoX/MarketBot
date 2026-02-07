import { MarkdownConfigSchema } from "marketbot/plugin-sdk";
import { z } from "zod";

const allowFromEntry = z.union([z.string(), z.number()]);

const dingtalkAccountSchema = z.object({
  name: z.string().optional(),
  enabled: z.boolean().optional(),
  markdown: MarkdownConfigSchema,

  clientId: z.string().optional(),
  clientSecret: z.string().optional(),

  /**
   * Optional: when replying via AI Card / group delivery, DingTalk uses robotCode.
   * For Stream mode message replies (sessionWebhook), it's still useful as a default identifier.
   */
  robotCode: z.string().optional(),

  dmPolicy: z.enum(["pairing", "allowlist", "open", "disabled"]).optional(),
  allowFrom: z.array(allowFromEntry).optional(),

  debug: z.boolean().optional(),
});

export const DingTalkConfigSchema = dingtalkAccountSchema.extend({
  accounts: z.object({}).catchall(dingtalkAccountSchema).optional(),
  defaultAccount: z.string().optional(),
});


import { MarkdownConfigSchema } from "marketbot/plugin-sdk";
import { z } from "zod";

const allowFromEntry = z.union([z.string(), z.number()]);

const qqbotAccountSchema = z.object({
  name: z.string().optional(),
  enabled: z.boolean().optional(),
  markdown: MarkdownConfigSchema,

  appId: z.string().optional(),
  clientSecret: z.string().optional(),

  /**
   * Gateway intents (bitmask). If unset, defaults to a conservative set.
   * You may need to request permissions for group/C2C intents.
   */
  intents: z.number().optional(),

  markdownSupport: z.boolean().optional(),

  dmPolicy: z.enum(["pairing", "allowlist", "open", "disabled"]).optional(),
  allowFrom: z.array(allowFromEntry).optional(),
});

export const QQBotConfigSchema = qqbotAccountSchema.extend({
  accounts: z.object({}).catchall(qqbotAccountSchema).optional(),
  defaultAccount: z.string().optional(),
});


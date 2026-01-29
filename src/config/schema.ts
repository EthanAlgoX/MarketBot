import { z } from "zod";

export const AgentSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().optional(),
    workspace: z.string().optional(),
    default: z.boolean().optional(),
  })
  .passthrough();

export const TradeBotConfigSchema = z
  .object({
    agents: z
      .object({
        defaults: z
          .object({
            workspace: z.string().optional(),
            ensureBootstrap: z.boolean().optional(),
          })
          .passthrough()
          .optional(),
        list: z.array(AgentSchema).optional(),
      })
      .passthrough()
      .optional(),
    skills: z
      .object({
        enabled: z.boolean().optional(),
        directories: z.array(z.string()).optional(),
        maxCharsPerSkill: z.number().int().positive().optional(),
        maxSkills: z.number().int().positive().optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

export type TradeBotConfigSchemaType = z.infer<typeof TradeBotConfigSchema>;

export function validateConfig(raw: unknown): TradeBotConfigSchemaType {
  const parsed = TradeBotConfigSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`);
    throw new Error(`Invalid tradebot.json:\n${issues.join("\n")}`);
  }
  return parsed.data;
}

import { z } from "zod";

export const AgentSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().optional(),
    workspace: z.string().optional(),
    default: z.boolean().optional(),
  })
  .passthrough();

export const MarketBotConfigSchema = z
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
        managedDir: z.string().optional(),
        allowlist: z.array(z.string()).optional(),
        denylist: z.array(z.string()).optional(),
        entries: z.record(
          z.object({
            enabled: z.boolean().optional(),
            env: z.record(z.string()).optional(),
            config: z.record(z.string()).optional(),
            apiKey: z.string().optional(),
          }),
        ).optional(),
      })
      .passthrough()
      .optional(),
    llm: z
      .object({
        provider: z.enum(["mock", "openai-compatible"]).optional(),
        model: z.string().optional(),
        baseUrl: z.string().optional(),
        apiKeyEnv: z.string().optional(),
        apiKey: z.string().optional(),
        timeoutMs: z.number().int().positive().optional(),
        jsonMode: z.boolean().optional(),
        headers: z.record(z.string()).optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

export type MarketBotConfigSchemaType = z.infer<typeof MarketBotConfigSchema>;

export function validateMarketBotConfig(raw: unknown): MarketBotConfigSchemaType {
  const parsed = MarketBotConfigSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`);
    throw new Error(`Invalid marketbot.json:\n${issues.join("\n")}`);
  }
  return parsed.data;
}

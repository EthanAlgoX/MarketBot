import type { LLMProvider } from "../llm.js";
import { postJson } from "./http.js";

export interface OpenAICompatibleConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  timeoutMs?: number;
  jsonMode?: boolean;
  extraHeaders?: Record<string, string>;
}

export class OpenAICompatibleProvider implements LLMProvider {
  constructor(private config: OpenAICompatibleConfig) {}

  async generateText(args: { system: string; prompt: string; input?: unknown }): Promise<string> {
    const content = buildUserContent(args.prompt, args.input);
    const response = await this.callChat({
      messages: [
        { role: "system", content: args.system },
        { role: "user", content },
      ],
    });
    return response;
  }

  async generateJSON<T>(args: { system: string; prompt: string; input?: unknown; schema?: string }): Promise<T> {
    const schema = args.schema ? `Schema:\n${args.schema}` : "";
    const content = [
      args.prompt,
      "Return ONLY valid JSON (no markdown).",
      schema,
      args.input ? `Input:\n${JSON.stringify(args.input)}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    const response = await this.callChat({
      messages: [
        { role: "system", content: args.system },
        { role: "user", content },
      ],
      jsonMode: this.config.jsonMode ?? false,
    });

    const parsed = safeJsonParse<T>(response);
    if (!parsed) {
      throw new Error("Failed to parse JSON response from LLM");
    }
    return parsed;
  }

  private async callChat(params: {
    messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
    jsonMode?: boolean;
  }): Promise<string> {
    const endpoint = `${this.config.baseUrl.replace(/\/$/, "")}/chat/completions`;
    const body: Record<string, unknown> = {
      model: this.config.model,
      messages: params.messages,
      temperature: 0.2,
    };

    if (params.jsonMode) {
      body.response_format = { type: "json_object" };
    }

    const payload = await postJson<OpenAIChatResponse>(endpoint, body, {
      timeoutMs: this.config.timeoutMs,
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        ...(this.config.extraHeaders ?? {}),
      },
    });

    const choice = payload.choices?.[0];
    const content = choice?.message?.content;
    if (!content) {
      throw new Error("LLM response missing content");
    }
    return content.trim();
  }
}

function buildUserContent(prompt: string, input?: unknown): string {
  if (input === undefined) return prompt;
  return `${prompt}\n\nInput:\n${JSON.stringify(input)}`;
}

function safeJsonParse<T>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    // Try to extract JSON object/array from text.
    const match = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]) as T;
    } catch {
      return null;
    }
  }
}

interface OpenAIChatResponse {
  choices?: Array<{ message?: { content?: string } }>;
}

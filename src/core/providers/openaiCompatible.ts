import type { LLMProvider, LLMMessage, LLMResponse } from "../llm.js";
import type { ToolDefinition, ToolCall, LLMToolResponse } from "../agentTypes.js";
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
  constructor(private config: OpenAICompatibleConfig) { }

  async chat(messages: LLMMessage[]): Promise<LLMResponse> {
    // Filter to only standard chat messages for basic chat
    const chatMessages = messages
      .filter(m => m.role !== "tool" && m.content !== null)
      .map(m => ({ role: m.role as "system" | "user" | "assistant", content: m.content as string }));
    const content = await this.callChat({ messages: chatMessages });
    return {
      content,
      usage: {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0,
      },
    };
  }

  async complete(prompt: string): Promise<string> {
    return this.callChat({
      messages: [{ role: "user", content: prompt }],
    });
  }

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

  async chatWithTools(messages: LLMMessage[], tools: ToolDefinition[]): Promise<LLMToolResponse> {
    const endpoint = `${this.config.baseUrl.replace(/\/$/, "")}/chat/completions`;

    // Convert messages for API
    const apiMessages = messages.map(m => {
      if (m.role === "tool") {
        return {
          role: "tool" as const,
          tool_call_id: m.toolCallId ?? "",
          content: m.content ?? "",
        };
      }
      if (m.role === "assistant" && m.toolCalls) {
        return {
          role: "assistant" as const,
          content: m.content,
          tool_calls: m.toolCalls.map(tc => ({
            id: tc.id,
            type: "function" as const,
            function: {
              name: tc.name,
              arguments: tc.arguments,
            },
          })),
        };
      }
      return {
        role: m.role,
        content: m.content ?? "",
      };
    });

    const body: Record<string, unknown> = {
      model: this.config.model,
      messages: apiMessages,
      temperature: 0.2,
      tools: tools,
    };

    const payload = await postJson<OpenAIChatResponseWithTools>(endpoint, body, {
      timeoutMs: this.config.timeoutMs,
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        ...(this.config.extraHeaders ?? {}),
      },
    });

    const choice = payload.choices?.[0];
    const message = choice?.message;
    const finishReason = choice?.finish_reason as LLMToolResponse["finishReason"];

    // Parse tool calls if present
    const toolCalls: ToolCall[] | undefined = message?.tool_calls?.map(tc => ({
      id: tc.id,
      name: tc.function.name,
      arguments: tc.function.arguments,
    }));

    return {
      content: message?.content ?? null,
      toolCalls: toolCalls?.length ? toolCalls : undefined,
      finishReason,
      usage: payload.usage,
    };
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

interface OpenAIChatResponseWithTools {
  choices?: Array<{
    message?: {
      content?: string | null;
      tool_calls?: Array<{
        id: string;
        type: string;
        function: {
          name: string;
          arguments: string;
        };
      }>;
    };
    finish_reason?: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}


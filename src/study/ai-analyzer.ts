/**
 * LLM provider interface and adapters for site analysis.
 * Supports Claude (Anthropic), OpenAI, and Ollama.
 */
import { log } from "../utils/logger.js";

/**
 * Generic LLM provider interface.
 */
export interface LLMProvider {
  name: string;
  analyze(prompt: string, context: string): Promise<string>;
}

/**
 * Claude (Anthropic) provider.
 */
export class ClaudeProvider implements LLMProvider {
  name = "claude";
  private apiKey: string;
  private model: string;

  constructor(apiKey?: string, model = "claude-sonnet-4-20250514") {
    this.apiKey = apiKey || process.env.ANTHROPIC_API_KEY || "";
    this.model = model;
    if (!this.apiKey) {
      throw new Error(
        "ANTHROPIC_API_KEY not set. Set it in .env or pass --api-key",
      );
    }
  }

  async analyze(prompt: string, context: string): Promise<string> {
    try {
      const { default: Anthropic } = await import("@anthropic-ai/sdk");
      const client = new Anthropic({ apiKey: this.apiKey });
      const message = await client.messages.create({
        model: this.model,
        max_tokens: 4096,
        messages: [
          {
            role: "user",
            content: `${prompt}\n\nCONTEXT:\n${context}`,
          },
        ],
      });
      const textBlock = message.content.find((b: any) => b.type === "text");
      return (textBlock as any)?.text || "";
    } catch (err) {
      log.error(`Claude API error: ${(err as Error).message}`);
      throw err;
    }
  }
}

/**
 * OpenAI provider.
 */
export class OpenAIProvider implements LLMProvider {
  name = "openai";
  private apiKey: string;
  private model: string;

  constructor(apiKey?: string, model = "gpt-4o") {
    this.apiKey = apiKey || process.env.OPENAI_API_KEY || "";
    this.model = model;
    if (!this.apiKey) {
      throw new Error(
        "OPENAI_API_KEY not set. Set it in .env or pass --api-key",
      );
    }
  }

  async analyze(prompt: string, context: string): Promise<string> {
    try {
      const { default: OpenAI } = await import("openai");
      const client = new OpenAI({ apiKey: this.apiKey });
      const response = await client.chat.completions.create({
        model: this.model,
        max_tokens: 4096,
        messages: [
          {
            role: "user",
            content: `${prompt}\n\nCONTEXT:\n${context}`,
          },
        ],
      });
      return response.choices[0]?.message?.content || "";
    } catch (err) {
      log.error(`OpenAI API error: ${(err as Error).message}`);
      throw err;
    }
  }
}

/**
 * Ollama provider (local LLM).
 */
export class OllamaProvider implements LLMProvider {
  name = "ollama";
  private host: string;
  private model: string;

  constructor(model = "llama3.1", host?: string) {
    this.host = host || process.env.OLLAMA_HOST || "http://localhost:11434";
    this.model = model;
  }

  async analyze(prompt: string, context: string): Promise<string> {
    try {
      const response = await fetch(`${this.host}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: this.model,
          prompt: `${prompt}\n\nCONTEXT:\n${context}`,
          stream: false,
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status}`);
      }

      const data = (await response.json()) as { response: string };
      return data.response || "";
    } catch (err) {
      log.error(`Ollama error: ${(err as Error).message}`);
      throw err;
    }
  }
}

/**
 * Create an LLM provider by name.
 */
export function createProvider(
  providerName: string,
  apiKey?: string,
  model?: string,
): LLMProvider {
  switch (providerName.toLowerCase()) {
    case "claude":
    case "anthropic":
      return new ClaudeProvider(apiKey, model);
    case "openai":
    case "gpt":
      return new OpenAIProvider(apiKey, model);
    case "ollama":
    case "local":
      return new OllamaProvider(model);
    default:
      throw new Error(
        `Unknown provider: ${providerName}. Supported: claude, openai, ollama`,
      );
  }
}

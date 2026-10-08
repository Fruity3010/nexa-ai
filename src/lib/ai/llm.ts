import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";

export const aiMode = (): "live" | "demo" => (process.env.ANTHROPIC_API_KEY ? "live" : "demo");
const MODEL = process.env.NEXA_AI_MODEL || "claude-opus-5";
let client: Anthropic | null = null;

/**
 * Structured call to Claude. Returns null when no key is configured or the call fails, so every
 * caller falls back to the deterministic demo engine instead of crashing.
 */
export async function llmJSON<S extends z.ZodType>(
  schema: S,
  system: string,
  messages: Anthropic.MessageParam[],
): Promise<z.infer<S> | null> {
  if (aiMode() !== "live") return null;
  client ??= new Anthropic();
  try {
    const res = await client.messages.parse({
      model: MODEL,
      max_tokens: 4000,
      system,
      messages,
      output_config: { format: zodOutputFormat(schema), effort: "low" },
    });
    if (res.stop_reason !== "end_turn" || !res.parsed_output) {
      console.warn("[nexa:llm] unusable response, falling back:", res.stop_reason);
      return null;
    }
    return res.parsed_output;
  } catch (e) {
    console.error("[nexa:llm] request failed, falling back to demo engine:", (e as Error).message);
    return null;
  }
}

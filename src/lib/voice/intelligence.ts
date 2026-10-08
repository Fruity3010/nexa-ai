// CallIntelligenceService: structured post-call analysis. Gemini → Claude → deterministic rules,
// always validated against the same zod schema, so the dashboard never sees free-form output.
import "server-only";
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { ConversationAnalysisService as CA, HUMAN_RX } from "../ai/analysis";
import { llmJSON } from "../ai/llm";
import type { CallIntelligence, Conversation, Settings } from "../types";
import { voiceConfig } from "./config";

export const INTENTS = ["order_status", "delivery_delay", "double_charge", "payment_missing_order", "payment_failed", "returns", "refund_status", "delivery_fee", "account_access", "product_question", "human_request", "other"] as const;

const Schema = z.object({
  summary: z.string().max(600),
  intent: z.enum(INTENTS),
  sentiment: z.enum(["positive", "neutral", "negative", "frustrated"]),
  urgency: z.enum(["low", "medium", "high", "urgent"]),
  resolution: z.enum(["resolved", "unresolved", "unknown"]),
  issues: z.array(z.string().max(60)).max(8),
  attempted: z.array(z.string().max(160)).max(10),
  recommended_action: z.string().max(400),
  follow_up_required: z.boolean(),
});
type Raw = z.infer<typeof Schema>;

const transcriptText = (c: Conversation) =>
  c.messages.filter((m) => m.role !== "system").map((m) => `${m.role === "customer" ? "Caller" : m.role === "human" ? "Human agent" : "AI agent"}: ${m.text}`).join("\n");

function prompt(c: Conversation, s: Settings) {
  return `Analyse this ${s.org.name} support phone call transcript and return the JSON fields.
Facts recorded by the system (authoritative):
- escalated to human: ${c.status === "escalated" || !!c.call?.handoff}
- agent recorded caller-confirmed resolution: ${!!c.call?.resolvedConfirmed}
- call end reason: ${c.call?.endReason ?? "unknown"}
- order/payment lookups on this call used a DEMO dataset, not a live commerce system; describe them as demo lookups
Rules: resolution is "resolved" ONLY if the caller explicitly confirmed the issue was solved; a call ending is not resolution. Use "unknown" when the outcome is unclear (e.g. the caller hung up). issues are short snake_case labels. attempted lists troubleshooting steps the agent actually performed. Do not invent facts that are not in the transcript.

TRANSCRIPT:
${transcriptText(c) || "(no speech captured)"}`;
}

async function viaGemini(c: Conversation, s: Settings): Promise<Raw | null> {
  const cfg = voiceConfig();
  if (!cfg.gemini.apiKey) return null;
  try {
    const ai = new GoogleGenAI({ apiKey: cfg.gemini.apiKey });
    const res = await ai.models.generateContent({
      model: cfg.gemini.textModel,
      contents: prompt(c, s),
      config: { responseMimeType: "application/json", responseJsonSchema: z.toJSONSchema(Schema), abortSignal: AbortSignal.timeout(20_000) },
    });
    return Schema.parse(JSON.parse(res.text ?? ""));
  } catch (e) {
    console.warn("[nexa:voice] Gemini call analysis failed, falling back:", (e as Error).message);
    return null;
  }
}

/** Deterministic analysis from the same keyword engine the chat agent uses. */
export function analyseWithRules(c: Conversation, s: Settings): Raw {
  const caller = c.messages.filter((m) => m.role === "customer").map((m) => m.text);
  const intents = caller.map((t) => CA.detectIntent(t, s)).filter((x): x is string => !!x);
  const intent = (intents.find((i) => i !== "human_request") ?? intents[0] ?? (c.intent !== "unknown" ? c.intent : "other")) as Raw["intent"];
  const neg = caller.filter((t) => CA.detectSentiment(t) === "negative").length;
  const escalated = c.status === "escalated" || !!c.call?.handoff;
  const sentiment: Raw["sentiment"] = neg >= 2 || (neg && caller.some((t) => HUMAN_RX.test(t))) ? "frustrated" : neg ? "negative" : caller.some((t) => CA.detectSentiment(t) === "positive") ? "positive" : "neutral";
  const resolution: Raw["resolution"] = escalated ? "unresolved" : c.call?.resolvedConfirmed ? "resolved" : "unknown";
  return {
    summary: c.call?.handoff?.summary || c.summary || (caller.length ? `Caller asked about ${intent.replace(/_/g, " ")}.` : "No caller speech was captured."),
    intent: (INTENTS as readonly string[]).includes(intent) ? intent : "other",
    sentiment,
    urgency: c.priority === "urgent" ? "urgent" : escalated ? "high" : neg ? "medium" : "low",
    resolution,
    issues: [...new Set(intents.filter((i) => i !== "human_request"))],
    attempted: c.attempted,
    recommended_action: escalated ? c.nextAction || "Review the transcript and contact the customer." : resolution === "resolved" ? "No action needed." : "Outcome was not confirmed on the call. Review the transcript and follow up if needed.",
    follow_up_required: resolution !== "resolved",
  };
}

export async function analyseCall(c: Conversation, s: Settings): Promise<CallIntelligence> {
  let engine: CallIntelligence["engine"] = "gemini";
  let raw = await viaGemini(c, s);
  if (!raw) { engine = "claude"; raw = await llmJSON(Schema, "You analyse customer support phone calls and output only the requested fields.", [{ role: "user", content: prompt(c, s) }]); }
  if (!raw) { engine = "rules"; raw = analyseWithRules(c, s); }
  // System facts override the model: an escalated call is never "resolved".
  const escalated = c.status === "escalated" || !!c.call?.handoff;
  const resolution = escalated && raw.resolution === "resolved" ? "unresolved" : raw.resolution;
  return { ...raw, resolution, resolved: resolution === "resolved", escalated, follow_up_required: raw.follow_up_required || resolution !== "resolved", engine };
}

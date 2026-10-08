// Voice call lifecycle on top of the shared conversation store: create the record, append
// transcript segments, run agent tools against demo data, hand off to humans, and finalise
// with post-call intelligence. Used by the Twilio webhooks, the bridge API and the simulator.
import "server-only";
import { ConversationAnalysisService as CA } from "../ai/analysis";
import { db, logActivity, mutate } from "../store";
import type { CallMeta, Conversation, Priority } from "../types";
import { voiceConfig } from "./config";
import { analyseCall } from "./intelligence";
import { voiceGreeting } from "./prompt";
import { maskPhone } from "./twilio";

const DAY = 86_400_000;
export const callId = (callSid: string) => `call-${callSid}`;
export const findCall = (callSid: string) => db().conversations.find((c) => c.id === callId(callSid));

/** Idempotent: Twilio may retry the webhook. Stores only the masked caller number. */
export function startCall(callSid: string, from: string | null, engine: CallMeta["engine"]): Conversation {
  const existing = findCall(callSid);
  if (existing) return existing;
  const masked = maskPhone(from);
  return mutate((s) => {
    const custId = `caller-${masked.replace(/\D/g, "") || "anon"}`;
    if (!s.customers.some((c) => c.id === custId))
      s.customers.push({ id: custId, name: `Caller ${masked}`, email: "", phone: masked, city: "Unknown", segment: "Repeat buyer", orders: 0 });
    const now = new Date().toISOString();
    const conv: Conversation = {
      id: callId(callSid), channel: "voice", customerId: custId, intent: "unknown", topic: "general", sentiment: "neutral", status: "open", priority: "low",
      startedAt: now, firstResponseSec: 1, effort: 1, summary: "", nextAction: "", attempted: [], notes: [], source: "phone",
      // Gemini Live transcribes its own spoken greeting; the turn-based path records it here.
      messages: engine === "twilio-gather" ? [{ id: "g", role: "agent", text: voiceGreeting(s.settings), at: now }] : [],
      call: { provider: "twilio", engine, callSid, from: masked, status: "active", transcript: "live" },
    };
    s.conversations.unshift(conv);
    logActivity(s, { kind: "call", text: `Incoming phone call from ${masked} (real Twilio call, ${engine === "gemini-live" ? "Gemini Live" : "turn-based"})`, href: `/dashboard/voice?call=${conv.id}` });
    return conv;
  });
}

export function appendTranscript(callSid: string, role: "customer" | "agent", text: string) {
  const t = text.trim().slice(0, 2000);
  if (!t) return;
  mutate(() => {
    const c = findCall(callSid);
    if (!c) return;
    c.messages.push({ id: `${role[0]}${c.messages.length}`, role, text: t, at: new Date().toISOString() });
    if (role === "customer") {
      const intent = CA.detectIntent(t, db().settings);
      if (intent && intent !== "human_request" && c.intent === "unknown") { c.intent = intent; c.topic = CA.topicFor(intent); }
      if (CA.detectSentiment(t) === "negative") c.sentiment = "negative";
    }
  });
}

/** HumanHandoffService: record the escalation. Transfer only happens if a destination is configured. */
export function escalateCall(c: Conversation, args: { reason: string; summary: string; urgency?: Priority }) {
  const transfer = voiceConfig().handoffNumber ? ("dialing" as const) : ("not_configured" as const);
  const callback = db().settings.voice.callbackMessage;
  mutate((s) => {
    c.status = "escalated";
    c.priority = args.urgency ?? "high";
    c.summary = args.summary.slice(0, 600);
    c.nextAction = transfer === "dialing" ? "Caller is being transferred to the handoff line; pick up with this summary." : "Call the customer back using this summary; no live transfer line is configured.";
    c.attempted = [...new Set([...c.attempted, "Escalated to human agent with call summary"])];
    c.call!.handoff = { at: new Date().toISOString(), reason: args.reason.slice(0, 300), transfer, summary: c.summary };
    c.messages.push({ id: `s${c.messages.length}`, role: "system", text: transfer === "dialing" ? "AI escalated the call: transferring to the configured handoff line." : "AI escalated the call. No transfer line configured; caller told to expect a callback.", at: new Date().toISOString() });
    logActivity(s, { kind: "escalation", text: `Phone call escalated by AI agent: ${args.reason.slice(0, 80)}`, href: `/dashboard/voice?call=${c.id}` });
  });
  return transfer === "dialing"
    ? { transfer: true, instruction: "A transfer line is available. Tell the caller you are transferring them now, then call end_call." }
    : { transfer: false, callback_message: callback, instruction: "No live transfer is available. Read the callback message, then call end_call. Do not say you are transferring." };
}

/** Tools the live agent can call. Order data is the clearly-labelled demo dataset only. */
export function runTool(callSid: string, name: string, args: Record<string, unknown>): Record<string, unknown> {
  const c = findCall(callSid);
  if (!c?.call) return { error: "call not found" };
  const str = (k: string) => (typeof args[k] === "string" ? (args[k] as string) : "");
  switch (name) {
    case "lookup_order": {
      const norm = (v: string, p: string) => { const m = v.replace(/\s/g, "").match(/(\d{5})/); return m ? `${p}-${m[1]}` : ""; };
      const orderId = norm(str("order_id"), "NM");
      const payRef = norm(str("payment_reference"), "PSK");
      const o = db().orders.find((x) => (orderId && x.id === orderId) || (payRef && x.paymentRef === payRef));
      mutate(() => { c.attempted = [...new Set([...c.attempted, `Order lookup (demo data): ${orderId || payRef || "no id"}`])]; });
      if (!o) return { found: false, source: "demo dataset", note: "No matching record. Ask the caller to confirm the number; do not guess." };
      return { found: true, source: "DEMO dataset, not a live commerce system", order_id: o.id, item: o.item, amount_ngn: o.amount, status: o.status, eta: o.eta, carrier: o.carrier, payment_reference: o.paymentRef, successful_debits: o.charges };
    }
    case "escalate_to_human":
      return escalateCall(c, { reason: str("reason") || "Escalation requested", summary: str("summary") || "Caller needs a human agent.", urgency: (["low", "medium", "high", "urgent"] as const).find((u) => u === args.urgency) });
    case "mark_resolved":
      mutate(() => { c.call!.resolvedConfirmed = true; c.summary = str("summary").slice(0, 600) || c.summary; });
      return { ok: true };
    case "end_call":
      return { ok: true };
    default:
      return { error: `unknown tool ${name}` };
  }
}

/** Finalise once: mark ended, run post-call intelligence, feed the shared insight engine. */
export async function endCall(c: Conversation | undefined, opts: { reason: string; durationSec?: number; failed?: boolean }) {
  if (!c?.call || c.call.status !== "active") return c;
  mutate(() => {
    c.call!.status = opts.failed ? "failed" : "completed";
    c.call!.endedAt = new Date().toISOString();
    c.call!.endReason = opts.reason;
    c.call!.transcript = c.messages.some((m) => m.role === "customer") ? (opts.failed ? "partial" : "complete") : "none";
    c.durationSec = opts.durationSec ?? Math.round((Date.now() - Date.parse(c.startedAt)) / 1000);
  });
  return applyIntelligence(c);
}

export async function applyIntelligence(c: Conversation) {
  const s = db();
  const intel = await analyseCall(c, s.settings);
  return mutate((st) => {
    c.call!.intelligence = intel;
    if (intel.intent !== "other") { c.intent = intel.intent; c.topic = CA.topicFor(intel.intent); }
    c.sentiment = intel.sentiment === "frustrated" ? "negative" : intel.sentiment;
    c.summary = intel.summary;
    c.nextAction = intel.recommended_action;
    c.attempted = [...new Set([...c.attempted, ...intel.attempted])];
    c.status = intel.escalated ? "escalated" : intel.resolved ? "ai_resolved" : "open";
    c.priority = intel.urgency;
    c.effort = intel.sentiment === "frustrated" ? 5 : intel.sentiment === "negative" ? 4 : Math.min(3, c.effort);
    // Retention: transcripts of calls older than the configured window are dropped.
    const cutoff = Date.now() - st.settings.retentionDays.conversations * DAY;
    st.conversations = st.conversations.filter((x) => !x.call || Date.parse(x.startedAt) >= cutoff);
    logActivity(st, { kind: "call", text: `Call ${c.call!.from} ended: ${intel.intent.replace(/_/g, " ")}, ${intel.resolution}${intel.escalated ? ", escalated" : ""}`, href: `/dashboard/voice?call=${c.id}` });
    return c;
  });
}

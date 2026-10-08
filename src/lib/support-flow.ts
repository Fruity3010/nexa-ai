import "server-only";
import { SupportAgentService } from "./ai/support";
import { ConversationAnalysisService as CA } from "./ai/analysis";
import { db, logActivity, mutate, uid } from "./store";
import type { Channel, Conversation, RecordSource } from "./types";

export const DEMO_CUSTOMER = "cus-1"; // Chidi Okeke: owns the demo order records

/** Append a customer message, run the support agent, and persist the result. */
export async function handleCustomerMessage(opts: { conversationId?: string; text: string; channel: Channel; source: RecordSource; externalId?: string; customerId?: string }) {
  const s = db();
  let conv = opts.conversationId ? s.conversations.find((c) => c.id === opts.conversationId) : undefined;
  const now = new Date().toISOString();
  if (!conv) {
    conv = {
      id: opts.externalId ?? uid("conv"), channel: opts.channel, customerId: opts.customerId ?? DEMO_CUSTOMER, intent: "unknown", topic: "general",
      sentiment: "neutral", status: "open", priority: "low", startedAt: now, firstResponseSec: 0, effort: 1,
      messages: [{ id: "g", role: "agent", text: s.settings.agent.greeting, at: now }],
      summary: "", nextAction: "", attempted: [], notes: [], source: opts.source,
    } satisfies Conversation;
    const created = conv;
    mutate((st) => { st.conversations.unshift(created); });
  }
  conv.messages.push({ id: `c${conv.messages.length}`, role: "customer", text: opts.text.slice(0, 2000), at: now });

  // Once a human owns the conversation the AI stays out of it.
  if (conv.status === "escalated") {
    const c = conv;
    mutate(() => { c.messages.push({ id: `s${c.messages.length}`, role: "system", text: "Message added to the human agent's queue.", at: new Date().toISOString() }); });
    return { conversation: conv, turn: null };
  }

  const t0 = Date.now();
  // Phone callers are unidentified, so the clearly-labelled demo dataset is searched by order id.
  const orders = conv.source === "phone" ? s.orders : s.orders.filter((o) => o.customerId === conv.customerId);
  const customer = s.customers.find((c) => c.id === conv.customerId) ?? s.customers[0];
  const turn = await SupportAgentService.reply(conv, s.settings, customer, orders);
  const c = conv;
  mutate((st) => {
    c.messages.push({ id: `a${c.messages.length}`, role: "agent", text: turn.reply, at: new Date().toISOString(), meta: { intent: turn.intent, kb: turn.kb, action: turn.action } });
    if (turn.intent !== "unknown") { c.intent = turn.intent; c.topic = CA.topicFor(turn.intent); }
    c.sentiment = turn.sentiment === "negative" || c.sentiment !== "negative" ? turn.sentiment : c.sentiment;
    c.effort = Math.min(5, Math.max(c.effort, turn.sentiment === "negative" ? 4 : Math.ceil(c.messages.length / 4)));
    c.summary = turn.summary;
    c.nextAction = turn.nextAction;
    c.attempted = turn.attempted;
    if (!c.firstResponseSec) c.firstResponseSec = Math.max(1, Math.round((Date.now() - t0) / 1000));
    if (turn.escalate) {
      c.status = "escalated";
      c.priority = turn.priority;
      logActivity(st, { kind: "escalation", text: `${c.channel === "voice" ? "Call" : "Conversation"} escalated by AI agent: ${c.intent.replace(/_/g, " ")}`, href: `/dashboard/conversations?id=${c.id}` });
    } else {
      c.status = /anything else|resolved|great day/i.test(turn.reply) ? "ai_resolved" : "open";
      c.priority = turn.priority;
    }
  });
  return { conversation: conv, turn };
}

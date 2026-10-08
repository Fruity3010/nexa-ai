import "server-only";
import { z } from "zod";
import { llmJSON } from "./llm";
import { ConversationAnalysisService as CA, HUMAN_RX } from "./analysis";
import type { Conversation, Customer, DemoOrder, Priority, Sentiment, Settings } from "../types";

export interface AgentTurn {
  reply: string;
  intent: string;
  sentiment: Sentiment;
  escalate: boolean;
  priority: Priority;
  action?: string; // demo action label shown in the UI, e.g. "Order lookup (demo record)"
  kb?: string;
  summary: string;
  nextAction: string;
  attempted: string[];
  engine: "llm" | "demo";
}

const LLMTurn = z.object({
  reply: z.string(),
  intent: z.string(),
  sentiment: z.enum(["positive", "neutral", "negative"]),
  escalate: z.boolean(),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  kbArticleId: z.string().nullable(),
  summary: z.string(),
  nextAction: z.string(),
  attempted: z.array(z.string()),
});

const fmt = (n: number) => `₦${n.toLocaleString("en-NG")}`;
const ORDER_RX = /NM-?\s?(\d{5})/i;
const PAY_RX = /PSK-?\s?(\d{5})/i;
const YES_RX = /^\s*(yes|yeah|yep|ok|okay|please|sure|abeg|connect)/i;

export const SupportAgentService = {
  async reply(conv: Conversation, settings: Settings, customer: Customer, orders: DemoOrder[]): Promise<AgentTurn> {
    const live = await llmReply(conv, settings, customer, orders);
    return live ?? demoReply(conv, settings, orders);
  },
};

async function llmReply(conv: Conversation, settings: Settings, customer: Customer, orders: DemoOrder[]): Promise<AgentTurn | null> {
  const a = settings.agent;
  // Data minimisation: only this customer's demo orders, no contact details.
  const system = `You are ${a.name}, the customer support agent for ${settings.org.name} (${settings.org.industry}).
Personality: ${a.personality}
Supported languages: ${a.languages.join(", ")}. Reply in the customer's language when supported.
Business hours for human agents: ${a.businessHours}

POLICIES (authoritative; never invent policy beyond these or the knowledge base):
${a.policies}

KNOWLEDGE BASE:
${settings.kb.map((k) => `[${k.id}] ${k.title}: ${k.body}`).join("\n")}

INTENTS (canResolve=false means gather details then escalate):
${a.intents.map((i) => `${i.id} (${i.label}) canResolve=${i.canResolve}`).join("\n")}

ESCALATE when: ${a.escalationRules.join("; ")}.

DEMO ORDER RECORDS for this customer (${customer.segment}, ${customer.city}). These are demo records; you may quote them:
${orders.map((o) => `${o.id}: ${o.item}, ${fmt(o.amount)}, status=${o.status}, eta=${o.eta}, carrier=${o.carrier}, paymentRef=${o.paymentRef}, debits=${o.charges}`).join("\n") || "none"}

Rules: Ask a clarifying question if you need an order number or payment reference. If the answer is not in the policies or knowledge base, say you are not certain and offer a human. Never ask for passwords, PINs, OTPs or card numbers. Keep replies under 80 words. "summary" is a handoff summary for a human agent; "attempted" lists troubleshooting steps done so far in the whole conversation.`;
  const messages = conv.messages
    .filter((m) => m.role === "customer" || m.role === "agent")
    .map((m) => ({ role: m.role === "customer" ? ("user" as const) : ("assistant" as const), content: m.text }));
  while (messages.length && messages[0].role !== "user") messages.shift();
  const out = await llmJSON(LLMTurn, system, messages);
  if (!out) return null;
  return { ...out, kb: out.kbArticleId ?? undefined, engine: "llm", action: undefined };
}

/** Deterministic intent engine used when no LLM is configured. */
function demoReply(conv: Conversation, settings: Settings, orders: DemoOrder[]): AgentTurn {
  const customerMsgs = conv.messages.filter((m) => m.role === "customer");
  const text = customerMsgs.at(-1)?.text ?? "";
  const allText = customerMsgs.map((m) => m.text).join(" \n ");
  const lastAgent = [...conv.messages].reverse().find((m) => m.role === "agent");
  const sentiment = CA.detectSentiment(text);
  const negativeTurns = customerMsgs.filter((m) => CA.detectSentiment(m.text) === "negative").length;
  const detected = CA.detectIntent(text, settings);
  const known = conv.intent !== "unknown" && conv.intent !== "human_request";
  // A bare order number / payment ref continues the current intent instead of switching to order status.
  const idOnly = (ORDER_RX.test(text) || PAY_RX.test(text)) && detected === "order_status";
  const intent = known && (!detected || idOnly) ? conv.intent : detected ?? "unknown";
  const attempted = new Set(conv.attempted);
  const policy = (id: string) => settings.agent.intents.find((i) => i.id === id);
  const base = { intent, sentiment, engine: "demo" as const, priority: (sentiment === "negative" ? "medium" : "low") as Priority };
  const done = (reply: string, extra: Partial<AgentTurn> & { summary: string; nextAction: string }): AgentTurn =>
    ({ ...base, reply, escalate: false, attempted: [...attempted], ...extra });
  const escalateTurn = (reply: string, summary: string, nextAction: string, priority: Priority = "high", action?: string): AgentTurn =>
    ({ ...base, reply, escalate: true, priority, summary, nextAction, action, attempted: [...attempted, "Escalated to human agent with full context"] });

  // 1. Explicit human request, or sustained frustration.
  if (intent === "human_request" || HUMAN_RX.test(text) && sentiment === "negative" || negativeTurns >= 3 ||
      (lastAgent?.meta?.action === "offer_handoff" && YES_RX.test(text))) {
    const prev = conv.intent !== "unknown" && conv.intent !== "human_request" ? conv.intent.replace(/_/g, " ") : "their issue";
    return escalateTurn(
      `I'm sorry you've had to deal with this. I'm connecting you to a ${settings.terms.customer} support specialist now and sharing our full conversation, so you won't need to repeat yourself.`,
      `Customer requested a human regarding ${prev}. Sentiment: ${sentiment}. ${customerMsgs.length} customer messages so far.`,
      "Review the conversation history, acknowledge the frustration, and resolve the original issue directly.",
      negativeTurns >= 2 ? "urgent" : "high",
    );
  }

  // Checked before intent handlers so "thanks, that's all" closes instead of repeating the last answer.
  if (!detected && /^\W*(ok(ay)?|thanks|thank you|that'?s all|no,? (that'?s all|thanks)|bye|great)\b/i.test(text))
    return done(`You're welcome! Thanks for contacting ${settings.org.name}. Have a great day.`, { summary: conv.summary || "Customer closed the conversation.", nextAction: conv.nextAction || "None. Resolved by AI.", intent: conv.intent !== "unknown" ? conv.intent : "closing" });

  if (settings.org.industry === "ecommerce") {
    const orderId = allText.match(ORDER_RX) ? `NM-${allText.match(ORDER_RX)![1]}` : null;
    const payRef = allText.match(PAY_RX) ? `PSK-${allText.match(PAY_RX)![1]}` : null;
    const order = orders.find((o) => o.id === orderId) ?? orders.find((o) => o.paymentRef === payRef);
    const askOrder = (why: string) => done(
      `${why} Could you share your order number? It starts with NM- (demo orders: NM-10421, NM-10457, NM-10476, NM-10388).`,
      { summary: `Customer asked about ${intent.replace(/_/g, " ")}; waiting for order number.`, nextAction: "Collect order number.", action: "await_order" });

    switch (intent) {
      case "order_status": {
        if (!orderId) return askOrder("I can check that for you.");
        if (!order) return done(`I couldn't find ${orderId} in our order records. Could you double-check the number?`, { summary: `Order ${orderId} not found.`, nextAction: "Verify order number." });
        attempted.add(`Order lookup: ${order.id}`);
        if (order.status === "Payment received, order not created")
          return escalateTurn(`I can see payment ${order.paymentRef} for ${fmt(order.amount)}, but the order wasn't created. Our Payments team needs to fix this, and I've passed them everything.`, `Payment ${order.paymentRef} (${fmt(order.amount)}) succeeded but no order was created.`, "Reconcile payment and create the order or refund.", "high", "Order lookup (demo record)");
        const line = order.status === "Delivered" ? `was delivered (${order.eta}).` : `is ${order.status.toLowerCase()} with ${order.carrier}, expected ${order.eta}.`;
        return done(`Your order ${order.id} (${order.item}) ${line} Is there anything else I can help with?`,
          { summary: `Order status lookup for ${order.id}: ${order.status}.`, nextAction: "None. Resolved by AI.", action: "Order lookup (demo record)", kb: "kb-orders" });
      }
      case "delivery_delay": {
        if (!orderId) return askOrder("I'm sorry it hasn't arrived yet. Let me check what's happening.");
        if (!order) return done(`I couldn't find ${orderId} in our order records. Could you double-check the number?`, { summary: `Late delivery claim; ${orderId} not found.`, nextAction: "Verify order number." });
        attempted.add(`Order lookup: ${order.id}`);
        if (order.status === "Delivered")
          return escalateTurn(`Our records show ${order.id} as delivered (${order.eta}), but you haven't received it. I've passed this to our Logistics team to investigate, and they'll contact you within 1 business day.`,
            `${order.id} marked delivered but customer reports not received.`, "Logistics to investigate proof of delivery; replace or refund.", "high", "Order lookup (demo record)");
        return done(`${order.id} (${order.item}) is ${order.status.toLowerCase()} with ${order.carrier}, expected ${order.eta}. If it's more than 2 business days late, our Logistics team investigates, and paid delivery fees are refunded when we miss the promised date. Would you like me to flag it to them now?`,
          { summary: `Late delivery enquiry for ${order.id}: ${order.status}, ETA ${order.eta}.`, nextAction: "Flag to Logistics if the customer confirms it is late.", action: "offer_handoff", kb: "kb-late" });
      }
      case "double_charge": {
        if (!orderId && !payRef) return askOrder("I'm sorry about that. Let me check the payment records.");
        if (!order) return done(`I couldn't find that in our order records. Could you double-check the order number?`, { summary: "Duplicate charge claim; order not found.", nextAction: "Verify order number." });
        attempted.add(`Payment lookup: ${order.paymentRef}`);
        if (order.charges > 1)
          return escalateTurn(`I can see ${order.charges} debits of ${fmt(order.amount)} for ${order.id}. Duplicate charges must be confirmed by our Payments team before a reversal, so I've escalated this with all the details. Confirmed reversals reach your bank in 3–5 business days.`,
            `Duplicate debit: ${order.charges} × ${fmt(order.amount)} on ${order.id} (${order.paymentRef}).`, "Payments to confirm duplicate and reverse one debit; send the customer a reversal reference.", "urgent", "Payment lookup (demo record)");
        return done(`I see only one successful debit of ${fmt(order.amount)} for ${order.id}. Banks sometimes show a temporary authorisation that drops off within 24 hours. If it's still there tomorrow, reply here and I'll escalate it.`,
          { summary: `Duplicate charge claim on ${order.id}; only one debit on record.`, nextAction: "Follow up if the second debit persists after 24h.", action: "Payment lookup (demo record)", kb: "kb-payments" });
      }
      case "payment_missing_order": {
        if (!orderId && !payRef) return done("I'm sorry about that. Could you share the payment reference (it starts with PSK-) or the time you paid? Demo reference: PSK-88231.",
          { summary: "Payment without order; waiting for payment reference.", nextAction: "Collect payment reference.", action: "await_payref", kb: "kb-payments" });
        if (!order) return done("I couldn't find that payment in our order records. Payments are reconciled automatically within 24 hours. If it's still missing after that, I'll escalate it.",
          { summary: "Payment reference not found.", nextAction: "Re-check after 24h.", kb: "kb-payments" });
        attempted.add(`Payment lookup: ${order.paymentRef}`);
        return escalateTurn(`I found payment ${order.paymentRef} for ${fmt(order.amount)} (${order.item}). It's marked successful but isn't linked to an order. Our Payments team will create the order or refund you within 4 business hours. I've shared all the details.`,
          `Payment ${order.paymentRef} (${fmt(order.amount)}) successful but no order created for ${order.item}.`, "Reconcile payment and create the order; confirm with the customer.", "high", "Payment lookup (demo record)");
      }
      case "returns": {
        const kb = settings.kb.find((k) => k.id === "kb-returns");
        if (!orderId) return done(`${kb?.body ?? "Returns are accepted within 7 days."} If you share your order number, I can start the return for you.`,
          { summary: "Returns policy shared.", nextAction: "Start return if the customer provides an order.", kb: "kb-returns", action: "await_order" });
        if (!order) return done(`I couldn't find ${orderId} in our order records.`, { summary: "Return requested; order not found.", nextAction: "Verify order." });
        attempted.add(`Return eligibility check: ${order.id}`);
        if (order.status !== "Delivered") return done(`${order.id} hasn't been delivered yet (${order.status.toLowerCase()}), so it can't be returned yet. You can refuse delivery or start a return within 7 days of delivery.`,
          { summary: `Return requested for undelivered ${order.id}.`, nextAction: "None.", kb: "kb-returns" });
        return done(`Done. I've started a return for ${order.item} (${order.id}). Return reference RT-${order.id.slice(3)} (demo). A pickup will be scheduled within 2 business days, and your refund is issued after inspection.`,
          { summary: `Return started for ${order.id}.`, nextAction: "Pickup scheduled; refund after inspection.", action: "Return created (demo action)", kb: "kb-returns" });
      }
    }
  }

  // Generic: knowledge-base grounded answer, else admit uncertainty.
  const article = CA.searchKB(text, settings);
  if (article) {
    attempted.add(`KB answer: ${article.title}`);
    return done(`${article.body} Is there anything else I can help with?`, { summary: `Answered from knowledge base: ${article.title}.`, nextAction: "None. Resolved by AI.", kb: article.id });
  }
  if (policy(intent)?.canResolve === false)
    return escalateTurn("Thanks for explaining. This needs a specialist, so I'm passing your conversation to a member of our team with all the details.", `Customer issue (${intent.replace(/_/g, " ")}) requires a human per policy.`, "Review and resolve.");
  return done("I'm not certain about that, and I don't want to guess. Would you like me to connect you with a member of our team?",
    { summary: "Question not covered by the knowledge base.", nextAction: "Offer human handoff.", action: "offer_handoff" });
}

// ConversationAnalysisService + InsightGenerationService: rule-based signal extraction and
// live evidence scoring over the shared dataset. Deterministic so the demo story is stable.
import type { Insight, Sentiment, Settings, Store, Topic } from "../types";

const NEG = ["ridiculous", "useless", "angry", "terrible", "worst", "scam", "frustrat", "annoy", "three times", "again and again", "nonsense", "too long", "hidden", "trick", "disappoint", "still no", "charged twice", "!!", "rubbish", "fed up"];
const POS = ["thank", "great", "perfect", "awesome", "love", "worked", "helpful", "fast", "easy"];

export const HUMAN_RX = /\b(human|real person|someone|agent|manager|supervisor|speak to|talk to)\b/i;

function detectSentiment(text: string): Sentiment {
  const t = text.toLowerCase();
  const neg = NEG.filter((w) => t.includes(w)).length + (/[A-Z]{5,}/.test(text) ? 1 : 0);
  const pos = POS.filter((w) => t.includes(w)).length;
  return neg > pos ? "negative" : pos > neg ? "positive" : "neutral";
}

const ECOM_INTENTS: [string, RegExp][] = [
  ["human_request", /\b(human|real person|manager|supervisor|speak to (someone|a person|an agent)|talk to (someone|a person|an agent))\b/i],
  ["double_charge", /(charged|debited|deducted|billed).{0,20}(twice|two times|2 times|double)|double (charge|debit)|duplicate/i],
  ["payment_missing_order", /(paid|payment|transfer|debited).{0,60}(no order|missing|not (see|showing|there)|can'?t (see|find))|order.{0,20}missing/i],
  ["returns", /\b(return|send (it )?back|exchange|wrong (item|size))\b/i],
  ["refund_status", /\brefund/i],
  ["delivery_fee", /(delivery|shipping) (fee|cost|charge)|total.{0,30}(higher|more|increase)|why.{0,20}(expensive|extra)/i],
  ["delivery_delay", /(has ?n[o']t|still( not| has ?n[o']t)?|never|not yet) (arrived|come|been delivered|received)|\b(late|delayed) (order|delivery|parcel)|\bdelivery (is )?(late|delayed)/i],
  ["account_access", /\b(otp|log ?in|password|sign in|locked out|account)\b/i],
  ["order_status", /\b(where('?s| is| (it|my order|my package) is)|track|status|arrive|deliver(y|ed)?|when will|NM-?\d{5})\b/i],
];

const INTENT_TOPIC: Record<string, Topic> = {
  double_charge: "payment_failure", payment_missing_order: "payment_failure", payment_failed: "payment_failure",
  returns: "refund_delays", refund_status: "refund_delays", delivery_fee: "delivery_fee_surprise",
  account_access: "account_access", order_status: "delivery_date_unclear", delivery_delay: "delivery_date_unclear", express_checkout: "express_checkout_adoption",
};

function detectIntent(text: string, settings: Settings): string | null {
  if (settings.org.industry === "ecommerce") {
    for (const [intent, rx] of ECOM_INTENTS) if (rx.test(text)) return intent;
    return null;
  }
  if (HUMAN_RX.test(text)) return "human_request";
  const t = text.toLowerCase();
  const hit = settings.agent.intents.find((i) => i.label.toLowerCase().split(/\W+/).some((w) => w.length > 3 && t.includes(w)));
  return hit?.id ?? null;
}

/** Token-overlap search over the configured knowledge base. */
function searchKB(text: string, settings: Settings) {
  const t = text.toLowerCase();
  let best: { article: Settings["kb"][number]; score: number } | null = null;
  for (const a of settings.kb) {
    const score = a.tags.filter((tag) => t.includes(tag)).length * 2 +
      a.title.toLowerCase().split(/\W+/).filter((w) => w.length > 3 && t.includes(w)).length;
    if (score > (best?.score ?? 0)) best = { article: a, score };
  }
  return best && best.score >= 2 ? best.article : null;
}

export const ConversationAnalysisService = {
  detectSentiment,
  detectIntent,
  searchKB,
  topicFor: (intent: string): Topic => INTENT_TOPIC[intent] ?? "general",
};

// ---------------------------------------------------------------- research themes

export const THEMES: Record<string, { label: string; keywords: string[]; tone: Sentiment; experiment: string; topic?: Topic }> = {
  awareness: { label: "Didn't notice the feature", keywords: ["didn't know", "didnt know", "didn't see", "didn't notice", "never noticed", "never seen", "where is", "hidden", "scroll", "didn't even"], tone: "neutral", experiment: "Move the express checkout button above the fold on mobile and add a one-time explainer.", topic: "express_checkout_adoption" },
  trust_security: { label: "Trust in saving card details", keywords: ["fraud", "trust", "safe", "secure", "saving my card", "save my card", "scam", "trick", "money taken", "cautious"], tone: "negative", experiment: "Add tokenisation reassurance copy ('Your bank handles your card') and allow express checkout without saving a card.", topic: "express_checkout_adoption" },
  total_cost_visibility: { label: "Total cost shown too late", keywords: ["delivery fee", "delivery cost", "shipping", "the total", "final total", "total including", "jumped", "extra", "full cost", "fee"], tone: "negative", experiment: "Show the delivery fee on product pages, in the cart, and on the express checkout button.", topic: "delivery_fee_surprise" },
  payment_reliability: { label: "Payment failures erode confidence", keywords: ["otp", "failed", "spinning", "declined", "charged", "not sure if", "wasn't sure", "timeout", "error"], tone: "negative", experiment: "Show a 'waiting for your bank' state and a payment reference with clear next steps after failures.", topic: "payment_failure" },
  pay_on_delivery: { label: "Preference for pay on delivery / transfer", keywords: ["pay on delivery", "cash", "transfer", "only pay when"], tone: "neutral", experiment: "Offer bank transfer and pay-on-delivery inside express checkout where eligible." },
  delivery_expectations: { label: "Unclear delivery dates", keywords: ["delivery date", "by friday", "when it", "arrive", "needed the item"], tone: "neutral", experiment: "Show 'Arrives by <date>' before payment.", topic: "delivery_date_unclear" },
  speed_convenience: { label: "Speed and convenience (positive)", keywords: ["fast", "quick", "two taps", "easy", "convenient", "all the time"], tone: "positive", experiment: "Promote reorder-in-two-taps to repeat buyers." },
  feature_request: { label: "Feature requests", keywords: ["should", "wish", "would be nice", "allow", "make the button", "show the", "if it said", "add "], tone: "neutral", experiment: "Review requests in the next product planning cycle." },
};

export function tagThemes(text: string): string[] {
  const t = text.toLowerCase();
  return Object.entries(THEMES).filter(([, th]) => th.keywords.some((k) => t.includes(k))).map(([id]) => id);
}

// ---------------------------------------------------------------- insights

const DAY = 86_400_000;
const uniqBy = <T,>(xs: T[], key: (x: T) => string) => [...new Map(xs.map((x) => [key(x), x] as const).reverse()).values()].reverse();

export const InsightGenerationService = {
  /** Live evidence, trend and confidence for an insight, computed from every source in the store. */
  evaluate(s: Store, ins: Insight, funnel?: { step: string; dropPct: number }[]) {
    const now = Date.now();
    const convs = s.conversations.filter((c) => c.topic === ins.topic);
    const fb = s.feedback.filter((f) => f.topic === ins.topic);
    const themeIds = Object.entries(THEMES).filter(([, t]) => t.topic === ins.topic).map(([id]) => id);
    const interviews = s.campaigns.flatMap((c) =>
      c.interviews.filter((i) => i.consent && i.themes.some((t) => themeIds.includes(t))).map((i) => ({ campaignId: c.id, interviewId: i.id, participant: i.participant })));
    const web = s.events.filter((e) => ins.webEventNames.includes(e.name) &&
      (e.name !== "rage_click" || e.path.startsWith(ins.funnelStep === "delivery_fee_viewed" ? "/checkout/delivery" : "/checkout/payment")) &&
      (e.name !== "feature_used" || e.props?.feature === "express_checkout"));
    const inWindow = (at: string, from: number, to: number) => { const t = Date.parse(at); return t >= now - from * DAY && t < now - to * DAY; };
    const recent = convs.filter((c) => inWindow(c.startedAt, 14, 0)).length + fb.filter((f) => inWindow(f.at, 14, 0)).length;
    const prior = convs.filter((c) => inWindow(c.startedAt, 28, 14)).length + fb.filter((f) => inWindow(f.at, 28, 14)).length;
    const trendPct = prior ? Math.round(((recent - prior) / prior) * 100) : recent ? 100 : 0;
    const sources = [convs.length, fb.length, interviews.length, web.length].filter((x) => x > 0).length;
    const volume = convs.length + fb.length + interviews.length;
    const score = Math.min(95, 25 + sources * 14 + Math.min(20, volume / 5));
    const step = funnel?.find((f) => f.step === ins.funnelStep);
    return {
      counts: { conversations: convs.length, calls: convs.filter((c) => c.channel === "voice").length, feedback: fb.length, interviews: interviews.length, webEvents: web.length },
      negativeShare: convs.length ? Math.round((convs.filter((c) => c.sentiment === "negative").length / convs.length) * 100) : 0,
      escalationRate: convs.length ? Math.round((convs.filter((c) => c.status === "escalated" || c.status === "human_resolved").length / convs.length) * 100) : 0,
      funnelDropPct: step?.dropPct,
      trendPct,
      emerging: trendPct >= 30 && recent >= 12,
      confidence: { score: Math.round(score), label: score >= 75 ? "High" : score >= 55 ? "Medium" : "Low", sources },
      sampleConversations: uniqBy(convs, (c) => c.messages.find((m) => m.role === "customer")?.text ?? c.id).slice(0, 6).map((c) => ({ id: c.id, intent: c.intent, channel: c.channel, at: c.startedAt, text: c.messages.find((m) => m.role === "customer")?.text ?? "" })),
      sampleFeedback: uniqBy(fb, (f) => f.text).slice(0, 4).map((f) => ({ id: f.id, text: f.text, rating: f.rating, kind: f.kind })),
      interviews: interviews.slice(0, 6),
    };
  },
};

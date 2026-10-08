// Deterministic synthetic dataset for the NovaMart demo. All people, orders and events are fictional.
import { getPreset } from "./presets";
import type {
  Activity, Campaign, Channel, Conversation, ConvStatus, Customer, DemoOrder, Feedback, Insight,
  Interview, Recommendation, Sentiment, Settings, Store, Topic, WebEvent,
} from "./types";

export const STORE_VERSION = 4;
export const AGENTS = ["Adaeze Okafor", "Tunde Bakare", "Chiamaka Eze", "Ibrahim Musa"];

function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRST = ["Chidi", "Aisha", "Tunde", "Ngozi", "Emeka", "Funke", "Bola", "Yusuf", "Amaka", "Segun", "Halima", "Ifeanyi", "Zainab", "Kunle", "Blessing", "Musa", "Tobi", "Chioma", "Femi", "Hauwa", "Uche", "Bisi", "Danjuma", "Ronke", "Obinna", "Fatima", "Dayo", "Nkechi", "Sani", "Yemi"];
const LAST = ["Okeke", "Bello", "Adeyemi", "Nwosu", "Ibrahim", "Okafor", "Balogun", "Abubakar", "Eze", "Ogunleye", "Lawal", "Obi", "Danladi", "Adebayo", "Umeh"];
const CITIES = ["Lagos", "Abuja", "Port Harcourt", "Ibadan", "Kano", "Enugu", "Benin City", "Kaduna"];
const SEGMENTS: Customer["segment"][] = ["First-time buyer", "Repeat buyer", "Repeat buyer", "High-value", "Business buyer", "First-time buyer"];

type Tpl = { intent: string; msgs: string[]; summary: string; next: string; attempted: string[] };

const TEMPLATES: Record<Topic, Tpl[]> = {
  delivery_fee_surprise: [
    { intent: "delivery_fee", msgs: ["Why is my total higher than the price on the product page?", "The difference is the delivery fee for your state, which is calculated once your address is entered. For Ibadan it's ₦3,800 for this parcel size.", "That should have been shown earlier. I nearly didn't buy.", "That's fair feedback and I've recorded it. Orders above ₦50,000 in Lagos ship free, but outside Lagos the fee applies."], summary: "Customer surprised by delivery fee at the final checkout step.", next: "No action needed; feedback tagged for checkout pricing review.", attempted: ["Explained delivery fee calculation"] },
    { intent: "delivery_fee", msgs: ["₦4,500 delivery for a phone case? Is this correct?", "Delivery fees depend on your state and parcel size. For Kano, small parcels are ₦4,500 this week.", "I'll just leave it then. You should show this before checkout.", "Understood. I've shared your feedback with the team."], summary: "Customer abandoned purchase after seeing ₦4,500 delivery fee for a small item.", next: "Consider showing delivery estimate on product page.", attempted: ["Confirmed fee is correct"] },
    { intent: "delivery_fee", msgs: ["The cart said ₦18,000 and now checkout says ₦21,500. What happened?", "The extra ₦3,500 is the delivery fee for Port Harcourt, added after the address step."], summary: "Customer questioned total increase at checkout caused by delivery fee.", next: "None; explained fee.", attempted: ["Explained delivery fee"] },
  ],
  payment_failure: [
    { intent: "double_charge", msgs: ["I was charged twice for my order.", "I'm sorry about that. I can see two debits of the same amount. Duplicate charges need the Payments team to confirm before reversal, so I'm escalating this with full details.", "How long will that take?", "The Payments team responds within 4 business hours, and confirmed reversals reach your bank in 3–5 business days."], summary: "Customer reports duplicate debit. Two debits found on demo payment record.", next: "Payments team to confirm duplicate and initiate reversal.", attempted: ["Located order", "Confirmed two debits on record"] },
    { intent: "payment_missing_order", msgs: ["My bank says the payment went through but I don't see any order.", "Thanks. Payments are usually reconciled automatically within 24 hours. I can see a successful payment but no order linked, so I'm escalating to Payments to create or refund it.", "Ok please hurry, I need the item this week."], summary: "Payment successful but no order created. Escalated for reconciliation.", next: "Payments to reconcile payment reference and create order or refund.", attempted: ["Checked order list", "Checked payment status"] },
    { intent: "payment_failed", msgs: ["Payment keeps failing at the last step. The page just spins.", "Sorry about that. Card payments can time out when the bank OTP takes too long. You can retry, or use bank transfer or USSD.", "Bank transfer worked, thanks."], summary: "Card payment timed out at payment step; customer completed via transfer.", next: "Monitor payment widget timeout errors.", attempted: ["Suggested alternative payment method"] },
  ],
  delivery_date_unclear: [
    { intent: "order_status", msgs: ["Where is my order?", "I can help with that. Could you share your order number? It starts with NM-.", "NM-10421", "Order NM-10421 shipped yesterday with GIG Logistics and is expected on Thursday."], summary: "Order status lookup, shipped and on schedule.", next: "None.", attempted: ["Order status lookup"] },
    { intent: "order_status", msgs: ["When will my order arrive? The product page didn't say.", "Delivery to Enugu takes 3–5 business days after dispatch. Your order was dispatched today.", "I thought it would come tomorrow."], summary: "Customer expected faster delivery; product page lacked a delivery date.", next: "Show estimated delivery date on product pages.", attempted: ["Explained delivery window"] },
  ],
  refund_delays: [
    { intent: "refund_status", msgs: ["I returned my item 10 days ago and still no refund.", "I'm sorry for the wait. Your return was inspected yesterday and the refund was approved. It should arrive in 3–5 business days.", "That's too long."], summary: "Refund approved after delayed inspection; customer unhappy with timeline.", next: "Review return inspection SLA.", attempted: ["Checked return status"] },
    { intent: "returns", msgs: ["How do I return an item?", "Unused items with tags can be returned within 7 days of delivery. Go to Account → My Orders → Return item and we'll schedule a pickup within 2 business days.", "Great, thanks!"], summary: "Returns policy explained.", next: "None.", attempted: ["Shared returns policy"] },
  ],
  account_access: [
    { intent: "account_access", msgs: ["I'm not getting the OTP to log in.", "OTP codes expire after 5 minutes. You can request the code by email instead from the sign-in page.", "Email code worked."], summary: "OTP SMS not delivered; resolved via email code.", next: "None.", attempted: ["Suggested email OTP"] },
  ],
  express_checkout_adoption: [
    { intent: "express_checkout", msgs: ["Is it safe to save my card for express checkout?", "Yes. Card details are tokenised by our payment provider and NovaMart never stores full card numbers. You can remove a saved card at any time.", "Ok, I'll think about it."], summary: "Customer hesitant about saving card for express checkout.", next: "Add reassurance copy to express checkout.", attempted: ["Explained card tokenisation"] },
  ],
  general: [
    { intent: "product_question", msgs: ["Does the Tecno Camon 30 come with a charger?", "Yes, it comes with a 70W charger and a USB-C cable.", "Thanks!"], summary: "Product question answered.", next: "None.", attempted: ["KB answer"] },
  ],
};

const FEEDBACK_TEXT: Record<Topic, { text: string; rating: number }[]> = {
  delivery_fee_surprise: [
    { text: "Delivery fee only showed at the very end. Felt like a hidden charge.", rating: 2 },
    { text: "Good prices but shipping to Kano doubled my total.", rating: 2 },
    { text: "Please show delivery cost on the product page.", rating: 3 },
    { text: "I abandoned my cart when I saw the delivery fee.", rating: 1 },
  ],
  payment_failure: [
    { text: "Charged twice and had to wait a week for reversal.", rating: 1 },
    { text: "Payment page froze while waiting for my bank OTP.", rating: 2 },
  ],
  delivery_date_unclear: [
    { text: "No delivery date shown before I paid.", rating: 3 },
    { text: "Arrived on time, tracking was clear.", rating: 5 },
  ],
  refund_delays: [{ text: "Refund took almost two weeks.", rating: 2 }, { text: "Return pickup was quick and easy.", rating: 5 }],
  account_access: [{ text: "OTP never arrives on my MTN line.", rating: 2 }],
  express_checkout_adoption: [{ text: "Didn't know express checkout existed until a friend told me.", rating: 4 }],
  general: [
    { text: "Great selection and fast delivery in Lagos.", rating: 5 },
    { text: "Customer support was very helpful.", rating: 5 },
    { text: "Good app, easy to use.", rating: 4 },
  ],
};

const iso = (t: number) => new Date(t).toISOString();
const DAY = 86_400_000;

export function defaultSettings(): Settings {
  const p = getPreset("ecommerce");
  return {
    org: { name: "NovaMart", industry: "ecommerce" },
    terms: p.terms,
    agent: structuredClone(p.agent),
    kb: structuredClone(p.kb),
    scenarios: [...p.scenarios],
    guardrails: { neverInventPolicy: true, redactPII: true, maxAutoRefundNGN: 0 },
    retentionDays: { conversations: 365, webEvents: 90, research: 180 },
    privacy: { requireConsent: true, respectDoNotTrack: true, anonymizeIP: true },
    roles: [
      { name: "Demo Admin", email: "admin@novamart.example", role: "Admin" },
      { name: "Adaeze Okafor", email: "adaeze@novamart.example", role: "Support Agent" },
      { name: "Tunde Bakare", email: "tunde@novamart.example", role: "Support Agent" },
      { name: "Kelechi Nnaji", email: "kelechi@novamart.example", role: "Analyst" },
    ],
    sdk: {
      projectName: "NovaMart Web",
      projectKey: "nx_demo_public_key",
      allowedDomains: ["localhost", "127.0.0.1", "*.novamart.example"],
      autoTrack: { pageViews: true, errors: true, rageClicks: true, forms: true },
    },
    demoIntegrations: [],
    voiceNumber: "",
    voice: { voiceName: "Kore", callbackMessage: "A member of our support team will call you back on this number within one business day." },
  };
}

export function buildSeed(now = Date.now()): Store {
  const r = rng(20261008);
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)];
  const chance = (p: number) => r() < p;
  let n = 0;
  const id = (p: string) => `${p}-${(++n).toString(36).padStart(4, "0")}`;

  // Customers
  const customers: Customer[] = Array.from({ length: 60 }, (_, i) => {
    const first = FIRST[i % FIRST.length], last = LAST[(i * 7) % LAST.length];
    return {
      id: `cus-${i + 1}`,
      name: `${first} ${last}`,
      email: `${first}.${last}${i}@example.com`.toLowerCase(),
      phone: `+234 80${(10000000 + i * 7919) % 100000000}`.slice(0, 15),
      city: CITIES[i % CITIES.length],
      segment: SEGMENTS[i % SEGMENTS.length],
      orders: 1 + ((i * 13) % 17),
    };
  });
  customers[0] = { ...customers[0], name: "Chidi Okeke", email: "chidi.okeke@example.com", city: "Lagos", segment: "Repeat buyer", orders: 14 };

  const orders: DemoOrder[] = [
    { id: "NM-10421", customerId: "cus-1", item: "Tecno Camon 30 (256GB)", amount: 289000, status: "Shipped", eta: "Thursday", carrier: "GIG Logistics", paymentRef: "PSK-77120", charges: 1 },
    { id: "NM-10457", customerId: "cus-1", item: "Oraimo FreePods 4", amount: 24500, status: "Out for delivery", eta: "today before 6pm", carrier: "NovaMart Express", paymentRef: "PSK-77191", charges: 1 },
    { id: "NM-10476", customerId: "cus-1", item: "Hisense 43\" Smart TV", amount: 312000, status: "Processing", eta: "in 2–3 business days", carrier: "GIG Logistics", paymentRef: "PSK-77302", charges: 2 },
    { id: "NM-10388", customerId: "cus-1", item: "Nike Revolution 7 (size 43)", amount: 58000, status: "Delivered", eta: "delivered last Monday", carrier: "NovaMart Express", paymentRef: "PSK-76455", charges: 1 },
    { id: "NM-10511", customerId: "cus-1", item: "Binatone Blender BLG-555", amount: 41000, status: "Payment received, order not created", eta: "—", carrier: "—", paymentRef: "PSK-88231", charges: 1 },
  ];

  // Topic mix drifts over time: delivery-fee complaints are the emerging issue.
  const topicWeights = (daysAgo: number): [Topic, number][] => {
    const recent = 1 - daysAgo / 90;
    return [
      ["delivery_fee_surprise", 0.06 + 0.5 * Math.max(0, 1 - daysAgo / 21) + 0.04 * recent],
      ["payment_failure", 0.17],
      ["delivery_date_unclear", 0.24],
      ["refund_delays", 0.12],
      ["account_access", 0.08],
      ["express_checkout_adoption", 0.04],
      ["general", 0.12],
    ];
  };
  const weighted = <T,>(w: [T, number][]) => {
    const total = w.reduce((s, [, x]) => s + x, 0);
    let x = r() * total;
    for (const [k, v] of w) if ((x -= v) <= 0) return k;
    return w[0][0];
  };

  const conversations: Conversation[] = [];
  for (let d = 89; d >= 0; d--) {
    const dayStart = now - d * DAY;
    const dow = new Date(dayStart).getDay();
    const volume = Math.round((3 + (90 - d) / 40 + (dow === 1 || dow === 5 ? 1.5 : 0)) * (0.7 + r() * 0.6));
    for (let k = 0; k < volume; k++) {
      const topic = weighted(topicWeights(d));
      const tpl = pick(TEMPLATES[topic]);
      const channel = weighted<Channel>([["chat", 0.45], ["whatsapp", 0.25], ["voice", 0.18], ["email", 0.12]]);
      const cust = pick(customers);
      const start = dayStart - Math.floor(r() * DAY * 0.9);
      const escalateP = topic === "payment_failure" ? 0.55 : topic === "refund_delays" ? 0.25 : 0.08;
      let status: ConvStatus = chance(escalateP) ? "escalated" : "ai_resolved";
      if (status === "escalated" && d > 2) status = "human_resolved";
      if (status === "ai_resolved" && d === 0 && chance(0.2)) status = "open";
      const negP = topic === "delivery_fee_surprise" || topic === "payment_failure" ? 0.7 : topic === "general" ? 0.05 : 0.35;
      const sentiment: Sentiment = chance(negP) ? "negative" : chance(0.6) ? "neutral" : "positive";
      const firstResponseSec = channel === "email" ? 60 + Math.floor(r() * 300) : 2 + Math.floor(r() * 6);
      conversations.push({
        id: id("conv"),
        channel, customerId: cust.id, intent: tpl.intent, topic, sentiment, status,
        priority: topic === "payment_failure" ? "high" : sentiment === "negative" ? "medium" : "low",
        assignee: status === "escalated" || status === "human_resolved" ? pick(AGENTS) : undefined,
        startedAt: iso(start),
        firstResponseSec,
        durationSec: channel === "voice" ? 90 + Math.floor(r() * 300) : undefined,
        csat: chance(0.55) ? (sentiment === "negative" ? 2 + Math.floor(r() * 2) : 4 + Math.floor(r() * 2)) : undefined,
        effort: sentiment === "negative" ? 4 + Math.floor(r() * 2) : 1 + Math.floor(r() * 2),
        messages: tpl.msgs.map((text, i) => ({
          id: `m${i}`, role: i % 2 === 0 ? "customer" : "agent", text, at: iso(start + i * 40_000),
          meta: i === 0 ? { intent: tpl.intent } : undefined,
        })),
        summary: tpl.summary, nextAction: tpl.next, attempted: tpl.attempted, notes: [],
        source: "seed",
      });
    }
  }

  // A few hand-written recent escalations with richer handoff context.
  const recent = (h: number) => iso(now - h * 3_600_000);
  const rich: Conversation[] = [
    {
      id: "conv-esc-1", channel: "voice", customerId: "cus-2", intent: "double_charge", topic: "payment_failure", sentiment: "negative",
      status: "escalated", priority: "urgent", assignee: "Tunde Bakare", startedAt: recent(1.5), firstResponseSec: 1, durationSec: 214, effort: 5,
      messages: [
        { id: "a", role: "agent", text: "Hi, I'm Ada from NovaMart. How can I help today?", at: recent(1.5) },
        { id: "b", role: "customer", text: "You people charged me twice for the TV I bought. ₦312,000 two times!", at: recent(1.49) },
        { id: "c", role: "agent", text: "I'm really sorry, that's stressful. Could you confirm the order number?", at: recent(1.48) },
        { id: "d", role: "customer", text: "NM-10476.", at: recent(1.47) },
        { id: "e", role: "agent", text: "Thank you. I can see two debits of ₦312,000 on 14:02 and 14:03. Duplicate charges must be confirmed by our Payments team, so I'm transferring you with all the details. You won't need to repeat anything.", at: recent(1.46) },
      ],
      summary: "Customer double-charged ₦312,000 for order NM-10476 (two debits one minute apart). Identity matched on phone number. Customer is upset and needs reversal confirmation.",
      nextAction: "Confirm duplicate with payment provider, initiate reversal of one debit, and give the customer a reversal reference.",
      attempted: ["Verified caller by registered phone number", "Located order NM-10476", "Confirmed two debits on demo payment record"],
      notes: [{ author: "Ada (AI)", text: "Policy prevents AI-initiated reversals. Escalated with high urgency.", at: recent(1.45) }],
      source: "seed",
    },
    {
      id: "conv-esc-2", channel: "whatsapp", customerId: "cus-5", intent: "payment_missing_order", topic: "payment_failure", sentiment: "negative",
      status: "escalated", priority: "high", startedAt: recent(3), firstResponseSec: 3, effort: 4,
      messages: [
        { id: "a", role: "customer", text: "I paid ₦41,000 for a blender by transfer, the money left my account but there's no order.", at: recent(3) },
        { id: "b", role: "agent", text: "Thanks for letting me know. Could you share the payment reference or the time of the transfer?", at: recent(2.99) },
        { id: "c", role: "customer", text: "PSK-88231 around 9am", at: recent(2.98) },
        { id: "d", role: "agent", text: "I found payment PSK-88231, marked successful, but it isn't linked to any order. That needs our Payments team. I've passed on everything, and they'll contact you within 4 business hours.", at: recent(2.97) },
      ],
      summary: "Transfer PSK-88231 (₦41,000) succeeded but no order was created. Customer wants the blender, not a refund.",
      nextAction: "Reconcile PSK-88231 and create the order for Binatone Blender BLG-555; confirm by WhatsApp.",
      attempted: ["Located payment reference", "Checked order list: no linked order"],
      notes: [], source: "seed",
    },
    {
      id: "conv-esc-3", channel: "chat", customerId: "cus-9", intent: "human_request", topic: "refund_delays", sentiment: "negative",
      status: "escalated", priority: "high", startedAt: recent(5), firstResponseSec: 2, effort: 5,
      messages: [
        { id: "a", role: "customer", text: "This is the third time I'm explaining this. My refund for the shoes is 12 days late. I want a human.", at: recent(5) },
        { id: "b", role: "agent", text: "I'm sorry you've had to repeat yourself. I'm connecting you to a support specialist now and sharing your full history so you won't need to explain again.", at: recent(4.99) },
      ],
      summary: "Refund for returned shoes is 12 days old; customer has contacted support 3 times and is frustrated.",
      nextAction: "Check return inspection status, expedite refund, and consider a goodwill voucher.",
      attempted: ["Detected repeated contact (3 prior conversations)", "Immediate handoff on explicit request"],
      notes: [], source: "seed",
    },
  ];
  conversations.push(...rich);
  conversations.sort((a, b) => b.startedAt.localeCompare(a.startedAt));

  // Feedback
  const feedback: Feedback[] = [];
  for (let i = 0; i < 140; i++) {
    const d = Math.floor(r() * 90);
    const topic = weighted(topicWeights(d));
    const f = pick(FEEDBACK_TEXT[topic]);
    feedback.push({
      id: id("fb"), kind: chance(0.6) ? "review" : "survey", customerId: pick(customers).id, rating: f.rating, text: f.text,
      at: iso(now - d * DAY - Math.floor(r() * DAY)), topic,
      sentiment: f.rating >= 4 ? "positive" : f.rating === 3 ? "neutral" : "negative",
    });
  }

  // Website events
  const events: WebEvent[] = [];
  for (let d = 89; d >= 0; d--) {
    const sessionsToday = 7 + Math.floor(r() * 5) + Math.floor((90 - d) / 30);
    const dropAfterFee = 0.28 + 0.24 * (1 - d / 90);
    for (let s = 0; s < sessionsToday; s++) {
      const sid = id("ses");
      let t = now - d * DAY - Math.floor(r() * DAY * 0.95);
      const device = chance(0.72) ? "mobile" : "desktop";
      const ev = (name: string, path: string, props?: WebEvent["props"]) => {
        t += 8_000 + Math.floor(r() * 60_000);
        if (t > now) t = now - 1000;
        events.push({ id: id("ev"), sessionId: sid, name, at: iso(t), path, props: { device, ...props }, origin: "seed" });
      };
      ev("page_view", pick(["/", "/category/phones", "/category/fashion", "/deals"]));
      if (!chance(0.85)) continue;
      ev("product_view", pick(["/product/tecno-camon-30", "/product/oraimo-freepods-4", "/product/nike-revolution-7", "/product/hisense-43-tv"]));
      if (!chance(0.62)) continue;
      ev("add_to_cart", "/cart");
      if (!chance(0.7)) continue;
      ev("checkout_started", "/checkout/address");
      ev("form_start", "/checkout/address", { form: "address-form" });
      if (chance(0.06)) { ev("form_abandon", "/checkout/address", { form: "address-form" }); continue; }
      ev("form_submit", "/checkout/address", { form: "address-form" });
      ev("delivery_fee_viewed", "/checkout/delivery", { fee_band: pick(["₦1,500–2,500", "₦2,500–4,000", "₦4,000+"]) });
      if (chance(dropAfterFee)) {
        if (chance(0.3)) ev("rage_click", "/checkout/delivery", { target: "#delivery-fee-info", clicks: 4 + Math.floor(r() * 4) });
        if (chance(0.25)) ev("page_view", "/cart");
        continue;
      }
      if (chance(0.05)) ev("feature_used", "/checkout/delivery", { feature: "express_checkout" });
      ev("payment_started", "/checkout/payment", { method: pick(["card", "card", "transfer", "ussd"]) });
      if (chance(0.07)) {
        ev("js_error", "/checkout/payment", { message: "PaymentWidget: OTP confirmation timeout", source: "/static/payment-widget.js" });
        if (chance(0.5)) continue;
      }
      if (chance(0.04)) ev("rage_click", "/checkout/payment", { target: "button.pay-now", clicks: 3 + Math.floor(r() * 3) });
      if (!chance(0.88)) continue;
      ev("purchase_completed", "/order/confirmed");
    }
  }
  events.sort((a, b) => a.at.localeCompare(b.at));

  const campaigns: Campaign[] = [seedCampaign(now)];

  const insights: Insight[] = [
    {
      id: "ins-delivery-fee", topic: "delivery_fee_surprise", category: "Checkout & pricing", severity: "critical",
      title: "Delivery fees revealed too late are driving checkout abandonment",
      summary: "Several customers are abandoning checkout after delivery fees appear. Support conversations and website events suggest that the total cost is being revealed too late.",
      observed: [
        "Drop-off between Delivery Fee Viewed and Payment Started is the largest step loss in the funnel and has grown over the period.",
        "Support conversations asking why the final amount is higher than the product price have increased week over week.",
        "Reviews and survey responses mention 'hidden' or unexpected delivery costs.",
        "Research participants said they want delivery costs shown before checkout.",
        "Rage clicks are concentrated on the delivery-fee info icon (#delivery-fee-info).",
      ],
      factors: [
        { text: "Delivery fee is only calculated after the address step, so the total changes late in the journey.", kind: "hypothesis" },
        { text: "Fees outside Lagos/Abuja are high relative to low-value items, making small orders feel poor value.", kind: "hypothesis" },
        { text: "The fee info tooltip does not respond on mobile (rage clicks), so customers cannot see how the fee is calculated.", kind: "hypothesis" },
      ],
      nextSteps: ["Show an estimated delivery fee on product and cart pages based on state.", "Fix the delivery-fee tooltip on mobile.", "A/B test a free-delivery threshold banner in the cart."],
      moreEvidence: ["Split funnel drop-off by delivery state and order value.", "Run a short research campaign with customers who abandoned after the fee step.", "Compare abandonment before/after any recent fee table change."],
      funnelStep: "delivery_fee_viewed", webEventNames: ["delivery_fee_viewed", "rage_click"], recommendationIds: ["rec-1"],
    },
    {
      id: "ins-payment", topic: "payment_failure", category: "Payments", severity: "high",
      title: "Payment failures and duplicate debits create high-effort escalations",
      summary: "Payment issues have the highest escalation rate. Customers report double debits, payments without orders and card OTP timeouts.",
      observed: ["Payment conversations escalate to humans far more often than other topics.", "JavaScript errors 'PaymentWidget: OTP confirmation timeout' occur on /checkout/payment.", "Customers report waiting days for reversals."],
      factors: [{ text: "Bank OTP latency exceeds the payment widget timeout.", kind: "hypothesis" }, { text: "Customers retry after a timeout, causing duplicate debits.", kind: "hypothesis" }],
      nextSteps: ["Extend the widget OTP timeout and show a 'waiting for your bank' state.", "Show customers a recovery message with the payment reference after a failure.", "Auto-detect duplicate debits within 5 minutes and flag them for Payments."],
      moreEvidence: ["Payment provider logs for timeout vs decline split.", "Bank-level breakdown of OTP delays."],
      funnelStep: "payment_started", webEventNames: ["js_error"], recommendationIds: ["rec-2"],
    },
    {
      id: "ins-delivery-date", topic: "delivery_date_unclear", category: "Delivery expectations", severity: "medium",
      title: "Customers can't see when orders will arrive before buying",
      summary: "'Where is my order?' is the most common intent, and many contacts start because no delivery date was shown at purchase.",
      observed: ["Order status is the most common support intent.", "Reviews mention that no delivery date was shown before payment."],
      factors: [{ text: "Product pages show a generic delivery window rather than a date for the customer's state.", kind: "hypothesis" }],
      nextSteps: ["Show 'Arrives by <date>' on product pages.", "Send proactive dispatch and delay notifications."],
      moreEvidence: ["Contact rate per order for customers outside Lagos vs inside."],
      webEventNames: [], recommendationIds: ["rec-3"],
    },
    {
      id: "ins-express", topic: "express_checkout_adoption", category: "Feature adoption", severity: "medium",
      title: "Express checkout adoption is low: awareness and trust gaps",
      summary: "Few checkout sessions use express checkout. Customers say they didn't notice it or are unsure about saving cards.",
      observed: ["express_checkout feature_used events appear in a small share of checkout sessions.", "Support questions ask whether saving cards is safe."],
      factors: [{ text: "The express option is below the fold on mobile.", kind: "hypothesis" }, { text: "Card-saving reassurance copy is missing.", kind: "hypothesis" }],
      nextSteps: ["Run a research campaign on express checkout.", "Add trust copy and move the button above the fold."],
      moreEvidence: ["Interview customers who saw but didn't use express checkout."],
      funnelStep: "checkout_started", webEventNames: ["feature_used"], recommendationIds: ["rec-4"],
    },
    {
      id: "ins-refunds", topic: "refund_delays", category: "Returns & refunds", severity: "medium",
      title: "Return inspections are delaying refunds",
      summary: "Customers contact support repeatedly about refunds that are waiting on return inspection.",
      observed: ["Refund conversations show repeat contacts and negative sentiment.", "Reviews mention two-week refund times."],
      factors: [{ text: "Inspection backlog at the returns hub.", kind: "hypothesis" }],
      nextSteps: ["Send automatic refund status updates.", "Set a 48-hour inspection SLA."],
      moreEvidence: ["Returns hub inspection timestamps."],
      webEventNames: [], recommendationIds: [],
    },
    {
      id: "ins-otp", topic: "account_access", category: "Account access", severity: "low",
      title: "OTP SMS delivery issues on some networks",
      summary: "A steady share of contacts are about OTP codes not arriving by SMS.",
      observed: ["Account-access conversations are mostly resolved by switching to an email OTP."],
      factors: [{ text: "SMS gateway delivery delays on specific carriers.", kind: "hypothesis" }],
      nextSteps: ["Offer email/WhatsApp OTP as a visible option."],
      moreEvidence: ["SMS gateway delivery reports by carrier."],
      webEventNames: [], recommendationIds: [],
    },
  ];

  const recommendations: Recommendation[] = [
    { id: "rec-1", insightId: "ins-delivery-fee", title: "Show delivery fees earlier in checkout", problem: "Customers see the delivery fee only after the address step, and many leave the funnel there.", action: "Display an estimated delivery fee on product and cart pages using the customer's saved or detected state; fix the mobile fee tooltip.", impact: "Could recover a meaningful share of sessions lost after the fee step", impactMetric: { label: "Fee step → purchase conversion", liftPct: 18 }, priority: "P1", owner: "Product: Checkout", status: "New", updatedAt: iso(now - 2 * DAY) },
    { id: "rec-2", insightId: "ins-payment", title: "Improve payment-failure recovery messaging", problem: "OTP timeouts leave customers unsure whether they paid, leading to retries and duplicate debits.", action: "Show a 'waiting for your bank' state, extend the timeout, and show the payment reference with clear next steps after any failure.", impact: "Fewer duplicate debits and payment escalations", impactMetric: { label: "Payment escalations / week", liftPct: -30 }, priority: "P1", owner: "Engineering: Payments", status: "In Progress", updatedAt: iso(now - 6 * DAY) },
    { id: "rec-3", insightId: "ins-delivery-date", title: "Clarify expected delivery dates on product pages", problem: "Customers don't know when items will arrive, which drives 'where is my order' contacts.", action: "Show 'Arrives by <date>' for the customer's state on product pages and in the cart.", impact: "Fewer order-status contacts", impactMetric: { label: "Order-status contacts / 100 orders", liftPct: -22 }, priority: "P2", owner: "Product: Catalogue", status: "Implemented", updatedAt: iso(now - 20 * DAY) },
    { id: "rec-4", insightId: "ins-express", title: "Improve express-checkout onboarding", problem: "Customers don't notice express checkout or don't trust saving cards.", action: "Move express checkout above the fold on mobile, add tokenisation reassurance copy, and show a one-time explainer.", impact: "Higher express checkout adoption", impactMetric: { label: "Express checkout usage", liftPct: 40 }, priority: "P2", owner: "Growth", status: "New", updatedAt: iso(now - 3 * DAY) },
  ];

  const activity: Activity[] = [
    { id: id("act"), at: recent(0.4), kind: "insight", text: "Delivery-fee abandonment flagged as top emerging issue", href: "/dashboard/intelligence?insight=ins-delivery-fee" },
    { id: id("act"), at: recent(1.45), kind: "escalation", text: "Voice call escalated to Tunde Bakare: duplicate charge", href: "/dashboard/conversations?id=conv-esc-1" },
    { id: id("act"), at: recent(2.97), kind: "escalation", text: "WhatsApp conversation escalated: payment without order", href: "/dashboard/conversations?id=conv-esc-2" },
    { id: id("act"), at: recent(4.99), kind: "escalation", text: "Chat escalated on request: delayed refund", href: "/dashboard/conversations?id=conv-esc-3" },
    { id: id("act"), at: recent(30), kind: "research", text: "Research campaign completed: checkout blockers (6 interviews)", href: "/dashboard/research?campaign=camp-checkout" },
    { id: id("act"), at: recent(144), kind: "recommendation", text: "Payment-failure messaging moved to In Progress", href: "/dashboard/recommendations?id=rec-2" },
  ];

  return {
    version: STORE_VERSION, seededAt: iso(now), settings: defaultSettings(), customers, orders,
    conversations, feedback, campaigns, events, insights, recommendations, activity,
  };
}

function seedCampaign(now: number): Campaign {
  const at = (d: number) => new Date(now - d * DAY).toISOString();
  const iv = (i: number, segment: Interview["segment"], turns: [string, string][], themes: string[], sentiment: Sentiment, status: Interview["status"] = "completed"): Interview => ({
    id: `int-${i}`, participant: `Synthetic participant P${i}`, segment, status, consent: status !== "declined", themes, sentiment,
    startedAt: at(3 + i * 0.3), source: "seed",
    turns: turns.map(([q, a], k) => ({ q, a, followUp: k > 0 })),
  });
  return {
    id: "camp-checkout",
    question: "What stops customers from completing checkout?",
    objective: "Understand why checkout abandonment rose this quarter.",
    segment: "Customers who started checkout in the last 30 days but did not purchase",
    channel: "web_chat", targetParticipants: 8, language: "English", lengthMin: 5,
    consentText: "Nexa will ask a few questions about your recent checkout experience on behalf of NovaMart. Responses are stored for 180 days and used only to improve the service. You can skip any question or stop at any time.",
    retentionDays: 180, status: "completed", createdAt: at(6), source: "seed",
    interviews: [
      iv(1, "First-time buyer", [
        ["Tell me about the last time you started a checkout on NovaMart but didn't finish.", "I wanted earbuds, but when I got to the end the delivery fee was almost ₦4,000."],
        ["What did you expect the total to be at that point?", "Just the price on the page. Maybe ₦1,000 delivery, not that much."],
        ["What would have helped you decide earlier?", "Show the delivery cost on the product page so I know before I waste time."],
      ], ["total_cost_visibility", "feature_request"], "negative"),
      iv(2, "Repeat buyer", [
        ["Tell me about the last time you started a checkout but didn't finish.", "Payment kept spinning while I waited for my bank OTP, then it failed."],
        ["What happened after it failed?", "I wasn't sure if I'd been charged, so I didn't try again that day."],
        ["What would have made you confident to retry?", "A clear message saying no money was taken, or a reference number."],
      ], ["payment_reliability", "feature_request"], "negative"),
      iv(3, "First-time buyer", [
        ["Tell me about the last time you didn't finish a checkout.", "The total jumped at the end because of shipping to Kano."],
        ["How did that make you feel about NovaMart?", "Like the price was a trick. I went to the market instead."],
      ], ["total_cost_visibility", "trust_security"], "negative"),
      iv(4, "High-value", [
        ["Tell me about your recent checkout experience.", "Usually fine. I use express checkout because it's fast."],
        ["What almost stopped you?", "Delivery date wasn't clear. I needed the item by Friday."],
      ], ["speed_convenience", "delivery_expectations"], "positive"),
      iv(5, "Business buyer", [
        ["Tell me about the last time you didn't finish a checkout.", "We buy in bulk and the delivery fee calculation for multiple items is confusing."],
        ["What would make it easier?", "Show the delivery cost in the cart, per order not per item, and allow invoice payment."],
      ], ["total_cost_visibility", "feature_request"], "neutral"),
      iv(6, "Repeat buyer", [["Tell me about the last time you didn't finish a checkout.", "I got distracted."]], [], "neutral", "abandoned"),
    ],
  };
}

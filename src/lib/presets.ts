import type { IndustryPreset } from "./types";

const baseEscalation = [
  "Customer explicitly asks for a human",
  "Customer is frustrated after two unresolved replies",
  "Duplicate charge or missing funds",
  "Answer not found in knowledge base",
  "Legal, safety or account-security concerns",
];

export const PRESETS: IndustryPreset[] = [
  {
    id: "ecommerce",
    label: "E-commerce",
    terms: { customer: "customer", order: "order" },
    agent: {
      name: "Ada",
      personality: "Warm, concise and practical. Uses plain Nigerian English. Never over-promises.",
      languages: ["English", "Nigerian Pidgin", "Yoruba"],
      greeting: "Hi, I'm Ada from NovaMart. How can I help with your order today?",
      policies:
        "Refunds are processed to the original payment method within 3–5 business days after approval. Returns accepted within 7 days of delivery for unused items with tags. Duplicate charges must be confirmed by the Payments team before a reversal. Agents cannot change delivery addresses after an order ships.",
      escalationRules: baseEscalation,
      businessHours: "Mon–Sat, 8:00–20:00 WAT (AI agent available 24/7)",
      intents: [
        { id: "order_status", label: "Order status", canResolve: true },
        { id: "returns", label: "Returns", canResolve: true },
        { id: "refund_status", label: "Refund status", canResolve: true },
        { id: "delivery_fee", label: "Delivery fee questions", canResolve: true },
        { id: "double_charge", label: "Charged twice", canResolve: false },
        { id: "payment_missing_order", label: "Paid but no order", canResolve: false },
        { id: "account_access", label: "Account access", canResolve: true },
        { id: "human_request", label: "Wants a human", canResolve: false },
      ],
    },
    kb: [
      { id: "kb-orders", title: "Tracking an order", body: "Customers can track orders under Account → My Orders. Orders ship within 24 hours in Lagos and Abuja and 48 hours elsewhere. A tracking link is sent by SMS and email once the order ships.", tags: ["order", "track", "where", "status", "shipping", "arrive"] },
      { id: "kb-delivery", title: "Delivery times and fees", body: "Delivery takes 1–2 business days in Lagos and Abuja and 3–5 business days elsewhere. Delivery fees depend on the delivery state and parcel size and are calculated at checkout after the address is entered. Orders above ₦50,000 in Lagos qualify for free delivery.", tags: ["delivery", "fee", "shipping", "cost", "charge", "total", "expensive", "price"] },
      { id: "kb-returns", title: "Returning an item", body: "Unused items with original tags can be returned within 7 days of delivery. Start a return from Account → My Orders → Return item, or ask support. A pickup is scheduled within 2 business days, and the refund is issued after the item is inspected.", tags: ["return", "send back", "exchange", "wrong item", "size"] },
      { id: "kb-refunds", title: "Refund timelines", body: "Approved refunds go back to the original payment method within 3–5 business days. NovaMart Wallet refunds are instant.", tags: ["refund", "money back", "reversal"] },
      { id: "kb-payments", title: "Payment methods and failed payments", body: "NovaMart accepts cards, bank transfer, USSD and Pay on Delivery in selected cities. If a payment is debited but no order is created, the payment is reconciled automatically within 24 hours; if not, the Payments team investigates.", tags: ["payment", "card", "transfer", "debited", "charged", "failed", "ussd", "twice", "double"] },
      { id: "kb-account", title: "Account access and OTP", body: "Customers can reset their password from the sign-in page. OTP codes expire after 5 minutes. If OTP SMS is not received, customers can request a code by email. Support never asks for passwords or full card numbers.", tags: ["login", "password", "otp", "account", "sign in", "locked"] },
      { id: "kb-late", title: "Late or missing deliveries", body: "If an order is past its expected delivery date, support checks the carrier status. Orders more than 2 business days late are investigated by the Logistics team, who contact the customer within 1 business day. Paid delivery fees are refunded when NovaMart misses the promised delivery date. Orders marked delivered but not received are investigated and replaced or refunded.", tags: ["late", "delay", "delayed", "hasn't arrived", "not arrived", "arrived", "missing", "not received", "still waiting"] },
      { id: "kb-products", title: "Product questions and warranty", body: "Product specifications are listed on each product page. Electronics carry the manufacturer's warranty (usually 12 months); NovaMart helps with warranty claims within 30 days of delivery. Support cannot confirm stock levels by phone beyond what the product page shows.", tags: ["product", "warranty", "spec", "size", "colour", "color", "stock", "available", "genuine"] },
      { id: "kb-express", title: "Express checkout", body: "Express checkout lets signed-in customers pay in one step with a saved address and payment method. Card details are tokenised by the payment provider; NovaMart does not store full card numbers.", tags: ["express", "one click", "checkout", "saved card"] },
    ],
    scenarios: [
      "Where is my order?",
      "I was charged twice.",
      "How do I return an item?",
      "My payment succeeded, but my order is missing.",
      "This is ridiculous, I've explained this three times. I want to speak to a human now!",
    ],
  },
  {
    id: "banking",
    label: "Banking",
    terms: { customer: "account holder", order: "transaction" },
    agent: {
      name: "Kemi",
      personality: "Calm, precise and security-conscious. Never asks for PINs or passwords.",
      languages: ["English", "Hausa", "Yoruba", "Igbo"],
      greeting: "Hello, I'm Kemi, your digital banking assistant. How can I help?",
      policies: "Failed transfers are auto-reversed within 24 hours. Card blocks are immediate. Disputes require a human agent. Never request PIN, OTP or full card number.",
      escalationRules: [...baseEscalation, "Suspected fraud or unauthorised transaction"],
      businessHours: "24/7 for card blocks; disputes Mon–Fri 8:00–17:00 WAT",
      intents: [
        { id: "failed_transfer", label: "Failed transfer", canResolve: true },
        { id: "card_block", label: "Block card", canResolve: true },
        { id: "dispute", label: "Transaction dispute", canResolve: false },
        { id: "account_access", label: "App access", canResolve: true },
      ],
    },
    kb: [
      { id: "kb-b1", title: "Failed transfers", body: "If a transfer fails but your account was debited, the amount is reversed automatically within 24 hours.", tags: ["transfer", "failed", "debited", "reversal", "money"] },
      { id: "kb-b2", title: "Blocking a card", body: "You can block your card instantly in the app under Cards → Block card, or the agent can block it for you after verification.", tags: ["card", "block", "lost", "stolen"] },
      { id: "kb-b3", title: "App login problems", body: "Reset your password from the login screen. Device changes require re-verification with your BVN-linked phone number.", tags: ["login", "app", "password", "device", "otp"] },
    ],
    scenarios: ["My transfer failed but I was debited.", "I lost my card.", "I don't recognise this transaction.", "I can't log in to the app.", "I want to speak to someone now!"],
  },
  {
    id: "hospitality",
    label: "Hospitality",
    terms: { customer: "guest", order: "booking" },
    agent: {
      name: "Tolu",
      personality: "Gracious, upbeat and helpful.",
      languages: ["English", "French"],
      greeting: "Welcome! I'm Tolu from the front desk team. How can I make your stay better?",
      policies: "Free cancellation up to 48 hours before check-in. Early check-in subject to availability. Refunds within 5 business days.",
      escalationRules: [...baseEscalation, "Safety or security incident at the property"],
      businessHours: "24/7",
      intents: [
        { id: "booking_change", label: "Change booking", canResolve: true },
        { id: "cancellation", label: "Cancellation", canResolve: true },
        { id: "complaint", label: "Room complaint", canResolve: false },
      ],
    },
    kb: [
      { id: "kb-h1", title: "Cancellations", body: "Bookings can be cancelled free of charge up to 48 hours before check-in.", tags: ["cancel", "refund", "booking"] },
      { id: "kb-h2", title: "Check-in times", body: "Check-in is from 14:00, check-out by 12:00. Early check-in depends on availability.", tags: ["check-in", "check in", "early", "time", "checkout"] },
      { id: "kb-h3", title: "Airport transfer", body: "Airport transfers can be booked for a fee at least 24 hours in advance.", tags: ["airport", "pickup", "transfer", "taxi"] },
    ],
    scenarios: ["Can I check in early?", "I want to cancel my booking.", "Do you offer airport pickup?", "My room's AC is broken.", "Get me the manager!"],
  },
  {
    id: "telecom",
    label: "Telecommunications",
    terms: { customer: "subscriber", order: "plan" },
    agent: {
      name: "Zainab",
      personality: "Efficient, friendly, explains technical things simply.",
      languages: ["English", "Hausa", "Nigerian Pidgin"],
      greeting: "Hi, I'm Zainab. How can I help with your line or data today?",
      policies: "Data bundles are non-refundable once activated. Network outages are credited automatically when confirmed.",
      escalationRules: baseEscalation,
      businessHours: "24/7",
      intents: [
        { id: "data_balance", label: "Data balance", canResolve: true },
        { id: "network_issue", label: "Network issue", canResolve: false },
        { id: "plan_change", label: "Plan change", canResolve: true },
      ],
    },
    kb: [
      { id: "kb-t1", title: "Checking data balance", body: "Dial *323# or open the app to check your data balance.", tags: ["data", "balance", "bundle"] },
      { id: "kb-t2", title: "Network outages", body: "Known outages are listed in the app. Confirmed outages are credited automatically.", tags: ["network", "signal", "outage", "no service"] },
      { id: "kb-t3", title: "Changing plans", body: "You can migrate plans once every 30 days in the app or by dialling *500#.", tags: ["plan", "change", "migrate", "tariff"] },
    ],
    scenarios: ["How do I check my data balance?", "I have no network.", "I want to change my plan.", "My data finished too fast.", "I need a human agent!"],
  },
  {
    id: "saas",
    label: "SaaS",
    terms: { customer: "user", order: "subscription" },
    agent: {
      name: "Nova",
      personality: "Knowledgeable, crisp and technical when needed.",
      languages: ["English"],
      greeting: "Hi, I'm Nova. What can I help you with in your workspace?",
      policies: "Plans can be changed at any time; downgrades take effect next cycle. Refunds within 14 days of an annual purchase.",
      escalationRules: [...baseEscalation, "Data loss or security incident"],
      businessHours: "Mon–Fri, 8:00–18:00 WAT",
      intents: [
        { id: "billing", label: "Billing", canResolve: true },
        { id: "bug", label: "Bug report", canResolve: false },
        { id: "sso", label: "SSO / login", canResolve: true },
      ],
    },
    kb: [
      { id: "kb-s1", title: "Changing plans", body: "Admins can change plans under Settings → Billing. Downgrades apply at the next billing cycle.", tags: ["plan", "billing", "upgrade", "downgrade", "invoice"] },
      { id: "kb-s2", title: "SSO setup", body: "SSO via SAML is available on the Business plan under Settings → Security.", tags: ["sso", "saml", "login", "okta"] },
      { id: "kb-s3", title: "Exporting data", body: "Workspace data can be exported as CSV from Settings → Data.", tags: ["export", "csv", "data", "download"] },
    ],
    scenarios: ["How do I change my plan?", "How do I set up SSO?", "Can I export my data?", "The dashboard is showing an error.", "I want to talk to a person."],
  },
];

export const getPreset = (id: string) => PRESETS.find((p) => p.id === id) ?? PRESETS[0];

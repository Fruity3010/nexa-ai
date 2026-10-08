// Shared domain types. Everything seeded is synthetic demo data and carries `source`.

export type Channel = "chat" | "voice" | "email" | "whatsapp";
export type Sentiment = "positive" | "neutral" | "negative";
export type ConvStatus = "ai_resolved" | "escalated" | "open" | "human_resolved";
export type Priority = "low" | "medium" | "high" | "urgent";
export type RecordSource = "seed" | "simulator" | "phone" | "sdk" | "user";

/** Issue topics tie every signal (conversation, review, interview, web event) to insights. */
export type Topic =
  | "delivery_fee_surprise"
  | "payment_failure"
  | "delivery_date_unclear"
  | "express_checkout_adoption"
  | "refund_delays"
  | "account_access"
  | "general";

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  city: string;
  segment: "First-time buyer" | "Repeat buyer" | "High-value" | "Business buyer";
  orders: number;
}

export interface Message {
  id: string;
  role: "customer" | "agent" | "human" | "system";
  text: string;
  at: string;
  meta?: { intent?: string; kb?: string; action?: string };
}

export interface Note {
  author: string;
  text: string;
  at: string;
}

export interface Conversation {
  id: string;
  channel: Channel;
  customerId: string;
  intent: string;
  topic: Topic;
  sentiment: Sentiment;
  status: ConvStatus;
  priority: Priority;
  assignee?: string;
  startedAt: string;
  firstResponseSec: number;
  durationSec?: number;
  csat?: number;
  effort: number; // 1 (effortless) – 5 (high friction)
  messages: Message[];
  summary: string;
  nextAction: string;
  attempted: string[];
  notes: Note[];
  source: RecordSource;
  call?: CallMeta; // present on phone calls (real or simulated)
}

/** Structured post-call output. `resolution` is "resolved" only when the caller confirmed it. */
export interface CallIntelligence {
  summary: string;
  intent: string;
  sentiment: "positive" | "neutral" | "negative" | "frustrated";
  urgency: "low" | "medium" | "high" | "urgent";
  resolution: "resolved" | "unresolved" | "unknown";
  resolved: boolean;
  escalated: boolean;
  issues: string[];
  attempted: string[];
  recommended_action: string;
  follow_up_required: boolean;
  engine: "gemini" | "claude" | "rules";
}

export interface CallMeta {
  provider: "twilio" | "simulated";
  engine: "gemini-live" | "twilio-gather" | "simulator";
  callSid?: string;
  from: string; // masked, e.g. •••4821
  status: "active" | "completed" | "failed";
  endedAt?: string;
  endReason?: string;
  transcript: "live" | "complete" | "partial" | "none";
  resolvedConfirmed?: boolean; // agent's mark_resolved tool was called after the caller confirmed
  handoff?: { at: string; reason: string; transfer: "dialing" | "not_configured"; summary: string };
  intelligence?: CallIntelligence;
}

export interface Feedback {
  id: string;
  kind: "review" | "survey";
  customerId: string;
  rating: number; // 1-5
  text: string;
  at: string;
  topic: Topic;
  sentiment: Sentiment;
}

export interface InterviewTurn {
  q: string;
  a?: string;
  skipped?: boolean;
  followUp?: boolean;
}

export interface Interview {
  id: string;
  participant: string; // e.g. "Synthetic participant P3"
  segment: Customer["segment"];
  status: "completed" | "in_progress" | "abandoned" | "declined";
  consent: boolean;
  turns: InterviewTurn[];
  themes: string[];
  sentiment: Sentiment;
  startedAt: string;
  source: RecordSource;
}

export interface Campaign {
  id: string;
  question: string;
  objective: string;
  segment: string;
  channel: "web_chat" | "voice" | "whatsapp" | "email";
  targetParticipants: number;
  language: string;
  lengthMin: number;
  consentText: string;
  retentionDays: number;
  status: "draft" | "running" | "completed";
  createdAt: string;
  interviews: Interview[];
  source: RecordSource;
}

export interface WebEvent {
  id: string;
  sessionId: string;
  name: string;
  at: string;
  path: string;
  props?: Record<string, string | number | boolean>;
  origin: "seed" | "sdk";
  host?: string;
}

export interface Insight {
  id: string;
  topic: Topic;
  title: string;
  summary: string;
  category: string;
  severity: "low" | "medium" | "high" | "critical";
  observed: string[];
  factors: { text: string; kind: "hypothesis" }[];
  nextSteps: string[];
  moreEvidence: string[];
  funnelStep?: string;
  webEventNames: string[];
  recommendationIds: string[];
}

export type RecStatus = "New" | "Accepted" | "In Progress" | "Implemented" | "Dismissed";

export interface Recommendation {
  id: string;
  insightId: string;
  title: string;
  problem: string;
  action: string;
  impact: string;
  impactMetric: { label: string; liftPct: number };
  priority: "P1" | "P2" | "P3";
  owner: string;
  status: RecStatus;
  updatedAt: string;
}

export interface Activity {
  id: string;
  at: string;
  kind: "conversation" | "escalation" | "call" | "research" | "sdk" | "recommendation" | "settings" | "insight";
  text: string;
  href?: string;
}

export interface KBArticle {
  id: string;
  title: string;
  body: string;
  tags: string[];
}

export interface AgentConfig {
  name: string;
  personality: string;
  languages: string[];
  greeting: string;
  policies: string;
  escalationRules: string[];
  businessHours: string;
  intents: { id: string; label: string; canResolve: boolean }[];
}

export interface IndustryPreset {
  id: "ecommerce" | "banking" | "hospitality" | "telecom" | "saas";
  label: string;
  terms: { customer: string; order: string };
  agent: AgentConfig;
  kb: KBArticle[];
  scenarios: string[];
}

export type IntegrationStatus = "Connected" | "Demo Mode" | "Not Connected" | "Needs Configuration";

export interface Settings {
  org: { name: string; industry: IndustryPreset["id"] };
  terms: IndustryPreset["terms"];
  agent: AgentConfig;
  kb: KBArticle[];
  scenarios: string[];
  guardrails: { neverInventPolicy: boolean; redactPII: boolean; maxAutoRefundNGN: number };
  retentionDays: { conversations: number; webEvents: number; research: number };
  privacy: { requireConsent: boolean; respectDoNotTrack: boolean; anonymizeIP: boolean };
  roles: { name: string; email: string; role: "Admin" | "Analyst" | "Support Agent" | "Viewer" }[];
  sdk: {
    projectName: string;
    projectKey: string;
    allowedDomains: string[];
    autoTrack: { pageViews: boolean; errors: boolean; rageClicks: boolean; forms: boolean };
  };
  demoIntegrations: string[]; // ids the user toggled into labelled demo mode
  voiceNumber: string;
  voice: { voiceName: string; callbackMessage: string };
}

export interface DemoOrder {
  id: string;
  customerId: string;
  item: string;
  amount: number;
  status: "Processing" | "Shipped" | "Out for delivery" | "Delivered" | "Payment received, order not created";
  eta: string;
  carrier: string;
  paymentRef: string;
  charges: number;
}

export interface Store {
  version: number;
  seededAt: string;
  settings: Settings;
  customers: Customer[];
  orders: DemoOrder[];
  conversations: Conversation[];
  feedback: Feedback[];
  campaigns: Campaign[];
  events: WebEvent[];
  insights: Insight[];
  recommendations: Recommendation[];
  activity: Activity[];
}

import "server-only";
import type { IntegrationStatus, Store } from "./types";
import { voiceConfig } from "./voice/config";

export interface Integration {
  id: string;
  name: string;
  category: "Telephony" | "Website" | "Support platform" | "E-commerce" | "CRM" | "Messaging" | "AI provider";
  description: string;
  status: IntegrationStatus;
  real: boolean; // true when Nexa has a working code path for this integration
  env: string[];
  setup: string;
  detail?: string;
}

const has = (...keys: string[]) => keys.every((k) => !!process.env[k]);
const some = (...keys: string[]) => keys.some((k) => !!process.env[k]);

/** Status is derived from server env vars and real activity. Nothing reports "Connected" without credentials. */
export function integrations(s: Store): Integration[] {
  const demo = (id: string, fallback: IntegrationStatus = "Not Connected"): IntegrationStatus => (s.settings.demoIntegrations.includes(id) ? "Demo Mode" : fallback);
  const sdkEvents = s.events.filter((e) => e.origin === "sdk").length;
  const voice = voiceConfig();
  const twilio = voice.mode !== "not-configured";
  return [
    {
      id: "anthropic", name: "Claude (Anthropic)", category: "AI provider", real: true,
      description: "Powers the support agent and research interviewer through server-side structured outputs.",
      status: has("ANTHROPIC_API_KEY") ? "Connected" : "Demo Mode", env: ["ANTHROPIC_API_KEY", "NEXA_AI_MODEL (optional)"],
      setup: "Set ANTHROPIC_API_KEY on the server and restart. Without it, Nexa uses the deterministic demo engine.",
      detail: has("ANTHROPIC_API_KEY") ? `Model: ${process.env.NEXA_AI_MODEL || "claude-opus-5"}` : "Deterministic intent engine (no LLM calls)",
    },
    {
      id: "twilio", name: "Twilio Voice", category: "Telephony", real: true,
      description: "Answer ordinary phone calls with the Nexa voice agent. Full-duplex audio via Media Streams when Gemini is configured, otherwise turn-based speech recognition.",
      status: twilio ? "Connected" : some("TWILIO_AUTH_TOKEN", "TWILIO_PHONE_NUMBER", "TWILIO_ACCOUNT_SID") ? "Needs Configuration" : "Not Connected",
      env: ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_PHONE_NUMBER", "NEXA_PUBLIC_URL", "VOICE_HUMAN_HANDOFF_NUMBER (optional)"],
      setup: "Buy a voice-capable Twilio number, set its Voice webhook to POST {NEXA_PUBLIC_URL}/api/voice/twilio and its status callback to {NEXA_PUBLIC_URL}/api/voice/status. Requests are verified with X-Twilio-Signature.",
      detail: twilio ? `Number: ${voice.twilio.phoneNumber} · ${voice.mode === "streaming" ? "real-time streaming" : "turn-based"}` : voice.missingTelephony.length < 3 ? `Missing: ${voice.missingTelephony.join(", ")}` : "No number provisioned",
    },
    {
      id: "gemini", name: "Gemini Live (Google)", category: "AI provider", real: true,
      description: "Real-time speech-to-speech voice agent for phone calls, plus structured post-call analysis.",
      status: voice.missingStreaming.length === 0 ? "Connected" : voice.gemini.apiKey ? "Needs Configuration" : "Not Connected",
      env: ["GEMINI_API_KEY", "GEMINI_LIVE_MODEL (optional)", "VOICE_BRIDGE_SECRET", "TWILIO_STREAM_WSS_URL (optional)"],
      setup: "Set GEMINI_API_KEY and VOICE_BRIDGE_SECRET, then run the voice bridge with `npm run voice`. See README → Live phone calls.",
      detail: voice.gemini.apiKey ? `Live model: ${voice.gemini.liveModel}${voice.missingStreaming.length ? ` · missing ${voice.missingStreaming.join(", ")}` : ""}` : "Not configured",
    },
    {
      id: "sdk", name: "Nexa Website SDK", category: "Website", real: true,
      description: "Consent-aware website events from a single script tag.",
      status: sdkEvents ? "Connected" : "Needs Configuration", env: [],
      setup: "Install the snippet from the Website SDK page.",
      detail: sdkEvents ? `${sdkEvents} events received` : "No SDK events received yet",
    },
    ...([
      ["zendesk", "Zendesk", "Support platform", "Import tickets and sync escalations.", ["ZENDESK_SUBDOMAIN", "ZENDESK_API_TOKEN"]],
      ["intercom", "Intercom", "Support platform", "Import conversations and hand off to Intercom inbox.", ["INTERCOM_ACCESS_TOKEN"]],
      ["shopify", "Shopify", "E-commerce", "Real order lookups for the support agent.", ["SHOPIFY_STORE_DOMAIN", "SHOPIFY_ADMIN_TOKEN"]],
      ["woocommerce", "WooCommerce", "E-commerce", "Order and customer lookups.", ["WOO_URL", "WOO_KEY", "WOO_SECRET"]],
      ["hubspot", "HubSpot", "CRM", "Enrich customer profiles and log interactions.", ["HUBSPOT_TOKEN"]],
      ["salesforce", "Salesforce", "CRM", "Sync cases and customer context.", ["SALESFORCE_INSTANCE_URL", "SALESFORCE_TOKEN"]],
      ["whatsapp", "WhatsApp Business", "Messaging", "Support and research interviews over WhatsApp.", ["WHATSAPP_TOKEN", "WHATSAPP_PHONE_ID"]],
      ["sms", "SMS (Termii / Twilio)", "Messaging", "Send research invitations and notifications by SMS.", ["SMS_API_KEY"]],
    ] as const).map(([id, name, category, description, env]): Integration => ({
      id, name, category, description, env: [...env], real: false,
      status: demo(id, some(...env) ? "Needs Configuration" : "Not Connected"),
      setup: `Connector not implemented in this MVP. Add ${env.join(", ")} and implement the adapter in src/lib/integrations.ts. "Demo Mode" only labels this integration as simulated; no third-party API is contacted.`,
    })),
  ];
}

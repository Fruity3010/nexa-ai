// Voice configuration from server env vars. Read per request so tests and restarts see changes.
// Nothing here is ever sent to the browser except via voiceStatus(), which omits secrets.

type Env = Record<string, string | undefined>;

export function voiceConfig(env: Env = process.env) {
  const publicUrl = env.NEXA_PUBLIC_URL?.replace(/\/$/, "") || "";
  const twilio = {
    accountSid: env.TWILIO_ACCOUNT_SID || "",
    authToken: env.TWILIO_AUTH_TOKEN || "",
    phoneNumber: env.TWILIO_PHONE_NUMBER || "",
    // Must be the exact URLs configured in Twilio: they are part of the signed payload.
    webhookUrl: env.TWILIO_VOICE_WEBHOOK_URL || (publicUrl && `${publicUrl}/api/voice/twilio`),
    statusCallbackUrl: env.TWILIO_STATUS_CALLBACK_URL || (publicUrl && `${publicUrl}/api/voice/status`),
    streamUrl: env.TWILIO_STREAM_WSS_URL || (publicUrl && `${publicUrl.replace(/^http/, "ws")}/media-stream`),
  };
  const gemini = {
    apiKey: env.GEMINI_API_KEY || "",
    liveModel: env.GEMINI_LIVE_MODEL || "gemini-3.8-live",
    textModel: env.GEMINI_TEXT_MODEL || "gemini-3.5-flash-lite",
    voice: env.GEMINI_VOICE || "Kore",
  };
  const missingTelephony = Object.entries({ TWILIO_AUTH_TOKEN: twilio.authToken, TWILIO_PHONE_NUMBER: twilio.phoneNumber, "NEXA_PUBLIC_URL or TWILIO_VOICE_WEBHOOK_URL": twilio.webhookUrl })
    .filter(([, v]) => !v).map(([k]) => k);
  const missingStreaming = Object.entries({ GEMINI_API_KEY: gemini.apiKey, VOICE_BRIDGE_SECRET: env.VOICE_BRIDGE_SECRET, "TWILIO_STREAM_WSS_URL or NEXA_PUBLIC_URL": twilio.streamUrl })
    .filter(([, v]) => !v).map(([k]) => k);
  const telephony = missingTelephony.length === 0;
  return {
    twilio,
    gemini,
    bridgeSecret: env.VOICE_BRIDGE_SECRET || "",
    appUrl: (env.NEXA_INTERNAL_URL || "http://localhost:3000").replace(/\/$/, ""),
    bridgePort: Number(env.VOICE_BRIDGE_PORT) || 8081,
    demoMode: env.VOICE_DEMO_MODE !== "false",
    handoffNumber: env.VOICE_HUMAN_HANDOFF_NUMBER || env.NEXA_HANDOFF_NUMBER || "",
    maxCallSec: Math.min(Number(env.VOICE_MAX_CALL_SECONDS) || 540, 840), // Live connections last ~10 min, audio sessions 15
    maxConcurrent: Number(env.VOICE_MAX_CONCURRENT_CALLS) || 5,
    allowUnsigned: env.NEXA_VOICE_ALLOW_UNSIGNED === "true" && !twilio.authToken,
    missingTelephony,
    missingStreaming,
    /** "streaming" = full-duplex Gemini Live; "turn-based" = Twilio <Gather> STT + Nexa agent + <Say>. */
    mode: !telephony ? ("not-configured" as const) : missingStreaming.length === 0 ? ("streaming" as const) : ("turn-based" as const),
  };
}

export type VoiceConfig = ReturnType<typeof voiceConfig>;

/** Browser-safe summary for the dashboard. */
export function voiceStatus(cfg = voiceConfig()) {
  return {
    mode: cfg.mode,
    demoMode: cfg.demoMode,
    phoneNumber: cfg.twilio.phoneNumber || null,
    webhookUrl: cfg.twilio.webhookUrl || null,
    statusCallbackUrl: cfg.twilio.statusCallbackUrl || null,
    streamUrl: cfg.twilio.streamUrl || null,
    liveModel: cfg.gemini.liveModel,
    geminiConfigured: !!cfg.gemini.apiKey,
    handoffConfigured: !!cfg.handoffNumber,
    missingTelephony: cfg.missingTelephony,
    missingStreaming: cfg.missingStreaming,
  };
}

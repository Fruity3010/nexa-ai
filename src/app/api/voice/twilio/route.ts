import { handleCustomerMessage } from "@/lib/support-flow";
import { db, mutate } from "@/lib/store";
import { escalateCall, findCall, startCall } from "@/lib/voice/calls";
import { voiceConfig } from "@/lib/voice/config";
import { voiceGreeting } from "@/lib/voice/prompt";
import { streamToken, twiml, validTwilioSignature, xmlEscape as esc } from "@/lib/voice/twilio";

/**
 * Twilio Voice webhook (TwilioVoiceService).
 * - Streaming mode (Gemini configured): answers with <Connect><Stream> to the voice bridge for
 *   full-duplex audio. When the stream closes, Twilio continues to the <Redirect> (?step=after),
 *   which transfers escalated calls or falls back to turn-based if Gemini failed.
 * - Turn-based mode (no Gemini): Twilio <Gather input="speech"> STT → Nexa support agent → <Say>.
 *   This is NOT full duplex: the caller and agent take turns and barge-in is limited.
 */
export async function POST(req: Request) {
  const cfg = voiceConfig();
  const params = new URLSearchParams(await req.text());
  const search = new URL(req.url).search;
  const signedOk = cfg.twilio.authToken
    ? validTwilioSignature(cfg.twilio.authToken, cfg.twilio.webhookUrl + search, params, req.headers.get("x-twilio-signature"))
    : cfg.allowUnsigned;
  if (!signedOk) {
    console.warn(`[nexa:voice] rejected webhook (${cfg.twilio.authToken ? "bad signature" : `telephony not configured: missing ${cfg.missingTelephony.join(", ")}`})`);
    return new Response("Telephony not configured or invalid signature", { status: 403 });
  }

  const sid = params.get("CallSid");
  if (!sid || !/^CA[0-9a-f]{32}$/i.test(sid)) return new Response("Missing CallSid", { status: 400 });
  const self = cfg.twilio.webhookUrl || "/api/voice/twilio";
  const gather = (say: string) =>
    `<Gather input="speech" action="${esc(self)}" method="POST" speechTimeout="auto" language="en-NG"><Say>${esc(say)}</Say></Gather><Say>Sorry, I didn't catch that.</Say><Redirect method="POST">${esc(self)}</Redirect>`;
  const step = new URL(req.url).searchParams.get("step");
  const settings = db().settings;

  // Stream ended: transfer, fall back to turn-based, or hang up.
  if (step === "after") {
    const c = findCall(sid);
    if (c?.call?.handoff?.transfer === "dialing" && cfg.handoffNumber) return twiml(`<Dial>${esc(cfg.handoffNumber)}</Dial>`);
    if (c?.call?.engine === "twilio-gather" && c.call.status === "active") return twiml(gather("Sorry, I had a technical problem. I'm still here. How can I help?"));
    return twiml("<Hangup/>");
  }

  const speech = params.get("SpeechResult");
  if (!speech) {
    const existing = findCall(sid);
    if (!existing && cfg.mode === "streaming") {
      startCall(sid, params.get("From"), "gemini-live");
      return twiml(
        `<Connect><Stream url="${esc(cfg.twilio.streamUrl)}"><Parameter name="token" value="${streamToken(cfg.bridgeSecret, sid)}"/></Stream></Connect>` +
        `<Redirect method="POST">${esc(`${self}?step=after`)}</Redirect>`,
      );
    }
    if (!existing) startCall(sid, params.get("From"), "twilio-gather");
    return twiml(gather(existing ? "Are you still there? How can I help?" : voiceGreeting(settings)));
  }

  const { conversation: c, turn } = await handleCustomerMessage({ conversationId: `call-${sid}`, text: speech, channel: "voice", source: "phone" });
  if (!turn) return twiml(`<Say>${esc(settings.voice.callbackMessage)} Goodbye.</Say><Hangup/>`);
  if (turn.escalate) {
    const out = c.call?.handoff ? null : escalateCall(c, { reason: `AI agent escalated: ${turn.intent}`, summary: turn.summary, urgency: turn.priority });
    const transfer = out?.transfer ?? c.call?.handoff?.transfer === "dialing";
    return twiml(`<Say>${esc(turn.reply)}</Say>` + (transfer ? `<Dial>${esc(cfg.handoffNumber)}</Dial>` : `<Say>${esc(settings.voice.callbackMessage)} Goodbye.</Say><Hangup/>`));
  }
  if (c.status === "ai_resolved" && /great day|goodbye/i.test(turn.reply)) {
    mutate(() => { if (c.call) c.call.resolvedConfirmed = true; });
    return twiml(`<Say>${esc(turn.reply)}</Say><Hangup/>`);
  }
  return twiml(gather(turn.reply));
}

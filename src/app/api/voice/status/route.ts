import { endCall, findCall } from "@/lib/voice/calls";
import { voiceConfig } from "@/lib/voice/config";
import { validTwilioSignature } from "@/lib/voice/twilio";

const FINAL = new Set(["completed", "busy", "failed", "no-answer", "canceled"]);

/** Twilio call status callback ("Call status changes" URL on the number). Finalises dropped calls too. */
export async function POST(req: Request) {
  const cfg = voiceConfig();
  const params = new URLSearchParams(await req.text());
  const ok = cfg.twilio.authToken
    ? validTwilioSignature(cfg.twilio.authToken, cfg.twilio.statusCallbackUrl + new URL(req.url).search, params, req.headers.get("x-twilio-signature"))
    : cfg.allowUnsigned;
  if (!ok) return new Response("Invalid signature", { status: 403 });
  const sid = params.get("CallSid") ?? "";
  const status = params.get("CallStatus") ?? "";
  if (FINAL.has(status)) {
    const duration = Number(params.get("CallDuration"));
    await endCall(findCall(sid), { reason: `twilio:${status}`, durationSec: Number.isFinite(duration) && duration > 0 ? duration : undefined, failed: status !== "completed" });
  }
  return new Response(null, { status: 204 });
}

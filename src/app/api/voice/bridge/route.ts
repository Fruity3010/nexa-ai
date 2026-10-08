import crypto from "node:crypto";
import { z } from "zod";
import { db, mutate } from "@/lib/store";
import { appendTranscript, endCall, findCall, runTool } from "@/lib/voice/calls";
import { voiceConfig } from "@/lib/voice/config";
import { voiceGreeting, voiceInstructions } from "@/lib/voice/prompt";

const sid = z.string().regex(/^CA[0-9a-f]{32}$/i);
const Body = z.discriminatedUnion("type", [
  z.object({ type: z.literal("start"), callSid: sid }),
  z.object({ type: z.literal("transcript"), callSid: sid, role: z.enum(["customer", "agent"]), text: z.string().max(4000) }),
  z.object({ type: z.literal("tool"), callSid: sid, name: z.string().max(60), args: z.record(z.string(), z.unknown()).default({}) }),
  z.object({ type: z.literal("provider_failed"), callSid: sid, error: z.string().max(300) }),
  z.object({ type: z.literal("end"), callSid: sid, reason: z.string().max(100), durationSec: z.number().int().min(0).max(36000).optional() }),
]);

/** Internal API for the voice bridge process (never called by browsers). Bearer VOICE_BRIDGE_SECRET. */
export async function POST(req: Request) {
  const secret = voiceConfig().bridgeSecret;
  const got = req.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  if (!secret || got.length !== secret.length || !crypto.timingSafeEqual(Buffer.from(got), Buffer.from(secret)))
    return Response.json({ error: "unauthorized" }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid message" }, { status: 400 });
  const b = parsed.data;
  const c = findCall(b.callSid);
  if (!c?.call) return Response.json({ error: "unknown call" }, { status: 404 });

  switch (b.type) {
    case "start": {
      const s = db().settings;
      return Response.json({ systemInstruction: voiceInstructions(s, { handoffAvailable: !!voiceConfig().handoffNumber }), greeting: voiceGreeting(s), voiceName: s.voice.voiceName });
    }
    case "transcript":
      appendTranscript(b.callSid, b.role, b.text);
      return Response.json({ ok: true });
    case "tool":
      return Response.json({ response: runTool(b.callSid, b.name, b.args) });
    case "provider_failed":
      // The webhook's ?step=after redirect continues this call in turn-based mode.
      mutate(() => {
        c.call!.engine = "twilio-gather";
        c.messages.push({ id: `s${c.messages.length}`, role: "system", text: "Real-time voice provider failed; call continued in turn-based mode.", at: new Date().toISOString() });
      });
      console.warn(`[nexa:voice] ${c.id} provider failed: ${b.error}`);
      return Response.json({ ok: true });
    case "end":
      await endCall(c, { reason: b.reason, durationSec: b.durationSec, failed: b.reason === "error" });
      return Response.json({ ok: true });
  }
}

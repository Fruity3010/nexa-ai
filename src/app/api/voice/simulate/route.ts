import { z } from "zod";
import { db, mutate } from "@/lib/store";
import { endCall } from "@/lib/voice/calls";
import { voiceConfig } from "@/lib/voice/config";

const Body = z.object({ conversationId: z.string().max(80), durationSec: z.number().int().min(0).max(36000) });

/** Finalise a browser-simulated call through the same post-call intelligence as real calls. */
export async function POST(req: Request) {
  if (!voiceConfig().demoMode) return Response.json({ error: "Demo mode is disabled (VOICE_DEMO_MODE=false)" }, { status: 403 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "conversationId and durationSec are required" }, { status: 400 });
  const c = db().conversations.find((x) => x.id === parsed.data.conversationId && x.channel === "voice" && x.source === "simulator");
  if (!c) return Response.json({ error: "Simulated call not found" }, { status: 404 });
  if (!c.call) mutate(() => {
    c.call = { provider: "simulated", engine: "simulator", from: "Demo caller", status: "active", transcript: "live",
      // The demo engine only says "have a great day" after the caller closes with thanks / that's all.
      resolvedConfirmed: /great day/i.test(c.messages.filter((m) => m.role === "agent").at(-1)?.text ?? "") };
    if (c.status === "escalated") c.call.handoff = { at: new Date().toISOString(), reason: c.intent, transfer: "not_configured", summary: c.summary };
  });
  return Response.json({ conversation: await endCall(c, { reason: "simulator:hangup", durationSec: parsed.data.durationSec }) });
}

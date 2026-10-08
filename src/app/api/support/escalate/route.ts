import { z } from "zod";
import { logActivity, mutate } from "@/lib/store";

const Body = z.object({ conversationId: z.string(), reason: z.string().max(300).optional() });

/** Manual escalation from the simulator or live-call console. */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "conversationId is required" }, { status: 400 });
  const { conversationId, reason } = parsed.data;
  const conv = mutate((s) => {
    const c = s.conversations.find((x) => x.id === conversationId);
    if (!c) return null;
    c.status = "escalated";
    c.priority = c.priority === "urgent" ? "urgent" : "high";
    c.attempted = [...new Set([...c.attempted, "Manually escalated by operator"])];
    c.nextAction ||= "Review conversation and contact the customer.";
    c.messages.push({ id: `s${c.messages.length}`, role: "system", text: `Escalated to human queue${reason ? `: ${reason}` : ""}. Full context attached.`, at: new Date().toISOString() });
    logActivity(s, { kind: "escalation", text: `${c.channel === "voice" ? "Call" : "Conversation"} escalated manually: ${c.intent.replace(/_/g, " ")}`, href: `/dashboard/conversations?id=${c.id}` });
    return c;
  });
  return conv ? Response.json({ conversation: conv }) : Response.json({ error: "Conversation not found" }, { status: 404 });
}

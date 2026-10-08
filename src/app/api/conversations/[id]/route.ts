import type { NextRequest } from "next/server";
import { z } from "zod";
import { db, logActivity, mutate } from "@/lib/store";

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/conversations/[id]">) {
  const { id } = await ctx.params;
  const s = db();
  const conv = s.conversations.find((c) => c.id === id);
  if (!conv) return Response.json({ error: "Conversation not found" }, { status: 404 });
  return Response.json({ conversation: conv, customer: s.customers.find((c) => c.id === conv.customerId) ?? null });
}

const Patch = z.object({
  status: z.enum(["ai_resolved", "escalated", "open", "human_resolved"]).optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  assignee: z.string().max(80).nullable().optional(),
  note: z.string().min(1).max(2000).optional(),
  reply: z.string().min(1).max(2000).optional(),
  durationSec: z.number().int().min(0).max(36000).optional(),
});

export async function PATCH(req: NextRequest, ctx: RouteContext<"/api/conversations/[id]">) {
  const { id } = await ctx.params;
  const parsed = Patch.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid update", issues: parsed.error.issues }, { status: 400 });
  const p = parsed.data;
  const out = mutate((s) => {
    const c = s.conversations.find((x) => x.id === id);
    if (!c) return null;
    const now = new Date().toISOString();
    if (p.status) c.status = p.status;
    if (p.priority) c.priority = p.priority;
    if (p.assignee !== undefined) {
      c.assignee = p.assignee ?? undefined;
      if (p.assignee) logActivity(s, { kind: "escalation", text: `${p.assignee} assigned to ${c.intent.replace(/_/g, " ")} conversation`, href: `/dashboard/conversations?id=${c.id}` });
    }
    if (p.note) c.notes.push({ author: "Demo Admin", text: p.note, at: now });
    if (p.reply) c.messages.push({ id: `h${c.messages.length}`, role: "human", text: p.reply, at: now });
    if (p.durationSec !== undefined) c.durationSec = p.durationSec;
    if (p.status === "human_resolved") logActivity(s, { kind: "conversation", text: `Escalation resolved by ${c.assignee ?? "human agent"}`, href: `/dashboard/conversations?id=${c.id}` });
    return c;
  });
  return out ? Response.json({ conversation: out }) : Response.json({ error: "Conversation not found" }, { status: 404 });
}

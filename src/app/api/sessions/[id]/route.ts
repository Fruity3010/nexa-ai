import type { NextRequest } from "next/server";
import { sessionDetail } from "@/lib/analytics";

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/sessions/[id]">) {
  const { id } = await ctx.params;
  const events = sessionDetail(id);
  return events.length ? Response.json({ id, events }) : Response.json({ error: "Session not found" }, { status: 404 });
}

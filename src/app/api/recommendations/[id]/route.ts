import type { NextRequest } from "next/server";
import { z } from "zod";
import { logActivity, mutate } from "@/lib/store";

const Patch = z.object({
  status: z.enum(["New", "Accepted", "In Progress", "Implemented", "Dismissed"]).optional(),
  owner: z.string().min(1).max(80).optional(),
});

export async function PATCH(req: NextRequest, ctx: RouteContext<"/api/recommendations/[id]">) {
  const { id } = await ctx.params;
  const parsed = Patch.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid update" }, { status: 400 });
  const rec = mutate((s) => {
    const r = s.recommendations.find((x) => x.id === id);
    if (!r) return null;
    Object.assign(r, parsed.data, { updatedAt: new Date().toISOString() });
    logActivity(s, { kind: "recommendation", text: `"${r.title}" ${parsed.data.status ? `→ ${parsed.data.status}` : `assigned to ${r.owner}`}`, href: `/dashboard/recommendations?id=${r.id}` });
    return r;
  });
  return rec ? Response.json({ recommendation: rec }) : Response.json({ error: "Recommendation not found" }, { status: 404 });
}

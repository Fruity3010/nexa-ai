import { z } from "zod";
import { logActivity, mutate, uid } from "@/lib/store";
import type { Campaign } from "@/lib/types";

const Body = z.object({
  question: z.string().trim().min(8).max(300),
  objective: z.string().trim().max(500).default(""),
  segment: z.string().trim().max(200).default("All customers"),
  channel: z.enum(["web_chat", "voice", "whatsapp", "email"]).default("web_chat"),
  targetParticipants: z.number().int().min(1).max(500).default(10),
  language: z.string().max(40).default("English"),
  lengthMin: z.number().int().min(2).max(30).default(5),
  consentText: z.string().trim().min(10).max(1000),
  retentionDays: z.number().int().min(1).max(730).default(180),
});

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid campaign", issues: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) }, { status: 400 });
  const campaign: Campaign = { ...parsed.data, id: uid("camp"), status: "running", createdAt: new Date().toISOString(), interviews: [], source: "user" };
  mutate((s) => {
    s.campaigns.unshift(campaign);
    logActivity(s, { kind: "research", text: `Research campaign launched: "${campaign.question}"`, href: `/dashboard/research?campaign=${campaign.id}` });
  });
  return Response.json({ campaign }, { status: 201 });
}

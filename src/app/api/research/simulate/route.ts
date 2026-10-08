import { z } from "zod";
import { PERSONAS, ResearchInterviewerService } from "@/lib/ai/research";
import { db, logActivity, mutate, uid } from "@/lib/store";
import type { Interview } from "@/lib/types";

const Body = z.object({ campaignId: z.string(), count: z.number().int().min(1).max(6).default(6) });

/**
 * Runs the interviewer against scripted synthetic personas so a campaign has results to analyse.
 * Persona answers are fixed scripts; the questions come from the real interviewer engine.
 */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });
  const c = db().campaigns.find((x) => x.id === parsed.data.campaignId);
  if (!c) return Response.json({ error: "Campaign not found" }, { status: 404 });
  const created: Interview[] = [];
  const offset = c.interviews.filter((i) => i.source === "simulator").length;
  for (let k = 0; k < parsed.data.count; k++) {
    const persona = PERSONAS[(offset + k) % PERSONAS.length];
    const iv: Interview = {
      id: uid("int"), participant: `Synthetic participant S${offset + k + 1}`, segment: persona.segment, status: "in_progress",
      consent: false, turns: [], themes: [], sentiment: "neutral", startedAt: new Date().toISOString(), source: "simulator",
    };
    let out = await ResearchInterviewerService.next(c, iv, { answer: "yes" });
    for (let i = 0; !out.done; i++) {
      out = await ResearchInterviewerService.next(c, iv, i < persona.answers.length ? { answer: persona.answers[i] } : { end: true });
    }
    created.push(iv);
  }
  mutate((s) => {
    c.interviews.push(...created);
    if (c.interviews.filter((i) => i.status === "completed").length >= c.targetParticipants) c.status = "completed";
    logActivity(s, { kind: "research", text: `${created.length} synthetic interviews completed for "${c.question}"`, href: `/dashboard/research?campaign=${c.id}` });
  });
  return Response.json({ interviews: created });
}

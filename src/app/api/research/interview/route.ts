import { z } from "zod";
import { intro, ResearchInterviewerService } from "@/lib/ai/research";
import { db, mutate, uid } from "@/lib/store";
import type { Interview } from "@/lib/types";

const Body = z.object({
  campaignId: z.string(),
  interviewId: z.string().optional(),
  action: z.enum(["start", "answer", "skip", "end"]),
  answer: z.string().trim().max(2000).optional(),
});

/** Interactive interview: the dashboard user plays the participant. */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });
  const { campaignId, interviewId, action, answer } = parsed.data;
  const s = db();
  const c = s.campaigns.find((x) => x.id === campaignId);
  if (!c) return Response.json({ error: "Campaign not found" }, { status: 404 });

  if (action === "start") {
    const iv: Interview = {
      id: uid("int"), participant: `Live participant L${c.interviews.filter((i) => i.source === "user").length + 1}`, segment: "Repeat buyer",
      status: "in_progress", consent: false, turns: [], themes: [], sentiment: "neutral", startedAt: new Date().toISOString(), source: "user",
    };
    mutate(() => { c.interviews.push(iv); });
    return Response.json({ interview: iv, messages: intro(c, s.settings.agent.name), done: false });
  }
  const iv = c.interviews.find((i) => i.id === interviewId);
  if (!iv || iv.status !== "in_progress") return Response.json({ error: "Interview not active" }, { status: 409 });
  if (action === "answer" && !answer) return Response.json({ error: "answer is required" }, { status: 400 });
  const out = await ResearchInterviewerService.next(c, iv, { answer, skip: action === "skip", end: action === "end" });
  mutate(() => { if (c.interviews.filter((i) => i.status === "completed").length >= c.targetParticipants) c.status = "completed"; });
  return Response.json({ interview: iv, messages: [out.message], done: out.done, engine: out.engine });
}

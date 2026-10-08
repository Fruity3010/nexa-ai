import { z } from "zod";
import { getPreset } from "@/lib/presets";
import { pruneEvents } from "@/lib/ingest";
import { logActivity, mutate } from "@/lib/store";

const KB = z.object({ id: z.string().max(60), title: z.string().min(1).max(120), body: z.string().min(1).max(2000), tags: z.array(z.string().max(40)).max(30) });
const Patch = z.object({
  preset: z.enum(["ecommerce", "banking", "hospitality", "telecom", "saas"]).optional(),
  org: z.object({ name: z.string().min(1).max(80) }).optional(),
  agent: z.object({
    name: z.string().min(1).max(40), personality: z.string().max(500), languages: z.array(z.string().max(40)).max(10),
    greeting: z.string().min(1).max(300), policies: z.string().max(4000), escalationRules: z.array(z.string().max(200)).max(20),
    businessHours: z.string().max(200), intents: z.array(z.object({ id: z.string(), label: z.string(), canResolve: z.boolean() })).max(30),
  }).partial().optional(),
  kb: z.array(KB).max(100).optional(),
  guardrails: z.object({ neverInventPolicy: z.boolean(), redactPII: z.boolean(), maxAutoRefundNGN: z.number().min(0) }).partial().optional(),
  retentionDays: z.object({ conversations: z.number().int().min(1).max(3650), webEvents: z.number().int().min(1).max(3650), research: z.number().int().min(1).max(3650) }).partial().optional(),
  privacy: z.object({ requireConsent: z.boolean(), respectDoNotTrack: z.boolean(), anonymizeIP: z.boolean() }).partial().optional(),
  roles: z.array(z.object({ name: z.string().max(80), email: z.string().max(120), role: z.enum(["Admin", "Analyst", "Support Agent", "Viewer"]) })).max(50).optional(),
  sdk: z.object({
    projectName: z.string().min(1).max(80),
    allowedDomains: z.array(z.string().regex(/^(\*\.)?[a-z0-9.-]+$/i)).max(20),
    autoTrack: z.object({ pageViews: z.boolean(), errors: z.boolean(), rageClicks: z.boolean(), forms: z.boolean() }),
  }).partial().optional(),
  demoIntegrations: z.array(z.string().max(40)).max(20).optional(),
  voiceNumber: z.string().max(30).optional(),
  voice: z.object({ voiceName: z.enum(["Kore", "Aoede", "Leda", "Zephyr", "Puck", "Charon", "Fenrir", "Orus"]), callbackMessage: z.string().min(1).max(300) }).partial().optional(),
});

export async function PATCH(req: Request) {
  const parsed = Patch.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid settings", issues: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) }, { status: 400 });
  const { preset, ...p } = parsed.data;
  const settings = mutate((s) => {
    const st = s.settings;
    if (preset) {
      const pr = getPreset(preset);
      Object.assign(st, { terms: pr.terms, agent: structuredClone(pr.agent), kb: structuredClone(pr.kb), scenarios: [...pr.scenarios] });
      st.org.industry = pr.id;
      logActivity(s, { kind: "settings", text: `Industry preset switched to ${pr.label}` });
    }
    if (p.org) st.org.name = p.org.name;
    if (p.agent) Object.assign(st.agent, p.agent);
    if (p.kb) st.kb = p.kb;
    if (p.guardrails) Object.assign(st.guardrails, p.guardrails);
    if (p.retentionDays) {
      Object.assign(st.retentionDays, p.retentionDays);
      s.events = pruneEvents(s.events, st.retentionDays.webEvents);
    }
    if (p.privacy) Object.assign(st.privacy, p.privacy);
    if (p.roles) st.roles = p.roles;
    if (p.sdk) Object.assign(st.sdk, p.sdk);
    if (p.demoIntegrations) st.demoIntegrations = p.demoIntegrations;
    if (p.voiceNumber !== undefined) st.voiceNumber = p.voiceNumber;
    if (p.voice) Object.assign(st.voice, p.voice);
    return st;
  });
  return Response.json({ settings });
}

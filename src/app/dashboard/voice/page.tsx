"use client";
import { AlertTriangle, AudioLines, Bot, Copy, Phone, PhoneIncoming, Radio } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ConversationDetail } from "@/components/conversation-view";
import { PageSkeleton } from "@/components/loading";
import { useNexa } from "@/components/nexa-context";
import { CallSimulator } from "@/components/support/call-simulator";
import { Badge, Button, Card, DemoTag, Drawer, Empty, PageHeader, ago, label, sentimentTone, type Tone } from "@/components/ui";
import { fmtDuration, outcomeMeta, ProviderBadge } from "@/components/voice/call-record";

const MODE: Record<string, { label: string; tone: Tone; detail: string }> = {
  streaming: { label: "Live · real-time streaming", tone: "green", detail: "Twilio Media Streams ⇄ Gemini Live: full-duplex audio with barge-in." },
  "turn-based": { label: "Live · turn-based", tone: "amber", detail: "Twilio speech recognition → Nexa agent → Twilio text-to-speech. Not full duplex: the caller and agent take turns." },
  "not-configured": { label: "Demo mode · live telephony not configured", tone: "slate", detail: "No real phone calls can reach Nexa. Use the simulator below." },
};

function Stat({ icon: Icon, title, value, sub, tone }: { icon: typeof Radio; title: string; value: string; sub: string; tone: Tone }) {
  const dot: Record<string, string> = { green: "bg-emerald-500", amber: "bg-amber-500", red: "bg-red-500", slate: "bg-slate-300" };
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="flex items-center gap-1.5 text-xs font-medium text-slate-500"><Icon size={14} />{title}</p>
      <p className="mt-1.5 flex items-center gap-2 font-semibold"><span className={`h-2 w-2 shrink-0 rounded-full ${dot[tone] ?? dot.slate}`} />{value}</p>
      <p className="mt-0.5 text-xs text-slate-500">{sub}</p>
    </div>
  );
}

export default function LiveVoice() {
  const { state, toast } = useNexa();
  const params = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const open = params.get("call");
  if (!state) return <PageSkeleton />;

  const v = state.voice;
  const mode = MODE[v.mode];
  const calls = state.conversations.filter((c) => c.channel === "voice");
  const active = calls.filter((c) => c.call?.status === "active");
  const recent = calls.slice(0, 25);
  const issues = Object.entries(calls.flatMap((c) => c.call?.intelligence?.issues ?? []).reduce<Record<string, number>>((m, i) => ({ ...m, [i]: (m[i] ?? 0) + 1 }), {})).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const setOpen = (id: string | null) => router.replace(id ? `${path}?call=${id}` : path, { scroll: false });
  const copy = (t: string) => navigator.clipboard.writeText(t).then(() => toast("Copied"));
  const urlRow = (name: string, value: string | null, note: string) => (
    <div>
      <p className="text-xs font-medium text-slate-700">{name}</p>
      <div className="mt-1 flex gap-2">
        <code className="min-w-0 flex-1 truncate rounded bg-slate-100 px-2 py-1.5 text-xs">{value ?? "Set NEXA_PUBLIC_URL to generate this"}</code>
        {value && <Button size="sm" onClick={() => copy(value)} aria-label={`Copy ${name}`}><Copy size={13} /></Button>}
      </div>
      <p className="mt-0.5 text-xs text-slate-500">{note}</p>
    </div>
  );

  return (
    <div>
      <PageHeader title="Live Voice" description={<span className="flex flex-wrap items-center gap-2">Phone calls answered by the {state.settings.agent.name} AI agent. <Badge tone={mode.tone}>{mode.label}</Badge></span>} />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={Bot} title="Voice agent" value={v.mode === "not-configured" ? "Simulator only" : `${state.settings.agent.name} answering`} sub={mode.detail} tone={mode.tone} />
        <Stat icon={PhoneIncoming} title="Twilio" value={v.missingTelephony.length ? "Not connected" : "Connected"} sub={v.missingTelephony.length ? `Missing: ${v.missingTelephony.join(", ")}` : "Webhooks verified by X-Twilio-Signature"} tone={v.missingTelephony.length ? (v.missingTelephony.length < 3 ? "amber" : "slate") : "green"} />
        <Stat icon={AudioLines} title="Gemini Live" value={v.missingStreaming.length ? (v.geminiConfigured ? "Needs configuration" : "Not configured") : "Configured"} sub={v.missingStreaming.length ? `Missing: ${v.missingStreaming.join(", ")}` : `${v.liveModel} via voice bridge (npm run voice)`} tone={v.missingStreaming.length ? (v.geminiConfigured ? "amber" : "slate") : "green"} />
        <Stat icon={Phone} title="Phone number" value={v.phoneNumber ?? "Not provisioned"} sub={v.phoneNumber ? "From TWILIO_PHONE_NUMBER" : "Buy a voice number in Twilio, then set TWILIO_PHONE_NUMBER"} tone={v.phoneNumber ? "green" : "slate"} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2" title={<span className="flex items-center gap-2">Active calls {active.length > 0 && <span className="h-2 w-2 animate-pulse rounded-full bg-red-600" />}</span>} subtitle="Transcript segments stream in while the call is live">
          {active.length === 0 ? <Empty title="No calls in progress" body={v.mode === "not-configured" ? "Live telephony isn't configured, so only simulated calls are possible." : `Call ${v.phoneNumber} to talk to the agent.`} /> : (
            <ul className="divide-y divide-slate-100">
              {active.map((c) => (
                <li key={c.id}><button onClick={() => setOpen(c.id)} className="flex w-full items-center gap-2 py-2 text-left text-sm hover:bg-slate-50">
                  <Radio size={14} className="text-red-600" />
                  <span className="flex-1">{c.call!.from} · {label(c.intent)}</span>
                  <ProviderBadge call={c.call} />
                  <span className="text-xs text-slate-500">started {ago(c.startedAt)}</span>
                </button></li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Issues raised on calls" subtitle="From post-call analysis, feeding cross-channel insights">
          {issues.length === 0 ? <p className="text-sm text-slate-500">Appears after analysed calls.</p> : (
            <ul className="space-y-1.5 text-sm">{issues.map(([k, n]) => <li key={k} className="flex justify-between"><span>{label(k)}</span><span className="tabular-nums text-slate-500">{n}</span></li>)}</ul>
          )}
          <Link href="/dashboard/intelligence" className="mt-3 block text-xs text-violet-700 hover:underline">See cross-channel insights →</Link>
        </Card>
      </div>

      <Card className="mt-4" title="Recent calls" subtitle="Real Twilio calls, simulated calls and seeded demo records are labelled separately">
        {recent.length === 0 ? <Empty title="No calls yet" /> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="text-xs text-slate-500"><tr>{["When", "Caller", "Source", "Duration", "Intent", "Sentiment", "Outcome", "Escalation"].map((h) => <th key={h} className="py-2 pr-3 font-medium">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-slate-100">
                {recent.map((c) => {
                  const o = c.call ? outcomeMeta(c.call) : { label: c.status === "ai_resolved" ? "Resolved" : c.status === "open" ? "Open" : "Escalated", tone: "slate" as Tone };
                  return (
                    <tr key={c.id} onClick={() => setOpen(c.id)} className="cursor-pointer hover:bg-slate-50">
                      <td className="py-2 pr-3 text-xs text-slate-500">{ago(c.startedAt)}</td>
                      <td className="py-2 pr-3">{c.call?.from ?? c.customer}</td>
                      <td className="py-2 pr-3">{c.call ? <ProviderBadge call={c.call} /> : <DemoTag />}</td>
                      <td className="py-2 pr-3 tabular-nums">{c.call?.status === "active" ? "Live" : fmtDuration(c.durationSec)}</td>
                      <td className="py-2 pr-3">{label(c.intent)}</td>
                      <td className="py-2 pr-3"><Badge tone={sentimentTone(c.sentiment)}>{label(c.call?.intelligence?.sentiment ?? c.sentiment)}</Badge></td>
                      <td className="py-2 pr-3"><Badge tone={o.tone}>{o.label}</Badge></td>
                      <td className="py-2 pr-3 text-xs">{c.call?.handoff ? (c.call.handoff.transfer === "dialing" ? "Transferred" : "Callback") : c.status === "escalated" || c.status === "human_resolved" ? "Escalated" : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {v.demoMode && <div className="mt-4"><CallSimulator /></div>}

      <Card className="mt-4" title="Telephony setup" subtitle="Configure these on your Twilio number. Full steps: README → Live phone calls">
        {v.mode === "not-configured" && (
          <p className="mb-3 flex items-start gap-2 rounded-md bg-amber-50 p-2.5 text-xs text-amber-900"><AlertTriangle size={14} className="mt-0.5 shrink-0" />Live telephony is not configured. Missing server env vars: {v.missingTelephony.join(", ")}. Credentials are read on the server only and never sent to this page.</p>
        )}
        <div className="grid gap-4 md:grid-cols-3">
          {urlRow("A call comes in → Webhook (HTTP POST)", v.webhookUrl, "Phone Numbers → your number → Voice configuration")}
          {urlRow("Call status changes (HTTP POST)", v.statusCallbackUrl, "Same page. Finalises calls the caller drops.")}
          {urlRow("Media stream (set automatically)", v.streamUrl, "Served by the voice bridge; Nexa returns it in TwiML.")}
        </div>
        <p className="mt-3 text-xs text-slate-500">Human handoff: {v.handoffConfigured ? "escalated calls are transferred to VOICE_HUMAN_HANDOFF_NUMBER." : "no transfer line configured, so escalated callers are told to expect a callback (set VOICE_HUMAN_HANDOFF_NUMBER to enable transfers)."} Calls are not recorded; audio is processed in memory and only transcripts are stored, for {state.settings.retentionDays.conversations} days.</p>
      </Card>

      <Drawer open={!!open} onClose={() => setOpen(null)} wide title={open ? `Call ${open}` : ""}>{open && <ConversationDetail id={open} />}</Drawer>
    </div>
  );
}

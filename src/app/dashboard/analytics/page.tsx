"use client";
import { MousePointerClick, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { FunnelBars, Spark } from "@/components/charts";
import { PageSkeleton } from "@/components/loading";
import { useNexa } from "@/components/nexa-context";
import { ago, Badge, Card, DemoTag, Drawer, Empty, fmtNum, fmtTime, label, PageHeader, Skeleton } from "@/components/ui";
import type { WebEvent } from "@/lib/types";

function SessionTimeline({ id }: { id: string }) {
  const [events, setEvents] = useState<WebEvent[] | null>(null);
  useEffect(() => { fetch(`/api/sessions/${id}`).then((r) => r.json()).then((d) => setEvents(d.events ?? [])); }, [id]);
  if (!events) return <Skeleton className="h-40" />;
  if (!events.length) return <p className="text-sm text-slate-500">Session not found.</p>;
  const issue = (n: string) => ["rage_click", "js_error", "form_abandon"].includes(n);
  return (
    <div>
      <p className="mb-3 flex flex-wrap gap-1.5 text-xs">{events[0].origin === "sdk" ? <Badge tone="green">Received via SDK from {events[0].host}</Badge> : <DemoTag />}<Badge>Anonymous session</Badge><Badge>{events.length} events</Badge></p>
      <ol className="relative space-y-3 border-l border-slate-200 pl-4">
        {events.map((e) => (
          <li key={e.id} className="relative">
            <span className={`absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full ${issue(e.name) ? "bg-red-500" : e.name === "purchase_completed" ? "bg-emerald-500" : "bg-violet-500"}`} />
            <p className="text-sm font-medium text-slate-900">{label(e.name)} <span className="font-normal text-slate-500">{e.path}</span></p>
            <p className="text-xs text-slate-500">{fmtTime(e.at)}{e.props && Object.keys(e.props).length > 0 && ` · ${Object.entries(e.props).map(([k, v]) => `${k}: ${v}`).join(", ")}`}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}

export default function Analytics() {
  const { state, days } = useNexa();
  const params = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const setParam = (k: string, v: string | null) => {
    const p = new URLSearchParams(params.toString());
    if (v) p.set(k, v); else p.delete(k);
    router.replace(`${path}?${p.toString()}`, { scroll: false });
  };
  if (!state) return <PageSkeleton />;
  const w = state.web;
  const step = params.get("step") ?? "delivery_fee_viewed";
  const stepInfo = w.funnel.find((f) => f.step === step);
  const detail = w.steps[step];
  const next = w.funnel[w.funnel.findIndex((f) => f.step === step) + 1];
  const related = state.insights.filter((i) => i.funnelStep === step || (step === "delivery_fee_viewed" && i.id === "ins-delivery-fee"));
  const session = params.get("session");
  const tiles = [
    ["Page views", fmtNum(w.pageViews)], ["Sessions", fmtNum(w.sessions)], ["Checkout abandonment", `${w.checkoutAbandonmentPct}%`],
    ["Form abandonment", `${w.formAbandonmentPct}%`], ["JavaScript errors", fmtNum(w.errors.reduce((s, e) => s + e.count, 0))], ["Rage clicks", fmtNum(w.rageClicks.reduce((s, e) => s + e.count, 0))],
  ];

  return (
    <div>
      <PageHeader title="Website Analytics" description={<>Consented, privacy-minimised journey events from the Nexa Website SDK. Last {days} days. <DemoTag label="Seeded demo events + live SDK events" /></>} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {tiles.map(([t, v]) => <div key={t} className="rounded-lg border border-slate-200 bg-white p-4"><p className="text-xs font-medium text-slate-500">{t}</p><p className="mt-1.5 text-2xl font-semibold tabular-nums">{v}</p></div>)}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title="Checkout funnel" subtitle="Click a step to inspect it">
          <FunnelBars steps={w.funnel} selected={step} onSelect={(s) => setParam("step", s)} />
        </Card>
        <Card title={`Step: ${stepInfo?.label}`} subtitle={next ? `${detail.stopped} sessions reached this step but not ${next.label}` : `${detail.stopped} sessions completed`}>
          {next && (
            <>
              <p className="mb-2 text-xs font-medium text-slate-500">What those sessions did next</p>
              <ul className="space-y-1.5">
                {detail.behaviours.map((b) => (
                  <li key={b.label} className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate text-slate-700">{b.label}</span>
                    <span className="shrink-0 tabular-nums text-slate-500">{b.count} ({detail.stopped ? Math.round((b.count / detail.stopped) * 100) : 0}%)</span>
                  </li>
                ))}
              </ul>
            </>
          )}
          {related.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-xs font-medium text-slate-500">Related issues</p>
              {related.map((i) => <Link key={i.id} href={`/dashboard/intelligence?insight=${i.id}`} className="block rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900 hover:bg-red-100">{i.title} →</Link>)}
              {step === "delivery_fee_viewed" && <Link href="/dashboard/conversations?topic=delivery_fee_surprise" className="block text-xs text-violet-700 hover:underline">See support conversations about delivery fees →</Link>}
            </div>
          )}
          {detail.sampleSessions.length > 0 && (
            <div className="mt-4">
              <p className="mb-1 text-xs font-medium text-slate-500">Sample sessions</p>
              <div className="flex flex-wrap gap-1.5">{detail.sampleSessions.map((s) => <button key={s} onClick={() => setParam("session", s)} className="rounded border border-slate-200 px-2 py-0.5 font-mono text-[11px] text-slate-600 hover:border-violet-300">{s}</button>)}</div>
            </div>
          )}
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2" title="Sessions per day"><Spark data={w.daily} dataKey="sessions" height={180} /></Card>
        <Card title="Feature engagement" subtitle="Share of checkout sessions">
          {w.features.length === 0 ? <Empty title="No feature events" /> : (
            <ul className="space-y-2 text-sm">{w.features.map((f) => <li key={f.key} className="flex justify-between"><span>{label(f.key)}</span><span className="tabular-nums text-slate-600">{f.count} uses · {f.sharePct}%</span></li>)}</ul>
          )}
          <p className="mt-3 text-xs text-slate-500">Tracked with <code>Nexa.feature(&quot;express_checkout&quot;)</code>.</p>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title="Rage clicks" subtitle="3+ rapid clicks on the same element">
          {w.rageClicks.length === 0 ? <Empty icon={<MousePointerClick size={24} />} title="No rage clicks" /> : (
            <table className="w-full text-sm"><tbody className="divide-y divide-slate-100">
              {w.rageClicks.map((r) => <tr key={r.key}><td className="py-2"><code className="text-xs">{r.key}</code></td><td className="text-right tabular-nums">{r.count}</td><td className="text-right text-xs text-slate-500">{r.sessions} sessions</td><td className="text-right">{r.sampleSession && <button onClick={() => setParam("session", r.sampleSession!)} className="text-xs text-violet-700 hover:underline">Session</button>}</td></tr>)}
            </tbody></table>
          )}
        </Card>
        <Card title="JavaScript errors" subtitle="Messages scrubbed of emails and long numbers by the SDK">
          {w.errors.length === 0 ? <Empty title="No errors" /> : (
            <table className="w-full text-sm"><tbody className="divide-y divide-slate-100">
              {w.errors.map((e) => <tr key={e.key}><td className="py-2 pr-2"><p className="text-xs">{e.key}</p><p className="text-[11px] text-slate-500">{e.path} · last {ago(e.lastAt)}</p></td><td className="text-right tabular-nums">{e.count}</td><td className="text-right">{e.sampleSession && <button onClick={() => setParam("session", e.sampleSession!)} className="text-xs text-violet-700 hover:underline">Session</button>}</td></tr>)}
            </tbody></table>
          )}
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2" title="Recent sessions" subtitle="Click for the event timeline">
          <ul className="divide-y divide-slate-100">
            {w.recentSessions.slice(0, 15).map((s) => (
              <li key={s.id}><button onClick={() => setParam("session", s.id)} className="flex w-full flex-wrap items-center gap-2 py-2 text-left text-sm hover:bg-slate-50">
                <code className="text-xs text-slate-500">{s.id}</code>
                <span className="text-slate-700">{s.lastStep}</span>
                {s.converted && <Badge tone="green">Purchased</Badge>}
                {s.issues > 0 && <Badge tone="red">{s.issues} friction</Badge>}
                {s.origin === "sdk" && <Badge tone="green">SDK</Badge>}
                <span className="ml-auto text-xs text-slate-400">{s.events} events · {ago(s.startedAt)}</span>
              </button></li>
            ))}
          </ul>
        </Card>
        <Card title={<span className="flex items-center gap-1.5"><ShieldCheck size={15} className="text-emerald-600" />Privacy by design</span>}>
          <ul className="list-disc space-y-1.5 pl-4 text-sm text-slate-600">
            <li>Nothing is sent until the visitor grants consent{state.settings.privacy.requireConsent ? " (required)" : ""}.</li>
            <li>No form values, keystrokes, passwords or card fields. Forms report start/submit only.</li>
            <li>URLs are reduced to the path; query strings and identifier-like segments are dropped.</li>
            <li>Anonymous per-tab session IDs; no fingerprinting, no cross-site identifiers.</li>
            <li>Events are deleted after {state.settings.retentionDays.webEvents} days.</li>
          </ul>
          <Link href="/dashboard/settings" className="mt-3 inline-block text-xs text-violet-700 hover:underline">Privacy & retention settings →</Link>
        </Card>
      </div>
      <Drawer open={!!session} onClose={() => setParam("session", null)} title={`Session ${session}`}>{session && <SessionTimeline id={session} />}</Drawer>
    </div>
  );
}

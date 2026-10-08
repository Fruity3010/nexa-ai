"use client";
import { ArrowDownRight, ArrowUpRight, Bot, Clock, MessagesSquare, Smile, TrendingUp, UserRoundCog } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CHANNEL_COLOR, Donut, FunnelBars, HBar, SentimentBar, TrendLines, VolumeChart } from "@/components/charts";
import { InsightDrawer, SeverityBadge } from "@/components/insight-drawer";
import { PageSkeleton } from "@/components/loading";
import { useNexa } from "@/components/nexa-context";
import { ago, Badge, Button, Card, cx, DemoTag, fmtNum, label, PageHeader } from "@/components/ui";

function Kpi({ icon: Icon, title, value, delta, goodWhenUp = true, suffix = "" }: { icon: typeof Bot; title: string; value: string; delta: number; goodWhenUp?: boolean; suffix?: string }) {
  const good = delta === 0 ? null : delta > 0 === goodWhenUp;
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500"><Icon size={14} />{title}</div>
      <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-slate-900">{value}</p>
      <p className={cx("mt-1 flex items-center gap-0.5 text-xs", good === null ? "text-slate-500" : good ? "text-emerald-700" : "text-red-700")}>
        {delta >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}{Math.abs(delta)}{suffix} vs previous period
      </p>
    </div>
  );
}

export default function Overview() {
  const { state, days } = useNexa();
  const router = useRouter();
  const [open, setOpen] = useState<string | null>(null);
  if (!state) return <PageSkeleton />;
  const { current: m, previous: p } = state.metrics;
  const d = (a: number, b: number) => Math.round((a - b) * 10) / 10;
  const top = state.insights.find((i) => i.eval.emerging) ?? state.insights[0];
  const insight = state.insights.find((i) => i.id === open) ?? null;

  return (
    <div>
      <PageHeader title="Overview" description={<>What NovaMart&apos;s customers are experiencing across support, research and the website over the last {days} days. <DemoTag /></>}
        actions={<><Button onClick={() => router.push("/dashboard/support")}>Simulate a call</Button><Button variant="primary" onClick={() => setOpen(top.id)}>Inspect top issue</Button></>} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi icon={MessagesSquare} title="Customer interactions" value={fmtNum(m.interactions)} delta={m.interactions - p.interactions} />
        <Kpi icon={Bot} title="AI-resolved" value={`${m.aiResolvedPct}%`} delta={d(m.aiResolvedPct, p.aiResolvedPct)} suffix=" pts" />
        <Kpi icon={UserRoundCog} title="Human escalation rate" value={`${m.escalationPct}%`} delta={d(m.escalationPct, p.escalationPct)} suffix=" pts" goodWhenUp={false} />
        <Kpi icon={Clock} title="Avg first response" value={`${m.avgResponseSec}s`} delta={d(m.avgResponseSec, p.avgResponseSec)} suffix="s" goodWhenUp={false} />
        <Kpi icon={Smile} title="Customer satisfaction" value={`${m.csat}/5`} delta={d(m.csat, p.csat)} />
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500"><TrendingUp size={14} />Top customer issues</div>
          <ol className="mt-2 space-y-1 text-xs">
            {state.insights.slice(0, 3).map((i, k) => (
              <li key={i.id}><button onClick={() => setOpen(i.id)} className="w-full truncate text-left text-slate-700 hover:text-violet-700">{k + 1}. {state.topicLabels[i.topic]} <span className="tabular-nums text-slate-400">({i.periodCount})</span></button></li>
            ))}
          </ol>
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <div className="rounded-lg border-2 border-red-200 bg-white p-5 xl:col-span-1">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-red-700">Top emerging issue</p>
            <SeverityBadge s={top.severity} />
          </div>
          <h2 className="mt-2 font-semibold text-slate-900">{top.title}</h2>
          <p className="mt-2 text-sm text-slate-600">{top.summary}</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {top.eval.emerging && <Badge tone="red">+{top.eval.trendPct}% in 2 weeks</Badge>}
            <Badge>{top.eval.counts.conversations} conversations</Badge>
            <Badge>{top.eval.counts.feedback} reviews</Badge>
            <Badge>{top.eval.counts.interviews} interviews</Badge>
            {top.eval.funnelDropPct !== undefined && <Badge>{state.web.funnel.find((f) => f.step === "payment_started")?.dropPct}% drop after fee</Badge>}
          </div>
          <Button variant="primary" className="mt-4 w-full" onClick={() => setOpen(top.id)}>See the evidence</Button>
        </div>
        <Card className="xl:col-span-2" title="Interaction volume" subtitle="Daily conversations by channel" action={<DemoTag />}>
          <VolumeChart data={state.charts.volume} />
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card title="Support channels" subtitle="Click a channel to filter conversations">
          <Donut data={Object.entries(state.charts.channels).map(([name, value]) => ({ name, value }))} colors={CHANNEL_COLOR} onSelect={(c) => router.push(`/dashboard/conversations?channel=${c}`)} />
        </Card>
        <Card title="Customer sentiment" subtitle="Conversations, reviews and surveys">
          <SentimentBar counts={state.charts.sentiment} />
          <div className="mt-5 space-y-2">
            {state.insights.slice(0, 4).map((i) => (
              <button key={i.id} onClick={() => setOpen(i.id)} className="flex w-full items-center justify-between gap-2 text-left text-xs hover:text-violet-700">
                <span className="truncate text-slate-700">{state.topicLabels[i.topic]}</span>
                <span className="shrink-0 tabular-nums text-slate-500">{i.eval.negativeShare}% negative</span>
              </button>
            ))}
          </div>
        </Card>
        <Card title="Most common intents" subtitle="Click to see conversations">
          <HBar data={state.charts.intents.map((i) => ({ name: i.intent, value: i.n }))} onSelect={(n) => router.push(`/dashboard/conversations?intent=${n}`)} />
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card title="Customer journey friction" subtitle="Website funnel from SDK events" action={<Link href="/dashboard/analytics" className="text-xs text-violet-700 hover:underline">Analytics →</Link>}>
          <FunnelBars steps={state.web.funnel} onSelect={(s) => router.push(`/dashboard/analytics?step=${s}`)} />
        </Card>
        <Card className="lg:col-span-2" title="Recurring issue trends" subtitle="Weekly conversations + feedback per issue">
          <TrendLines data={state.charts.issueTrends} keys={state.charts.trendTopics} names={state.topicLabels} />
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2" title="Insights" subtitle="Click any insight to see why it is happening">
          <ul className="divide-y divide-slate-100">
            {state.insights.map((i) => (
              <li key={i.id}>
                <button onClick={() => setOpen(i.id)} className="flex w-full items-center gap-3 py-2.5 text-left hover:bg-slate-50">
                  <SeverityBadge s={i.severity} />
                  <span className="min-w-0 flex-1 truncate text-sm text-slate-800">{i.title}</span>
                  {i.eval.emerging && <Badge tone="red">Emerging</Badge>}
                  <span className="hidden text-xs text-slate-500 sm:inline">{i.eval.confidence.label} confidence</span>
                </button>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Recent activity">
          <ul className="space-y-3">
            {state.activity.slice(0, 8).map((a) => (
              <li key={a.id} className="text-xs">
                {a.href ? <Link href={a.href} className="text-slate-800 hover:text-violet-700">{a.text}</Link> : <span className="text-slate-800">{a.text}</span>}
                <span className="mt-0.5 block text-slate-400">{label(a.kind)} · {ago(a.at)}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
      <InsightDrawer insight={insight} state={state} onClose={() => setOpen(null)} />
    </div>
  );
}

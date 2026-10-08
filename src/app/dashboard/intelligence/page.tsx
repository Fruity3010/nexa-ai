"use client";
import { BarChart3, FlaskConical, MessageSquare, Search, Star } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { TrendLines } from "@/components/charts";
import { Confidence, InsightDrawer, SeverityBadge } from "@/components/insight-drawer";
import { PageSkeleton } from "@/components/loading";
import { useNexa } from "@/components/nexa-context";
import { ago, Badge, Card, DemoTag, Empty, inputCls, label, PageHeader, sentimentTone } from "@/components/ui";
import type { Topic } from "@/lib/types";

type Signal = { id: string; source: "conversation" | "call" | "feedback" | "interview" | "website"; topic: Topic | "other"; sentiment: string; text: string; at: string; href: string; meta: string };

export default function Intelligence() {
  const { state, days } = useNexa();
  const params = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const [q, setQ] = useState("");
  const setParam = (k: string, v: string | null) => {
    const p = new URLSearchParams(params.toString());
    if (v) p.set(k, v); else p.delete(k);
    router.replace(`${path}?${p.toString()}`, { scroll: false });
  };

  const signals = useMemo<Signal[]>(() => {
    if (!state) return [];
    const out: Signal[] = [];
    for (const c of state.conversations) out.push({ id: c.id, source: c.channel === "voice" ? "call" : "conversation", topic: c.topic, sentiment: c.sentiment, text: c.preview, at: c.startedAt, href: `/dashboard/conversations?id=${c.id}`, meta: `${c.customer} · ${label(c.intent)} · ${label(c.channel)}` });
    for (const f of state.feedback) out.push({ id: f.id, source: "feedback", topic: f.topic, sentiment: f.sentiment, text: f.text, at: f.at, href: `/dashboard/intelligence?topic=${f.topic}&source=feedback`, meta: `${label(f.kind)} · ${f.rating}★` });
    for (const camp of state.campaigns) for (const t of camp.results.themes) for (const qq of t.quotes)
      out.push({ id: `${qq.interviewId}-${t.id}-${qq.text.slice(0, 12)}`, source: "interview", topic: t.topic ?? "other", sentiment: camp.interviews.find((i) => i.id === qq.interviewId)?.sentiment ?? "neutral", text: qq.text, at: camp.interviews.find((i) => i.id === qq.interviewId)?.startedAt ?? camp.createdAt, href: `/dashboard/research?campaign=${camp.id}&interview=${qq.interviewId}`, meta: `${qq.participant} · ${t.label}` });
    for (const r of state.web.rageClicks) out.push({ id: `rage-${r.key}`, source: "website", topic: r.path.includes("delivery") ? "delivery_fee_surprise" : "payment_failure", sentiment: "negative", text: `Rage clicks on ${r.key}: ${r.count} times across ${r.sessions} sessions`, at: r.lastAt, href: `/dashboard/analytics?step=${r.path.includes("delivery") ? "delivery_fee_viewed" : "payment_started"}`, meta: "Website events" });
    for (const e of state.web.errors) out.push({ id: `err-${e.key}`, source: "website", topic: e.path.includes("payment") ? "payment_failure" : "other", sentiment: "negative", text: `JS error "${e.key}" on ${e.path}: ${e.count} times`, at: e.lastAt, href: "/dashboard/analytics", meta: "Website events" });
    const fee = state.web.funnel.find((f) => f.step === "payment_started");
    if (fee) out.push({ id: "funnel-fee", source: "website", topic: "delivery_fee_surprise", sentiment: "negative", text: `${fee.dropPct}% of sessions leave after the delivery fee is shown`, at: state.generatedAt, href: "/dashboard/analytics?step=delivery_fee_viewed", meta: "Funnel analysis" });
    return out.sort((a, b) => b.at.localeCompare(a.at));
  }, [state]);

  if (!state) return <PageSkeleton />;
  const topic = params.get("topic"), source = params.get("source"), sentiment = params.get("sentiment");
  const needle = q.trim().toLowerCase();
  const rows = signals.filter((s) => (!topic || s.topic === topic) && (!source || s.source === source) && (!sentiment || s.sentiment === sentiment) && (!needle || (s.text + s.meta).toLowerCase().includes(needle)));
  const insight = state.insights.find((i) => i.id === params.get("insight")) ?? null;
  const fee = state.insights.find((i) => i.id === "ins-delivery-fee")!;
  const icon = { conversation: MessageSquare, call: MessageSquare, feedback: Star, interview: FlaskConical, website: BarChart3 };

  return (
    <div>
      <PageHeader title="Customer Intelligence" description={<>Support conversations, calls, research, reviews, surveys and consented website events, combined into one picture. Last {days} days. <DemoTag /></>} />

      <Card title="Cross-channel insight: delivery fees" subtitle="Four independent sources point at the same problem" action={<button onClick={() => setParam("insight", fee.id)} className="text-xs font-medium text-violet-700 hover:underline">Why is this happening? →</button>}>
        <div className="grid gap-3 md:grid-cols-4">
          {[
            { icon: MessageSquare, t: "Support", d: `${fee.eval.counts.conversations} conversations ask why the final amount is higher than expected`, href: "/dashboard/conversations?topic=delivery_fee_surprise" },
            { icon: BarChart3, t: "Website", d: `${state.web.funnel.find((f) => f.step === "payment_started")?.dropPct}% of sessions leave after the delivery fee appears`, href: "/dashboard/analytics?step=delivery_fee_viewed" },
            { icon: FlaskConical, t: "Research", d: `${fee.eval.counts.interviews} interviews say delivery cost should be shown earlier`, href: fee.eval.interviews[0] ? `/dashboard/research?campaign=${fee.eval.interviews[0].campaignId}` : "/dashboard/research" },
            { icon: Star, t: "Reviews", d: `${fee.eval.counts.feedback} reviews & surveys mention unexpected delivery costs`, href: "/dashboard/intelligence?topic=delivery_fee_surprise&source=feedback" },
          ].map((x) => (
            <Link key={x.t} href={x.href} className="rounded-md border border-slate-200 p-3 hover:border-violet-300 hover:bg-violet-50/40">
              <p className="flex items-center gap-1.5 text-xs font-medium text-slate-500"><x.icon size={14} />{x.t}</p>
              <p className="mt-1 text-sm text-slate-800">{x.d}</p>
            </Link>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-md bg-violet-50 px-3 py-2 text-sm">
          <span className="text-violet-900"><span className="font-medium">Prioritised recommendation:</span> Show delivery fees earlier in checkout</span>
          <Link href="/dashboard/recommendations?id=rec-1" className="text-xs font-medium text-violet-700 hover:underline">Review recommendation →</Link>
        </div>
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2" title="Insights" subtitle="Ranked by severity and volume">
          <ul className="space-y-2">
            {state.insights.map((i) => (
              <li key={i.id}>
                <button onClick={() => setParam("insight", i.id)} className="w-full rounded-md border border-slate-200 p-3 text-left hover:border-violet-300">
                  <div className="flex flex-wrap items-center gap-2"><SeverityBadge s={i.severity} /><span className="font-medium text-slate-900">{i.title}</span>{i.eval.emerging && <Badge tone="red">Emerging +{i.eval.trendPct}%</Badge>}</div>
                  <p className="mt-1 text-sm text-slate-600">{i.summary}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                    <Confidence score={i.eval.confidence.score} label={i.eval.confidence.label} />
                    <span>{i.eval.counts.conversations} conv · {i.eval.counts.feedback} reviews · {i.eval.counts.interviews} interviews · {i.eval.counts.webEvents} web events</span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Trend analysis" subtitle="Weekly signal volume by issue">
          <TrendLines data={state.charts.issueTrends} keys={state.charts.trendTopics} names={state.topicLabels} />
        </Card>
      </div>

      <Card className="mt-4" title="Intelligence feed" subtitle="Every signal with its source. Click to open the underlying record.">
        <div className="mb-3 flex flex-wrap gap-2">
          <div className="relative min-w-56 flex-1"><Search size={15} className="absolute left-2.5 top-2.5 text-slate-400" /><input className={`${inputCls} pl-8`} placeholder="Search signals…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search signals" /></div>
          <select aria-label="Source" className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm" value={source ?? ""} onChange={(e) => setParam("source", e.target.value || null)}>
            <option value="">All sources</option>{["conversation", "call", "feedback", "interview", "website"].map((s) => <option key={s} value={s}>{label(s)}</option>)}
          </select>
          <select aria-label="Issue" className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm" value={topic ?? ""} onChange={(e) => setParam("topic", e.target.value || null)}>
            <option value="">All issues</option>{Object.entries(state.topicLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select aria-label="Sentiment" className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm" value={sentiment ?? ""} onChange={(e) => setParam("sentiment", e.target.value || null)}>
            <option value="">All sentiment</option>{["positive", "neutral", "negative"].map((s) => <option key={s} value={s}>{label(s)}</option>)}
          </select>
        </div>
        <p className="mb-2 text-xs text-slate-500">{rows.length} signals</p>
        {rows.length === 0 ? <Empty title="No signals match these filters" /> : (
          <ul className="divide-y divide-slate-100">
            {rows.slice(0, 80).map((s) => {
              const I = icon[s.source];
              return (
                <li key={s.id}><Link href={s.href} className="flex items-start gap-3 py-2.5 hover:bg-slate-50">
                  <I size={15} className="mt-0.5 shrink-0 text-slate-400" />
                  <div className="min-w-0 flex-1"><p className="text-sm text-slate-800">{s.text}</p><p className="text-xs text-slate-500">{label(s.source)} · {s.meta}</p></div>
                  <div className="flex shrink-0 flex-col items-end gap-1"><Badge tone={sentimentTone(s.sentiment)}>{s.sentiment}</Badge><span className="text-[11px] text-slate-400">{s.topic !== "other" ? state.topicLabels[s.topic] : ""}</span><span className="text-[11px] text-slate-400">{ago(s.at)}</span></div>
                </Link></li>
              );
            })}
          </ul>
        )}
      </Card>
      <InsightDrawer insight={insight} state={state} onClose={() => setParam("insight", null)} />
    </div>
  );
}

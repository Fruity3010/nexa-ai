"use client";
import { ArrowRight, BarChart3, FlaskConical, Info, MessageSquare, Phone, Star } from "lucide-react";
import Link from "next/link";
import type { NexaState } from "@/lib/analytics";
import { Badge, DemoTag, Drawer, label } from "./ui";

type InsightRow = NexaState["insights"][number];
const sevTone = { critical: "red", high: "amber", medium: "blue", low: "slate" } as const;

export function SeverityBadge({ s }: { s: InsightRow["severity"] }) {
  return <Badge tone={sevTone[s]}>{s[0].toUpperCase() + s.slice(1)}</Badge>;
}

export function Confidence({ score, label: l }: { score: number; label: string }) {
  return (
    <div className="flex items-center gap-2" title="Heuristic: number of independent sources and volume of supporting records">
      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-violet-600" style={{ width: `${score}%` }} /></div>
      <span className="text-xs text-slate-600">{l} confidence ({score}%)</span>
    </div>
  );
}

export function InsightDrawer({ insight, state, onClose }: { insight: InsightRow | null; state: NexaState; onClose: () => void }) {
  if (!insight) return null;
  const e = insight.eval;
  const recs = state.recommendations.filter((r) => insight.recommendationIds.includes(r.id));
  const step = insight.funnelStep ? state.web.funnel.find((f) => f.step === insight.funnelStep) : null;
  const nextStep = step ? state.web.funnel[state.web.funnel.indexOf(step) + 1] : null;
  return (
    <Drawer open onClose={onClose} wide title={<div><p className="text-xs font-medium uppercase tracking-wide text-violet-700">Why is this happening?</p><p className="mt-1">{insight.title}</p></div>}>
      <div className="space-y-6 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <SeverityBadge s={insight.severity} />
          <Badge>{insight.category}</Badge>
          {e.emerging && <Badge tone="red">Emerging: +{e.trendPct}% vs prior 2 weeks</Badge>}
          <Confidence score={e.confidence.score} label={e.confidence.label} />
          <DemoTag />
        </div>
        <p className="text-slate-700">{insight.summary}</p>

        <section>
          <h3 className="mb-2 font-semibold text-slate-900">1. Observed problem <span className="font-normal text-slate-500">(facts in the data)</span></h3>
          <ul className="list-disc space-y-1 pl-5 text-slate-700">{insight.observed.map((o) => <li key={o}>{o}</li>)}</ul>
        </section>

        <section>
          <h3 className="mb-2 font-semibold text-slate-900">2. Supporting evidence <span className="font-normal text-slate-500">({e.counts.conversations + e.counts.feedback + e.counts.interviews + e.counts.webEvents} demo records across {e.confidence.sources} sources)</span></h3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { icon: MessageSquare, n: e.counts.conversations, l: "Support conversations", href: `/dashboard/conversations?topic=${insight.topic}` },
              { icon: Phone, n: e.counts.calls, l: "of which calls", href: `/dashboard/conversations?topic=${insight.topic}&channel=voice` },
              { icon: Star, n: e.counts.feedback, l: "Reviews & surveys", href: `/dashboard/intelligence?topic=${insight.topic}&source=feedback` },
              { icon: FlaskConical, n: e.counts.interviews, l: "Research interviews", href: e.interviews[0] ? `/dashboard/research?campaign=${e.interviews[0].campaignId}` : "/dashboard/research" },
            ].map((x) => (
              <Link key={x.l} href={x.href} className="rounded-md border border-slate-200 p-3 hover:border-violet-300 hover:bg-violet-50/40">
                <x.icon size={15} className="text-slate-400" />
                <p className="mt-1 text-lg font-semibold tabular-nums text-slate-900">{x.n}</p>
                <p className="text-xs text-slate-500">{x.l}</p>
              </Link>
            ))}
          </div>
          {step && (
            <Link href={`/dashboard/analytics?step=${step.step}`} className="mt-2 flex items-center gap-3 rounded-md border border-slate-200 p-3 hover:border-violet-300 hover:bg-violet-50/40">
              <BarChart3 size={18} className="text-slate-400" />
              <div className="flex-1">
                <p className="font-medium text-slate-900">Website: {nextStep ? `${nextStep.dropPct}% of sessions drop between ${step.label} and ${nextStep.label}` : `${step.sessions} sessions reached ${step.label}`}</p>
                <p className="text-xs text-slate-500">{e.counts.webEvents} related website events ({insight.webEventNames.join(", ")}) in the retention window</p>
              </div>
              <ArrowRight size={16} className="text-slate-400" />
            </Link>
          )}
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div>
              <p className="mb-1.5 text-xs font-medium text-slate-500">Conversations</p>
              <ul className="space-y-1.5">
                {e.sampleConversations.map((c) => (
                  <li key={c.id}><Link href={`/dashboard/conversations?id=${c.id}`} className="block rounded border border-slate-100 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-700 hover:border-violet-200">
                    <span className="text-slate-400">{label(c.channel)} · </span>&ldquo;{c.text}&rdquo;</Link></li>
                ))}
              </ul>
            </div>
            <div>
              <p className="mb-1.5 text-xs font-medium text-slate-500">Reviews, surveys & interviews</p>
              <ul className="space-y-1.5">
                {e.sampleFeedback.map((f) => <li key={f.id} className="rounded border border-slate-100 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-700"><span className="text-slate-400">{label(f.kind)} · {f.rating}★ · </span>&ldquo;{f.text}&rdquo;</li>)}
                {e.interviews.map((i) => (
                  <li key={i.interviewId}><Link href={`/dashboard/research?campaign=${i.campaignId}&interview=${i.interviewId}`} className="block rounded border border-slate-100 bg-slate-50 px-2.5 py-1.5 text-xs text-violet-700 hover:border-violet-200">Interview: {i.participant} →</Link></li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section>
          <h3 className="mb-2 font-semibold text-slate-900">3. Likely contributing factors <Badge tone="amber">Hypotheses</Badge></h3>
          <ul className="list-disc space-y-1 pl-5 text-slate-700">{insight.factors.map((f) => <li key={f.text}>{f.text}</li>)}</ul>
          <p className="mt-2 flex items-start gap-1.5 text-xs text-slate-500"><Info size={13} className="mt-0.5 shrink-0" />These signals occur together; that does not prove the factors cause the problem. Validate with an experiment before attributing impact.</p>
        </section>

        <section>
          <h3 className="mb-2 font-semibold text-slate-900">4. Confidence</h3>
          <Confidence score={e.confidence.score} label={e.confidence.label} />
          <p className="mt-1 text-xs text-slate-500">{e.confidence.sources} of 4 source types agree · {e.negativeShare}% negative sentiment · {e.escalationRate}% escalated to humans</p>
        </section>

        <section>
          <h3 className="mb-2 font-semibold text-slate-900">5. Recommended next steps</h3>
          <ul className="list-disc space-y-1 pl-5 text-slate-700">{insight.nextSteps.map((n) => <li key={n}>{n}</li>)}</ul>
          {recs.map((r) => (
            <Link key={r.id} href={`/dashboard/recommendations?id=${r.id}`} className="mt-2 flex items-center justify-between rounded-md border border-violet-200 bg-violet-50 px-3 py-2 text-violet-800 hover:bg-violet-100">
              <span>Recommendation: {r.title}</span><Badge tone="violet">{r.status}</Badge>
            </Link>
          ))}
        </section>

        <section>
          <h3 className="mb-2 font-semibold text-slate-900">6. Evidence that would strengthen this conclusion</h3>
          <ul className="list-disc space-y-1 pl-5 text-slate-700">{insight.moreEvidence.map((n) => <li key={n}>{n}</li>)}</ul>
        </section>
      </div>
    </Drawer>
  );
}

"use client";
import { Check, LineChart, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { ImpactChart } from "@/components/charts";
import { Confidence } from "@/components/insight-drawer";
import { PageSkeleton } from "@/components/loading";
import { useNexa } from "@/components/nexa-context";
import { ago, Badge, Button, Card, Confirm, Drawer, inputCls, PageHeader, type Tone } from "@/components/ui";
import type { RecStatus } from "@/lib/types";

const STATUSES: RecStatus[] = ["New", "Accepted", "In Progress", "Implemented", "Dismissed"];
const statusTone: Record<RecStatus, Tone> = { New: "blue", Accepted: "violet", "In Progress": "amber", Implemented: "green", Dismissed: "slate" };
const OWNERS = ["Product: Checkout", "Product: Catalogue", "Engineering: Payments", "Growth", "Customer Support", "Logistics"];

export default function Recommendations() {
  const { state, api, refresh, toast } = useNexa();
  const params = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const [filter, setFilter] = useState<string>("");
  const [dismiss, setDismiss] = useState<string | null>(null);
  if (!state) return <PageSkeleton />;
  const open = state.recommendations.find((r) => r.id === params.get("id"));
  const setOpen = (id: string | null) => router.replace(id ? `${path}?id=${id}` : path, { scroll: false });

  const update = async (id: string, body: { status?: RecStatus; owner?: string }) => {
    await api(`/api/recommendations/${id}`, body, "PATCH");
    await refresh();
    toast(body.status ? `Marked as ${body.status}` : `Assigned to ${body.owner}`);
  };
  const rows = state.recommendations.filter((r) => !filter || r.status === filter);

  return (
    <div>
      <PageHeader title="Recommendations" description="Prioritised actions generated from cross-channel evidence. Accept, assign and track their impact." />
      <div className="mb-3 flex flex-wrap gap-1.5">
        {["", ...STATUSES].map((s) => (
          <button key={s} onClick={() => setFilter(s)} className={`rounded-full px-3 py-1 text-xs font-medium ${filter === s ? "bg-violet-700 text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>
            {s || "All"} <span className="opacity-70">{s ? state.recommendations.filter((r) => r.status === s).length : state.recommendations.length}</span>
          </button>
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        {rows.map((r) => {
          const ins = state.insights.find((i) => i.id === r.insightId);
          return (
            <Card key={r.id}>
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge tone={r.priority === "P1" ? "red" : r.priority === "P2" ? "amber" : "slate"}>{r.priority}</Badge>
                <Badge tone={statusTone[r.status]}>{r.status}</Badge>
                <span className="ml-auto text-xs text-slate-400">Updated {ago(r.updatedAt)}</span>
              </div>
              <h2 className="mt-2 font-semibold text-slate-900">{r.title}</h2>
              <dl className="mt-2 space-y-2 text-sm">
                <div><dt className="text-xs text-slate-500">Problem</dt><dd className="text-slate-700">{r.problem}</dd></div>
                <div><dt className="text-xs text-slate-500">Recommended action</dt><dd className="text-slate-700">{r.action}</dd></div>
                {ins && <div><dt className="text-xs text-slate-500">Evidence</dt><dd className="text-slate-700">{ins.eval.counts.conversations} conversations · {ins.eval.counts.feedback} reviews · {ins.eval.counts.interviews} interviews · {ins.eval.counts.webEvents} web events <Link href={`/dashboard/intelligence?insight=${ins.id}`} className="text-violet-700 hover:underline">View →</Link></dd></div>}
                <div className="flex flex-wrap gap-x-6 gap-y-2">
                  <div><dt className="text-xs text-slate-500">Estimated impact</dt><dd className="text-slate-700">{r.impact} <span className="text-xs text-slate-500">({r.impactMetric.label} {r.impactMetric.liftPct > 0 ? "+" : ""}{r.impactMetric.liftPct}% est.)</span></dd></div>
                  {ins && <div><dt className="text-xs text-slate-500">Confidence</dt><dd><Confidence score={ins.eval.confidence.score} label={ins.eval.confidence.label} /></dd></div>}
                </div>
              </dl>
              <div className="mt-4 flex flex-wrap items-end gap-2 border-t border-slate-100 pt-3">
                <label className="text-xs text-slate-500">Owner
                  <select className={`${inputCls} mt-1 h-8 w-48 py-0 text-xs`} value={r.owner} onChange={(e) => update(r.id, { owner: e.target.value })}>
                    {[...new Set([r.owner, ...OWNERS])].map((o) => <option key={o}>{o}</option>)}
                  </select>
                </label>
                <label className="text-xs text-slate-500">Status
                  <select className={`${inputCls} mt-1 h-8 w-36 py-0 text-xs`} value={r.status} onChange={(e) => e.target.value === "Dismissed" ? setDismiss(r.id) : update(r.id, { status: e.target.value as RecStatus })}>
                    {STATUSES.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </label>
                <div className="ml-auto flex gap-2">
                  {r.status === "New" && <><Button size="sm" variant="ghost" onClick={() => setDismiss(r.id)}><X size={13} />Dismiss</Button><Button size="sm" variant="primary" onClick={() => update(r.id, { status: "Accepted" })}><Check size={13} />Accept</Button></>}
                  <Button size="sm" onClick={() => setOpen(r.id)}><LineChart size={13} />Impact</Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <Drawer open={!!open} onClose={() => setOpen(null)} title={open ? `Impact tracking: ${open.title}` : ""}>
        {open && (
          <div className="space-y-4 text-sm">
            <div className="flex flex-wrap gap-1.5"><Badge tone={statusTone[open.status]}>{open.status}</Badge><Badge>{open.owner}</Badge><Badge tone="amber">Illustrative projection</Badge></div>
            <div>
              <p className="font-medium text-slate-900">{open.impactMetric.label}</p>
              <p className="text-xs text-slate-500">Solid: weekly baseline measured from the demo dataset. Dashed: illustrative projection assuming a {open.impactMetric.liftPct > 0 ? "+" : ""}{open.impactMetric.liftPct}% effect. This is not a measured or verified result.</p>
            </div>
            <ImpactChart {...open.impactData} />
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-md border border-slate-200 p-3"><p className="text-xs text-slate-500">Baseline (last 3 weeks avg)</p><p className="text-lg font-semibold tabular-nums">{(open.impactData.baseline.slice(-3).reduce((a, b) => a + b, 0) / 3).toFixed(1)}{open.impactData.unit}</p></div>
              <div className="rounded-md border border-violet-200 bg-violet-50 p-3"><p className="text-xs text-violet-700">Illustrative after change</p><p className="text-lg font-semibold tabular-nums text-violet-900">{open.impactData.projected.at(-1)}{open.impactData.unit}</p></div>
            </div>
            <div className="rounded-md bg-slate-50 p-3 text-xs text-slate-600">
              <p className="font-medium text-slate-800">How to verify for real</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-4">
                <li>Ship the change behind a flag to 50% of sessions.</li>
                <li>Compare the metric between groups for at least 2 full weeks.</li>
                <li>Watch support contact rate for the related issue in parallel.</li>
              </ul>
            </div>
            {open.status === "New" && <Button variant="primary" className="w-full" onClick={() => update(open.id, { status: "Accepted" })}><Check size={14} />Accept recommendation</Button>}
            {open.status === "Accepted" && <Button variant="primary" className="w-full" onClick={() => update(open.id, { status: "In Progress" })}>Start work</Button>}
            {open.status === "In Progress" && <Button variant="primary" className="w-full" onClick={() => update(open.id, { status: "Implemented" })}>Mark implemented</Button>}
          </div>
        )}
      </Drawer>
      <Confirm open={!!dismiss} onClose={() => setDismiss(null)} title="Dismiss recommendation?" body="It will move to Dismissed. You can restore it from the status menu." confirmLabel="Dismiss" danger onConfirm={() => dismiss && update(dismiss, { status: "Dismissed" })} />
    </div>
  );
}

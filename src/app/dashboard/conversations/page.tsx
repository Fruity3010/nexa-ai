"use client";
import { Inbox, Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { ConversationDetail } from "@/components/conversation-view";
import { PageSkeleton } from "@/components/loading";
import { useNexa } from "@/components/nexa-context";
import { ago, Badge, Card, DemoTag, Drawer, Empty, inputCls, label, PageHeader, priorityTone, sentimentTone, statusMeta } from "@/components/ui";

const FILTERS = ["channel", "intent", "sentiment", "status", "topic"] as const;

export default function Conversations() {
  const { state, days } = useNexa();
  const params = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const [q, setQ] = useState("");
  const selected = params.get("id");

  const setParam = (k: string, v: string | null) => {
    const p = new URLSearchParams(params.toString());
    if (v) p.set(k, v); else p.delete(k);
    router.replace(`${path}?${p.toString()}`, { scroll: false });
  };

  const rows = useMemo(() => {
    if (!state) return [];
    const needle = q.trim().toLowerCase();
    return state.conversations.filter((c) =>
      FILTERS.every((f) => !params.get(f) || c[f] === params.get(f)) &&
      (!needle || [c.customer, c.preview, c.summary, c.intent, c.assignee ?? ""].some((s) => s.toLowerCase().includes(needle))));
  }, [state, params, q]);

  if (!state) return <PageSkeleton />;
  const opts = (k: (typeof FILTERS)[number]) => [...new Set(state.conversations.map((c) => c[k]))].sort();

  return (
    <div>
      <PageHeader title="Conversations" description={<>Every support conversation and call, with detected signals and outcomes. Last {days} days. <DemoTag /></>} />
      <Card>
        <div className="mb-3 flex flex-wrap gap-2">
          <div className="relative min-w-56 flex-1">
            <Search size={15} className="absolute left-2.5 top-2.5 text-slate-400" />
            <input className={`${inputCls} pl-8`} placeholder="Search customer, message, summary, agent…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search conversations" />
          </div>
          {FILTERS.map((f) => (
            <select key={f} aria-label={`Filter by ${f}`} className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm" value={params.get(f) ?? ""} onChange={(e) => setParam(f, e.target.value || null)}>
              <option value="">All {f === "status" ? "statuses" : `${f}s`}</option>
              {opts(f).map((o) => <option key={o} value={o}>{f === "status" ? statusMeta[o]?.label : f === "topic" ? state.topicLabels[o as keyof typeof state.topicLabels] : label(o)}</option>)}
            </select>
          ))}
        </div>
        <p className="mb-2 text-xs text-slate-500">{rows.length} of {state.conversations.length} conversations</p>
        {rows.length === 0 ? <Empty icon={<Inbox size={28} />} title="No conversations match" body="Try clearing a filter, or widen the date range in the top bar." /> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="border-b border-slate-200 text-xs text-slate-500">
                <tr>{["Customer", "Channel", "Intent", "Sentiment", "Status", "Assigned", "When"].map((h) => <th key={h} className="px-2 py-2 font-medium">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.slice(0, 200).map((c) => (
                  <tr key={c.id} onClick={() => setParam("id", c.id)} className="cursor-pointer hover:bg-slate-50" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && setParam("id", c.id)}>
                    <td className="px-2 py-2.5"><p className="font-medium text-slate-900">{c.customer}</p><p className="max-w-xs truncate text-xs text-slate-500">{c.preview}</p></td>
                    <td className="px-2"><Badge>{label(c.channel)}</Badge></td>
                    <td className="px-2 text-slate-700">{label(c.intent)}</td>
                    <td className="px-2"><Badge tone={sentimentTone(c.sentiment)}>{label(c.sentiment)}</Badge></td>
                    <td className="px-2"><Badge tone={statusMeta[c.status].tone}>{statusMeta[c.status].label}</Badge>{c.status === "escalated" && <Badge tone={priorityTone(c.priority)} className="ml-1">{c.priority}</Badge>}</td>
                    <td className="px-2 text-slate-600">{c.assignee ?? <span className="text-slate-400">—</span>}</td>
                    <td className="whitespace-nowrap px-2 text-xs text-slate-500">{ago(c.startedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > 200 && <p className="mt-2 text-xs text-slate-500">Showing the 200 most recent. Refine filters to see more.</p>}
          </div>
        )}
      </Card>
      <Drawer open={!!selected} onClose={() => setParam("id", null)} wide title={selected ? `Conversation ${selected}` : ""}>
        {selected && <ConversationDetail id={selected} />}
      </Drawer>
    </div>
  );
}

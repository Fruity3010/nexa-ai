"use client";
import { Bot, CheckCircle2, ClipboardList, Headset, StickyNote, User } from "lucide-react";
import { useEffect, useState } from "react";
import type { Conversation, Customer } from "@/lib/types";
import { CallRecord } from "./voice/call-record";
import { useNexa } from "./nexa-context";
import { Badge, Button, cx, DemoTag, Field, fmtTime, inputCls, label, priorityTone, sentimentTone, Skeleton, statusMeta } from "./ui";

const AGENTS = ["Adaeze Okafor", "Tunde Bakare", "Chiamaka Eze", "Ibrahim Musa"];

export function Transcript({ messages, compact }: { messages: Conversation["messages"]; compact?: boolean }) {
  return (
    <ol className="space-y-2.5">
      {messages.map((m) => (
        <li key={m.id + m.at} className={cx("flex gap-2", m.role === "customer" && "flex-row-reverse")}>
          {m.role !== "system" && (
            <span className={cx("mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full", m.role === "customer" ? "bg-slate-200 text-slate-600" : m.role === "human" ? "bg-emerald-100 text-emerald-700" : "bg-violet-100 text-violet-700")}>
              {m.role === "customer" ? <User size={13} /> : m.role === "human" ? <Headset size={13} /> : <Bot size={13} />}
            </span>
          )}
          <div className={cx("max-w-[85%]", m.role === "system" && "mx-auto max-w-full")}>
            <div className={cx("rounded-lg px-3 py-2 text-sm", compact && "text-[13px]",
              m.role === "customer" ? "bg-slate-800 text-white" : m.role === "human" ? "border border-emerald-200 bg-emerald-50 text-slate-800" : m.role === "system" ? "bg-amber-50 text-xs text-amber-800" : "border border-slate-200 bg-white text-slate-800")}>
              {m.text}
            </div>
            <div className={cx("mt-0.5 flex flex-wrap gap-1 text-[10px] text-slate-400", m.role === "customer" && "justify-end")}>
              <span>{m.role === "agent" ? "AI agent" : m.role === "human" ? "Human agent" : m.role === "customer" ? "Customer" : "System"} · {fmtTime(m.at)}</span>
              {m.meta?.intent && m.role === "agent" && <span>· intent: {label(m.meta.intent)}</span>}
              {m.meta?.kb && <span>· KB: {m.meta.kb}</span>}
              {m.meta?.action?.includes("demo") && <Badge tone="amber" className="!text-[10px]">{m.meta.action}</Badge>}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function ConversationDetail({ id, onChange }: { id: string; onChange?: () => void }) {
  const { api, toast, refresh } = useNexa();
  const [data, setData] = useState<{ conversation: Conversation; customer: Customer | null } | null>(null);
  const [note, setNote] = useState("");
  const [reply, setReply] = useState("");
  const [missing, setMissing] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`/api/conversations/${id}`).then((r) => (r.ok ? r.json() : null)).then((d) => {
      if (!alive) return;
      if (d) setData(d); else setMissing(id);
    });
    return () => { alive = false; };
  }, [id]);
  // Live calls: poll so transcript segments appear while the caller is still talking.
  const active = data?.conversation.id === id && data.conversation.call?.status === "active";
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => fetch(`/api/conversations/${id}`).then((r) => (r.ok ? r.json() : null)).then((d) => d && setData(d)), 2500);
    return () => clearInterval(t);
  }, [active, id]);

  const patch = async (body: Record<string, unknown>, msg: string) => {
    const out = await api<{ conversation: Conversation }>(`/api/conversations/${id}`, body, "PATCH");
    setData((d) => (d ? { ...d, conversation: out.conversation } : d));
    toast(msg);
    refresh();
    onChange?.();
  };

  if (missing === id) return <p className="text-sm text-slate-500">Conversation not found. It may be outside the selected date range or the demo was reset.</p>;
  if (!data || data.conversation.id !== id) return <div className="space-y-3"><Skeleton className="h-20" /><Skeleton className="h-48" /></div>;
  const c = data.conversation;
  const needsHuman = c.status === "escalated" || c.status === "human_resolved";

  return (
    <div className="space-y-5 text-sm">
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge tone={statusMeta[c.status].tone}>{statusMeta[c.status].label}</Badge>
        <Badge>{label(c.channel)}</Badge>
        <Badge tone={sentimentTone(c.sentiment)}>{label(c.sentiment)} sentiment</Badge>
        <Badge tone={priorityTone(c.priority)}>{label(c.priority)} priority</Badge>
        {c.durationSec ? <Badge>{Math.floor(c.durationSec / 60)}m {c.durationSec % 60}s call</Badge> : null}
        {c.source === "phone" ? <Badge tone="green">Real phone call</Badge> : c.source === "simulator" ? <Badge tone="violet">Simulator session</Badge> : <DemoTag />}
      </div>

      {needsHuman && (
        <section className="rounded-lg border border-violet-200 bg-violet-50/50 p-4">
          <h3 className="flex items-center gap-1.5 font-semibold text-violet-900"><ClipboardList size={16} />Human handoff: full context</h3>
          <p className="mt-0.5 text-xs text-violet-800">The assigned agent sees everything below, so the customer doesn&apos;t have to repeat the problem.</p>
          <dl className="mt-3 grid gap-3 sm:grid-cols-2">
            <div><dt className="text-xs text-slate-500">Customer</dt><dd className="font-medium">{data.customer?.name}</dd><dd className="text-xs text-slate-500">{data.customer?.segment} · {data.customer?.city} · {data.customer?.orders} orders</dd></div>
            <div><dt className="text-xs text-slate-500">Detected intent & sentiment</dt><dd className="font-medium">{label(c.intent)}</dd><dd className="text-xs text-slate-500">{label(c.sentiment)} · effort {c.effort}/5</dd></div>
            <div className="sm:col-span-2"><dt className="text-xs text-slate-500">AI summary</dt><dd>{c.summary || "—"}</dd></div>
            <div><dt className="text-xs text-slate-500">Troubleshooting already attempted</dt><dd><ul className="mt-0.5 space-y-0.5">{c.attempted.map((a) => <li key={a} className="flex gap-1.5"><CheckCircle2 size={13} className="mt-0.5 shrink-0 text-emerald-600" />{a}</li>)}</ul></dd></div>
            <div><dt className="text-xs text-slate-500">Recommended next action</dt><dd className="font-medium text-slate-900">{c.nextAction || "—"}</dd></div>
          </dl>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <Field label="Assigned to">
              <select className={inputCls} value={c.assignee ?? ""} onChange={(e) => patch({ assignee: e.target.value || null }, e.target.value ? `Assigned to ${e.target.value}` : "Unassigned")}>
                <option value="">Unassigned</option>{AGENTS.map((a) => <option key={a}>{a}</option>)}
              </select>
            </Field>
            <Field label="Status">
              <select className={inputCls} value={c.status} onChange={(e) => patch({ status: e.target.value }, "Status updated")}>
                <option value="escalated">Escalated (open)</option><option value="human_resolved">Resolved by human</option>
              </select>
            </Field>
            <Field label="Priority">
              <select className={inputCls} value={c.priority} onChange={(e) => patch({ priority: e.target.value }, "Priority updated")}>
                {["low", "medium", "high", "urgent"].map((p) => <option key={p} value={p}>{label(p)}</option>)}
              </select>
            </Field>
          </div>
          <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (reply.trim()) { patch({ reply: reply.trim() }, "Reply added to conversation"); setReply(""); } }}>
            <input className={inputCls} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Reply to the customer as the human agent…" aria-label="Reply as human agent" />
            <Button type="submit" variant="primary" disabled={!reply.trim()}>Send</Button>
          </form>
        </section>
      )}

      {!needsHuman && (
        <section className="grid gap-3 sm:grid-cols-2">
          <div><p className="text-xs text-slate-500">Summary</p><p>{c.summary || "—"}</p></div>
          <div><p className="text-xs text-slate-500">Resolution outcome</p><p>{c.status === "ai_resolved" ? "Resolved by AI agent" : "Open"}{c.nextAction ? `: ${c.nextAction}` : ""}</p></div>
          <div><p className="text-xs text-slate-500">Detected signals</p><p>{label(c.intent)} · {label(c.sentiment)} · effort {c.effort}/5 · topic {label(c.topic)}</p></div>
          <div><p className="text-xs text-slate-500">Customer</p><p>{data.customer?.name} <span className="text-slate-500">({data.customer?.segment})</span></p></div>
        </section>
      )}

      {c.call && <CallRecord id={c.id} startedAt={c.startedAt} durationSec={c.durationSec} call={c.call} />}

      <section>
        <h3 className="mb-2 font-semibold text-slate-900">{c.channel === "voice" ? "Call transcript" : "Messages"}</h3>
        <Transcript messages={c.messages} />
      </section>

      <section>
        <h3 className="mb-2 flex items-center gap-1.5 font-semibold text-slate-900"><StickyNote size={15} />Internal notes</h3>
        {c.notes.length === 0 && <p className="text-xs text-slate-500">No notes yet. Notes are visible to your team only.</p>}
        <ul className="space-y-1.5">{c.notes.map((n, i) => <li key={i} className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs"><span className="font-medium">{n.author}</span> · {fmtTime(n.at)}<p className="mt-0.5 text-slate-700">{n.text}</p></li>)}</ul>
        <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (note.trim()) { patch({ note: note.trim() }, "Note added"); setNote(""); } }}>
          <input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add an internal note…" aria-label="Internal note" />
          <Button type="submit" disabled={!note.trim()}>Add note</Button>
        </form>
      </section>
    </div>
  );
}

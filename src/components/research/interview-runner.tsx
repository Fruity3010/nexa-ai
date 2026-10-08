"use client";
import { Send, SkipForward, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Interview } from "@/lib/types";
import { useNexa } from "../nexa-context";
import { Badge, Button, cx, inputCls } from "../ui";

type Msg = { role: "ai" | "you"; text: string };

/** Interactive interview: the dashboard user answers as a participant. */
export function InterviewRunner({ campaignId, onDone }: { campaignId: string; onDone: () => void }) {
  const { api, refresh, state } = useNexa();
  const [iv, setIv] = useState<Interview | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [engine, setEngine] = useState<string>("demo");
  const started = useRef(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    api<{ interview: Interview; messages: string[] }>("/api/research/interview", { campaignId, action: "start" }).then((r) => {
      setIv(r.interview);
      setMsgs(r.messages.map((t) => ({ role: "ai", text: t })));
    });
  }, [api, campaignId]);
  useEffect(() => { endRef.current?.scrollIntoView({ block: "nearest" }); }, [msgs.length]);

  const act = async (action: "answer" | "skip" | "end", answer?: string) => {
    if (!iv || busy || done) return;
    setBusy(true);
    if (action === "answer") setMsgs((m) => [...m, { role: "you", text: answer! }]);
    if (action === "skip") setMsgs((m) => [...m, { role: "you", text: "(skipped)" }]);
    setText("");
    try {
      const r = await api<{ interview: Interview; messages: string[]; done: boolean; engine?: string }>("/api/research/interview", { campaignId, interviewId: iv.id, action, answer });
      setIv(r.interview);
      setMsgs((m) => [...m, ...r.messages.map((t) => ({ role: "ai" as const, text: t }))]);
      if (r.engine) setEngine(r.engine);
      if (r.done) { setDone(true); refresh(); }
    } finally { setBusy(false); }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="mb-2 flex flex-wrap items-center gap-1.5 text-xs">
        <Badge tone="violet">You are the participant</Badge>
        <Badge>{state?.aiMode === "live" ? "Interviewer: Claude" : "Interviewer: deterministic branching engine"}</Badge>
        {engine === "llm" && <Badge tone="green">LLM follow-up</Badge>}
        {iv?.consent && <Badge tone="green">Consent given</Badge>}
      </div>
      <div className="min-h-[320px] flex-1 space-y-2.5 overflow-y-auto rounded-md border border-slate-100 bg-slate-50/60 p-3">
        {msgs.map((m, i) => (
          <div key={i} className={cx("flex", m.role === "you" && "justify-end")}>
            <p className={cx("max-w-[85%] rounded-lg px-3 py-2 text-sm", m.role === "you" ? "bg-slate-800 text-white" : "border border-slate-200 bg-white text-slate-800")}>{m.text}</p>
          </div>
        ))}
        {busy && <p className="text-xs text-slate-400">Interviewer is thinking…</p>}
        <div ref={endRef} />
      </div>
      {done ? (
        <div className="mt-3 flex items-center justify-between rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          <span>Interview {iv?.status}. {iv?.themes.length ? `Themes detected: ${iv.themes.join(", ")}` : ""}</span>
          <Button size="sm" onClick={onDone}>View results</Button>
        </div>
      ) : (
        <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (text.trim()) act("answer", text.trim()); }}>
          <input className={inputCls} value={text} onChange={(e) => setText(e.target.value)} placeholder={iv?.consent ? "Type your answer…" : "Type yes to take part, or no to decline"} aria-label="Your answer" disabled={!iv} />
          <Button type="submit" variant="primary" disabled={busy || !text.trim()}><Send size={14} /></Button>
          {iv?.consent && <Button type="button" onClick={() => act("skip")} disabled={busy} title="Skip this question"><SkipForward size={14} /></Button>}
          {iv?.consent && <Button type="button" onClick={() => act("end")} disabled={busy} title="End interview"><Square size={14} /></Button>}
        </form>
      )}
    </div>
  );
}

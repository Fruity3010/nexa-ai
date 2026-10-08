"use client";
import { Mic, MicOff, RotateCcw, Send, UserRoundCog, Volume2, VolumeX } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Conversation } from "@/lib/types";
import type { AgentTurn } from "@/lib/ai/support";
import { Transcript } from "../conversation-view";
import { useNexa } from "../nexa-context";
import { Badge, Button, Card, inputCls, label, sentimentTone, statusMeta, useClientValue } from "../ui";

type SR = { start(): void; stop(): void; onresult: ((e: { results: { 0: { transcript: string } }[] }) => void) | null; onend: (() => void) | null; lang: string; interimResults: boolean };
const getSR = (): (new () => SR) | null =>
  typeof window === "undefined" ? null : ((window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR }).SpeechRecognition ?? (window as unknown as { webkitSpeechRecognition?: new () => SR }).webkitSpeechRecognition ?? null);

export function speak(text: string) {
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-NG";
    speechSynthesis.speak(u);
  } catch {}
}

export function ChatSimulator() {
  const { state, api, refresh } = useNexa();
  const [conv, setConv] = useState<Conversation | null>(null);
  const [turn, setTurn] = useState<AgentTurn | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceOut, setVoiceOut] = useState(false);
  const srAvailable = useClientValue(() => !!getSR(), false);
  const recRef = useRef<SR | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ block: "nearest" }); }, [conv?.messages.length]);

  const send = async (message: string) => {
    if (!message.trim() || busy) return;
    setBusy(true);
    setText("");
    // optimistic customer bubble
    setConv((c) => c && { ...c, messages: [...c.messages, { id: `tmp${Date.now()}`, role: "customer", text: message, at: new Date().toISOString() }] });
    try {
      const out = await api<{ conversation: Conversation; turn: AgentTurn | null }>("/api/support/chat", { conversationId: conv?.id, message, channel: "chat" });
      setConv(out.conversation);
      if (out.turn) { setTurn(out.turn); if (voiceOut) speak(out.turn.reply); }
      refresh();
    } finally { setBusy(false); }
  };

  const escalate = async () => {
    if (!conv) return;
    const out = await api<{ conversation: Conversation }>("/api/support/escalate", { conversationId: conv.id, reason: "Operator requested handoff from simulator" });
    setConv(out.conversation);
    refresh();
  };

  const toggleMic = () => {
    const SRc = getSR();
    if (!SRc) return;
    if (listening) { recRef.current?.stop(); return; }
    const rec = new SRc();
    rec.lang = "en-NG";
    rec.interimResults = false;
    rec.onresult = (e) => send(e.results[0][0].transcript);
    rec.onend = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    rec.start();
  };

  const greeting = state?.settings.agent.greeting ?? "";
  const messages = conv?.messages ?? [{ id: "g", role: "agent" as const, text: greeting, at: new Date().toISOString() }];

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2" title={<span className="flex items-center gap-2">Support agent simulator <Badge tone="violet">You are the customer</Badge></span>}
        subtitle={`${state?.aiMode === "live" ? "Engine: Claude via server-side adapter" : "Engine: deterministic intent engine (no LLM configured)"} · Customer profile: Chidi Okeke (demo) · Order records are demo data`}
        action={<Button size="sm" variant="ghost" onClick={() => { setConv(null); setTurn(null); }}><RotateCcw size={13} />New</Button>}>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {state?.settings.scenarios.map((s) => (
            <button key={s} onClick={() => send(s)} disabled={busy} className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-700 hover:border-violet-300 hover:bg-violet-50 disabled:opacity-50">{s}</button>
          ))}
        </div>
        <div className="h-[420px] overflow-y-auto rounded-md border border-slate-100 bg-slate-50/60 p-3">
          <Transcript messages={messages} />
          {busy && <p className="mt-2 text-xs text-slate-400">{state?.settings.agent.name} is typing…</p>}
          <div ref={endRef} />
        </div>
        <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); send(text); }}>
          <input className={inputCls} value={text} onChange={(e) => setText(e.target.value)} placeholder="Type as a customer, e.g. 'Where is my order?'" aria-label="Customer message" maxLength={2000} />
          {srAvailable && <Button type="button" onClick={toggleMic} aria-label={listening ? "Stop listening" : "Speak"} title="Browser speech recognition">{listening ? <MicOff size={15} className="text-red-600" /> : <Mic size={15} />}</Button>}
          <Button type="button" onClick={() => setVoiceOut(!voiceOut)} aria-label={voiceOut ? "Mute agent voice" : "Speak agent replies"} title="Read agent replies aloud (browser speech synthesis)">{voiceOut ? <Volume2 size={15} /> : <VolumeX size={15} />}</Button>
          <Button type="submit" variant="primary" disabled={busy || !text.trim()}><Send size={14} />Send</Button>
        </form>
        {listening && <p className="mt-1 text-xs text-red-600">Listening… speak now (browser speech recognition)</p>}
      </Card>

      <Card title="Live signals" subtitle="What Nexa detected in this conversation">
        {!conv ? <p className="text-sm text-slate-500">Send a message or pick a scenario to start.</p> : (
          <div className="space-y-3 text-sm">
            <div className="flex flex-wrap gap-1.5">
              <Badge tone={statusMeta[conv.status].tone}>{statusMeta[conv.status].label}</Badge>
              <Badge tone={sentimentTone(conv.sentiment)}>{label(conv.sentiment)}</Badge>
              <Badge>{label(conv.intent)}</Badge>
            </div>
            {turn?.kb && <p className="text-xs text-slate-600">Knowledge base: <span className="font-medium">{state?.settings.kb.find((k) => k.id === turn.kb)?.title ?? turn.kb}</span></p>}
            {turn?.action?.includes("demo") && <p className="text-xs"><Badge tone="amber">{turn.action}</Badge></p>}
            <div><p className="text-xs text-slate-500">Summary</p><p>{conv.summary || "—"}</p></div>
            <div><p className="text-xs text-slate-500">Recommended next action</p><p>{conv.nextAction || "—"}</p></div>
            {conv.attempted.length > 0 && <div><p className="text-xs text-slate-500">Steps taken</p><ul className="list-disc pl-4 text-xs text-slate-700">{conv.attempted.map((a) => <li key={a}>{a}</li>)}</ul></div>}
            {conv.status === "escalated" ? (
              <Link href={`/dashboard/conversations?id=${conv.id}`} className="flex items-center justify-center gap-1.5 rounded-md bg-violet-700 px-3 py-2 text-sm font-medium text-white hover:bg-violet-800"><UserRoundCog size={15} />Open human handoff</Link>
            ) : (
              <Button className="w-full" variant="danger" onClick={escalate}><UserRoundCog size={15} />Escalate to human</Button>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}

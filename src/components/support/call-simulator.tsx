"use client";
import { Phone, PhoneCall, PhoneOff, UserRoundCog, Volume2, VolumeX } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Conversation } from "@/lib/types";
import type { AgentTurn } from "@/lib/ai/support";
import { Transcript } from "../conversation-view";
import { useNexa } from "../nexa-context";
import { Badge, Button, Card, label, sentimentTone, statusMeta } from "../ui";
import { speak } from "./chat-simulator";

const SCRIPTS: Record<string, { label: string; caller: string; lines: string[] }> = {
  status: { label: "A · Order tracking (AI resolves)", caller: "Demo caller", lines: ["Hi, I placed an order yesterday. Can you tell me where it is?", "It's NM-10457.", "Okay, thank you, that's all."] },
  double: { label: "B · Charged twice (escalates to Payments)", caller: "Demo caller", lines: ["I think I was charged twice.", "The order number is NM-10476.", "Okay, please make it quick."] },
  delivery: { label: "C · Paid delivery, order hasn't arrived", caller: "Demo caller", lines: ["I paid for delivery and my order still hasn't arrived.", "The order number is NM-10457.", "Yes please, flag it."] },
  angry: { label: "D · Frustrated caller (human handoff)", caller: "Demo caller", lines: ["I have explained this three times. I want to speak to someone."] },
};

type Phase = "idle" | "ringing" | "live" | "ended";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function CallSimulator() {
  const { api, refresh, state } = useNexa();
  const [scenario, setScenario] = useState("status");
  const [phase, setPhase] = useState<Phase>("idle");
  const [conv, setConv] = useState<Conversation | null>(null);
  const [turn, setTurn] = useState<AgentTurn | null>(null);
  const [partial, setPartial] = useState("");
  const [seconds, setSeconds] = useState(0);
  const [audio, setAudio] = useState(false);
  const cancelled = useRef(false);
  const convRef = useRef<Conversation | null>(null);
  const secRef = useRef(0);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (phase !== "live") return;
    const t = setInterval(() => setSeconds((s) => { secRef.current = s + 1; return s + 1; }), 1000);
    return () => clearInterval(t);
  }, [phase]);
  useEffect(() => { endRef.current?.scrollIntoView({ block: "nearest" }); }, [conv?.messages.length, partial]);
  useEffect(() => () => { cancelled.current = true; }, []);

  const finish = async () => {
    setPhase("ended");
    setPartial("");
    if (convRef.current) {
      // Same post-call intelligence as real calls, labelled as simulated.
      const out = await api<{ conversation: Conversation }>("/api/voice/simulate", { conversationId: convRef.current.id, durationSec: Math.max(secRef.current, 1) }).catch(() => null);
      if (out) setConv(out.conversation);
      refresh();
    }
  };

  const start = async () => {
    cancelled.current = false;
    setConv(null); convRef.current = null; setTurn(null); setSeconds(0); secRef.current = 0;
    setPhase("ringing");
    await sleep(1800);
    if (cancelled.current) return;
    setPhase("live");
    if (audio) speak(state?.settings.agent.greeting ?? "");
    await sleep(1500);
    for (const line of SCRIPTS[scenario].lines) {
      // Simulated streaming speech-to-text: words arrive as interim transcript events.
      const words = line.split(" ");
      for (let i = 1; i <= words.length; i++) {
        if (cancelled.current) return;
        setPartial(words.slice(0, i).join(" "));
        await sleep(140);
      }
      setPartial("");
      const out: { conversation: Conversation; turn: AgentTurn | null } = await api("/api/support/chat", { conversationId: convRef.current?.id, message: line, channel: "voice" });
      convRef.current = out.conversation;
      setConv(out.conversation);
      setTurn(out.turn);
      if (audio && out.turn) speak(out.turn.reply);
      await sleep(audio ? 4500 : 2200);
      if (out.conversation.status === "escalated") break;
    }
    if (!cancelled.current) await finish();
  };

  const hangUp = async () => { cancelled.current = true; await finish(); };
  const escalate = async () => {
    if (!convRef.current) return;
    cancelled.current = true;
    const out = await api<{ conversation: Conversation }>("/api/support/escalate", { conversationId: convRef.current.id, reason: "Escalated by supervisor during call" });
    convRef.current = out.conversation;
    setConv(out.conversation);
    await finish();
  };

  const mmss = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  const greet = { id: "g", role: "agent" as const, text: state?.settings.agent.greeting ?? "", at: new Date().toISOString() };

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2" title={<span className="flex items-center gap-2">Call console <Badge tone="amber">Simulated call. No real phone call is taking place</Badge></span>}
        subtitle="Caller speech is scripted and replies come from the turn-based support engine (not Gemini Live). Post-call analysis is the same as for real calls."
        action={phase === "live" ? <span className="flex items-center gap-1.5 text-sm font-medium tabular-nums text-red-600"><span className="h-2 w-2 animate-pulse rounded-full bg-red-600" />{mmss}</span> : null}>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <select aria-label="Call scenario" className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm" value={scenario} onChange={(e) => setScenario(e.target.value)} disabled={phase === "ringing" || phase === "live"}>
            {Object.entries(SCRIPTS).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}
          </select>
          {phase === "ringing" || phase === "live" ? (
            <Button variant="danger" onClick={hangUp}><PhoneOff size={15} />End call</Button>
          ) : (
            <Button variant="primary" onClick={start}><PhoneCall size={15} />Simulate incoming call</Button>
          )}
          <Button variant="ghost" onClick={() => setAudio(!audio)} title="Play the call through browser speech synthesis">{audio ? <Volume2 size={15} /> : <VolumeX size={15} />}{audio ? "Audio on" : "Audio off"}</Button>
        </div>
        <div className="h-[400px] overflow-y-auto rounded-md border border-slate-100 bg-slate-50/60 p-3">
          {phase === "idle" && <div className="flex h-full flex-col items-center justify-center text-center text-sm text-slate-500"><Phone size={28} className="mb-2 text-slate-300" />Choose a scenario and start a simulated call.</div>}
          {phase === "ringing" && <div className="flex h-full flex-col items-center justify-center text-sm text-slate-600"><PhoneCall size={30} className="mb-2 animate-bounce text-violet-600" />Incoming call from {SCRIPTS[scenario].caller}…</div>}
          {(phase === "live" || phase === "ended") && (
            <>
              <Transcript messages={conv?.messages ?? [greet]} compact />
              {partial && <p className="mt-2 text-right text-sm italic text-slate-500">{partial}<span className="animate-pulse">▍</span></p>}
              <div ref={endRef} />
            </>
          )}
        </div>
      </Card>

      <Card title="Call intelligence" subtitle={phase === "ended" ? "Post-call summary" : "Updates live during the call"}>
        {!conv ? <p className="text-sm text-slate-500">Intent, sentiment and resolution steps appear here once the caller speaks.</p> : (
          <div className="space-y-3 text-sm">
            <div className="flex flex-wrap gap-1.5">
              <Badge tone={statusMeta[conv.status].tone}>{statusMeta[conv.status].label}</Badge>
              <Badge tone={sentimentTone(conv.sentiment)}>{label(conv.sentiment)}</Badge>
              <Badge>{label(conv.intent)}</Badge>
              <Badge>{mmss}</Badge>
            </div>
            {turn?.action?.includes("demo") && <Badge tone="amber">{turn.action}</Badge>}
            <div><p className="text-xs text-slate-500">Resolution steps</p><ul className="list-disc pl-4 text-xs text-slate-700">{conv.attempted.map((a) => <li key={a}>{a}</li>)}{conv.attempted.length === 0 && <li>Listening…</li>}</ul></div>
            <div><p className="text-xs text-slate-500">{phase === "ended" ? "Post-call summary" : "Running summary"}</p><p>{conv.summary || "—"}</p></div>
            <div><p className="text-xs text-slate-500">Next action</p><p>{conv.nextAction || "—"}</p></div>
            {phase === "live" && conv.status !== "escalated" && <Button variant="danger" className="w-full" onClick={escalate}><UserRoundCog size={15} />Escalate to human now</Button>}
            {conv.status === "escalated" && <Link href={`/dashboard/conversations?id=${conv.id}`} className="flex items-center justify-center gap-1.5 rounded-md bg-violet-700 px-3 py-2 text-sm font-medium text-white hover:bg-violet-800"><UserRoundCog size={15} />Open human handoff</Link>}
            {phase === "ended" && conv.status !== "escalated" && <Link href={`/dashboard/voice?call=${conv.id}`} className="block text-center text-sm text-violet-700 hover:underline">View saved call record →</Link>}
          </div>
        )}
      </Card>
    </div>
  );
}

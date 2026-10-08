"use client";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import type { NexaState } from "@/lib/analytics";
import type { AgentConfig, KBArticle, Settings } from "@/lib/types";

// Gemini Live prebuilt voices (https://ai.google.dev/gemini-api/docs/speech-generation#voices)
const VOICES = ["Kore", "Aoede", "Leda", "Zephyr", "Puck", "Charon", "Fenrir", "Orus"];
import { useNexa } from "../nexa-context";
import { Button, Card, Confirm, Field, inputCls, Toggle } from "../ui";

export function AgentConfigForm() {
  const { state } = useNexa();
  return state ? <Form initial={state.settings} /> : null;
}

function Form({ initial }: { initial: NexaState["settings"] }) {
  const { api, refresh, toast } = useNexa();
  const [a, setA] = useState<AgentConfig>(() => structuredClone(initial.agent));
  const [kb, setKb] = useState<KBArticle[]>(() => structuredClone(initial.kb));
  const [voice, setVoice] = useState<Settings["voice"]>(() => structuredClone(initial.voice));
  const [del, setDel] = useState<string | null>(null);

  const save = async () => {
    await api("/api/settings", { agent: a, voice, kb: kb.filter((k) => k.title.trim() && k.body.trim()) }, "PATCH");
    await refresh();
    toast("Agent configuration saved. The simulator uses it immediately.");
  };
  const upd = (patch: Partial<AgentConfig>) => setA({ ...a, ...patch });

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="Agent profile & behaviour">
        <div className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Agent name"><input className={inputCls} value={a.name} onChange={(e) => upd({ name: e.target.value })} /></Field>
            <Field label="Business hours"><input className={inputCls} value={a.businessHours} onChange={(e) => upd({ businessHours: e.target.value })} /></Field>
          </div>
          <Field label="Personality"><textarea className={inputCls} rows={2} value={a.personality} onChange={(e) => upd({ personality: e.target.value })} /></Field>
          <Field label="Supported languages" hint="Comma-separated"><input className={inputCls} value={a.languages.join(", ")} onChange={(e) => upd({ languages: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} /></Field>
          <Field label="Greeting"><input className={inputCls} value={a.greeting} onChange={(e) => upd({ greeting: e.target.value })} /></Field>
          <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
            <Field label="Phone voice"><select className={inputCls} value={voice.voiceName} onChange={(e) => setVoice({ ...voice, voiceName: e.target.value })}>{VOICES.map((x) => <option key={x}>{x}</option>)}</select></Field>
            <Field label="Phone callback message" hint="Read to callers when a call is escalated and no transfer line is configured."><input className={inputCls} value={voice.callbackMessage} onChange={(e) => setVoice({ ...voice, callbackMessage: e.target.value })} /></Field>
          </div>
          <Field label="Support policies" hint="The agent must never answer beyond these policies and the knowledge base."><textarea className={inputCls} rows={4} value={a.policies} onChange={(e) => upd({ policies: e.target.value })} /></Field>
          <Field label="Escalation conditions" hint="One per line"><textarea className={inputCls} rows={4} value={a.escalationRules.join("\n")} onChange={(e) => upd({ escalationRules: e.target.value.split("\n").filter((s) => s.trim()) })} /></Field>
          <div>
            <p className="text-xs font-medium text-slate-700">Supported intents</p>
            <p className="mb-2 text-[11px] text-slate-500">Off = the agent gathers details, then must escalate.</p>
            <ul className="space-y-1.5">
              {a.intents.map((it, i) => (
                <li key={it.id} className="flex items-center justify-between rounded border border-slate-100 px-2.5 py-1.5 text-sm">
                  <span>{it.label}</span>
                  <Toggle checked={it.canResolve} label={it.canResolve ? "AI can resolve" : "Must escalate"} onChange={(v) => upd({ intents: a.intents.map((x, j) => (j === i ? { ...x, canResolve: v } : x)) })} />
                </li>
              ))}
            </ul>
          </div>
          <Button variant="primary" onClick={save}>Save configuration</Button>
        </div>
      </Card>
      <Card title="Company knowledge & FAQs" subtitle="Grounds every support answer" action={<Button size="sm" onClick={() => setKb([...kb, { id: `kb-${Date.now().toString(36)}`, title: "", body: "", tags: [] }])}><Plus size={13} />Add article</Button>}>
        <ul className="space-y-3">
          {kb.map((k, i) => (
            <li key={k.id} className="rounded-md border border-slate-200 p-3">
              <div className="flex gap-2">
                <input className={inputCls} value={k.title} placeholder="Title" aria-label="Article title" onChange={(e) => setKb(kb.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} />
                <Button size="sm" variant="ghost" aria-label="Delete article" onClick={() => setDel(k.id)}><Trash2 size={14} /></Button>
              </div>
              <textarea className={`${inputCls} mt-2`} rows={3} value={k.body} placeholder="Answer" aria-label="Article body" onChange={(e) => setKb(kb.map((x, j) => (j === i ? { ...x, body: e.target.value } : x)))} />
              <input className={`${inputCls} mt-2 text-xs`} value={k.tags.join(", ")} placeholder="Match keywords, comma-separated" aria-label="Keywords" onChange={(e) => setKb(kb.map((x, j) => (j === i ? { ...x, tags: e.target.value.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean) } : x)))} />
            </li>
          ))}
        </ul>
        <Button variant="primary" className="mt-3 w-full" onClick={save}>Save knowledge base</Button>
      </Card>
      <Confirm open={!!del} onClose={() => setDel(null)} danger title="Delete article?" body="The agent will no longer use this article once you save." confirmLabel="Delete" onConfirm={() => setKb(kb.filter((k) => k.id !== del))} />
    </div>
  );
}

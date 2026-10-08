"use client";
import { Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { PageSkeleton } from "@/components/loading";
import { useNexa } from "@/components/nexa-context";
import { Badge, Button, Card, Confirm, Field, inputCls, PageHeader, Toggle } from "@/components/ui";
import { PRESETS } from "@/lib/presets";
import type { Settings } from "@/lib/types";

export default function SettingsPage() {
  const { state } = useNexa();
  return state ? <SettingsForm initial={state.settings} /> : <PageSkeleton />;
}

function SettingsForm({ initial }: { initial: Settings }) {
  const { state: st, api, refresh, toast } = useNexa();
  const state = st!;
  const [s, setS] = useState<Settings>(() => structuredClone(initial));
  const [preset, setPreset] = useState<string | null>(null);

  const save = async (patch: Partial<Settings> & { preset?: string }, msg = "Settings saved") => {
    const r = await api<{ settings: Settings }>("/api/settings", patch, "PATCH");
    setS(structuredClone(r.settings));
    await refresh();
    toast(msg);
  };

  return (
    <div>
      <PageHeader title="Settings" description="Organisation, AI behaviour, privacy and data controls." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Organisation & industry">
          <div className="grid gap-3">
            <Field label="Organisation name"><input className={inputCls} value={s.org.name} onChange={(e) => setS({ ...s, org: { ...s.org, name: e.target.value } })} /></Field>
            <Button onClick={() => save({ org: s.org })}>Save name</Button>
            <div>
              <p className="text-xs font-medium text-slate-700">Industry preset</p>
              <p className="mb-2 text-[11px] text-slate-500">Switches knowledge base, agent persona, support scenarios and terminology. The analytics dataset stays NovaMart&apos;s e-commerce demo data.</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {PRESETS.map((p) => (
                  <button key={p.id} onClick={() => p.id !== s.org.industry && setPreset(p.id)} className={`rounded-md border p-2.5 text-left text-sm ${p.id === s.org.industry ? "border-violet-400 bg-violet-50" : "border-slate-200 hover:border-violet-300"}`}>
                    <p className="font-medium">{p.label}</p>
                    <p className="text-[11px] text-slate-500">Agent {p.agent.name} · &ldquo;{p.terms.customer}s&rdquo;</p>
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-slate-500">Current terminology: <Badge>{s.terms.customer}</Badge> <Badge>{s.terms.order}</Badge></p>
            </div>
          </div>
        </Card>

        <Card title="AI behaviour & guardrails">
          <div className="space-y-3">
            <Toggle checked={s.guardrails.neverInventPolicy} onChange={(v) => setS({ ...s, guardrails: { ...s.guardrails, neverInventPolicy: v } })} label="Never answer beyond policies and knowledge base (escalate instead)" />
            <Toggle checked={s.guardrails.redactPII} onChange={(v) => setS({ ...s, guardrails: { ...s.guardrails, redactPII: v } })} label="Send only minimum customer data to AI provider" />
            <Field label="Max refund the AI may approve automatically (₦)" hint="0 = all refunds require a human"><input type="number" min={0} className={inputCls} value={s.guardrails.maxAutoRefundNGN} onChange={(e) => setS({ ...s, guardrails: { ...s.guardrails, maxAutoRefundNGN: Number(e.target.value) } })} /></Field>
            <p className="text-xs text-slate-500">AI provider: {state.aiMode === "live" ? "Claude (server-side)" : "deterministic demo engine. Set ANTHROPIC_API_KEY to enable Claude."}</p>
            <Button onClick={() => save({ guardrails: s.guardrails })}>Save guardrails</Button>
          </div>
        </Card>

        <Card title="Support escalation policy" action={<Link href="/dashboard/support?tab=config" className="text-xs text-violet-700 hover:underline">Full agent config →</Link>}>
          <Field label="Escalate when (one per line)"><textarea className={inputCls} rows={5} value={s.agent.escalationRules.join("\n")} onChange={(e) => setS({ ...s, agent: { ...s.agent, escalationRules: e.target.value.split("\n") } })} /></Field>
          <Button className="mt-3" onClick={() => save({ agent: { ...s.agent, escalationRules: s.agent.escalationRules.filter((r) => r.trim()) } })}>Save policy</Button>
        </Card>

        <Card title="Data retention" subtitle="Older records are deleted automatically">
          <div className="grid grid-cols-3 gap-3">
            {(["conversations", "webEvents", "research"] as const).map((k) => (
              <Field key={k} label={{ conversations: "Conversations", webEvents: "Website events", research: "Research" }[k] + " (days)"}>
                <input type="number" min={1} max={3650} className={inputCls} value={s.retentionDays[k]} onChange={(e) => setS({ ...s, retentionDays: { ...s.retentionDays, [k]: Number(e.target.value) } })} />
              </Field>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-500">Website-event retention is enforced on save and on every ingest.</p>
          <Button className="mt-3" onClick={() => save({ retentionDays: s.retentionDays }, "Retention updated")}>Save retention</Button>
        </Card>

        <Card title="Privacy & consent">
          <div className="space-y-2.5">
            <Toggle checked={s.privacy.requireConsent} onChange={(v) => setS({ ...s, privacy: { ...s.privacy, requireConsent: v } })} label="Require visitor consent before website tracking" />
            <Toggle checked={s.privacy.respectDoNotTrack} onChange={(v) => setS({ ...s, privacy: { ...s.privacy, respectDoNotTrack: v } })} label="Respect Do Not Track / Global Privacy Control" />
            <Toggle checked={s.privacy.anonymizeIP} onChange={(v) => setS({ ...s, privacy: { ...s.privacy, anonymizeIP: v } })} label="Never store IP addresses (used only for rate limiting)" />
            <p className="text-xs text-slate-500">Research interviews always ask for consent before recording answers.</p>
            <Button onClick={() => save({ privacy: s.privacy })}>Save privacy</Button>
          </div>
        </Card>

        <Card title="Users & roles" subtitle="Demo only: no authentication in demo mode" action={<Button size="sm" onClick={() => setS({ ...s, roles: [...s.roles, { name: "", email: "", role: "Viewer" }] })}><Plus size={13} />Add</Button>}>
          <ul className="space-y-2">
            {s.roles.map((r, i) => (
              <li key={i} className="grid grid-cols-[1fr_1fr_auto_auto] gap-2">
                <input className={inputCls} aria-label="Name" placeholder="Name" value={r.name} onChange={(e) => setS({ ...s, roles: s.roles.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} />
                <input className={inputCls} aria-label="Email" placeholder="Email" value={r.email} onChange={(e) => setS({ ...s, roles: s.roles.map((x, j) => (j === i ? { ...x, email: e.target.value } : x)) })} />
                <select className={inputCls} aria-label="Role" value={r.role} onChange={(e) => setS({ ...s, roles: s.roles.map((x, j) => (j === i ? { ...x, role: e.target.value as typeof r.role } : x)) })}>
                  {["Admin", "Analyst", "Support Agent", "Viewer"].map((o) => <option key={o}>{o}</option>)}
                </select>
                <Button variant="ghost" aria-label="Remove user" onClick={() => setS({ ...s, roles: s.roles.filter((_, j) => j !== i) })}><Trash2 size={14} /></Button>
              </li>
            ))}
          </ul>
          <Button className="mt-3" onClick={() => save({ roles: s.roles.filter((r) => r.name.trim()) })}>Save users</Button>
        </Card>

        <Card title="SDK project" action={<Link href="/dashboard/sdk" className="text-xs text-violet-700 hover:underline">Website SDK →</Link>}>
          <Field label="Project name"><input className={inputCls} value={s.sdk.projectName} onChange={(e) => setS({ ...s, sdk: { ...s.sdk, projectName: e.target.value } })} /></Field>
          <p className="mt-2 text-xs text-slate-500">Public project key: <code>{s.sdk.projectKey}</code></p>
          <Button className="mt-3" onClick={() => save({ sdk: { ...s.sdk } }, "SDK project saved")}>Save</Button>
        </Card>

        <Card title="Integrations">
          <p className="text-sm text-slate-600">{state.integrations.filter((i) => i.status === "Connected").length} connected · {state.integrations.filter((i) => i.status === "Demo Mode").length} in demo mode</p>
          <Link href="/dashboard/integrations" className="mt-2 inline-block text-sm text-violet-700 hover:underline">Manage integrations →</Link>
        </Card>
      </div>
      <Confirm open={!!preset} onClose={() => setPreset(null)} title={`Switch to ${PRESETS.find((p) => p.id === preset)?.label}?`}
        body="This replaces the agent configuration, knowledge base and support scenarios with the preset's defaults. Use Reset demo to return to NovaMart e-commerce."
        confirmLabel="Switch preset" onConfirm={() => preset && save({ preset }, "Industry preset applied")} />
    </div>
  );
}

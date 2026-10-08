"use client";
import type { CallMeta } from "@/lib/types";
import { Badge, fmtTime, label, type Tone } from "../ui";

export const fmtDuration = (s?: number) => (s === undefined ? "—" : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`);
export const outcomeMeta = (call?: CallMeta): { label: string; tone: Tone } => {
  if (!call) return { label: "—", tone: "slate" };
  if (call.status === "active") return { label: "In progress", tone: "blue" };
  const i = call.intelligence;
  if (!i) return { label: "Analysing…", tone: "slate" };
  return i.escalated ? { label: "Escalated", tone: "amber" } : i.resolution === "resolved" ? { label: "Resolved (confirmed)", tone: "green" } : i.resolution === "unresolved" ? { label: "Unresolved", tone: "red" } : { label: "Outcome unknown", tone: "slate" };
};
export const ProviderBadge = ({ call }: { call?: CallMeta }) =>
  call?.provider === "twilio" ? <Badge tone="green">Real call · {call.engine === "gemini-live" ? "Gemini Live" : "turn-based"}</Badge> : <Badge tone="violet">Simulated</Badge>;

/** Detailed call record shown in the conversation drawer. */
export function CallRecord({ id, startedAt, durationSec, call }: { id: string; startedAt: string; durationSec?: number; call: CallMeta }) {
  const i = call.intelligence;
  const o = outcomeMeta(call);
  const row = (k: string, v: React.ReactNode) => <div><dt className="text-xs text-slate-500">{k}</dt><dd className="mt-0.5">{v}</dd></div>;
  return (
    <section className="rounded-lg border border-slate-200 p-4">
      <h3 className="mb-3 flex flex-wrap items-center gap-2 font-semibold text-slate-900">Call record <ProviderBadge call={call} /><Badge tone={o.tone}>{o.label}</Badge></h3>
      <dl className="grid gap-3 sm:grid-cols-3">
        {row("Call ID", <code className="break-all text-xs">{call.callSid ?? id}</code>)}
        {row("Started", fmtTime(startedAt))}
        {row("Duration", call.status === "active" ? "Live now" : fmtDuration(durationSec))}
        {row("Caller", call.from)}
        {row("Transcript", call.transcript === "live" ? "Streaming live" : call.transcript === "none" ? "No caller speech captured" : label(call.transcript))}
        {row("Escalation", call.handoff ? (call.handoff.transfer === "dialing" ? "Transferred to handoff line" : "Recorded, callback promised (no transfer line)") : "None")}
        {call.endReason && row("End reason", label(call.endReason.replace(/^\w+:/, "")))}
      </dl>
      {i && (
        <dl className="mt-4 grid gap-3 border-t border-slate-100 pt-3 sm:grid-cols-2">
          <div className="sm:col-span-2">{row(`AI summary (${i.engine === "rules" ? "rules engine" : i.engine})`, i.summary)}</div>
          {row("Intent", label(i.intent))}
          {row("Sentiment · urgency", `${label(i.sentiment)} · ${i.urgency}`)}
          {row("Detected issues", i.issues.length ? <span className="flex flex-wrap gap-1">{i.issues.map((x) => <Badge key={x}>{label(x)}</Badge>)}</span> : "—")}
          {row("Follow-up required", i.follow_up_required ? "Yes" : "No")}
          <div className="sm:col-span-2">{row("Suggested follow-up", i.recommended_action)}</div>
        </dl>
      )}
    </section>
  );
}

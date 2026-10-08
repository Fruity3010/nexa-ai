"use client";
import { Phone, Radio } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { ConversationDetail } from "@/components/conversation-view";
import { PageSkeleton } from "@/components/loading";
import { useNexa } from "@/components/nexa-context";
import { AgentConfigForm } from "@/components/support/agent-config";
import { ChatSimulator } from "@/components/support/chat-simulator";
import { ago, Badge, Card, Drawer, Empty, label, PageHeader, priorityTone, sentimentTone, Tabs } from "@/components/ui";

type Tab = "chat" | "queue" | "config";

export default function LiveSupport() {
  const { state } = useNexa();
  const params = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const tab = (params.get("tab") as Tab) ?? "chat";
  const [open, setOpen] = useState<string | null>(null);
  if (!state) return <PageSkeleton />;

  const twilio = state.integrations.find((i) => i.id === "twilio")!;
  const queue = state.conversations.filter((c) => c.status === "escalated");

  return (
    <div>
      <PageHeader title="Live Support" description="Voice and chat AI agent: test it, watch calls, and pick up escalations with full context." />
      <div className="mb-4 grid gap-3 md:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="flex items-center gap-1.5 text-xs font-medium text-slate-500"><Radio size={14} />Voice agent status</p>
          <p className="mt-1.5 flex items-center gap-2 font-semibold"><span className="h-2 w-2 rounded-full bg-emerald-500" />{state.settings.agent.name} online</p>
          <p className="mt-0.5 text-xs text-slate-500">{twilio.status === "Connected" ? "Answering real calls via Twilio" : "Simulator mode: no telephony provider connected"} · <Link href="/dashboard/voice" className="text-violet-700 hover:underline">Live Voice →</Link></p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="flex items-center gap-1.5 text-xs font-medium text-slate-500"><Phone size={14} />Phone number</p>
          <p className="mt-1.5 font-semibold">{twilio.status === "Connected" ? twilio.detail?.replace("Number: ", "") : "Not provisioned"}</p>
          <p className="mt-0.5 text-xs text-slate-500">{twilio.status === "Connected" ? "Provisioned via TWILIO_PHONE_NUMBER" : "Placeholder. Configure Twilio below to get a real number"}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium text-slate-500">Human handoff queue</p>
          <p className="mt-1.5 text-2xl font-semibold tabular-nums">{queue.length}</p>
          <button onClick={() => router.replace(`${path}?tab=queue`)} className="text-xs text-violet-700 hover:underline">Open queue →</button>
        </div>
      </div>

      <Tabs<Tab> value={tab} onChange={(t) => router.replace(`${path}?tab=${t}`, { scroll: false })} tabs={[
        { id: "chat", label: "Chat simulator" }, { id: "queue", label: `Handoff queue (${queue.length})` }, { id: "config", label: "Agent configuration" },
      ]} />
      <div className="mt-4">
        {tab === "chat" && <ChatSimulator />}
        {tab === "config" && <AgentConfigForm />}
        {tab === "queue" && (
          <Card title="Escalations awaiting a human" subtitle="Each handoff carries the AI summary, steps tried and recommended next action">
            {queue.length === 0 ? <Empty title="Queue is clear" body="Escalate a conversation from the chat or call simulator to see it here." /> : (
              <ul className="divide-y divide-slate-100">
                {queue.map((c) => (
                  <li key={c.id}><button onClick={() => setOpen(c.id)} className="grid w-full gap-1 py-3 text-left hover:bg-slate-50 sm:grid-cols-[1fr_auto]">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900">{c.customer} · {label(c.intent)} <span className="font-normal text-slate-400">via {c.channel}</span></p>
                      <p className="truncate text-xs text-slate-600">{c.summary}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Badge tone={priorityTone(c.priority)}>{c.priority}</Badge>
                      <Badge tone={sentimentTone(c.sentiment)}>{c.sentiment}</Badge>
                      <span className="text-xs text-slate-500">{c.assignee ?? "Unassigned"} · {ago(c.startedAt)}</span>
                    </div>
                  </button></li>
                ))}
              </ul>
            )}
          </Card>
        )}
      </div>
      <Drawer open={!!open} onClose={() => setOpen(null)} wide title={open ? `Conversation ${open}` : ""}>{open && <ConversationDetail id={open} />}</Drawer>
    </div>
  );
}

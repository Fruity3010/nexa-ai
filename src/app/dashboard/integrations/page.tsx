"use client";
import { Plug } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { PageSkeleton } from "@/components/loading";
import { useNexa } from "@/components/nexa-context";
import { Badge, Button, Card, Modal, PageHeader, Toggle, type Tone } from "@/components/ui";
import type { IntegrationStatus } from "@/lib/types";

const tone: Record<IntegrationStatus, Tone> = { Connected: "green", "Demo Mode": "amber", "Not Connected": "slate", "Needs Configuration": "red" };

export default function Integrations() {
  const { state, api, refresh, toast } = useNexa();
  const [openId, setOpenId] = useState<string | null>(null);
  if (!state) return <PageSkeleton />;
  const open = state.integrations.find((i) => i.id === openId);
  const cats = [...new Set(state.integrations.map((i) => i.category))];

  const toggleDemo = async (id: string, on: boolean) => {
    const list = on ? [...state.settings.demoIntegrations, id] : state.settings.demoIntegrations.filter((x) => x !== id);
    await api("/api/settings", { demoIntegrations: list }, "PATCH");
    await refresh();
    toast(on ? "Simulated connection enabled (labelled Demo Mode)" : "Simulated connection removed");
  };

  return (
    <div>
      <PageHeader title="Integrations" description="Connect the channels and systems Nexa listens to. Statuses come from server configuration; nothing shows as connected without real credentials." />
      <div className="space-y-6">
        {cats.map((cat) => (
          <section key={cat}>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{cat}</h2>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {state.integrations.filter((i) => i.category === cat).map((i) => (
                <Card key={i.id}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-100 text-slate-600"><Plug size={15} /></span><p className="font-medium text-slate-900">{i.name}</p></div>
                    <Badge tone={tone[i.status]}>{i.status}</Badge>
                  </div>
                  <p className="mt-2 text-sm text-slate-600">{i.description}</p>
                  {i.detail && <p className="mt-1 text-xs text-slate-500">{i.detail}</p>}
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-[11px] text-slate-400">{i.real ? "Implemented in this MVP" : "Connector not implemented yet"}</span>
                    {i.id === "sdk" ? <Link href="/dashboard/sdk" className="text-sm font-medium text-violet-700 hover:underline">Set up →</Link> : <Button size="sm" onClick={() => setOpenId(i.id)}>Configure</Button>}
                  </div>
                </Card>
              ))}
            </div>
          </section>
        ))}
      </div>
      <Modal open={!!open} onClose={() => setOpenId(null)} title={open ? `Configure ${open.name}` : ""} footer={<Button onClick={() => setOpenId(null)}>Close</Button>}>
        {open && (
          <div className="space-y-4 text-sm">
            <p className="flex items-center gap-2">Status: <Badge tone={tone[open.status]}>{open.status}</Badge></p>
            <p className="text-slate-700">{open.setup}</p>
            {open.env.length > 0 && (
              <div><p className="text-xs font-medium text-slate-700">Server environment variables</p>
                <ul className="mt-1 space-y-1">{open.env.map((e) => <li key={e}><code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">{e}</code></li>)}</ul>
                <p className="mt-1 text-xs text-slate-500">Set these in <code>.env.local</code> or your host&apos;s secret settings. Secrets are never sent to the browser.</p>
              </div>
            )}
            {!open.real && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
                <Toggle checked={state.settings.demoIntegrations.includes(open.id)} onChange={(v) => toggleDemo(open.id, v)} label="Show as simulated connection (Demo Mode)" />
                <p className="mt-1 text-xs text-amber-800">This only labels the integration for the demo. No OAuth flow runs and no {open.name} API is contacted.</p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

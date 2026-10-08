"use client";
import { FlaskConical, MessageCircle, Plus, Users } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { SentimentBar } from "@/components/charts";
import { PageSkeleton } from "@/components/loading";
import { useNexa } from "@/components/nexa-context";
import { InterviewRunner } from "@/components/research/interview-runner";
import { NewCampaignModal } from "@/components/research/new-campaign";
import { ago, Badge, Button, Card, cx, DemoTag, Drawer, Empty, label, PageHeader, sentimentTone } from "@/components/ui";

export default function Research() {
  const { state, api, refresh, toast } = useNexa();
  const params = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const [creating, setCreating] = useState(false);
  const [running, setRunning] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [theme, setTheme] = useState<string | null>(null);
  if (!state) return <PageSkeleton />;

  const setParam = (k: string, v: string | null) => {
    const p = new URLSearchParams(params.toString());
    if (v) p.set(k, v); else p.delete(k);
    router.replace(`${path}?${p.toString()}`, { scroll: false });
  };
  const c = state.campaigns.find((x) => x.id === params.get("campaign")) ?? state.campaigns[0];
  const ivOpen = c?.interviews.find((i) => i.id === params.get("interview"));
  const th = c?.results.themes.find((t) => t.id === theme);

  const simulate = async () => {
    setSimulating(true);
    try {
      await api("/api/research/simulate", { campaignId: c.id, count: 6 });
      await refresh();
      toast("6 synthetic interviews completed");
    } finally { setSimulating(false); }
  };

  return (
    <div>
      <PageHeader title="Customer Research" description="Ask a question. Nexa interviews customers, follows up on what they say, and returns patterns, not just a list of answers."
        actions={<Button variant="primary" onClick={() => setCreating(true)}><Plus size={15} />New campaign</Button>} />
      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <Card title="Campaigns">
          <ul className="-m-2 space-y-1">
            {state.campaigns.map((x) => (
              <li key={x.id}>
                <button onClick={() => { setParam("campaign", x.id); setTheme(null); }} className={cx("w-full rounded-md p-2 text-left text-sm", x.id === c?.id ? "bg-violet-50 ring-1 ring-violet-200" : "hover:bg-slate-50")}>
                  <p className="line-clamp-2 font-medium text-slate-900">{x.question}</p>
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500"><Badge tone={x.status === "completed" ? "green" : "blue"}>{label(x.status)}</Badge>{x.results.participants}/{x.targetParticipants} · {ago(x.createdAt)}</p>
                </button>
              </li>
            ))}
          </ul>
        </Card>

        {!c ? <Card><Empty icon={<FlaskConical size={28} />} title="No campaigns yet" action={<Button variant="primary" onClick={() => setCreating(true)}>Create one</Button>} /></Card> : (
          <div className="space-y-4">
            <Card>
              <div className="flex flex-col gap-3 2xl:flex-row 2xl:items-start 2xl:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">{c.question}</h2>
                  <p className="mt-1 text-sm text-slate-600">{c.objective}</p>
                  <p className="mt-2 flex flex-wrap gap-1.5 text-xs">
                    <Badge>{c.segment}</Badge><Badge>{label(c.channel)}</Badge><Badge>{c.language}</Badge><Badge>~{c.lengthMin} min</Badge><Badge>Retention {c.retentionDays}d</Badge>
                    {c.source === "seed" && <DemoTag />}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <Button onClick={simulate} disabled={simulating}><Users size={15} />{simulating ? "Interviewing…" : "Simulate 6 participants"}</Button>
                  <Button variant="primary" onClick={() => setRunning(true)}><MessageCircle size={15} />Take the interview</Button>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3 border-t border-slate-100 pt-4">
                <div><p className="text-xs text-slate-500">Participants (consented)</p><p className="text-xl font-semibold tabular-nums">{c.results.participants}<span className="text-sm font-normal text-slate-400"> / {c.targetParticipants}</span></p></div>
                <div><p className="text-xs text-slate-500">Completion rate</p><p className="text-xl font-semibold tabular-nums">{c.results.completionRate}%</p></div>
                <div><p className="text-xs text-slate-500">Themes found</p><p className="text-xl font-semibold tabular-nums">{c.results.themes.length}</p></div>
              </div>
            </Card>

            {c.results.themes.length === 0 ? (
              <Card><Empty icon={<Users size={28} />} title="No interviews yet" body="Take the interview yourself, or simulate synthetic participants to see how Nexa turns conversations into themes." /></Card>
            ) : (
              <div className="grid gap-4 xl:grid-cols-2">
                <Card title="Main themes" subtitle="Click a theme to see the responses behind it">
                  <ul className="space-y-3">
                    {c.results.themes.map((t) => (
                      <li key={t.id}>
                        <button onClick={() => setTheme(t.id)} className="w-full rounded-md p-2 text-left hover:bg-slate-50">
                          <div className="mb-1.5 flex items-center justify-between text-sm"><span className="font-medium text-slate-900">{t.label}</span><span className="text-xs text-slate-500">{t.count} of {c.results.participants} participants</span></div>
                          <SentimentBar counts={t.sentiment} />
                        </button>
                      </li>
                    ))}
                  </ul>
                </Card>
                <div className="space-y-4">
                  <Card title="Representative quotes" subtitle="From clearly labelled synthetic or live demo participants">
                    <ul className="space-y-2">
                      {c.results.themes.slice(0, 4).map((t) => t.quotes[0] && (
                        <li key={t.id} className="rounded-md border-l-2 border-violet-300 bg-slate-50 px-3 py-2 text-sm">
                          <p className="text-slate-800">&ldquo;{t.quotes[0].text}&rdquo;</p>
                          <p className="mt-1 text-xs text-slate-500">{t.quotes[0].participant} · {t.quotes[0].segment} · <span className="text-violet-700">{t.label}</span></p>
                        </li>
                      ))}
                    </ul>
                  </Card>
                  <Card title="Segments with different needs">
                    <ul className="space-y-2 text-sm">
                      {c.results.segments.map((s) => (
                        <li key={s.segment} className="flex flex-wrap items-baseline justify-between gap-2">
                          <span className="font-medium">{s.segment} <span className="font-normal text-slate-400">({s.participants})</span></span>
                          <span className="flex flex-wrap gap-1">{s.topThemes.map((t) => <Badge key={t.id}>{t.label}</Badge>)}</span>
                        </li>
                      ))}
                    </ul>
                  </Card>
                </div>
                <Card className="xl:col-span-2" title="Recommended experiments" subtitle="Each tied to the evidence behind it. These are hypotheses to test, not conclusions.">
                  <ul className="divide-y divide-slate-100">
                    {c.results.themes.filter((t) => t.id !== "speed_convenience").map((t) => (
                      <li key={t.id} className="flex flex-col gap-1 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                        <div><p className="text-sm text-slate-900">{t.experiment}</p><p className="text-xs text-slate-500">Evidence: {t.count} participants, {t.quotes.length} quotes on &ldquo;{t.label}&rdquo;</p></div>
                        <div className="flex shrink-0 gap-2">
                          <Button size="sm" variant="ghost" onClick={() => setTheme(t.id)}>Evidence</Button>
                          {t.topic && <Link href={`/dashboard/intelligence?topic=${t.topic}`} className="inline-flex h-8 items-center rounded-md px-2.5 text-xs font-medium text-violet-700 hover:bg-violet-50">Cross-channel signals →</Link>}
                        </div>
                      </li>
                    ))}
                  </ul>
                </Card>
              </div>
            )}

            <Card title="Interviews" subtitle="Full transcripts">
              {c.interviews.length === 0 ? <p className="text-sm text-slate-500">None yet.</p> : (
                <ul className="divide-y divide-slate-100">
                  {[...c.interviews].reverse().map((i) => (
                    <li key={i.id}><button onClick={() => setParam("interview", i.id)} className="flex w-full flex-wrap items-center gap-2 py-2 text-left text-sm hover:bg-slate-50">
                      <span className="font-medium">{i.participant}</span><span className="text-xs text-slate-500">{i.segment}</span>
                      <Badge tone={i.status === "completed" ? "green" : i.status === "declined" ? "slate" : "amber"}>{label(i.status)}</Badge>
                      <Badge tone={sentimentTone(i.sentiment)}>{i.sentiment}</Badge>
                      {i.source === "simulator" && <Badge tone="amber">Synthetic</Badge>}
                      <span className="ml-auto text-xs text-slate-400">{i.turns.filter((t) => t.a).length} answers · {ago(i.startedAt)}</span>
                    </button></li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        )}
      </div>

      <NewCampaignModal open={creating} onClose={() => setCreating(false)} onCreated={(id) => { setCreating(false); setParam("campaign", id); }} />
      <Drawer open={running} onClose={() => { setRunning(false); refresh(); }} title={<span>Interview: <span className="font-normal">{c?.question}</span></span>}>
        {running && c && <InterviewRunner campaignId={c.id} onDone={() => setRunning(false)} />}
      </Drawer>
      <Drawer open={!!th} onClose={() => setTheme(null)} title={th ? `Theme: ${th.label}` : ""}>
        {th && (
          <div className="space-y-4 text-sm">
            <p className="text-slate-600">{th.count} of {c.results.participants} participants raised this. Responses are matched to the theme; open an interview to read it in context.</p>
            <SentimentBar counts={th.sentiment} />
            <ul className="space-y-2">
              {th.quotes.map((q, k) => (
                <li key={k} className="rounded-md border border-slate-200 p-3">
                  <p className="text-xs text-slate-500">Q: {q.q}</p>
                  <p className="mt-1 text-slate-800">&ldquo;{q.text}&rdquo;</p>
                  <button onClick={() => { setTheme(null); setParam("interview", q.interviewId); }} className="mt-1 text-xs text-violet-700 hover:underline">{q.participant} · {q.segment} →</button>
                </li>
              ))}
            </ul>
            <div className="rounded-md bg-violet-50 p-3"><p className="text-xs font-medium text-violet-900">Suggested experiment</p><p className="mt-0.5 text-violet-900">{th.experiment}</p></div>
          </div>
        )}
      </Drawer>
      <Drawer open={!!ivOpen} onClose={() => setParam("interview", null)} title={ivOpen ? `${ivOpen.participant} · ${ivOpen.segment}` : ""}>
        {ivOpen && (
          <div className="space-y-3 text-sm">
            <p className="flex flex-wrap gap-1.5"><Badge tone={ivOpen.consent ? "green" : "slate"}>{ivOpen.consent ? "Consent given" : "No consent: nothing recorded"}</Badge>{ivOpen.source !== "user" && <DemoTag label="Synthetic participant" />}{ivOpen.themes.map((t) => <Badge key={t} tone="violet">{t}</Badge>)}</p>
            {ivOpen.turns.map((t, k) => (
              <div key={k}>
                <p className="text-slate-500">{t.followUp ? "Follow-up: " : ""}{t.q}</p>
                <p className={cx("mt-1 rounded-md px-3 py-2", t.skipped ? "italic text-slate-400" : "bg-slate-50 text-slate-800")}>{t.skipped ? "Skipped" : t.a ?? "(no answer)"}</p>
              </div>
            ))}
          </div>
        )}
      </Drawer>
    </div>
  );
}

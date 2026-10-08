"use client";
import { CheckCircle2, Copy, ExternalLink, Plus, Send, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Spark } from "@/components/charts";
import { PageSkeleton } from "@/components/loading";
import { useNexa } from "@/components/nexa-context";
import { ago, Badge, Button, Card, Empty, inputCls, label, PageHeader, Toggle, useOrigin } from "@/components/ui";

type Manifest = { version: string; bytes: number; builtAt: string };
const CDN = process.env.NEXT_PUBLIC_NEXA_CDN_URL?.replace(/\/$/, "");

export default function SdkPage() {
  const { state, api, refresh, toast } = useNexa();
  const origin = useOrigin();
  const [manifest, setManifest] = useState<Manifest | null | false>(null);
  const [domain, setDomain] = useState("");
  const [testResult, setTestResult] = useState<string | null>(null);
  const [pinned, setPinned] = useState(true);

  useEffect(() => {
    fetch("/sdk/manifest.json").then((r) => (r.ok ? r.json() : false)).then(setManifest).catch(() => setManifest(false));
  }, []);
  if (!state) return <PageSkeleton />;
  const sdk = state.settings.sdk;
  const version = manifest ? manifest.version : "1.0.0";
  const assetBase = CDN ?? origin;
  const src = pinned ? `${assetBase}/sdk/v${version}/nexa.min.js` : `${assetBase}/sdk/nexa.min.js`;
  const allOn = Object.values(sdk.autoTrack).every(Boolean);
  const snippet = `<script>
  window.NexaConfig = {
    projectKey: "${sdk.projectKey}",
    endpoint: "${origin}/api/sdk/events",
    autoTrack: ${allOn ? "true" : JSON.stringify(sdk.autoTrack)},
    requireConsent: ${state.settings.privacy.requireConsent}
  };
</script>
<script async src="${src}"></script>`;

  const save = async (patch: Record<string, unknown>, msg: string) => { await api("/api/settings", patch, "PATCH"); await refresh(); toast(msg); };
  const copy = (t: string, what: string) => navigator.clipboard.writeText(t).then(() => toast(`${what} copied`), () => toast("Copy failed. Select the text manually.", "error"));

  const sendTest = async () => {
    setTestResult(null);
    const res = await fetch("/api/sdk/events", {
      method: "POST", headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ projectKey: sdk.projectKey, sdkVersion: version, events: [{ name: "sdk_test_event", ts: Date.now(), path: "/dashboard/sdk", sessionId: `dashboardtest${Date.now().toString(36)}`, props: { source: "dashboard_test_button" } }] }),
    });
    const body = await res.json().catch(() => ({}));
    setTestResult(`${res.status} ${res.ok ? `Accepted ${body.accepted} event` : body.error}`);
    await refresh();
    if (res.ok) toast("Test event received by the ingestion API");
  };

  const status = state.sdk.total > 0
    ? { tone: "green" as const, text: `Installed: receiving events${state.sdk.hosts.length ? ` from ${state.sdk.hosts.join(", ")}` : ""}` }
    : { tone: "amber" as const, text: "Waiting for the first event" };

  return (
    <div>
      <PageHeader title="Website SDK" description="Install Nexa with one script tag to send consented journey events into this dashboard."
        actions={<><a href="/sdk-test.html" target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3.5 text-sm font-medium text-slate-800 hover:bg-slate-50"><ExternalLink size={14} />Open test page</a><Button variant="primary" onClick={sendTest}><Send size={14} />Send test event</Button></>} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {[
          ["Project", sdk.projectName], ["Public project key", sdk.projectKey], ["SDK version", manifest === false ? "Not built" : `v${version}`],
          ["Installation", status.text], ["Last event", state.sdk.last ? `${label(state.sdk.last.name)} · ${ago(state.sdk.last.at)}` : "—"], ["SDK events (total)", String(state.sdk.total)],
        ].map(([k, v]) => <div key={k} className="rounded-lg border border-slate-200 bg-white p-3"><p className="text-xs text-slate-500">{k}</p><p className="mt-1 break-words text-sm font-semibold text-slate-900">{v}</p></div>)}
      </div>
      {testResult && <p className="mt-2 text-sm text-slate-700">Test response: <code className="rounded bg-slate-100 px-1.5 py-0.5">{testResult}</code></p>}

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2" title="Installation" subtitle="Paste before </head> on every page" action={<Button size="sm" onClick={() => copy(snippet, "Snippet")}><Copy size={13} />Copy</Button>}>
          <pre className="overflow-x-auto rounded-md bg-[#0b1020] p-4 text-xs leading-relaxed text-slate-100"><code>{snippet}</code></pre>
          <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate-600">
            <Toggle checked={pinned} onChange={setPinned} label={pinned ? `Pinned to v${version} (immutable, cached 1 year)` : "Latest alias (cached 5 minutes)"} />
            {manifest && <span className="flex items-center gap-1 text-emerald-700"><CheckCircle2 size={13} />Asset built and served: {(manifest.bytes / 1024).toFixed(1)} KB</span>}
          </div>
          {!CDN && <p className="mt-2 text-xs text-slate-500">Script URL points at this app ({origin || "…"}), which serves the built file from <code>/public/sdk</code>. After deploying to a CDN, set <code>NEXT_PUBLIC_NEXA_CDN_URL</code> and this snippet will use it.</p>}
          <div className="mt-4 rounded-md bg-slate-50 p-3 text-xs text-slate-600">
            <p className="font-medium text-slate-800">Try it end to end</p>
            <ol className="mt-1 list-decimal space-y-0.5 pl-4">
              <li>Open the <a href="/sdk-test.html" target="_blank" rel="noreferrer" className="text-violet-700 hover:underline">test page</a> (it contains this snippet) and click &ldquo;Grant analytics consent&rdquo;.</li>
              <li>Click the buttons to generate events. They are batched and sent within 5 seconds.</li>
              <li>Watch them arrive in &ldquo;Live events&rdquo; on this page (refreshes every 8 seconds).</li>
            </ol>
            <p className="mt-1">Using your own page? Serve it over http(s) from an allowed domain. <code>file://</code> pages send <code>Origin: null</code> and are rejected.</p>
          </div>
        </Card>
        <Card title="Live events" subtitle="Received from installed SDKs">
          {state.sdk.recent.length === 0 ? <Empty title="No SDK events yet" body="Send a test event or open the test page." /> : (
            <ul className="max-h-80 space-y-1.5 overflow-y-auto">
              {state.sdk.recent.map((e) => (
                <li key={e.id} className="rounded border border-slate-100 px-2.5 py-1.5 text-xs">
                  <div className="flex justify-between"><span className="font-medium text-slate-800">{e.name}</span><span className="text-slate-400">{ago(e.at)}</span></div>
                  <p className="text-slate-500">{e.host} · {e.path}{e.props && Object.keys(e.props).length ? ` · ${Object.entries(e.props).map(([k, v]) => `${k}=${v}`).join(" ")}` : ""}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card title="Event volume" subtitle="SDK events per day (last 14 days)"><Spark data={state.sdk.perDay} dataKey="events" height={150} /></Card>
        <Card title="Allowed domains" subtitle="Origins allowed to send events (CORS)">
          <div className="flex flex-wrap gap-1.5">
            {sdk.allowedDomains.map((d) => (
              <span key={d} className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-1 text-xs">{d}
                <button aria-label={`Remove ${d}`} onClick={() => save({ sdk: { allowedDomains: sdk.allowedDomains.filter((x) => x !== d) } }, `Removed ${d}`)} className="text-slate-400 hover:text-red-600"><X size={12} /></button>
              </span>
            ))}
          </div>
          <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); const d = domain.trim().toLowerCase(); if (/^(\*\.)?[a-z0-9.-]+$/.test(d)) { save({ sdk: { allowedDomains: [...new Set([...sdk.allowedDomains, d])] } }, `Allowed ${d}`); setDomain(""); } else toast("Enter a hostname like shop.example.com or *.example.com", "error"); }}>
            <input className={inputCls} value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="shop.example.com or *.example.com" aria-label="Add domain" />
            <Button type="submit"><Plus size={14} /></Button>
          </form>
        </Card>
        <Card title="Consent & event configuration">
          <div className="space-y-2.5">
            <Toggle checked={state.settings.privacy.requireConsent} onChange={(v) => save({ privacy: { requireConsent: v } }, "Consent setting updated")} label="Require consent before tracking" />
            <Toggle checked={state.settings.privacy.respectDoNotTrack} onChange={(v) => save({ privacy: { respectDoNotTrack: v } }, "Updated")} label="Respect Do Not Track / GPC" />
            <hr className="border-slate-100" />
            {(Object.keys(sdk.autoTrack) as (keyof typeof sdk.autoTrack)[]).map((k) => (
              <Toggle key={k} checked={sdk.autoTrack[k]} onChange={(v) => save({ sdk: { autoTrack: { ...sdk.autoTrack, [k]: v } } }, "Event configuration updated")} label={{ pageViews: "Page views & SPA routes", errors: "JavaScript errors", rageClicks: "Rage clicks", forms: "Form start / submit / abandon" }[k]} />
            ))}
            <p className="text-[11px] text-slate-500">Changes update the snippet above. Sites using an older snippet keep their own config.</p>
          </div>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title="SDK reference">
          <div className="space-y-3 text-sm">
            {[
              ['Nexa.track("checkout_step", { step: "delivery" })', "Custom event. Names are lowercase snake_case; props are flat strings, numbers or booleans (max 20)."],
              ['Nexa.feature("express_checkout")', "Shorthand for feature_used with { feature }."],
              ['Nexa.setConsent("granted" | "denied")', "Call from your cookie banner. Stored in localStorage."],
              ["Nexa.optOut()", "Stops tracking, clears the queue and the anonymous session ID."],
              ["Nexa.flush()", "Send queued events now."],
              ['addEventListener("nexa:ready", …)', "Fires once the async script has loaded."],
            ].map(([c, d]) => <div key={c}><code className="text-xs text-violet-800">{c}</code><p className="text-xs text-slate-600">{d}</p></div>)}
            <p className="text-xs text-slate-600">Auto events: <code>page_view</code>, <code>js_error</code>, <code>rage_click</code>, <code>form_start</code>, <code>form_submit</code>, <code>form_abandon</code>. Add <code>data-nexa-ignore</code> to a form to skip it, and <code>data-nexa-id</code> to name an element for rage-click reports.</p>
            <p className="text-xs text-slate-600">Never collected: input values, keystrokes, passwords, card fields, query strings, element text. The project key is a public identifier, not a secret.</p>
          </div>
        </Card>
        <Card title="Troubleshooting">
          <dl className="space-y-2.5 text-sm">
            {[
              ["No events arrive", "Check consent: with requireConsent on, nothing is sent until Nexa.setConsent(\"granted\"). Add debug: true to NexaConfig to see console logs."],
              ["403 Origin not allowed", "Add the site's hostname to Allowed domains above."],
              ["401 Unknown project key", `The key must be ${sdk.projectKey}.`],
              ["400 No valid events", "Event names must match ^[a-z][a-z0-9_]{1,63}$."],
              ["429 Rate limit", "Over 60 requests per 10 seconds from one IP. The SDK backs off and retries automatically."],
              ["CDN deployment", "Upload public/sdk/v1.0.0/nexa.min.js with Cache-Control: public, max-age=31536000, immutable. Serve the unversioned alias with a short max-age. See README → Deploying the SDK."],
            ].map(([t, d]) => <div key={t}><dt className="font-medium text-slate-800">{t}</dt><dd className="text-xs text-slate-600">{d}</dd></div>)}
          </dl>
          <p className="mt-3 text-xs text-slate-500"><Badge tone="amber">Demo-level protection</Badge> Origin checks, an in-memory rate limit and validation are included; see README for what production needs.</p>
        </Card>
      </div>
    </div>
  );
}

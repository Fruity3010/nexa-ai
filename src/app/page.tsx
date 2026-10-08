import { ArrowRight, Banknote, BarChart3, Bed, Code2, FlaskConical, Headphones, Lightbulb, MessagesSquare, Radio, ShieldCheck, ShoppingBag, Sparkles, Stethoscope, Wifi } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/shell";

const CAPS = [
  { icon: Headphones, title: "AI Support", body: "A voice and chat agent that understands intent, answers from your knowledge base and policies, takes simple actions, and hands complex cases to a human with the full story attached." },
  { icon: FlaskConical, title: "Customer Research", body: "Ask a question in plain language. Nexa interviews customers with consent, asks adaptive follow-ups, and returns themes, segments and evidence, not a spreadsheet of answers." },
  { icon: Sparkles, title: "Customer Intelligence", body: "Connects conversations, calls, reviews, surveys and consented website behaviour to surface recurring problems, emerging issues and the friction behind them." },
  { icon: Lightbulb, title: "Actionable Insights", body: "Turns evidence into prioritised recommendations with owners, confidence and a plan to measure whether the change actually helped." },
];

const STEPS = [
  { n: "01", t: "Listen", d: "Support calls, chats, tickets, reviews, surveys and website events flow into one place." },
  { n: "02", t: "Investigate", d: "Nexa detects intent, sentiment and friction, then interviews customers to learn why." },
  { n: "03", t: "Understand", d: "Signals from different channels are linked into insights, separating observed facts from hypotheses." },
  { n: "04", t: "Act", d: "Recommendations are prioritised, assigned and tracked against the metrics they should move." },
];

const INDUSTRIES = [
  { icon: ShoppingBag, t: "E-commerce", d: "Checkout abandonment, delivery expectations, payment failures and returns." },
  { icon: Banknote, t: "Banking", d: "Failed transfers, card disputes and app access, with strict escalation for fraud." },
  { icon: Bed, t: "Hospitality", d: "Booking changes, guest complaints and pre-arrival questions, around the clock." },
  { icon: Wifi, t: "Telecommunications", d: "Network issues, data balances and plan changes at high volume." },
  { icon: Code2, t: "SaaS", d: "Onboarding friction, billing questions and feature adoption research." },
  { icon: Stethoscope, t: "Healthcare", d: "Appointment logistics and service feedback, with conservative guardrails." },
];

function Preview() {
  const bars = [62, 48, 71, 55, 80, 68, 90, 76, 95, 88, 102, 97];
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl shadow-violet-900/10" aria-label="Nexa dashboard preview" role="img">
      <div className="flex">
        <div className="hidden w-40 shrink-0 space-y-1.5 bg-[#0b1020] p-3 sm:block">
          <div className="mb-3 h-4 w-16 rounded bg-white/80" />
          {["Overview", "Live Support", "Conversations", "Research", "Intelligence", "Analytics"].map((x, i) => <div key={x} className={`rounded px-2 py-1 text-[10px] ${i === 0 ? "bg-white/10 text-white" : "text-slate-400"}`}>{x}</div>)}
        </div>
        <div className="flex-1 space-y-3 bg-slate-50 p-4">
          <div className="grid grid-cols-4 gap-2">
            {[["Interactions", "1,284"], ["AI-resolved", "82%"], ["Escalation", "14%"], ["CSAT", "4.1/5"]].map(([k, v]) => <div key={k} className="rounded border border-slate-200 bg-white p-2"><p className="text-[9px] text-slate-500">{k}</p><p className="text-sm font-semibold">{v}</p></div>)}
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded border-2 border-red-200 bg-white p-2.5">
              <p className="text-[9px] font-semibold uppercase text-red-700">Top emerging issue</p>
              <p className="mt-1 text-[11px] font-medium leading-snug">Delivery fees revealed too late are driving checkout abandonment</p>
              <div className="mt-2 flex gap-1"><span className="rounded bg-red-50 px-1 text-[9px] text-red-700">Support</span><span className="rounded bg-slate-100 px-1 text-[9px]">Web</span><span className="rounded bg-slate-100 px-1 text-[9px]">Research</span></div>
            </div>
            <div className="col-span-2 rounded border border-slate-200 bg-white p-2.5">
              <p className="text-[9px] text-slate-500">Interaction volume</p>
              <div className="mt-2 flex h-16 items-end gap-1">{bars.map((b, i) => <div key={i} className="flex-1 rounded-t bg-violet-500/80" style={{ height: `${b * 0.6}%` }} />)}</div>
            </div>
          </div>
          <p className="text-right text-[9px] text-slate-400">Illustrative preview with fictional demo data</p>
        </div>
      </div>
    </div>
  );
}

export default function Landing() {
  return (
    <div className="bg-white">
      <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <Logo />
          <nav className="hidden gap-6 text-sm text-slate-600 md:flex">
            <a href="#platform" className="hover:text-slate-900">Platform</a><a href="#how" className="hover:text-slate-900">How it works</a><a href="#industries" className="hover:text-slate-900">Industries</a><a href="#sdk" className="hover:text-slate-900">Website SDK</a>
          </nav>
          <Link href="/dashboard" className="rounded-md bg-violet-700 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-violet-800">Launch Demo</Link>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 lg:grid-cols-2 lg:py-24">
        <div>
          <p className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-medium text-violet-800"><Radio size={12} />AI Customer Intelligence Platform</p>
          <h1 className="text-4xl font-semibold leading-[1.1] tracking-tight text-slate-900 sm:text-5xl">Don&apos;t just serve your customers. Understand them.</h1>
          <p className="mt-5 max-w-xl text-lg text-slate-600">Nexa combines an AI support agent, AI-led customer research and cross-channel customer intelligence. It doesn&apos;t just answer questions: it listens across every interaction, investigates why problems happen, and helps you decide what to fix first.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/dashboard" className="inline-flex items-center gap-2 rounded-md bg-violet-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-violet-800">Launch Demo <ArrowRight size={16} /></Link>
            <a href="#platform" className="inline-flex items-center rounded-md border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-50">Explore the Platform</a>
          </div>
          <p className="mt-3 text-xs text-slate-500">The demo opens without sign-up and uses a fictional Nigerian retailer, NovaMart, with synthetic data.</p>
        </div>
        <Preview />
      </section>

      <section id="platform" className="border-t border-slate-100 bg-slate-50 py-20">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-3xl font-semibold tracking-tight text-slate-900">More than a chatbot</h2>
          <p className="mt-3 max-w-2xl text-slate-600">Most tools tell you what happened. Nexa connects the signals to show why it happened and what to do about it.</p>
          <div className="mt-10 grid gap-4 md:grid-cols-2">
            {CAPS.map((c) => (
              <div key={c.title} className="rounded-lg border border-slate-200 bg-white p-6">
                <c.icon className="text-violet-700" size={22} />
                <h3 className="mt-4 text-lg font-semibold text-slate-900">{c.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{c.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="how" className="py-20">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-3xl font-semibold tracking-tight text-slate-900">How Nexa works</h2>
          <div className="mt-10 grid gap-6 md:grid-cols-4">
            {STEPS.map((s) => (
              <div key={s.n}><p className="font-mono text-sm text-violet-700">{s.n}</p><h3 className="mt-2 font-semibold text-slate-900">{s.t}</h3><p className="mt-1 text-sm text-slate-600">{s.d}</p></div>
            ))}
          </div>
          <div className="mt-12 rounded-lg border border-slate-200 p-6">
            <p className="text-sm font-medium text-slate-900">Example from the demo</p>
            <p className="mt-2 text-slate-600">Support conversations ask why totals are higher than expected. Website events show visitors leaving right after the delivery fee appears. Research participants say they want delivery costs shown earlier. Nexa links these signals into one insight, labels which parts are observed and which are hypotheses, and recommends showing delivery fees earlier in checkout.</p>
          </div>
        </div>
      </section>

      <section id="industries" className="border-t border-slate-100 bg-slate-50 py-20">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-3xl font-semibold tracking-tight text-slate-900">Built for any customer-facing business</h2>
          <p className="mt-3 max-w-2xl text-slate-600">Industry presets configure the knowledge base, agent persona, support scenarios and terminology.</p>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {INDUSTRIES.map((i) => (
              <div key={i.t} className="rounded-lg border border-slate-200 bg-white p-5"><i.icon size={20} className="text-slate-500" /><h3 className="mt-3 font-semibold text-slate-900">{i.t}</h3><p className="mt-1 text-sm text-slate-600">{i.d}</p></div>
            ))}
          </div>
        </div>
      </section>

      <section id="sdk" className="py-20">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 lg:grid-cols-2">
          <div>
            <p className="flex items-center gap-1.5 text-sm font-medium text-violet-700"><Code2 size={16} />Nexa Website SDK</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">One script. Consent first.</h2>
            <p className="mt-3 text-slate-600">Add a single script tag to send journey events, feature usage, form abandonment, JavaScript errors and rage clicks into Nexa, only after your visitor consents.</p>
            <ul className="mt-5 space-y-2 text-sm text-slate-700">
              {["No form values, keystrokes, passwords or card fields. Ever.", "Paths only: query strings and identifiers are stripped", "Tiny, versioned, CDN-cacheable bundle that fails safely", "Public project key; no secrets in the browser"].map((x) => <li key={x} className="flex gap-2"><ShieldCheck size={16} className="mt-0.5 shrink-0 text-emerald-600" />{x}</li>)}
            </ul>
          </div>
          <pre className="overflow-x-auto rounded-lg bg-[#0b1020] p-5 text-xs leading-relaxed text-slate-100"><code>{`<script>
  window.NexaConfig = {
    projectKey: "nx_your_public_key",
    endpoint: "https://YOUR_NEXA_APP/api/sdk/events",
    autoTrack: true
  };
</script>
<script async src="https://YOUR_NEXA_APP/sdk/v1.0.0/nexa.min.js"></script>

<script>
  Nexa.feature("express_checkout");
</script>`}</code></pre>
        </div>
      </section>

      <section className="bg-[#0b1020] py-20">
        <div className="mx-auto max-w-3xl px-4 text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-white">See the whole story in a few minutes</h2>
          <p className="mt-3 text-slate-300">Simulate a support call, run a research interview, follow an insight from complaint to recommendation, and send a live SDK event.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/dashboard" className="inline-flex items-center gap-2 rounded-md bg-violet-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-violet-500">Launch Demo <ArrowRight size={16} /></Link>
            <Link href="/dashboard/support" className="inline-flex items-center gap-2 rounded-md border border-white/20 px-5 py-2.5 text-sm font-medium text-white hover:bg-white/10"><MessagesSquare size={16} />Try the AI agent</Link>
            <Link href="/dashboard/analytics" className="inline-flex items-center gap-2 rounded-md border border-white/20 px-5 py-2.5 text-sm font-medium text-white hover:bg-white/10"><BarChart3 size={16} />Explore analytics</Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-100 py-10">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 text-sm text-slate-500 md:flex-row md:items-center md:justify-between">
          <Logo />
          <nav className="flex flex-wrap gap-5"><a href="#platform">Platform</a><a href="#how">How it works</a><a href="#industries">Industries</a><a href="#sdk">Website SDK</a><Link href="/dashboard">Demo</Link></nav>
          <p>Hackathon MVP. Demo uses fictional data.</p>
        </div>
      </footer>
    </div>
  );
}

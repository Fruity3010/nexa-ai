import "server-only";
import { db, persistenceMode } from "./store";
import { InsightGenerationService, tagThemes, THEMES } from "./ai/analysis";
import { aiMode } from "./ai/llm";
import { integrations } from "./integrations";
import { voiceStatus } from "./voice/config";
import type { Campaign, Conversation, Feedback, Store, Topic, WebEvent } from "./types";

const DAY = 86_400_000;
export const FUNNEL = [
  { step: "product_view", label: "Product View" },
  { step: "add_to_cart", label: "Add to Cart" },
  { step: "checkout_started", label: "Checkout Started" },
  { step: "delivery_fee_viewed", label: "Delivery Fee Viewed" },
  { step: "payment_started", label: "Payment Started" },
  { step: "purchase_completed", label: "Purchase Completed" },
];
export const TOPIC_LABEL: Record<Topic, string> = {
  delivery_fee_surprise: "Unexpected delivery fees",
  payment_failure: "Payment failures",
  delivery_date_unclear: "Delivery date / order status",
  express_checkout_adoption: "Express checkout",
  refund_delays: "Refunds & returns",
  account_access: "Account access",
  general: "General enquiries",
};

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 10 : 0);
const dayKey = (t: string | number) => new Date(t).toISOString().slice(0, 10);

function metrics(convs: Conversation[], fb: Feedback[], interviews: number) {
  const ratings = [...convs.map((c) => c.csat).filter((x): x is number => !!x), ...fb.map((f) => f.rating)];
  const live = convs.filter((c) => c.channel !== "email");
  return {
    interactions: convs.length + fb.length + interviews,
    aiResolvedPct: pct(convs.filter((c) => c.status === "ai_resolved").length, convs.length),
    aiResolved: convs.filter((c) => c.status === "ai_resolved").length,
    escalationPct: pct(convs.filter((c) => c.status === "escalated" || c.status === "human_resolved").length, convs.length),
    avgResponseSec: live.length ? Math.round((live.reduce((s, c) => s + c.firstResponseSec, 0) / live.length) * 10) / 10 : 0,
    csat: ratings.length ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 100) / 100 : 0,
  };
}

function sessionsOf(events: WebEvent[]) {
  const m = new Map<string, WebEvent[]>();
  for (const e of events) (m.get(e.sessionId) ?? m.set(e.sessionId, []).get(e.sessionId)!).push(e);
  return m;
}

function funnelOf(sessions: Map<string, WebEvent[]>) {
  const reached = FUNNEL.map((f) => [...sessions.values()].filter((evs) => evs.some((e) => e.name === f.step)).length);
  return FUNNEL.map((f, i) => ({
    ...f, sessions: reached[i],
    conversionPct: pct(reached[i], reached[0]),
    dropPct: i === 0 ? 0 : Math.round((100 - pct(reached[i], reached[i - 1])) * 10) / 10,
  }));
}

/** What sessions that stopped at a funnel step did last. */
function stepDetail(sessions: Map<string, WebEvent[]>, step: string, next: string | undefined) {
  const stopped = [...sessions.values()].filter((evs) => evs.some((e) => e.name === step) && (!next || !evs.some((e) => e.name === next)));
  const after = new Map<string, number>();
  for (const evs of stopped) {
    const i = evs.findIndex((e) => e.name === step);
    const rest = evs.slice(i + 1);
    const label = rest.length === 0 ? "Left the site" : rest.map((e) => e.name === "rage_click" ? `Rage click on ${e.props?.target}` : e.name === "page_view" ? `Went back to ${e.path}` : e.name.replace(/_/g, " ")).join(" → ");
    after.set(label, (after.get(label) ?? 0) + 1);
  }
  return {
    stopped: stopped.length,
    behaviours: [...after.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([label, count]) => ({ label, count })),
    sampleSessions: stopped.slice(-6).reverse().map((evs) => evs[0].sessionId),
  };
}

function campaignResults(c: Campaign) {
  const started = c.interviews.filter((i) => i.status !== "in_progress");
  const consented = c.interviews.filter((i) => i.consent);
  const completed = c.interviews.filter((i) => i.status === "completed");
  const themes = Object.entries(THEMES).map(([id, t]) => {
    const ivs = consented.filter((i) => i.themes.includes(id));
    const quotes = ivs.flatMap((i) => i.turns.filter((tu) => tu.a && tagThemes(tu.a).includes(id)).map((tu) => ({ interviewId: i.id, participant: i.participant, segment: i.segment, q: tu.q, text: tu.a! })));
    return {
      id, label: t.label, count: ivs.length, experiment: t.experiment, topic: t.topic,
      sentiment: { positive: ivs.filter((i) => i.sentiment === "positive").length, neutral: ivs.filter((i) => i.sentiment === "neutral").length, negative: ivs.filter((i) => i.sentiment === "negative").length },
      quotes,
    };
  }).filter((t) => t.count > 0).sort((a, b) => b.count - a.count);
  const segments = [...new Set(consented.map((i) => i.segment))].map((seg) => {
    const ivs = consented.filter((i) => i.segment === seg);
    const counts = new Map<string, number>();
    ivs.forEach((i) => i.themes.forEach((t) => counts.set(t, (counts.get(t) ?? 0) + 1)));
    return { segment: seg, participants: ivs.length, topThemes: [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([id, n]) => ({ id, label: THEMES[id]?.label ?? id, n })) };
  });
  return {
    participants: consented.length,
    completed: completed.length,
    completionRate: pct(completed.length, started.length || 1),
    themes, segments,
  };
}

function weekly(series: { at: string }[], weeks: number, now: number) {
  return Array.from({ length: weeks }, (_, w) => {
    const end = now - (weeks - 1 - w) * 7 * DAY, start = end - 7 * DAY;
    return series.filter((x) => { const t = Date.parse(x.at); return t >= start && t < end; }).length;
  });
}

function recImpact(s: Store, recId: string, liftPct: number, sessions: Map<string, WebEvent[]>, now: number) {
  let baseline: number[] = [];
  let unit = "";
  if (recId === "rec-1") {
    unit = "%";
    baseline = Array.from({ length: 8 }, (_, w) => {
      const end = now - (7 - w) * 7 * DAY, start = end - 7 * DAY;
      const ss = [...sessions.values()].filter((evs) => { const t = Date.parse(evs[0].at); return t >= start && t < end; });
      const fee = ss.filter((e) => e.some((x) => x.name === "delivery_fee_viewed")).length;
      return pct(ss.filter((e) => e.some((x) => x.name === "purchase_completed")).length, fee);
    });
  } else if (recId === "rec-4") {
    unit = "%";
    baseline = Array.from({ length: 8 }, (_, w) => {
      const end = now - (7 - w) * 7 * DAY, start = end - 7 * DAY;
      const ss = [...sessions.values()].filter((evs) => { const t = Date.parse(evs[0].at); return t >= start && t < end && evs.some((x) => x.name === "checkout_started"); });
      return pct(ss.filter((e) => e.some((x) => x.name === "feature_used")).length, ss.length);
    });
  } else {
    const topic = recId === "rec-2" ? "payment_failure" : "delivery_date_unclear";
    baseline = weekly(s.conversations.filter((c) => c.topic === topic && (recId !== "rec-2" || c.status !== "ai_resolved")).map((c) => ({ at: c.startedAt })), 8, now);
  }
  const last = baseline.slice(-3).reduce((a, b) => a + b, 0) / 3 || 1;
  const projected = Array.from({ length: 6 }, (_, i) => Math.round(last * (1 + (liftPct / 100) * Math.min(1, (i + 1) / 4)) * 10) / 10);
  return { unit, baseline, projected };
}

export function buildState(days: number) {
  const s = db();
  const now = Date.now();
  const from = now - days * DAY, prevFrom = from - days * DAY;
  const inP = (at: string) => Date.parse(at) >= from;
  const inPrev = (at: string) => { const t = Date.parse(at); return t >= prevFrom && t < from; };

  const convs = s.conversations.filter((c) => inP(c.startedAt));
  const fb = s.feedback.filter((f) => inP(f.at));
  const ivs = s.campaigns.flatMap((c) => c.interviews.filter((i) => i.consent && inP(i.startedAt)));
  const prevIvs = s.campaigns.flatMap((c) => c.interviews.filter((i) => i.consent && inPrev(i.startedAt)));
  const events = s.events.filter((e) => inP(e.at));
  const sessions = sessionsOf(events);
  const allSessions = sessionsOf(s.events);
  const funnel = funnelOf(sessions);
  const cust = new Map(s.customers.map((c) => [c.id, c]));

  const count = <T,>(xs: T[], key: (x: T) => string) => {
    const m: Record<string, number> = {};
    xs.forEach((x) => { const k = key(x); m[k] = (m[k] ?? 0) + 1; });
    return m;
  };

  // daily volume by channel
  const volume: Record<string, number | string>[] = [];
  for (let d = days - 1; d >= 0; d--) {
    const k = dayKey(now - d * DAY);
    volume.push({ date: k, chat: 0, voice: 0, whatsapp: 0, email: 0, feedback: 0 });
  }
  const byDay = new Map(volume.map((v) => [v.date as string, v]));
  convs.forEach((c) => { const v = byDay.get(dayKey(c.startedAt)); if (v) (v[c.channel] as number)++; });
  fb.forEach((f) => { const v = byDay.get(dayKey(f.at)); if (v) (v.feedback as number)++; });

  const weeks = Math.max(2, Math.round(days / 7));
  const topicCounts = count(convs, (c) => c.topic);
  // Fixed set + order so each issue keeps its color regardless of rank.
  const trendTopics: Topic[] = ["delivery_fee_surprise", "payment_failure", "delivery_date_unclear", "refund_delays"];
  const issueTrends = Array.from({ length: weeks }, (_, w) => {
    const end = now - (weeks - 1 - w) * 7 * DAY, start = end - 7 * DAY;
    const row: Record<string, number | string> = { week: new Date(start).toISOString().slice(5, 10) };
    for (const t of trendTopics) row[t] = s.conversations.filter((c) => c.topic === t && Date.parse(c.startedAt) >= start && Date.parse(c.startedAt) < end).length +
      s.feedback.filter((f) => f.topic === t && Date.parse(f.at) >= start && Date.parse(f.at) < end).length;
    return row;
  });

  const insights = s.insights.map((ins) => ({ ...ins, eval: InsightGenerationService.evaluate(s, ins, funnel), periodCount: (topicCounts[ins.topic] ?? 0) + fb.filter((f) => f.topic === ins.topic).length }))
    .sort((a, b) => (b.severity === "critical" ? 1 : 0) - (a.severity === "critical" ? 1 : 0) || b.periodCount - a.periodCount);

  // website analytics
  const checkoutSessions = [...sessions.values()].filter((e) => e.some((x) => x.name === "checkout_started"));
  const formStarts = events.filter((e) => e.name === "form_start").length;
  const groupBy = (evs: WebEvent[], key: (e: WebEvent) => string) => {
    const m = new Map<string, { key: string; count: number; path: string; lastAt: string; sessions: Set<string> }>();
    evs.forEach((e) => { const k = key(e); const g = m.get(k) ?? { key: k, count: 0, path: e.path, lastAt: e.at, sessions: new Set() }; g.count++; g.lastAt = e.at > g.lastAt ? e.at : g.lastAt; g.sessions.add(e.sessionId); m.set(k, g); });
    return [...m.values()].sort((a, b) => b.count - a.count).map(({ sessions, ...g }) => ({ ...g, sessions: sessions.size, sampleSession: [...sessions].at(-1) }));
  };
  const web = {
    pageViews: events.filter((e) => e.name === "page_view").length,
    sessions: sessions.size,
    funnel,
    checkoutAbandonmentPct: Math.round((100 - pct(checkoutSessions.filter((e) => e.some((x) => x.name === "purchase_completed")).length, checkoutSessions.length)) * 10) / 10,
    formAbandonmentPct: pct(events.filter((e) => e.name === "form_abandon").length, formStarts),
    features: groupBy(events.filter((e) => e.name === "feature_used"), (e) => String(e.props?.feature ?? "unknown")).map((f) => ({ ...f, sharePct: pct(f.sessions, checkoutSessions.length) })),
    errors: groupBy(events.filter((e) => e.name === "js_error"), (e) => String(e.props?.message ?? "Unknown error")),
    rageClicks: groupBy(events.filter((e) => e.name === "rage_click"), (e) => `${e.props?.target ?? "?"} on ${e.path}`),
    daily: volume.map((v) => {
      const ss = [...sessions.values()].filter((evs) => dayKey(evs[0].at) === v.date);
      return { date: v.date, sessions: ss.length, purchases: ss.filter((e) => e.some((x) => x.name === "purchase_completed")).length };
    }),
    steps: Object.fromEntries(FUNNEL.map((f, i) => [f.step, stepDetail(sessions, f.step, FUNNEL[i + 1]?.step)])),
    recentSessions: [...sessions.values()].slice(-40).reverse().map((evs) => ({
      id: evs[0].sessionId, startedAt: evs[0].at, events: evs.length, device: String(evs[0].props?.device ?? (evs[0].origin === "sdk" ? "sdk" : "?")),
      lastStep: [...FUNNEL].reverse().find((f) => evs.some((e) => e.name === f.step))?.label ?? "Browsing",
      converted: evs.some((e) => e.name === "purchase_completed"),
      issues: evs.filter((e) => ["rage_click", "js_error", "form_abandon"].includes(e.name)).length,
      origin: evs[0].origin,
    })),
  };

  const sdkEvents = s.events.filter((e) => e.origin === "sdk");
  const sdk = {
    total: sdkEvents.length,
    last: sdkEvents.at(-1) ?? null,
    hosts: [...new Set(sdkEvents.map((e) => e.host).filter(Boolean))],
    perDay: Array.from({ length: 14 }, (_, i) => { const k = dayKey(now - (13 - i) * DAY); return { date: k, events: sdkEvents.filter((e) => dayKey(e.at) === k).length }; }),
    recent: sdkEvents.slice(-30).reverse(),
  };

  return {
    generatedAt: new Date(now).toISOString(),
    days,
    aiMode: aiMode(),
    persistence: persistenceMode(),
    settings: s.settings,
    integrations: integrations(s),
    voice: voiceStatus(),
    metrics: { current: metrics(convs, fb, ivs.length), previous: metrics(s.conversations.filter((c) => inPrev(c.startedAt)), s.feedback.filter((f) => inPrev(f.at)), prevIvs.length) },
    charts: {
      volume,
      channels: count(convs, (c) => c.channel),
      sentiment: count([...convs, ...fb], (x) => x.sentiment),
      intents: Object.entries(count(convs, (c) => c.intent)).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([intent, n]) => ({ intent, n })),
      issueTrends, trendTopics,
    },
    topicLabels: TOPIC_LABEL,
    insights,
    recommendations: s.recommendations.map((r) => ({ ...r, impactData: recImpact(s, r.id, r.impactMetric.liftPct, allSessions, now) })),
    conversations: convs.map((c) => ({
      id: c.id, channel: c.channel, customer: cust.get(c.customerId)?.name ?? "Unknown", intent: c.intent, topic: c.topic, sentiment: c.sentiment,
      status: c.status, priority: c.priority, assignee: c.assignee, startedAt: c.startedAt, summary: c.summary, source: c.source,
      preview: c.messages.find((m) => m.role === "customer")?.text ?? "",
      durationSec: c.durationSec, call: c.call,
    })),
    feedback: fb.map((f) => ({ ...f, customer: cust.get(f.customerId)?.name ?? "Unknown" })),
    campaigns: s.campaigns.map((c) => ({ ...c, results: campaignResults(c) })),
    activity: s.activity.slice(0, 15),
    web,
    sdk,
  };
}

export type NexaState = ReturnType<typeof buildState>;

export function sessionDetail(id: string) {
  return db().events.filter((e) => e.sessionId === id);
}

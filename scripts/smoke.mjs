// End-to-end smoke test against a running Nexa server: `npm run smoke` (BASE defaults to http://localhost:3000).
// Creates demo records; run `curl -X POST $BASE/api/reset` afterwards for a clean demo.
import assert from "node:assert/strict";

const BASE = process.env.BASE ?? "http://localhost:3000";
const post = (path, body, headers = {}) => fetch(BASE + path, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: typeof body === "string" ? body : JSON.stringify(body) });
const state = () => fetch(`${BASE}/api/state?days=7`).then((r) => r.json());
const ok = (name) => console.log(`✓ ${name}`);

// Dashboard state
const s0 = await state();
assert.ok(s0.conversations.length > 20 && s0.insights.length >= 4 && s0.web.funnel.length === 6);
ok("state loads with seeded data");

// Support agent: multi-turn order lookup and double-charge escalation
let r = await (await post("/api/support/chat", { message: "Where is my order?" })).json();
assert.equal(r.turn.intent, "order_status");
r = await (await post("/api/support/chat", { conversationId: r.conversation.id, message: "NM-10421" })).json();
assert.match(r.turn.reply, /NM-10421/);
assert.equal(r.conversation.status, "ai_resolved");
ok("agent resolves order status with demo lookup");
r = await (await post("/api/support/chat", { message: "I was charged twice." })).json();
r = await (await post("/api/support/chat", { conversationId: r.conversation.id, message: "NM-10476" })).json();
assert.equal(r.turn.escalate, true);
assert.equal(r.conversation.status, "escalated");
assert.ok(r.conversation.summary.includes("NM-10476"));
ok("double charge escalates with handoff summary");
r = await (await post("/api/support/chat", { message: "What is the meaning of life?" })).json();
assert.match(r.turn.reply, /not certain/);
ok("unknown question admits uncertainty instead of inventing policy");
assert.equal((await post("/api/support/chat", { message: "" })).status, 400);

// SDK ingestion
const key = s0.settings.sdk.projectKey;
const ev = { projectKey: key, events: [{ name: "feature_used", path: "/checkout?token=secret", props: { feature: "express_checkout", card_number: "4111" } }] };
let res = await post("/api/sdk/events", JSON.stringify(ev), { "Content-Type": "text/plain", Origin: "http://localhost:5500" });
assert.equal(res.status, 202);
assert.equal(res.headers.get("access-control-allow-origin"), "http://localhost:5500");
ok("valid SDK batch accepted (202) with CORS");
assert.equal((await post("/api/sdk/events", "{not json")).status, 400);
assert.equal((await post("/api/sdk/events", { projectKey: key, events: [] })).status, 400);
assert.equal((await post("/api/sdk/events", { projectKey: key, events: [{ name: "Bad Name!" }] })).status, 400);
assert.equal((await post("/api/sdk/events", { projectKey: "wrong", events: [{ name: "page_view" }] })).status, 401);
assert.equal((await post("/api/sdk/events", ev, { Origin: "https://evil.example" })).status, 403);
assert.equal((await post("/api/sdk/events", { projectKey: key, events: Array(51).fill({ name: "x_y" }) })).status, 400);
ok("malformed / unauthorised / disallowed batches rejected (400/401/403)");
const s1 = await state();
assert.equal(s1.sdk.total, s0.sdk.total + 1);
assert.equal(s1.sdk.last.path, "/checkout");
assert.equal(s1.sdk.last.props.card_number, undefined);
ok("dashboard reflects ingested event; query string and sensitive props stripped");

// SDK asset served
res = await fetch(`${BASE}/sdk/nexa.min.js`);
assert.equal(res.status, 200);
assert.match(res.headers.get("content-type"), /javascript/);
assert.match(await res.text(), /Nexa Website SDK/);
ok("SDK bundle served at /sdk/nexa.min.js");

// Research
const camp = await (await post("/api/research/campaigns", { question: "Why are customers not using our new express checkout feature?", consentText: "We ask a few questions. Skip or stop anytime." })).json();
assert.ok(camp.campaign.id);
let iv = await (await post("/api/research/interview", { campaignId: camp.campaign.id, action: "start" })).json();
iv = await (await post("/api/research/interview", { campaignId: camp.campaign.id, interviewId: iv.interview.id, action: "answer", answer: "no" })).json();
assert.equal(iv.interview.status, "declined");
assert.equal(iv.interview.turns.length, 0);
ok("declined consent records nothing");
await post("/api/research/simulate", { campaignId: camp.campaign.id, count: 6 });
const s2 = await state();
const c = s2.campaigns.find((x) => x.id === camp.campaign.id);
assert.ok(c.results.themes.length >= 3);
ok(`synthetic interviews produce ${c.results.themes.length} themes`);

console.log("\nAll smoke checks passed.");

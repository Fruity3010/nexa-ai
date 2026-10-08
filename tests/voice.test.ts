// Voice integration tests. All providers are faked: no Twilio calls, no Gemini/Claude requests.
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { afterEach, describe, test } from "node:test";
import { WebSocket } from "ws";
import { POST as bridgePOST } from "../src/app/api/voice/bridge/route";
import { POST as simulatePOST } from "../src/app/api/voice/simulate/route";
import { POST as statusPOST } from "../src/app/api/voice/status/route";
import { POST as twilioPOST } from "../src/app/api/voice/twilio/route";
import { POST as chatPOST } from "../src/app/api/support/chat/route";
import { db } from "../src/lib/store";
import { createDownsampler24kTo8k, encodeMulawSample, mulawToPcm16 } from "../src/lib/voice/audio";
import { findCall } from "../src/lib/voice/calls";
import { voiceConfig } from "../src/lib/voice/config";
import { analyseCall } from "../src/lib/voice/intelligence";
import { streamToken, twilioSignature, validTwilioSignature } from "../src/lib/voice/twilio";
import { createBridge, type LiveHandlers, type LiveVoiceProvider } from "../src/voice/bridge";
import type { Conversation } from "../src/lib/types";

const TOKEN = "test_auth_token";
const PUBLIC = "https://nexa.example";
const SECRET = "bridge-secret";
let n = 0;
const newSid = () => `CA${(++n + Date.now()).toString(16).padStart(32, "0")}`;

function setEnv(extra: Record<string, string> = {}) {
  for (const k of Object.keys(process.env)) if (/^(TWILIO_|GEMINI_|ANTHROPIC_|VOICE_|NEXA_PUBLIC|NEXA_HANDOFF|NEXA_VOICE)/.test(k)) delete process.env[k];
  Object.assign(process.env, extra);
}
const telephony = (extra: Record<string, string> = {}) => setEnv({ TWILIO_AUTH_TOKEN: TOKEN, TWILIO_PHONE_NUMBER: "+15550001111", NEXA_PUBLIC_URL: PUBLIC, ...extra });
const streaming = (extra: Record<string, string> = {}) => telephony({ GEMINI_API_KEY: "fake", VOICE_BRIDGE_SECRET: SECRET, ...extra });

function twilioReq(path: string, params: Record<string, string>, sign: boolean | string = true) {
  const body = new URLSearchParams(params);
  const headers: Record<string, string> = { "content-type": "application/x-www-form-urlencoded" };
  if (sign) headers["x-twilio-signature"] = typeof sign === "string" ? sign : twilioSignature(TOKEN, PUBLIC + path, body);
  return new Request(`http://localhost:3000${path}`, { method: "POST", headers, body });
}
const call = (sid: string, extra: Record<string, string> = {}) => twilioPOST(twilioReq("/api/voice/twilio", { CallSid: sid, From: "+2348031234821", ...extra })).then((r) => r.text());
const say = (sid: string, speech: string) => call(sid, { SpeechResult: speech });
const hangup = (sid: string, dur = "42") => statusPOST(twilioReq("/api/voice/status", { CallSid: sid, CallStatus: "completed", CallDuration: dur }));
const bridgeApi = (body: object, secret = SECRET) =>
  bridgePOST(new Request("http://localhost:3000/api/voice/bridge", { method: "POST", headers: { authorization: `Bearer ${secret}`, "content-type": "application/json" }, body: JSON.stringify(body) }));

afterEach(() => setEnv());

describe("audio conversion", () => {
  test("μ-law round trip stays within quantisation error", () => {
    for (const s of [0, 100, -100, 1000, -5000, 12000, -32000]) {
      const back = mulawToPcm16(Buffer.from([encodeMulawSample(s)])).readInt16LE(0);
      assert.ok(Math.abs(back - s) <= Math.max(8, Math.abs(s) * 0.07), `${s} → ${back}`);
    }
  });
  test("24 kHz PCM → 8 kHz μ-law: one byte per 3 samples, odd chunk sizes carried over", () => {
    const down = createDownsampler24kTo8k();
    assert.equal(down(Buffer.alloc(6 * 160)).length, 160);
    assert.equal(down(Buffer.alloc(7)).length, 1); // 1 frame + 1 leftover byte
    assert.equal(down(Buffer.alloc(5)).length, 1); // leftover completes a frame
  });
});

describe("Twilio signature validation", () => {
  test("accepts a correct signature, rejects tampered params, URL or token", () => {
    const p = new URLSearchParams({ CallSid: "CA1", From: "+1555" });
    const sig = twilioSignature(TOKEN, `${PUBLIC}/api/voice/twilio`, p);
    assert.ok(validTwilioSignature(TOKEN, `${PUBLIC}/api/voice/twilio`, p, sig));
    assert.ok(!validTwilioSignature(TOKEN, `${PUBLIC}/api/voice/twilio`, new URLSearchParams({ CallSid: "CA2", From: "+1555" }), sig));
    assert.ok(!validTwilioSignature(TOKEN, `${PUBLIC}/other`, p, sig));
    assert.ok(!validTwilioSignature("other", `${PUBLIC}/api/voice/twilio`, p, sig));
    assert.ok(!validTwilioSignature(TOKEN, `${PUBLIC}/api/voice/twilio`, p, null));
  });
  test("webhook rejects unsigned and wrongly signed requests", async () => {
    telephony();
    assert.equal((await twilioPOST(twilioReq("/api/voice/twilio", { CallSid: newSid() }, false))).status, 403);
    assert.equal((await twilioPOST(twilioReq("/api/voice/twilio", { CallSid: newSid() }, "bm9wZQ=="))).status, 403);
    assert.equal((await statusPOST(twilioReq("/api/voice/status", { CallSid: newSid(), CallStatus: "completed" }, false))).status, 403);
  });
});

describe("configuration", () => {
  test("demo mode with no credentials: not configured, webhooks refuse, nothing crashes", async () => {
    const cfg = voiceConfig({});
    assert.equal(cfg.mode, "not-configured");
    assert.equal(cfg.demoMode, true);
    assert.deepEqual(cfg.missingTelephony, ["TWILIO_AUTH_TOKEN", "TWILIO_PHONE_NUMBER", "NEXA_PUBLIC_URL or TWILIO_VOICE_WEBHOOK_URL"]);
    assert.equal((await twilioPOST(twilioReq("/api/voice/twilio", { CallSid: newSid() }))).status, 403);
  });
  test("mode selection: turn-based without Gemini, streaming with it", () => {
    const base = { TWILIO_AUTH_TOKEN: "t", TWILIO_PHONE_NUMBER: "+1", NEXA_PUBLIC_URL: "https://x.example/" };
    assert.equal(voiceConfig(base).mode, "turn-based");
    const s = voiceConfig({ ...base, GEMINI_API_KEY: "k", VOICE_BRIDGE_SECRET: "s" });
    assert.equal(s.mode, "streaming");
    assert.equal(s.twilio.streamUrl, "wss://x.example/media-stream");
    assert.equal(s.gemini.liveModel, "gemini-3.8-live");
  });
  test("bridge API requires the shared secret", async () => {
    streaming();
    assert.equal((await bridgeApi({ type: "start", callSid: newSid() }, "wrong-secret")).status, 401);
    assert.equal((await bridgeApi({ type: "nope" })).status, 400);
  });
});

describe("inbound calls and lifecycle", () => {
  test("streaming mode answers with <Connect><Stream>, a per-call token and an after-stream redirect", async () => {
    streaming();
    const sid = newSid();
    const xml = await call(sid);
    assert.match(xml, /<Connect><Stream url="wss:\/\/nexa\.example\/media-stream">/);
    assert.ok(xml.includes(`<Parameter name="token" value="${streamToken(SECRET, sid)}"/>`));
    assert.match(xml, /<Redirect method="POST">https:\/\/nexa\.example\/api\/voice\/twilio\?step=after<\/Redirect>/);
    const c = findCall(sid)!;
    assert.equal(c.call!.from, "•••4821");
    assert.ok(!JSON.stringify(c).includes("8031234821"), "full caller number must not be stored");
    assert.equal(c.call!.engine, "gemini-live");
  });

  test("Gemini failure mid-call falls back to turn-based <Gather>", async () => {
    streaming();
    const sid = newSid();
    await call(sid);
    assert.equal((await bridgeApi({ type: "provider_failed", callSid: sid, error: "socket closed" })).status, 200);
    const xml = await twilioPOST(twilioReq("/api/voice/twilio?step=after", { CallSid: sid })).then((r) => r.text());
    assert.match(xml, /<Gather input="speech"/);
    assert.equal(findCall(sid)!.call!.engine, "twilio-gather");
  });

  test("Scenario A (turn-based): order tracking asks for an order id, uses the demo lookup, resolves on confirmation", async () => {
    telephony();
    const sid = newSid();
    assert.match(await call(sid), /AI assistant|virtual/i); // AI disclosure in greeting
    assert.match(await say(sid, "Hi, I placed an order yesterday. Can you tell me where it is?"), /order number/i);
    assert.match(await say(sid, "It's NM-10457"), /NM-10457/);
    assert.match(await say(sid, "Okay, thank you, that's all."), /<Hangup\/>/);
    await hangup(sid);
    const c = findCall(sid)!;
    assert.equal(c.call!.status, "completed");
    assert.equal(c.durationSec, 42);
    assert.equal(c.call!.intelligence!.resolution, "resolved");
    assert.equal(c.status, "ai_resolved");
    assert.equal(c.topic, "delivery_date_unclear"); // feeds the cross-channel insight
  });

  test("Scenario B: duplicate charge escalates; without a handoff line no transfer is claimed", async () => {
    telephony();
    const sid = newSid();
    await call(sid);
    await say(sid, "I think I was charged twice.");
    const xml = await say(sid, "The order number is NM-10476");
    assert.doesNotMatch(xml, /<Dial>/);
    assert.match(xml, /call you back/);
    await hangup(sid);
    const c = findCall(sid)!;
    assert.equal(c.status, "escalated");
    assert.equal(c.call!.handoff!.transfer, "not_configured");
    const intel = c.call!.intelligence!;
    assert.equal(intel.escalated, true);
    assert.equal(intel.resolved, false);
    assert.equal(intel.intent, "double_charge");
    assert.equal(intel.follow_up_required, true);
  });

  test("Scenario C: delivery complaint asks for the order, then gives a grounded late-delivery answer", async () => {
    telephony();
    const sid = newSid();
    await call(sid);
    assert.match(await say(sid, "I paid for delivery and my order still hasn't arrived."), /order number/i); // follow-up question
    assert.match(await say(sid, "NM-10457"), /NM-10457.*Logistics team/);
    await hangup(sid);
    assert.equal(findCall(sid)!.call!.intelligence!.intent, "delivery_delay");
  });

  test("Scenario D: frustrated caller is handed off and transferred when a handoff number is configured", async () => {
    telephony({ VOICE_HUMAN_HANDOFF_NUMBER: "+15550002222" });
    const sid = newSid();
    await call(sid);
    const xml = await say(sid, "I have explained this three times. I want to speak to someone.");
    assert.match(xml, /<Dial>\+15550002222<\/Dial>/);
    const c = findCall(sid)!;
    assert.equal(c.call!.handoff!.transfer, "dialing");
    assert.ok(c.messages.some((m) => m.role === "customer" && /three times/.test(m.text)), "transcript preserved");
  });

  test("streaming escalation via tool: transfer after the stream closes only if configured", async () => {
    streaming({ VOICE_HUMAN_HANDOFF_NUMBER: "+15550002222" });
    const sid = newSid();
    await call(sid);
    const r = await (await bridgeApi({ type: "tool", callSid: sid, name: "escalate_to_human", args: { reason: "Caller asked for a person", summary: "Delivery late, caller frustrated", urgency: "high" } })).json();
    assert.equal(r.response.transfer, true);
    const xml = await twilioPOST(twilioReq("/api/voice/twilio?step=after", { CallSid: sid })).then((x) => x.text());
    assert.match(xml, /<Dial>\+15550002222<\/Dial>/);

    streaming();
    const sid2 = newSid();
    await call(sid2);
    const r2 = await (await bridgeApi({ type: "tool", callSid: sid2, name: "escalate_to_human", args: { reason: "x", summary: "y" } })).json();
    assert.equal(r2.response.transfer, false);
    assert.ok(r2.response.callback_message);
    assert.match(await twilioPOST(twilioReq("/api/voice/twilio?step=after", { CallSid: sid2 })).then((x) => x.text()), /<Hangup\/>/);
  });

  test("lookup_order tool returns labelled demo data and never guesses", async () => {
    streaming();
    const sid = newSid();
    await call(sid);
    const hit = await (await bridgeApi({ type: "tool", callSid: sid, name: "lookup_order", args: { order_id: "nm 10421" } })).json();
    assert.equal(hit.response.found, true);
    assert.match(hit.response.source, /DEMO/);
    const miss = await (await bridgeApi({ type: "tool", callSid: sid, name: "lookup_order", args: { order_id: "NM-99999" } })).json();
    assert.equal(miss.response.found, false);
  });

  test("call end is idempotent (bridge end + status callback) and a hang-up is not 'resolved'", async () => {
    streaming();
    const sid = newSid();
    await call(sid);
    await bridgeApi({ type: "transcript", callSid: sid, role: "customer", text: "Where is my order NM-10421?" });
    await bridgeApi({ type: "transcript", callSid: sid, role: "agent", text: "It is out for delivery." });
    assert.equal((await bridgeApi({ type: "end", callSid: sid, reason: "completed", durationSec: 30 })).status, 200);
    await hangup(sid, "99");
    const c = findCall(sid)!;
    assert.equal(c.durationSec, 30, "second finalisation ignored");
    assert.equal(c.call!.intelligence!.resolution, "unknown");
    assert.equal(c.status, "open");
    assert.equal(c.call!.transcript, "complete");
  });
});

describe("post-call intelligence", () => {
  const conv = (over: Partial<Conversation>): Conversation => ({
    id: "x", channel: "voice", customerId: "c", intent: "unknown", topic: "general", sentiment: "neutral", status: "open", priority: "low", startedAt: new Date().toISOString(),
    firstResponseSec: 1, effort: 1, summary: "", nextAction: "", attempted: [], notes: [], source: "phone",
    messages: [{ id: "1", role: "customer", text: "This is ridiculous, I was charged twice!", at: "" }, { id: "2", role: "customer", text: "I want to speak to a manager now, this is terrible", at: "" }],
    call: { provider: "twilio", engine: "gemini-live", from: "•••0000", status: "completed", transcript: "complete" }, ...over,
  });

  test("Gemini failure falls back to validated rules output", async () => {
    process.env.GEMINI_API_KEY = "fake";
    const realFetch = globalThis.fetch;
    let attempted = false;
    globalThis.fetch = (async () => { attempted = true; throw new Error("network down"); }) as typeof fetch;
    try {
      const out = await analyseCall(conv({}), db().settings);
      assert.ok(attempted, "Gemini was attempted");
      assert.equal(out.engine, "rules");
      assert.equal(out.sentiment, "frustrated");
      assert.equal(out.intent, "double_charge");
    } finally {
      globalThis.fetch = realFetch;
    }
  });

  test("escalated calls are never reported as resolved", async () => {
    const out = await analyseCall(conv({ status: "escalated", call: { provider: "twilio", engine: "gemini-live", from: "•", status: "completed", transcript: "complete", resolvedConfirmed: true } }), db().settings);
    assert.equal(out.escalated, true);
    assert.equal(out.resolved, false);
  });
});

describe("simulated calls (demo mode)", () => {
  test("simulator session is finalised with intelligence and labelled as simulated", async () => {
    setEnv();
    const json = (r: Response) => r.json();
    let r = await chatPOST(new Request("http://x/api/support/chat", { method: "POST", body: JSON.stringify({ message: "Where is my order?", channel: "voice" }) })).then(json);
    r = await chatPOST(new Request("http://x/api/support/chat", { method: "POST", body: JSON.stringify({ conversationId: r.conversation.id, message: "NM-10421", channel: "voice" }) })).then(json);
    const out = await simulatePOST(new Request("http://x", { method: "POST", body: JSON.stringify({ conversationId: r.conversation.id, durationSec: 20 }) })).then(json);
    assert.equal(out.conversation.call.provider, "simulated");
    assert.ok(out.conversation.call.intelligence);
    process.env.VOICE_DEMO_MODE = "false";
    assert.equal((await simulatePOST(new Request("http://x", { method: "POST", body: "{}" }))).status, 403);
  });
});

// ------------------------------------------------------------------ bridge (WebSocket) tests

function fakeProvider(failConnects = 0) {
  const st = { handlers: null as LiveHandlers | null, audio: [] as Buffer[], texts: [] as string[], toolResponses: [] as unknown[], closed: false, connects: 0, opts: null as unknown };
  const provider: LiveVoiceProvider = async (opts, h) => {
    st.connects++;
    if (failConnects-- > 0) throw new Error("connect refused");
    st.opts = opts;
    st.handlers = h;
    return { sendAudio: (b) => st.audio.push(b), sendText: (t) => st.texts.push(t), sendToolResponses: (r) => st.toolResponses.push(...r), close: () => { st.closed = true; } };
  };
  return { st, provider };
}

async function startBridge(provider: LiveVoiceProvider) {
  const cfg = voiceConfig({ TWILIO_AUTH_TOKEN: TOKEN, TWILIO_PHONE_NUMBER: "+1", NEXA_PUBLIC_URL: PUBLIC, GEMINI_API_KEY: "x", VOICE_BRIDGE_SECRET: SECRET });
  const calls: Record<string, unknown>[] = [];
  const api = async (b: Record<string, unknown>) => {
    calls.push(b);
    return b.type === "start" ? { systemInstruction: "SYS", greeting: "Hello caller", voiceName: "Kore" } : b.type === "tool" ? { response: { found: true } } : { ok: true };
  };
  const server = createBridge({ cfg, provider, api, log: { info() {}, warn() {} } });
  await new Promise<void>((r) => server.listen(0, r));
  const url = `ws://127.0.0.1:${(server.address() as AddressInfo).port}/media-stream`;
  return { server, calls, url, close: () => new Promise((r) => server.close(r)) };
}

async function until(fn: () => unknown, ms = 2000) {
  const t = Date.now();
  while (!fn()) {
    if (Date.now() - t > ms) throw new Error("timed out waiting for condition");
    await new Promise((r) => setTimeout(r, 10));
  }
}

function twilioClient(url: string) {
  const ws = new WebSocket(url);
  const got: { event: string; [k: string]: unknown }[] = [];
  let closed = false;
  ws.on("message", (m) => got.push(JSON.parse(m.toString())));
  ws.on("close", () => { closed = true; });
  return { ws, got, isClosed: () => closed, open: new Promise((r) => ws.on("open", r)), send: (o: unknown) => ws.send(typeof o === "string" ? o : JSON.stringify(o)) };
}
const startMsg = (sid: string, token: string) => ({
  event: "start", sequenceNumber: "1", streamSid: "MZ1",
  start: { callSid: sid, streamSid: "MZ1", accountSid: "AC1", tracks: ["inbound"], mediaFormat: { encoding: "audio/x-mulaw", sampleRate: 8000, channels: 1 }, customParameters: { token } },
});

describe("voice bridge (Twilio Media Streams ⇄ provider)", () => {
  test("full call: audio both ways, barge-in clear, transcripts, tool call, stop cleans up", async () => {
    const { st, provider } = fakeProvider();
    const b = await startBridge(provider);
    const sid = newSid();
    const tw = twilioClient(b.url);
    await tw.open;
    tw.send({ event: "connected", protocol: "Call", version: "1.0.0" });
    tw.send(startMsg(sid, streamToken(SECRET, sid)));
    await until(() => st.handlers);
    assert.deepEqual(st.opts, { systemInstruction: "SYS", voiceName: "Kore" });
    assert.match(st.texts[0], /Hello caller/);

    tw.send({ event: "media", streamSid: "MZ1", media: { track: "inbound", payload: Buffer.alloc(160, 0xff).toString("base64") } });
    await until(() => st.audio.length);
    assert.equal(st.audio[0].length, 320, "160 μ-law bytes → 160 PCM16 samples");

    st.handlers!.onAudio(Buffer.alloc(480 * 2));
    await until(() => tw.got.some((m) => m.event === "media"));
    const media = tw.got.find((m) => m.event === "media") as unknown as { streamSid: string; media: { payload: string } };
    assert.equal(media.streamSid, "MZ1");
    assert.equal(Buffer.from(media.media.payload, "base64").length, 160, "24 kHz → 8 kHz");

    st.handlers!.onInterrupted();
    await until(() => tw.got.some((m) => m.event === "clear"));

    st.handlers!.onTranscript("customer", "Where is ");
    st.handlers!.onTranscript("customer", "NM-10421?");
    st.handlers!.onTranscript("agent", "Let me check.");
    st.handlers!.onToolCall([{ id: "t1", name: "lookup_order", args: { order_id: "NM-10421" } }]);
    await until(() => st.toolResponses.length);
    assert.deepEqual(st.toolResponses[0], { id: "t1", name: "lookup_order", response: { found: true } });
    const types = b.calls.map((c) => `${c.type}${c.role ? `:${c.role}` : ""}`);
    assert.deepEqual(types.slice(0, 4), ["start", "transcript:customer", "transcript:agent", "tool"], "segments flushed in order before the tool call");
    assert.equal(b.calls[1].text, "Where is NM-10421?");

    tw.send({ event: "stop", streamSid: "MZ1", stop: { callSid: sid } });
    await until(() => tw.isClosed() && b.calls.some((c) => c.type === "end"));
    assert.ok(st.closed, "provider session closed");
    assert.equal(b.server.activeCalls(), 0);
    await b.close();
  });

  test("rejects a stream with a bad token without opening a provider session", async () => {
    const { st, provider } = fakeProvider();
    const b = await startBridge(provider);
    const tw = twilioClient(b.url);
    await tw.open;
    tw.send(startMsg(newSid(), "forged"));
    await until(() => tw.isClosed());
    assert.equal(st.connects, 0);
    assert.equal(b.calls.length, 0);
    await b.close();
  });

  test("malformed messages are tolerated, then the stream is closed", async () => {
    const { provider } = fakeProvider();
    const b = await startBridge(provider);
    const tw = twilioClient(b.url);
    await tw.open;
    for (let i = 0; i < 25; i++) tw.send(i % 2 ? "not json" : { foo: 1 });
    await until(() => tw.isClosed());
    await b.close();
  });

  test("provider connect failure: retries once, reports provider_failed, closes for Twilio fallback", async () => {
    const { st, provider } = fakeProvider(2);
    const b = await startBridge(provider);
    const sid = newSid();
    const tw = twilioClient(b.url);
    await tw.open;
    tw.send(startMsg(sid, streamToken(SECRET, sid)));
    await until(() => tw.isClosed());
    assert.equal(st.connects, 2);
    assert.ok(b.calls.some((c) => c.type === "provider_failed"));
    assert.ok(!b.calls.some((c) => c.type === "end"), "call stays open for the turn-based fallback");
    await b.close();
  });

  test("end_call: sends a mark and hangs up when Twilio echoes it", async () => {
    const { st, provider } = fakeProvider();
    const b = await startBridge(provider);
    const sid = newSid();
    const tw = twilioClient(b.url);
    await tw.open;
    tw.send(startMsg(sid, streamToken(SECRET, sid)));
    await until(() => st.handlers);
    st.handlers!.onToolCall([{ id: "e", name: "end_call", args: {} }]);
    await until(() => tw.got.some((m) => m.event === "mark"));
    tw.send({ event: "mark", streamSid: "MZ1", mark: { name: "end_call" } });
    await until(() => tw.isClosed());
    assert.equal(b.calls.find((c) => c.type === "end")?.reason, "agent_ended");
    await b.close();
  });

  test("unexpected provider close mid-call hands the call back for fallback", async () => {
    const { st, provider } = fakeProvider();
    const b = await startBridge(provider);
    const sid = newSid();
    const tw = twilioClient(b.url);
    await tw.open;
    tw.send(startMsg(sid, streamToken(SECRET, sid)));
    await until(() => st.handlers);
    st.handlers!.onClose("1011 internal error");
    await until(() => tw.isClosed());
    assert.ok(b.calls.some((c) => c.type === "provider_failed"));
    await b.close();
  });
});

// VoiceSessionManager: Twilio Media Streams ⇄ real-time voice provider, one session per call.
// Runs as its own Node process (Next.js route handlers cannot accept WebSockets) and talks to
// the Nexa app over the internal /api/voice/bridge API, so the app stays the only data owner.
// Twilio protocol: https://www.twilio.com/docs/voice/media-streams/websocket-messages
import http from "node:http";
import { WebSocketServer, type WebSocket } from "ws";
import { createDownsampler24kTo8k, mulawToPcm16 } from "../lib/voice/audio";
import type { VoiceConfig } from "../lib/voice/config";
import { validStreamToken, validTwilioSignature } from "../lib/voice/twilio";

export type Role = "customer" | "agent";
export interface ToolCall { id: string; name: string; args: Record<string, unknown> }
export interface LiveHandlers {
  onAudio(pcm16le24k: Buffer): void;
  onInterrupted(): void;
  onTranscript(role: Role, text: string): void;
  onTurnComplete(): void;
  onToolCall(calls: ToolCall[]): void;
  onGoAway(): void;
  onError(e: Error): void;
  onClose(reason: string): void;
}
export interface LiveSession {
  sendAudio(pcm16le8k: Buffer): void;
  sendText(text: string): void;
  sendToolResponses(r: { id: string; name: string; response: Record<string, unknown> }[]): void;
  close(): void;
}
/** Swap point for another speech-to-speech provider. */
export type LiveVoiceProvider = (opts: { systemInstruction: string; voiceName: string }, h: LiveHandlers) => Promise<LiveSession>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type BridgeApi = (body: Record<string, unknown>) => Promise<any>;

const SID_RX = /^CA[0-9a-f]{32}$/i;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Calls the app's internal bridge API with bounded retries. */
export function httpBridgeApi(appUrl: string, secret: string): BridgeApi {
  return async (body) => {
    let last: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(`${appUrl}/api/voice/bridge`, {
          method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${secret}` }, body: JSON.stringify(body), signal: AbortSignal.timeout(25_000),
        });
        if (res.ok) return res.json();
        if (res.status < 500) throw Object.assign(new Error(`bridge API ${res.status}`), { final: true });
        last = new Error(`bridge API ${res.status}`);
      } catch (e) {
        if ((e as { final?: boolean }).final) throw e;
        last = e;
      }
      await sleep(300 * (attempt + 1));
    }
    throw last;
  };
}

export function createBridge({ cfg, provider, api, log = console }: { cfg: VoiceConfig; provider: LiveVoiceProvider; api: BridgeApi; log?: Pick<Console, "info" | "warn"> }) {
  let active = 0;

  // Plain HTTP: health check, otherwise proxy the Twilio webhooks to the app so one HTTPS tunnel
  // serves webhooks + stream. Nothing else is forwarded: the tunnel must not expose the dashboard.
  const server = http.createServer((req, res) => {
    if (req.url === "/healthz") {
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ ok: true, activeCalls: active }));
    }
    if (!/^\/api\/voice\/(twilio|status)(\?|$)/.test(req.url ?? "")) {
      res.writeHead(404);
      return res.end("Not found");
    }
    const upstream = http.request(new URL(req.url ?? "/", cfg.appUrl), { method: req.method, headers: req.headers }, (r) => {
      res.writeHead(r.statusCode ?? 502, r.headers);
      r.pipe(res);
    });
    upstream.on("error", () => { if (!res.headersSent) res.writeHead(502); res.end("Nexa app unreachable"); });
    req.pipe(upstream);
  });

  const wss = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 });
  server.on("upgrade", (req, socket, head) => {
    const reject = (status: string) => { socket.write(`HTTP/1.1 ${status}\r\nConnection: close\r\n\r\n`); socket.destroy(); };
    if (new URL(req.url ?? "/", "http://bridge").pathname !== "/media-stream") return reject("404 Not Found");
    if (active >= cfg.maxConcurrent) { log.warn("[nexa:bridge] rejected stream: concurrent call limit reached"); return reject("503 Service Unavailable"); }
    // The per-call token in the start message is the authoritative check. Twilio's handshake
    // signature is verified when present; a mismatch is logged, not fatal, because proxies/tunnels
    // can rewrite the URL that was signed.
    const sig = req.headers["x-twilio-signature"];
    if (sig && cfg.twilio.authToken && !validTwilioSignature(cfg.twilio.authToken, cfg.twilio.streamUrl, new URLSearchParams(), String(sig)))
      log.warn("[nexa:bridge] handshake X-Twilio-Signature did not match TWILIO_STREAM_WSS_URL; relying on stream token");
    wss.handleUpgrade(req, socket, head, (ws) => handleCall(ws));
  });

  function handleCall(ws: WebSocket) {
    active++;
    const t0 = Date.now();
    let callSid = "";
    let streamSid = "";
    let session: LiveSession | null = null;
    let ended = false;
    let ending = false;
    let malformed = 0;
    let lastMedia = Date.now();
    const pending: Record<Role, string> = { customer: "", agent: "" };
    const timers: NodeJS.Timeout[] = [];
    const down = createDownsampler24kTo8k();

    // Serialise API calls so transcript segments and tool calls keep their order.
    let chain: Promise<unknown> = Promise.resolve();
    const send = (body: Record<string, unknown>) => {
      const p = chain.then(() => api(body));
      chain = p.catch((e) => log.warn(`[nexa:bridge] ${callSid} ${String(body.type)} failed: ${(e as Error).message}`));
      return p;
    };
    const flush = (role: Role) => {
      const text = pending[role].trim();
      pending[role] = "";
      if (text && callSid) send({ type: "transcript", callSid, role, text }).catch(() => {});
    };
    const toTwilio = (msg: Record<string, unknown>) => { if (ws.readyState === ws.OPEN) ws.send(JSON.stringify({ ...msg, streamSid })); };

    const cleanup = (reason: string) => {
      if (ended) return;
      ended = true;
      active--;
      timers.forEach(clearTimeout);
      try { session?.close(); } catch {}
      session = null;
      flush("customer");
      flush("agent");
      if (callSid && reason !== "provider_failed" && reason !== "rejected")
        send({ type: "end", callSid, reason, durationSec: Math.round((Date.now() - t0) / 1000) }).catch(() => {});
      if (ws.readyState === ws.OPEN) ws.close(1000);
      log.info(`[nexa:bridge] ${callSid || "unidentified stream"} closed: ${reason}`);
    };
    timers.push(setInterval(() => { if (Date.now() - lastMedia > 20_000) cleanup("idle_timeout"); }, 5_000));

    const handlers: LiveHandlers = {
      onAudio: (pcm) => { const b = down(pcm); if (b.length) toTwilio({ event: "media", media: { payload: b.toString("base64") } }); },
      // Caller barged in: drop audio Twilio has buffered but not yet played.
      onInterrupted: () => { toTwilio({ event: "clear" }); flush("agent"); },
      onTranscript: (role, text) => {
        const other: Role = role === "customer" ? "agent" : "customer";
        if (pending[other]) flush(other);
        pending[role] += text;
      },
      onTurnComplete: () => {
        flush("customer");
        flush("agent");
        if (ending) toTwilio({ event: "mark", mark: { name: "end_call" } });
      },
      onToolCall: async (calls) => {
        flush("customer");
        flush("agent");
        const responses = [];
        for (const fc of calls) {
          if (fc.name === "end_call") {
            ending = true;
            // Twilio echoes the mark once queued audio has played; then we hang up.
            toTwilio({ event: "mark", mark: { name: "end_call" } });
            timers.push(setTimeout(() => cleanup("agent_ended"), 15_000));
            responses.push({ id: fc.id, name: fc.name, response: { ok: true } });
            continue;
          }
          try {
            const r = await send({ type: "tool", callSid, name: fc.name, args: fc.args });
            responses.push({ id: fc.id, name: fc.name, response: (r?.response ?? {}) as Record<string, unknown> });
          } catch {
            responses.push({ id: fc.id, name: fc.name, response: { error: "This system is temporarily unavailable. Apologise and offer a callback." } });
          }
        }
        if (!ended) session?.sendToolResponses(responses);
      },
      onGoAway: () => session?.sendText("[System notice: the connection is about to reset. Wrap up now, offer a callback if the issue is unresolved, then call end_call.]"),
      onError: (e) => log.warn(`[nexa:bridge] ${callSid} provider error: ${e.message}`),
      onClose: (reason) => {
        if (ended) return;
        if (ending) return cleanup("agent_ended");
        // Dropped mid-call: hand the call back to Twilio, whose ?step=after redirect continues turn-based.
        log.warn(`[nexa:bridge] ${callSid} provider closed mid-call: ${reason}`);
        send({ type: "provider_failed", callSid, error: reason.slice(0, 300) }).catch(() => {}).finally(() => cleanup("provider_failed"));
      },
    };

    async function onStart(msg: { streamSid?: string; start?: { callSid?: string; streamSid?: string; accountSid?: string; customParameters?: Record<string, string> } }) {
      if (callSid) return;
      const s = msg.start ?? {};
      const sid = String(s.callSid ?? "");
      if (!SID_RX.test(sid) || !validStreamToken(cfg.bridgeSecret, sid, s.customParameters?.token) || (cfg.twilio.accountSid && s.accountSid !== cfg.twilio.accountSid)) {
        log.warn("[nexa:bridge] rejected stream: invalid call token or account");
        return cleanup("rejected");
      }
      callSid = sid;
      streamSid = String(msg.streamSid ?? s.streamSid ?? "");
      let ctx: { systemInstruction: string; greeting: string; voiceName: string };
      try {
        ctx = await send({ type: "start", callSid });
      } catch {
        return cleanup("error");
      }
      for (let attempt = 1; attempt <= 2 && !ended && !session; attempt++) {
        try {
          session = await provider({ systemInstruction: ctx.systemInstruction, voiceName: ctx.voiceName }, handlers);
        } catch (e) {
          log.warn(`[nexa:bridge] ${callSid} provider connect attempt ${attempt} failed: ${(e as Error).message}`);
          if (attempt < 2) await sleep(500);
        }
      }
      if (ended) { session?.close(); return; }
      if (!session) {
        await send({ type: "provider_failed", callSid, error: "connect failed" }).catch(() => {});
        return cleanup("provider_failed");
      }
      session.sendText(`The phone call has just connected. Greet the caller now by saying: "${ctx.greeting}"`);
      timers.push(setTimeout(() => session?.sendText("[System notice: the call time limit is close. Briefly wrap up, offer a callback if the issue is unresolved, then call end_call.]"), Math.max(cfg.maxCallSec - 30, 5) * 1000));
      timers.push(setTimeout(() => cleanup("max_duration"), cfg.maxCallSec * 1000));
      log.info(`[nexa:bridge] ${callSid} live session started`);
    }

    ws.on("message", (raw) => {
      if (ended) return;
      let msg: { event?: unknown; media?: { track?: string; payload?: unknown }; mark?: { name?: string } } & Parameters<typeof onStart>[0];
      try { msg = JSON.parse(raw.toString()); } catch { msg = {}; }
      switch (msg.event) {
        case "connected": return;
        case "start": void onStart(msg); return;
        case "media":
          lastMedia = Date.now();
          if (session && msg.media?.track !== "outbound" && typeof msg.media?.payload === "string")
            session.sendAudio(mulawToPcm16(Buffer.from(msg.media.payload, "base64")));
          return;
        case "mark": if (msg.mark?.name === "end_call") cleanup("agent_ended"); return;
        case "stop": return cleanup("completed");
        case "dtmf": return;
        default:
          if (++malformed > 20) cleanup("malformed_stream");
      }
    });
    ws.on("close", () => cleanup("stream_closed"));
    ws.on("error", (e) => { log.warn(`[nexa:bridge] ${callSid} socket error: ${e.message}`); cleanup("error"); });
  }

  return Object.assign(server, { activeCalls: () => active });
}

# Nexa: AI Customer Intelligence Platform

> **Don't just serve your customers. Understand them.**

Nexa combines an AI support agent (chat + voice), AI-led customer research, cross-channel customer intelligence, and actionable recommendations. This repository is a hackathon MVP that runs fully in **demo mode** with no API keys, using a fictional Nigerian retailer, **NovaMart**, and a coherent synthetic dataset.

## Quick start

```bash
npm install
npm run dev          # builds the SDK, then starts Next.js on http://localhost:3000
```

Open http://localhost:3000 and click **Launch Demo** (no sign-in in demo mode).

Other scripts:

| Script | What it does |
|---|---|
| `npm run build` | Builds the SDK bundle, then the production Next.js build |
| `npm start` | Serves the production build |
| `npm run lint` / `npm run typecheck` | ESLint / TypeScript |
| `npm run build:sdk` | Builds `public/sdk/nexa.min.js` and `public/sdk/v1.0.0/nexa.min.js` |
| `npm run smoke` | End-to-end API checks against a running server (`BASE=http://localhost:3000`) |
| `npm test` | Voice integration tests (webhooks, signatures, lifecycle, bridge protocol, escalation, intelligence); providers mocked |
| `npm run voice` | Builds and starts the voice bridge for real phone calls (see *Live phone calls*) |

Requires Node 20.9+ for the app; the voice bridge needs Node 22.9+ (`--env-file-if-exists`).

## Demo walkthrough (about 10 minutes)

1. **Launch Demo** → **Overview**. The *Top emerging issue* panel shows delivery fees revealed too late. Click **See the evidence**.
2. In the *Why is this happening?* panel, open a supporting conversation. Observed facts and hypotheses are separated.
3. **Live Voice** → pick *B · Charged twice* → **Simulate incoming call**. Watch the transcript, intent, sentiment and resolution steps; the call escalates and gets the same post-call analysis as a real call. Click **Open human handoff**: the human agent has the summary, the steps already tried and the next action, so the customer doesn't repeat themselves. Assign an agent and add a note.
4. **Live Support → Chat simulator**: be the customer. Try the scenario chips, follow up with `NM-10421` or `PSK-88231`, or ask something the agent can't know (it admits uncertainty and offers a human). The mic button uses browser speech recognition where supported.
5. **Customer Research → New campaign → Quick start** (*Why are customers not using our new express checkout feature?*) → **Create**.
6. **Take the interview**: consent first, then adaptive follow-ups; you can skip or end. Then **Simulate 6 participants**.
7. Open a **theme** to see the responses behind it, the segments and the recommended experiments.
8. **Intelligence**: the cross-channel card connects support, website, research and reviews; the feed links to every underlying record.
9. **Website Analytics**: click *Delivery Fee Viewed* in the funnel to see what abandoning sessions did next, then open a session timeline.
10. **Website SDK**: copy the snippet, click **Send test event**, or open the **test page**, grant consent and click around. Events appear under *Live events*.
11. **Recommendations**: **Accept** *Show delivery fees earlier in checkout*, then open **Impact**.

**Reset demo** is in the profile menu (top right).

## Real vs simulated

| Capability | Status |
|---|---|
| Website SDK, CDN-ready bundle, ingestion API, CORS, validation, rate limit, consent | **Real** |
| Dashboard analytics computed from stored events and records | **Real** computation over **synthetic seed data** plus any real SDK events |
| Support agent | **Real Claude** when `ANTHROPIC_API_KEY` is set; otherwise a **deterministic intent engine** (labelled in the UI) |
| Research interviewer | **Real Claude** when configured; otherwise deterministic branching follow-ups |
| Order / payment lookups, return creation | **Simulated** against demo records (labelled *demo record* / *demo action*) |
| Phone calls via Twilio + Gemini Live | **Real** full-duplex voice (Media Streams ⇄ Gemini Live) once Twilio + Gemini env vars are set and the voice bridge runs; **real turn-based** (Twilio speech recognition) with Twilio only. No number is provisioned by this repo |
| Post-call intelligence | **Real Gemini** (or Claude) structured output when configured; otherwise rules. Validated against one schema either way |
| Call simulator | **Simulated**: the caller's lines are scripted and replies come from the turn-based engine, not Gemini Live. Labelled *Simulated* |
| Synthetic research participants | **Simulated** personas with scripted answers; questions come from the real interviewer |
| Impact tracking | Baseline measured from the demo dataset; post-change line is an **illustrative projection** |
| Zendesk, Intercom, Shopify, WooCommerce, HubSpot, Salesforce, WhatsApp, SMS | **Not implemented**. Cards show *Not Connected*; "Demo Mode" only labels them, and no API is contacted |
| Auth / multi-org | Optional shared admin password (`NEXA_ADMIN_PASSWORD`, HTTP Basic). No user accounts or multi-org |

All people, orders and messages in the seed are fictional and marked *Demo data* in the UI.

## Architecture

```
src/
  app/
    page.tsx                  Landing page
    dashboard/*               Client pages (Overview, Live Support, Conversations, Research,
                              Intelligence, Analytics, Recommendations, Integrations, SDK, Settings)
    api/
      state                   GET aggregated dashboard state for ?days=7|30|90
      support/chat|escalate   Support agent turn / manual escalation
      conversations/[id]      GET detail, PATCH assign/status/priority/notes/replies
      research/campaigns|interview|simulate
      recommendations/[id]    PATCH status/owner
      settings                PATCH settings, apply industry preset
      sessions/[id]           Web session event timeline
      sdk/events              SDK ingestion (POST + OPTIONS/CORS)
      voice/twilio            Twilio inbound webhook: <Connect><Stream> or turn-based <Gather> (signature-verified)
      voice/status            Twilio call status callback: finalises completed/dropped calls
      voice/bridge            Internal API for the voice bridge (Bearer VOICE_BRIDGE_SECRET)
      voice/simulate          Finalises a simulated call through post-call intelligence
      reset                   Reset demo data
  lib/
    types.ts                  Shared domain types
    seed.ts                   Deterministic synthetic NovaMart dataset
    presets.ts                Industry presets (e-commerce, banking, hospitality, telecom, SaaS)
    store.ts                  Data-access layer: JSON file in .data/ (memory fallback)
    analytics.ts              All aggregates (metrics, charts, funnel, research results, impact)
    ingest.ts                 SDK payload validation, origin allowlist, rate limiting, retention
    integrations.ts           Integration status derived from server env vars
    support-flow.ts           Shared message → agent → persist flow (chat, simulator, Twilio)
    ai/
      llm.ts                  Claude adapter (official SDK, structured outputs via zod)
      support.ts              SupportAgentService (Claude or deterministic engine)
      research.ts             ResearchInterviewerService + synthetic personas
      analysis.ts             ConversationAnalysisService + InsightGenerationService
    voice/
      config.ts               Env validation, mode selection (streaming / turn-based / not configured)
      twilio.ts               Signature validation, per-call stream token, phone masking, TwiML
      audio.ts                μ-law ⇄ PCM16, 24 kHz → 8 kHz resampling
      prompt.ts               Agent instructions + tool declarations from dashboard settings
      calls.ts                Call lifecycle, demo tools, human handoff, finalisation
      intelligence.ts         Post-call analysis (Gemini → Claude → rules), zod-validated
  voice/                      Voice bridge process (`npm run voice`), separate from Next.js
    bridge.ts                 Twilio Media Streams WebSocket ⇄ LiveVoiceProvider; HTTP proxy to the app
    gemini-live.ts            Gemini Live provider (@google/genai)
    main.ts                   Entry point
  proxy.ts                    Optional admin Basic auth
tests/voice.test.ts           `npm test`: voice tests with mocked providers (no network, no cost)
sdk/nexa.ts                   Website SDK source → built by scripts/build-sdk.mjs
public/sdk-test.html          Test store page that loads the SDK
```

**One dataset, one story.** Every record (conversation, review, interview theme, web event) carries an issue *topic*. Insights compute their evidence, trend and confidence live from those records, so every page shows the same numbers. Changing the date filter recomputes everything server-side.

**AI services.** `llmJSON()` calls Claude server-side with a zod schema (`messages.parse` + `output_config.format`) and returns `null` on no key, error or refusal. Every service then falls back to its deterministic engine, so missing or failing credentials never crash the app. The support prompt includes only the policies, the knowledge base and that customer's demo orders: no contact details (data minimisation). The agent is instructed to escalate rather than invent policy.

**Persistence.** Demo state lives in `.data/store.json` (survives refreshes and restarts). On read-only hosts it falls back to memory, as shown in the sidebar. For production, replace `src/lib/store.ts` with Supabase/Postgres tables; the rest of the app only uses `db()` / `mutate()`.

## Configuring real providers

Copy `.env.example` to `.env.local` and fill in what you need. All secrets stay on the server.

### Claude

```
ANTHROPIC_API_KEY=sk-ant-...
NEXA_AI_MODEL=claude-opus-5   # optional
```

Restart. The sidebar and Integrations page show *Claude (live)*, and the agent and interviewer use structured outputs. On any API error or refusal, the deterministic engine answers instead (logged as `[nexa:llm]`).

### Live phone calls (Twilio + Gemini Live)

```
Caller's phone ──PSTN──▶ Twilio number ──POST /api/voice/twilio──▶ Nexa app (Next.js)
                                │            ◀── TwiML <Connect><Stream url=wss://…/media-stream>
                                │
                                └──wss: 8 kHz μ-law, both directions──▶ Voice bridge (npm run voice)
                                                                         │  μ-law ⇄ PCM16, 24k→8k
                                                                         ├──▶ Gemini Live (gemini-3.8-live)
                                                                         └──▶ Nexa app /api/voice/bridge
                                                                              (transcript, tools, handoff, end)
```

**Why a separate bridge process:** Next.js route handlers cannot accept WebSockets, and Twilio Media Streams need one. The bridge (`src/voice/`) holds no data. It streams audio between Twilio and Gemini and reports transcript segments, tool calls and call end to the app, which owns every record. It also proxies the two Twilio webhook paths (and nothing else, so the dashboard is never exposed through the tunnel) to the app, so **one HTTPS tunnel/port serves both** the webhooks and the media stream.

**Modes** (shown on the Live Voice page):

| Mode | When | What the caller gets |
|---|---|---|
| Real-time streaming | Twilio vars + `GEMINI_API_KEY` + `VOICE_BRIDGE_SECRET`, bridge running | Full-duplex speech-to-speech. The caller can interrupt (barge-in clears Twilio's playback buffer), Gemini's VAD handles turn-taking, ~1–3 s to first reply audio in local tests |
| Turn-based fallback | Twilio vars only, or Gemini fails mid-call | Twilio `<Gather input="speech">` → Nexa support engine → `<Say>`. **Not full duplex**: strict turns, limited barge-in |
| Not configured | No Twilio vars | No calls reach Nexa. The browser simulator still works (`VOICE_DEMO_MODE=true`) |

If Gemini can't connect (one retry) or drops mid-call, the bridge closes the stream and Twilio continues with the `?step=after` redirect, which keeps the caller on the line in turn-based mode.

**Agent behaviour** comes from *Live Support → Agent configuration*: business name, greeting, personality, languages, policies, knowledge base, escalation rules, the Gemini voice, and the callback message. The system prompt (`src/lib/voice/prompt.ts`) is built from those settings on every call. The greeting always includes an AI disclosure, even if an admin removes it. The agent has four tools:
- `lookup_order`: **demo dataset only**, labelled as such to the model.
- `escalate_to_human`
- `mark_resolved`: called only after the caller confirms the issue is solved.
- `end_call`

It cannot change orders, payments or accounts.

**Human handoff.** On escalation the call record gets the summary, reason, urgency, steps tried and next action, and it appears in the handoff queue. If `VOICE_HUMAN_HANDOFF_NUMBER` is set, the stream closes after the agent's last sentence and Twilio `<Dial>`s that number. If it isn't set, **no transfer is claimed**: the agent reads the configured callback message and hangs up.

**Post-call intelligence.** When a call ends (bridge `stop` or Twilio status callback, whichever comes first; finalisation runs once), `analyseCall` produces `summary, intent, sentiment, urgency, resolution, issues, attempted, recommended_action, follow_up_required`. It tries Gemini (`GEMINI_TEXT_MODEL`), then Claude, then rules, and validates every result with zod. `resolution` is `resolved` only when the caller confirmed it. A hang-up is `unknown`, and an escalated call is never `resolved`. The intent maps to the shared issue topics, so calls count toward cross-channel insights alongside chats, research and web events.

**Privacy and safety.**
- Calls are **not recorded**. Audio exists only in memory in the bridge, and only transcripts are stored.
- Transcripts are deleted after the *conversations* retention period in Settings.
- Only the last four digits of the caller's number are stored.
- Credentials never reach the browser. `/api/state` exposes only a secrets-free status.
- Webhooks are verified with `X-Twilio-Signature`.
- The media stream needs a per-call HMAC token that only the signed webhook can issue. Twilio's handshake signature is also checked and logged.
- Bridge ⇄ app traffic uses `VOICE_BRIDGE_SECRET`.
- Built-in limits: concurrent calls (`VOICE_MAX_CONCURRENT_CALLS`), call length (`VOICE_MAX_CALL_SECONDS`, wrapped up 30 s before the limit and before Gemini's ~10-minute connection lifetime), 20 s idle timeout, 64 KB WebSocket frames, and bounded retries.

#### Setup guide: your first real call

1. **Install:** `npm install`.
2. **Configure env:** `cp .env.example .env.local`. Generate `VOICE_BRIDGE_SECRET` with `openssl rand -hex 24`.
3. **Gemini:** create a key at [Google AI Studio](https://aistudio.google.com/apikey) → `GEMINI_API_KEY`. The defaults `GEMINI_LIVE_MODEL=gemini-3.8-live` (current default Live API model) and `GEMINI_TEXT_MODEL=gemini-3.5-flash-lite` were confirmed available via the models API on 2026-10-08. To check your key: `curl -H "x-goog-api-key: $GEMINI_API_KEY" https://generativelanguage.googleapis.com/v1beta/models | grep live`.
4. **Twilio account:** sign up at twilio.com and copy the **Account SID** and **Auth Token** (Console → Account info) into `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN`.
5. **Phone number:** Console → Phone Numbers → Buy a number, and tick **Voice**. Put it in `TWILIO_PHONE_NUMBER` (E.164, e.g. `+14155550123`).
   - **Trial accounts** get one free US number. It works with this integration, but only **verified caller IDs** can call it (Console → Verified Caller IDs), and every call starts with Twilio's trial message ("press any key").
   - **Test credentials** and magic numbers such as `+15005550006` are for REST API tests only. They **cannot receive real calls**.
   - **Nigeria:** Twilio lists Nigerian local voice numbers, but per its [Nigeria regulatory guidelines](https://www.twilio.com/en-us/guidelines/ng/regulatory) they need business registration documents and a signed Letter of Authorization, and mobile numbers aren't available to individuals. Availability changes, so check Console → Buy a number → Country: Nigeria. The quickest path is a US/UK number; Nigerian callers can dial it internationally.
6. **Expose locally over HTTPS:** the bridge listens on `:8081` and forwards the Twilio webhooks to the app on `:3000`, so tunnel **the bridge port**: `ngrok http 8081`. Set `NEXA_PUBLIC_URL=https://<your-subdomain>.ngrok-free.app`. The webhook, status callback and `wss://…/media-stream` URLs are derived from it. Restart both processes after changing env.
7. **Inbound webhook:** Console → Phone Numbers → Manage → Active numbers → your number → *Voice configuration*:
   - *Configure with:* Webhook, TwiML Bin, Function…
   - *A call comes in:* **Webhook**, `https://<NEXA_PUBLIC_URL>/api/voice/twilio`, **HTTP POST**
   - *Call status changes:* `https://<NEXA_PUBLIC_URL>/api/voice/status`, **HTTP POST**
   - Save. The Live Voice page shows these exact URLs with copy buttons.
8. **Streaming URL:** nothing to configure in Twilio. Nexa returns `<Stream url="wss://…/media-stream">` in TwiML. Override it with `TWILIO_STREAM_WSS_URL` only if the bridge runs on a different host from `NEXA_PUBLIC_URL`.
9. **Start:** `npm run dev` in one terminal and `npm run voice` in another. The bridge refuses to start and lists any missing variables. Then open `/dashboard/voice`: Twilio and Gemini should both show green, and the mode should read *Live · real-time streaming*.
10. **Call** `TWILIO_PHONE_NUMBER` from a phone (a verified caller ID on trial accounts). Try the scenarios below.
11. **Inspect:** the call appears under *Active calls* with transcript segments while it's live. After hang-up it shows the summary, intent, sentiment, outcome, escalation and suggested follow-up under *Recent calls*. It also appears in Conversations, the handoff queue (if escalated) and Intelligence.
12. **Deploy:** run the app anywhere Next.js runs. Run the bridge (`npm run voice:build && node .voice/main.mjs`) on a host that allows long-lived WebSockets (Fly.io, Railway, Render, a VM; **not** serverless functions). Set `NEXA_INTERNAL_URL` to the app's URL, put both behind HTTPS, and set `TWILIO_STREAM_WSS_URL` to the bridge's `wss://…/media-stream`. The app must use durable storage if it runs more than one instance (see Persistence).

#### Manual test scenarios (real call)

| Say | Expect |
|---|---|
| A: "Hi, I placed an order yesterday. Can you tell me where it is?" then "NM-10457" | Asks for the order number, looks up the **demo** record, gives status + ETA. Say "that's all, thanks" → outcome *Resolved (confirmed)* |
| B: "I think I was charged twice." then "NM-10476" | Empathy, looks up 2 debits, escalates to Payments. Never asks for card details. Callback promised or transfer |
| C: "I paid for delivery and my order still hasn't arrived." | Asks for the order, answers from the late-delivery policy, offers to flag it |
| D: "I have explained this three times. I want to speak to someone." | Acknowledges frustration, escalates immediately, callback or transfer. Sentiment *frustrated* |
| Interrupt mid-sentence | Agent stops talking within a moment and listens |
| "Are you a real person?" | States it is an AI assistant |
| Hang up mid-call | Call finalised by the status callback, outcome *unknown* (not resolved) |

#### Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Caller hears "an application error has occurred" | Twilio got a non-2xx response. Check the app log for `[nexa:voice] rejected webhook`. **403** means a signature mismatch: `NEXA_PUBLIC_URL` must exactly match the URL configured in Twilio (scheme, host, no trailing path), and `TWILIO_AUTH_TOKEN` must be the primary token of the account that owns the number. A new ngrok URL means updating both |
| Call connects then silence, bridge log has no `live session started` | Bridge not reachable at the stream URL (is ngrok pointing at **8081**?), or `rejected stream: invalid call token`: the app and bridge have different `VOICE_BRIDGE_SECRET`s |
| `provider connect attempt … failed` | Bad `GEMINI_API_KEY`, model not available to your key, or quota. The call continues turn-based. Check models with the curl in step 3 |
| Agent audio is noise/static | Audio must be raw 8 kHz μ-law with no headers back to Twilio, and PCM16 to Gemini. If you change `audio.ts`, run `npm test` (round-trip and resampling tests) |
| Agent keeps talking over the caller | Echo from speakerphone triggers barge-in. Use a handset. VAD sensitivity is in `src/voice/gemini-live.ts` |
| Calls drop after ~10 minutes | Gemini Live connection lifetime. Lower `VOICE_MAX_CALL_SECONDS` (default 540) |
| Call shows *Analysing…* forever | The app couldn't reach Gemini/Claude for analysis and the rules fallback failed. Check the app log for `[nexa:voice]` |
| Dashboard says *Not configured* but env is set | Restart `npm run dev` after editing `.env.local`. The bridge reads `.env.local` at start |

Local-only escape hatch: `NEXA_VOICE_ALLOW_UNSIGNED=true` accepts unsigned webhooks **only** when no auth token is set, so you can test with curl.

## Website SDK

### Install

```html
<script>
  window.NexaConfig = {
    projectKey: "nx_demo_public_key",
    endpoint: "https://YOUR_APP/api/sdk/events",
    autoTrack: true,
    requireConsent: true
  };
</script>
<script async src="https://YOUR_APP/sdk/v1.0.0/nexa.min.js"></script>
```

The Website SDK page generates this snippet with your real URL. The project key is a **public identifier**, not a secret.

### API

```js
Nexa.setConsent("granted");                         // from your cookie banner; "denied" stops tracking
Nexa.track("checkout_step", { step: "delivery" });  // custom event (lowercase snake_case)
Nexa.feature("express_checkout");                   // feature_used
Nexa.optOut();                                      // stop, clear queue + anonymous session id
Nexa.flush();
addEventListener("nexa:ready", () => {});
```

Auto events: `page_view` (incl. SPA `pushState`/`popstate`), `js_error` (messages scrubbed of emails and long numbers, capped per page), `rage_click` (3+ clicks on one element within 700 ms; element described structurally, never by its text), `form_start`, `form_submit`, `form_abandon` (started but not submitted at `pagehide`). Use `data-nexa-ignore` on a form to skip it and `data-nexa-id` to name elements.

**Never collected:** input values, keystrokes, passwords, card fields, query strings or fragments, element text, fingerprints. Paths have identifier-like segments redacted. Session IDs are random and per-tab (`sessionStorage`). Prop keys that look sensitive (`email`, `card`, `token`…) are dropped by both the SDK and the server.

**Reliability:** bounded queue (100), batches of 20 every 5 s, `sendBeacon` on page hide, exponential-backoff retry on network errors, 5xx and 429 (no retry on other 4xx). Every entry point is wrapped in try/catch, so it never throws into the host page.

### Ingestion API: `POST /api/sdk/events`

Body (`text/plain` or `application/json`, ≤ 64 KB): `{ projectKey, sdkVersion?, events: [{ name, ts?, path?, sessionId?, props? }] }`, 1–50 events.

| Status | Meaning |
|---|---|
| 202 | `{ accepted, rejected }` (invalid events in a batch are skipped) |
| 400 | Invalid JSON, empty/oversized batch, or no valid events |
| 401 | Unknown project key |
| 403 | Origin not in *Allowed domains* (Website SDK page) |
| 413 | Payload too large |
| 429 | Rate limited (60 requests / 10 s per IP) |

**CORS:** the SDK sends `text/plain`, which needs no preflight; `OPTIONS` is handled anyway. `Access-Control-Allow-Origin` echoes allowed origins only. Requests without an `Origin` header (server-to-server, curl) are accepted. Pages opened via `file://` send `Origin: null` and are rejected, so serve test pages over http(s).

### Deploying the SDK to a CDN

`npm run build:sdk` writes:

- `public/sdk/v1.0.0/nexa.min.js`: immutable; serve with `Cache-Control: public, max-age=31536000, immutable`
- `public/sdk/nexa.min.js`: "latest" alias; short cache (`max-age=300`)
- `public/sdk/manifest.json`: version and size, read by the dashboard

The Next.js app already serves these with those headers (`next.config.ts`). To use a CDN, upload `public/sdk/` to it (S3 + CloudFront, Cloudflare R2, etc.) with the same headers, and set `NEXT_PUBLIC_NEXA_CDN_URL`. The dashboard snippet then points at the CDN. Bump `SDK_VERSION` in `scripts/build-sdk.mjs` for each release, so old versioned URLs never change.

## Deploying the app

Any Node host works (Vercel, Render, Fly, a VM). On serverless/read-only filesystems the demo store falls back to memory, so state resets on cold starts; set `NEXA_DATA_DIR` to a writable volume or move the store to a database.

## Before real production use

This MVP has demo-level protections only. You'd still need:

- Authentication, organisations and role-based access control (the roles in Settings are just labels)
- A real database with per-tenant isolation, encryption at rest and enforced retention jobs
- A distributed rate limiter (Redis etc.) and per-project quotas; bot filtering on ingestion
- Per-project keys with rotation, and server-side domain verification
- Audit logs, PII redaction before LLM calls, DPA/consent records and data subject request tooling
- Real connectors (Shopify orders, Zendesk tickets…) replacing the demo order records
- Monitoring, alerting, load and security testing

// Entry point for the voice bridge process: `npm run voice` (see README "Live phone calls").
import { voiceConfig } from "../lib/voice/config";
import { createBridge, httpBridgeApi } from "./bridge";
import { geminiLiveProvider } from "./gemini-live";

const cfg = voiceConfig();
if (cfg.missingStreaming.length) {
  console.error(`[nexa:bridge] cannot start: missing ${cfg.missingStreaming.join(", ")}. Set them in .env.local (see .env.example).`);
  process.exit(1);
}
if (!cfg.twilio.authToken) console.warn("[nexa:bridge] TWILIO_AUTH_TOKEN not set: the app will reject Twilio webhooks, so no calls will reach this bridge.");

const server = createBridge({
  cfg,
  provider: geminiLiveProvider({ apiKey: cfg.gemini.apiKey, model: cfg.gemini.liveModel }),
  api: httpBridgeApi(cfg.appUrl, cfg.bridgeSecret),
});
server.listen(cfg.bridgePort, () => {
  console.info(`[nexa:bridge] listening on :${cfg.bridgePort} (model ${cfg.gemini.liveModel}); proxying HTTP to ${cfg.appUrl}`);
  console.info(`[nexa:bridge] Twilio stream URL: ${cfg.twilio.streamUrl}`);
});
const stop = () => server.close(() => process.exit(0));
process.on("SIGINT", stop);
process.on("SIGTERM", stop);

import type { NextRequest } from "next/server";
import { corsHeaders, MAX_BODY, originAllowed, pruneEvents, rateLimited, validateBatch } from "@/lib/ingest";
import { db, logActivity, mutate } from "@/lib/store";

export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get("origin");
  const ok = originAllowed(origin, db().settings);
  return new Response(null, { status: ok ? 204 : 403, headers: corsHeaders(origin, ok) });
}

/**
 * Batched SDK ingestion. Accepts application/json or text/plain (the SDK uses text/plain so
 * browsers skip the CORS preflight and sendBeacon works).
 */
export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  const s = db();
  const allowed = originAllowed(origin, s.settings);
  const headers = corsHeaders(origin, allowed);
  const fail = (status: number, error: string) => Response.json({ error }, { status, headers });

  if (!allowed) return fail(403, `Origin not allowed. Add its domain under Website SDK → Allowed domains.`);
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "local";
  if (rateLimited(`${ip}`)) return fail(429, "Rate limit exceeded");
  if (Number(req.headers.get("content-length") ?? 0) > MAX_BODY) return fail(413, "Payload too large (64 KB max)");
  const text = await req.text();
  if (Buffer.byteLength(text) > MAX_BODY) return fail(413, "Payload too large (64 KB max)");
  let body: unknown;
  try { body = JSON.parse(text); } catch { return fail(400, "Body must be valid JSON"); }
  const v = validateBatch(body);
  if (!v.ok) return fail(400, v.error);
  if (v.projectKey !== s.settings.sdk.projectKey) return fail(401, "Unknown project key");

  const host = origin ? new URL(origin).host : "server";
  const fallbackSession = `anon-${Date.now().toString(36)}`;
  mutate((st) => {
    const firstEver = !st.events.some((e) => e.origin === "sdk");
    for (const [i, e] of v.events.entries()) {
      st.events.push({ id: `sdk-${Date.now().toString(36)}-${i}-${Math.random().toString(36).slice(2, 6)}`, sessionId: `sdk-${e.sessionId ?? fallbackSession}`, name: e.name, at: e.at, path: e.path, props: e.props, origin: "sdk", host });
    }
    st.events = pruneEvents(st.events, st.settings.retentionDays.webEvents);
    const lastSdkAct = st.activity.find((a) => a.kind === "sdk");
    if (firstEver || !lastSdkAct || Date.now() - Date.parse(lastSdkAct.at) > 60_000)
      logActivity(st, { kind: "sdk", text: `${firstEver ? "First SDK events received" : "SDK events received"} from ${host} (${v.events.map((e) => e.name).slice(0, 3).join(", ")})`, href: "/dashboard/sdk" });
  });
  console.info(`[nexa:sdk] accepted ${v.events.length} rejected ${v.rejected} from ${host}`);
  return Response.json({ accepted: v.events.length, rejected: v.rejected }, { status: 202, headers });
}

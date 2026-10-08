import "server-only";
import type { Settings, WebEvent } from "./types";

export const MAX_BODY = 64 * 1024;
export const MAX_EVENTS = 50;
const NAME_RX = /^[a-z][a-z0-9_]{1,63}$/;
const KEY_RX = /^[a-z0-9_]{1,40}$/i;
const SESSION_RX = /^[a-z0-9_-]{8,64}$/i;
// Defence in depth: the SDK never sends these, and the server drops them if a custom call does.
const SENSITIVE = /pass|card|cvv|cvc|token|secret|auth|email|phone|bvn|ssn|otp|^pin$/i;

export type CleanEvent = Pick<WebEvent, "name" | "path" | "props" | "at"> & { sessionId?: string };

export function validateBatch(body: unknown): { ok: true; projectKey: string; events: CleanEvent[]; rejected: number } | { ok: false; error: string } {
  if (!body || typeof body !== "object") return { ok: false, error: "Body must be a JSON object" };
  const b = body as Record<string, unknown>;
  if (typeof b.projectKey !== "string" || !b.projectKey) return { ok: false, error: "projectKey is required" };
  if (!Array.isArray(b.events) || b.events.length === 0) return { ok: false, error: "events must be a non-empty array" };
  if (b.events.length > MAX_EVENTS) return { ok: false, error: `At most ${MAX_EVENTS} events per batch` };
  const now = Date.now();
  const events: CleanEvent[] = [];
  for (const raw of b.events) {
    const e = clean(raw, now);
    if (e) events.push(e);
  }
  if (!events.length) return { ok: false, error: "No valid events in batch (check event names: lowercase snake_case)" };
  return { ok: true, projectKey: b.projectKey, events, rejected: b.events.length - events.length };
}

function clean(raw: unknown, now: number): CleanEvent | null {
  if (!raw || typeof raw !== "object") return null;
  const e = raw as Record<string, unknown>;
  if (typeof e.name !== "string" || !NAME_RX.test(e.name)) return null;
  const path = typeof e.path === "string" && e.path.startsWith("/") ? e.path.split(/[?#]/)[0].slice(0, 300) : "/";
  const ts = typeof e.ts === "number" && Math.abs(e.ts - now) < 86_400_000 ? e.ts : now;
  const props: Record<string, string | number | boolean> = {};
  if (e.props && typeof e.props === "object" && !Array.isArray(e.props)) {
    for (const [k, v] of Object.entries(e.props).slice(0, 20)) {
      if (!KEY_RX.test(k) || SENSITIVE.test(k)) continue;
      if (typeof v === "string") props[k] = v.slice(0, 200);
      else if ((typeof v === "number" && Number.isFinite(v)) || typeof v === "boolean") props[k] = v;
    }
  }
  return {
    name: e.name, path, props, at: new Date(ts).toISOString(),
    sessionId: typeof e.sessionId === "string" && SESSION_RX.test(e.sessionId) ? e.sessionId : undefined,
  };
}

export function originAllowed(origin: string | null, s: Settings): boolean {
  if (!origin) return true; // server-to-server / curl; browsers always send Origin on cross-origin POSTs
  let host: string;
  try { host = new URL(origin).hostname; } catch { return false; }
  return s.sdk.allowedDomains.some((d) => (d.startsWith("*.") ? host === d.slice(2) || host.endsWith(d.slice(1)) : host === d));
}

// ponytail: in-memory fixed-window limiter, per server instance; use Redis/Upstash for multi-instance deploys.
const buckets = new Map<string, { n: number; reset: number }>();
export function rateLimited(key: string, limit = 60, windowMs = 10_000) {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.reset < now) { buckets.set(key, { n: 1, reset: now + windowMs }); return false; }
  return ++b.n > limit;
}

export function corsHeaders(origin: string | null, allowed: boolean): HeadersInit {
  return {
    ...(origin && allowed ? { "Access-Control-Allow-Origin": origin } : {}),
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

export function pruneEvents(events: WebEvent[], retentionDays: number) {
  const cutoff = new Date(Date.now() - retentionDays * 86_400_000).toISOString();
  return events.filter((e) => e.at >= cutoff);
}

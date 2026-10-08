// Twilio helpers shared by the Next.js webhooks and the voice bridge. No server-only imports.
import crypto from "node:crypto";

const safeEqual = (a: string, b: string) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));

/**
 * Twilio request signature: HMAC-SHA1(authToken, fullUrl + each POST param name+value sorted by name),
 * base64. https://www.twilio.com/docs/usage/security#validating-requests
 */
export function twilioSignature(authToken: string, url: string, params: URLSearchParams = new URLSearchParams()) {
  const data = url + [...new Set(params.keys())].sort().map((k) => params.getAll(k).map((v) => k + v).join("")).join("");
  return crypto.createHmac("sha1", authToken).update(data).digest("base64");
}

export const validTwilioSignature = (authToken: string, url: string, params: URLSearchParams, header: string | null | undefined) =>
  !!header && safeEqual(header, twilioSignature(authToken, url, params));

/**
 * Per-call token passed from the signed webhook to the media stream as a <Parameter>. The bridge
 * only accepts a stream whose token matches its CallSid, so a stranger who finds the wss:// URL
 * cannot open a Gemini session on our key.
 */
export const streamToken = (secret: string, callSid: string) => crypto.createHmac("sha256", secret).update(`stream:${callSid}`).digest("hex").slice(0, 40);
export const validStreamToken = (secret: string, callSid: string, token: unknown) => typeof token === "string" && safeEqual(token, streamToken(secret, callSid));

/** Keep only the last four digits. Full caller numbers are never stored. */
export const maskPhone = (n?: string | null) => {
  const d = (n ?? "").replace(/\D/g, "");
  return d.length >= 4 ? `•••${d.slice(-4)}` : "Withheld";
};

export const xmlEscape = (t: string) => t.replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[c]!);
export const twiml = (body: string) => new Response(`<?xml version="1.0" encoding="UTF-8"?><Response>${body}</Response>`, { headers: { "Content-Type": "text/xml" } });

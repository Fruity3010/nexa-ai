import { NextResponse, type NextRequest } from "next/server";

// Admin gate. Off unless NEXA_ADMIN_PASSWORD is set (demo mode stays open for judges).
// Machine endpoints are excluded: Twilio webhooks verify X-Twilio-Signature, the voice bridge
// uses VOICE_BRIDGE_SECRET, and the website SDK uses its project key.
// ponytail: one shared Basic-auth password; swap for real user accounts + roles before production.
export function proxy(req: NextRequest) {
  const password = process.env.NEXA_ADMIN_PASSWORD;
  if (!password) return NextResponse.next();
  const [scheme, encoded] = (req.headers.get("authorization") ?? "").split(" ");
  if (scheme === "Basic" && encoded) {
    const decoded = atob(encoded);
    if (decoded.slice(decoded.indexOf(":") + 1) === password) return NextResponse.next();
  }
  return new NextResponse("Authentication required", { status: 401, headers: { "WWW-Authenticate": 'Basic realm="Nexa admin"' } });
}

export const config = {
  matcher: ["/dashboard/:path*", "/api/((?!voice/twilio|voice/status|voice/bridge|sdk/).*)"],
};

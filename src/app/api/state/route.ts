import type { NextRequest } from "next/server";
import { buildState } from "@/lib/analytics";

export async function GET(req: NextRequest) {
  const days = Number(req.nextUrl.searchParams.get("days"));
  return Response.json(buildState([7, 30, 90].includes(days) ? days : 30));
}

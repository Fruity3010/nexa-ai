import { resetStore } from "@/lib/store";

export async function POST() {
  resetStore();
  console.info("[nexa] demo data reset");
  return Response.json({ ok: true });
}

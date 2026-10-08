import { z } from "zod";
import { handleCustomerMessage } from "@/lib/support-flow";

const Body = z.object({
  conversationId: z.string().optional(),
  message: z.string().trim().min(1).max(2000),
  channel: z.enum(["chat", "voice", "whatsapp", "email"]).default("chat"),
});

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "message is required (1–2000 chars)" }, { status: 400 });
  const { conversationId, message, channel } = parsed.data;
  const { conversation, turn } = await handleCustomerMessage({ conversationId, text: message, channel, source: "simulator" });
  return Response.json({ conversation, turn });
}

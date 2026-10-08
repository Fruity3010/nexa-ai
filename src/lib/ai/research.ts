import "server-only";
import { z } from "zod";
import { llmJSON } from "./llm";
import { ConversationAnalysisService as CA, tagThemes, THEMES } from "./analysis";
import type { Campaign, Interview, Sentiment } from "../types";

const FOLLOWUPS: Record<string, string[]> = {
  awareness: ["Where on the page would you expect to find a faster way to pay?", "What usually catches your attention on a checkout page?"],
  trust_security: ["What would make you feel comfortable saving your payment details?", "What have you heard or experienced that makes you cautious?"],
  total_cost_visibility: ["At what point would you want to see the full cost, including delivery?", "How did the final total compare with what you expected?"],
  payment_reliability: ["What happened after the payment didn't go through?", "What would have made you confident enough to try again?"],
  pay_on_delivery: ["What makes paying on delivery or by transfer feel better than paying by card?"],
  delivery_expectations: ["How important is knowing the exact delivery date before you pay?"],
  speed_convenience: ["What makes a checkout feel fast to you?"],
  feature_request: ["If NovaMart built that, how would it change how often you shop?"],
};
const GENERIC = ["How did that affect what you did next?", "What would have made it easier for you?", "If you could change one thing about it, what would it be?", "Is there anything else you'd like NovaMart to know?"];

export const maxQuestions = (lengthMin: number) => (lengthMin <= 3 ? 3 : lengthMin <= 5 ? 4 : 6);

export function opener(c: Campaign) {
  const m = c.question.match(/not (?:using|use|buying|completing|adopting) (?:our |the )?(?:new )?(.+?)\??$/i);
  if (m) return `Have you come across the ${m[1].replace(/ feature$/i, "")} on NovaMart? Tell me about the last time you checked out.`;
  return `To start, tell me about a recent experience that relates to this: "${c.question}"`;
}

export const intro = (c: Campaign, agentName: string) => [
  `Hi! I'm ${agentName}, a research assistant working on behalf of NovaMart. We're trying to understand: "${c.question}"`,
  `${c.consentText} Do you agree to take part? (yes / no)`,
];

const LLMNext = z.object({
  message: z.string(),
  themes: z.array(z.string()),
  done: z.boolean(),
});

/** Returns the next interviewer message, mutating the interview in place. */
export const ResearchInterviewerService = {
  async next(c: Campaign, iv: Interview, input: { answer?: string; skip?: boolean; end?: boolean }): Promise<{ message: string; done: boolean; engine: "llm" | "demo" }> {
    const close = (msg: string) => {
      iv.status = iv.turns.some((t) => t.a) ? "completed" : "abandoned";
      iv.themes = [...new Set(iv.turns.flatMap((t) => (t.a ? tagThemes(t.a) : [])).concat(iv.themes))];
      iv.sentiment = overall(iv);
      return { message: msg, done: true, engine: "demo" as const };
    };

    // Consent gate: nothing is recorded until the participant agrees.
    if (!iv.consent) {
      if (input.answer && /^\s*(y|yes|yeah|ok|okay|sure|i agree|agree)\b/i.test(input.answer)) {
        iv.consent = true;
        const q = opener(c);
        iv.turns.push({ q });
        return { message: `Thank you! ${q}`, done: false, engine: "demo" };
      }
      iv.status = "declined";
      return { message: "No problem at all. Nothing has been recorded. Thanks for your time!", done: true, engine: "demo" };
    }

    const current = iv.turns.at(-1);
    if (current && !current.a && !current.skipped) {
      if (input.skip) current.skipped = true;
      else if (input.answer) current.a = input.answer.slice(0, 2000);
    }
    if (input.end) return close("Thanks so much for your time. Your responses have been recorded.");
    const asked = iv.turns.filter((t) => t.a || t.skipped).length;
    if (asked >= maxQuestions(c.lengthMin)) return close("That's all my questions. Thank you, this is really helpful for the NovaMart team!");

    const live = await llmNext(c, iv);
    if (live) {
      iv.themes = [...new Set([...iv.themes, ...live.themes.filter((t) => t in THEMES)])];
      if (live.done) return { ...close(live.message), engine: "llm" };
      iv.turns.push({ q: live.message, followUp: true });
      return { message: live.message, done: false, engine: "llm" };
    }

    const q = pickFollowUp(iv);
    iv.turns.push({ q, followUp: true });
    return { message: q, done: false, engine: "demo" };
  },
};

function pickFollowUp(iv: Interview) {
  const askedQs = new Set(iv.turns.map((t) => t.q));
  const last = iv.turns.at(-1);
  // Probe once if the last answer was very short.
  if (last?.a && last.a.trim().split(/\s+/).length < 5 && !askedQs.has("Could you tell me a bit more about that?"))
    return "Could you tell me a bit more about that?";
  const themes = last?.a ? tagThemes(last.a) : [];
  for (const t of themes) for (const q of FOLLOWUPS[t] ?? []) if (!askedQs.has(q)) return q;
  return GENERIC.find((q) => !askedQs.has(q)) ?? "Is there anything else you'd like to add?";
}

function overall(iv: Interview): Sentiment {
  const s = iv.turns.filter((t) => t.a).map((t) => CA.detectSentiment(t.a!));
  const neg = s.filter((x) => x === "negative").length + iv.themes.filter((t) => THEMES[t]?.tone === "negative").length;
  const pos = s.filter((x) => x === "positive").length + iv.themes.filter((t) => THEMES[t]?.tone === "positive").length;
  return neg > pos ? "negative" : pos > neg ? "positive" : "neutral";
}

async function llmNext(c: Campaign, iv: Interview) {
  const system = `You are a neutral customer research interviewer for NovaMart.
Research question: ${c.question}
Business objective: ${c.objective}
Interview language: ${c.language}. Ask at most ${maxQuestions(c.lengthMin)} questions in total.
Ask ONE open-ended, non-leading follow-up question that builds on the participant's last answer. Never repeat a question already asked. Set done=true with a short thank-you message once you have enough.
Tag the participant's answers so far with theme ids from: ${Object.entries(THEMES).map(([id, t]) => `${id} (${t.label})`).join(", ")}.`;
  const transcript = iv.turns.map((t) => `Q: ${t.q}\nA: ${t.skipped ? "(skipped)" : t.a ?? ""}`).join("\n\n");
  return llmJSON(LLMNext, system, [{ role: "user", content: `Transcript so far:\n\n${transcript}` }]);
}

// ---------------------------------------------------------------- synthetic participants

export const PERSONAS: { segment: Interview["segment"]; answers: string[] }[] = [
  { segment: "First-time buyer", answers: ["I didn't even know there was an express checkout. I always use the normal one.", "Maybe at the top near the cart total. On my phone I never scroll that far.", "Just make the button bigger and explain what it does."] },
  { segment: "Repeat buyer", answers: ["I saw it but I don't like saving my card on websites. Too many fraud stories.", "A friend had money taken after saving her card on another site.", "If it said the bank handles my card, or let me pay without saving it, I'd try it."] },
  { segment: "First-time buyer", answers: ["Express checkout skips the summary, so I can't see the delivery fee before paying.", "I want to see the full total including delivery before I tap anything.", "Show the delivery cost on the express button itself."] },
  { segment: "Repeat buyer", answers: ["Last time I tried express, my card OTP failed and I wasn't sure if I'd paid.", "I had to call support to confirm. It was stressful.", "A clear message if payment fails, with a reference number."] },
  { segment: "Business buyer", answers: ["I mostly pay by transfer or on delivery, and express checkout only works with cards.", "Paying on delivery means I only pay when I see the item.", "Allow transfer or pay on delivery in express checkout."] },
  { segment: "High-value", answers: ["I use it all the time, it's very fast and easy.", "Being able to reorder in two taps is the best part.", "Maybe let me save more than one delivery address."] },
];

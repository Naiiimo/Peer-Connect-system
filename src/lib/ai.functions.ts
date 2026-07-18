import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const RefineInput = z.object({
  text: z.string().min(1).max(8000),
  context: z.string().optional(),
});

export const refineText = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => RefineInput.parse(d))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");
    const system = `You are a careful editor. Improve grammar, spelling, clarity and professionalism WITHOUT changing the writer's intended meaning, facts, tone or first-person perspective. Preserve length within ±20%. Keep any code, URLs and proper nouns unchanged. Respond with ONLY the improved text — no preamble, no quotes, no explanation.`;
    const user = data.context
      ? `Context: ${data.context}\n\nText to refine:\n${data.text}`
      : `Text to refine:\n${data.text}`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
    if (res.status === 429) throw new Error("Rate limit — please try again in a moment.");
    if (res.status === 402) throw new Error("AI credits exhausted. Please add credits to keep using AI features.");
    if (!res.ok) throw new Error(`AI error: ${res.status}`);
    const j = (await res.json()) as any;
    const refined = String(j.choices?.[0]?.message?.content ?? "").trim();
    return { refined: refined || data.text };
  });

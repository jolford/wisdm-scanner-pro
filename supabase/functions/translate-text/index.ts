import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TranslateRequest {
  text?: string;
  items?: string[];
}

async function translateViaLovableAI(input: string): Promise<string> {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) throw new Error("LOVABLE_API_KEY is not configured");

  const system = `You are an expert translator specializing in historical documents, OCR text, and multilingual content.

Your task:
1. Detect the source language(s) - the text may contain mixed languages (German, Latin, Dutch, etc.)
2. Translate ALL non-English text into clear, modern English
3. If text is already in English, keep it as-is
4. For OCR errors or unclear words, infer the most likely meaning from context
5. Preserve proper nouns, names, dates, and numbers
6. Clean up any obvious OCR artifacts (random characters, broken words)
7. Make the output readable and coherent

Output ONLY the translated English text, nothing else. Do not add explanations or notes.`;

  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: system },
        { role: "user", content: input }
      ],
      stream: false,
    }),
  });

  if (!resp.ok) {
    if (resp.status === 429) throw new Error("Rate limits exceeded, please try again later.");
    if (resp.status === 402) throw new Error("Payment required, please add funds to your Lovable AI workspace.");
    const t = await resp.text();
    console.error("AI gateway error", resp.status, t);
    throw new Error("AI gateway error");
  }

  const json = await resp.json();
  const content = json?.choices?.[0]?.message?.content || json?.choices?.[0]?.delta?.content;
  return typeof content === "string" ? content : String(content ?? "");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = (await req.json()) as TranslateRequest;
    if (!body.text && !body.items) {
      return new Response(JSON.stringify({ error: "Provide 'text' or 'items'" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (body.text) {
      const translated = await translateViaLovableAI(body.text);
      return new Response(JSON.stringify({ text: translated }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const items = body.items ?? [];
    const outputs: string[] = [];
    for (const item of items) {
      outputs.push(await translateViaLovableAI(item));
    }

    return new Response(JSON.stringify({ items: outputs }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("translate-text error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: msg.includes("Rate limits") ? 429 : msg.includes("Payment required") ? 402 : 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

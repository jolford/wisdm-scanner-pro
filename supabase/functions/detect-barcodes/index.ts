import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BarcodeDetectionSchema = z.object({
  imageUrl: z.string().url().max(2000),
  fileName: z.string().max(255).optional(),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const validated = BarcodeDetectionSchema.parse(body);
    const { imageUrl, fileName = "document" } = validated;

    console.log(`Detecting barcodes in: ${fileName}`);

    // Fetch the image
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new Error(`Failed to fetch image: ${imageResponse.statusText}`);
    }

    const imageBlob = await imageResponse.blob();
    const imageBuffer = await imageBlob.arrayBuffer();
    const base64Image = btoa(
      new Uint8Array(imageBuffer).reduce(
        (data, byte) => data + String.fromCharCode(byte),
        ""
      )
    );

    // Use Lovable AI for barcode detection
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableApiKey) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Analyze this image and detect all barcodes present. For each barcode found, provide:
1. The barcode type/format (QR Code, Code 128, Code 39, EAN-13, UPC-A, etc.)
2. The decoded value/text from the barcode
3. Confidence level (0-1)
4. Approximate position if visible (x, y, width, height in pixels)

Return ONLY a valid JSON array of objects with this structure:
[{
  "type": "barcode type",
  "value": "decoded value", 
  "format": "format name",
  "confidence": 0.95,
  "position": {"x": 100, "y": 200, "width": 150, "height": 150}
}]

If no barcodes are found, return an empty array: []`,
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:${imageBlob.type};base64,${base64Image}`,
                },
              },
            ],
          },
        ],
        max_completion_tokens: 1000,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI API error:", errorText);
      throw new Error(`AI API error: ${aiResponse.statusText}`);
    }

    const aiData = await aiResponse.json();
    const aiContent = aiData.choices[0].message.content;

    console.log("AI Response:", aiContent);

    // Parse the AI response
    let barcodes = [];
    try {
      // Extract JSON from markdown code blocks if present
      const jsonMatch = aiContent.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/) ||
                       aiContent.match(/(\[[\s\S]*\])/);
      
      if (jsonMatch) {
        barcodes = JSON.parse(jsonMatch[1]);
      } else {
        console.log("No JSON array found in response");
      }
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError);
      console.log("Raw content:", aiContent);
    }

    console.log(`Detected ${barcodes.length} barcode(s)`);

    return new Response(
      JSON.stringify({
        success: true,
        barcodes,
        fileName,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error detecting barcodes:", error);
    
    if (error instanceof z.ZodError) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Invalid input",
          details: error.errors,
          barcodes: [],
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
        barcodes: [],
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

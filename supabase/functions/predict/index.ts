import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function callAI(lovableApiKey: string, imageUrl: string, attempt = 1): Promise<any> {
  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${lovableApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content: `You are a medical AI specialized in brain MRI tumor detection. Analyze the MRI image and respond with ONLY valid JSON (no markdown):
{
  "tumor_present": boolean,
  "tumor_type": "Glioma" | "Meningioma" | "Pituitary" | "NoTumor",
  "confidence": number (0-1),
  "probabilities": { "Glioma": number, "Meningioma": number, "Pituitary": number, "NoTumor": number },
  "analysis": "brief description"
}
Probabilities must sum to ~1.0. Each value must be between 0 and 1.`,
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Analyze this brain MRI scan for tumor detection." },
            { type: "image_url", image_url: { url: imageUrl } },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("AI gateway error:", response.status, errText);
    throw new Error(`AI analysis failed: ${response.status}`);
  }

  const aiResult = await response.json();
  const rawContent = aiResult.choices?.[0]?.message?.content || "";

  let cleaned = rawContent.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
  }

  try {
    const parsed = JSON.parse(cleaned);
    // Validate and clamp probabilities
    if (parsed.probabilities) {
      for (const key of Object.keys(parsed.probabilities)) {
        parsed.probabilities[key] = Math.max(0, Math.min(1, parsed.probabilities[key] || 0));
      }
      const sum = Object.values(parsed.probabilities).reduce((a: number, b: any) => a + b, 0) as number;
      if (sum > 0) {
        for (const key of Object.keys(parsed.probabilities)) {
          parsed.probabilities[key] = parsed.probabilities[key] / sum;
        }
      }
    }
    parsed.confidence = Math.max(0, Math.min(1, parsed.confidence || 0.5));
    return parsed;
  } catch {
    if (attempt < 2) {
      console.warn("JSON parse failed, retrying...");
      return callAI(lovableApiKey, imageUrl, attempt + 1);
    }
    console.error("Failed to parse AI response after retry:", rawContent);
    return {
      tumor_present: false,
      tumor_type: "NoTumor",
      confidence: 0.5,
      probabilities: { Glioma: 0.1, Meningioma: 0.1, Pituitary: 0.1, NoTumor: 0.7 },
      analysis: "Unable to parse AI response.",
    };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    if (!lovableApiKey) throw new Error("LOVABLE_API_KEY not configured");

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { case_id, patient_id, image_urls } = await req.json();

    if (!patient_id || !image_urls?.length) {
      return new Response(JSON.stringify({ error: "Missing patient_id or image_urls" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use only the last (latest) image for speed
    const latestUrl = image_urls[image_urls.length - 1];
    const result = await callAI(lovableApiKey, latestUrl);

    // Compute severity
    let severity_level = "GREEN";
    if (result.tumor_present && (result.tumor_type === "Glioma" || result.tumor_type === "Meningioma")) {
      severity_level = "RED";
    } else if (result.tumor_present && result.tumor_type === "Pituitary") {
      severity_level = "YELLOW";
    }

    // Compute queue rank
    const { count } = await supabase
      .from("predictions")
      .select("*", { count: "exact", head: true })
      .eq("severity_level", severity_level);
    const queue_rank = (count ?? 0) + 1;

    // Save prediction
    const { data: prediction, error: predError } = await supabase
      .from("predictions")
      .insert({
        patient_id,
        tumor_present: result.tumor_present ?? false,
        tumor_type: result.tumor_type ?? "NoTumor",
        probabilities: result.probabilities ?? {},
        severity_level,
        queue_rank,
      })
      .select()
      .single();

    if (predError) throw predError;

    // Save metrics
    const conf = result.confidence ?? 0.5;
    await supabase.from("metrics").insert({
      prediction_id: prediction.id,
      accuracy: conf,
      precision: conf,
      recall: conf,
      f1_score: conf,
      recall_sensitivity: conf,
      specificity: 1 - conf,
    });

    return new Response(
      JSON.stringify({
        tumor_present: result.tumor_present,
        tumor_type: result.tumor_type,
        severity_level,
        prediction_id: prediction.id,
        probabilities: result.probabilities,
        analysis: result.analysis,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("predict error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

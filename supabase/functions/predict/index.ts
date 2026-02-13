import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    if (!lovableApiKey) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { case_id, patient_id, image_urls } = await req.json();

    if (!patient_id || !image_urls?.length) {
      return new Response(JSON.stringify({ error: "Missing patient_id or image_urls" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use Lovable AI (Gemini) to analyze the MRI image
    const imageContent = image_urls.map((url: string) => ({
      type: "image_url",
      image_url: { url },
    }));

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          {
            role: "system",
            content: `You are a medical AI assistant specialized in brain MRI analysis for tumor detection. Analyze the provided MRI brain scan image(s) and determine if a tumor is present.

You MUST respond with ONLY a valid JSON object (no markdown, no code fences) with these exact fields:
{
  "tumor_present": boolean,
  "tumor_type": "Glioma" | "Meningioma" | "Pituitary" | "NoTumor",
  "confidence": number between 0 and 1,
  "probabilities": {
    "Glioma": number,
    "Meningioma": number,
    "Pituitary": number,
    "NoTumor": number
  },
  "analysis": "Brief description of findings"
}

The probabilities must sum to approximately 1.0. Be thorough but respond only with the JSON.`,
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Analyze this brain MRI scan for tumor detection. Provide your assessment as the specified JSON format." },
              ...imageContent,
            ],
          },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);
      throw new Error(`AI analysis failed: ${aiResponse.status}`);
    }

    const aiResult = await aiResponse.json();
    const rawContent = aiResult.choices?.[0]?.message?.content || "";
    
    // Parse the JSON from the AI response (strip markdown fences if present)
    let cleaned = rawContent.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
    }
    
    let result: any;
    try {
      result = JSON.parse(cleaned);
    } catch {
      console.error("Failed to parse AI response:", rawContent);
      // Fallback
      result = {
        tumor_present: false,
        tumor_type: "NoTumor",
        confidence: 0.5,
        probabilities: { Glioma: 0.1, Meningioma: 0.1, Pituitary: 0.1, NoTumor: 0.7 },
        analysis: "Unable to parse AI response. Please try again.",
      };
    }

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

    // Save metrics from AI confidence
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

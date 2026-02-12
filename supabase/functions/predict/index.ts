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
    const inferenceUrl = Deno.env.get("INFERENCE_API_URL");

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { case_id, patient_id, image_urls } = await req.json();

    if (!patient_id || !image_urls?.length) {
      return new Response(JSON.stringify({ error: "Missing patient_id or image_urls" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!inferenceUrl) {
      return new Response(
        JSON.stringify({ error: "INFERENCE_API_URL not configured. Please set it in your secrets." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Call the external inference API
    const apiResponse = await fetch(`${inferenceUrl}/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ case_id, patient_id, image_urls }),
    });

    if (!apiResponse.ok) {
      const errText = await apiResponse.text();
      throw new Error(`Inference API error: ${errText}`);
    }

    const result = await apiResponse.json();

    // Upload base64 images to storage
    let gradcamPath: string | null = null;
    let confusionMatrixPath: string | null = null;
    let rocCurvePath: string | null = null;

    if (result.gradcam_image_base64) {
      const bytes = Uint8Array.from(atob(result.gradcam_image_base64), (c) => c.charCodeAt(0));
      const path = `${patient_id}/${Date.now()}_gradcam.png`;
      await supabase.storage.from("gradcam_images").upload(path, bytes, { contentType: "image/png" });
      gradcamPath = path;
    }

    if (result.confusion_matrix_base64) {
      const bytes = Uint8Array.from(atob(result.confusion_matrix_base64), (c) => c.charCodeAt(0));
      const path = `${patient_id}/${Date.now()}_confusion_matrix.png`;
      await supabase.storage.from("charts").upload(path, bytes, { contentType: "image/png" });
      confusionMatrixPath = path;
    }

    if (result.roc_curve_base64) {
      const bytes = Uint8Array.from(atob(result.roc_curve_base64), (c) => c.charCodeAt(0));
      const path = `${patient_id}/${Date.now()}_roc_curve.png`;
      await supabase.storage.from("charts").upload(path, bytes, { contentType: "image/png" });
      rocCurvePath = path;
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
        gradcam_path: gradcamPath,
        severity_level,
        queue_rank,
      })
      .select()
      .single();

    if (predError) throw predError;

    // Save metrics
    if (result.metrics) {
      await supabase.from("metrics").insert({
        prediction_id: prediction.id,
        precision: result.metrics.precision,
        recall: result.metrics.recall,
        f1_score: result.metrics.f1_score,
        support: result.metrics.support,
        accuracy: result.metrics.accuracy,
        recall_sensitivity: result.metrics.recall_sensitivity,
        specificity: result.metrics.specificity,
        roc_auc: result.metrics.roc_auc,
        tp: result.metrics.tp,
        tn: result.metrics.tn,
        fp: result.metrics.fp,
        fn: result.metrics.fn,
        confusion_matrix_path: confusionMatrixPath,
        roc_curve_path: rocCurvePath,
      });
    }

    return new Response(
      JSON.stringify({
        tumor_present: result.tumor_present,
        tumor_type: result.tumor_type,
        severity_level,
        prediction_id: prediction.id,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

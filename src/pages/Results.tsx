import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BarChart3, Download, FileImage, FileText } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

const Results = () => {
  const [selectedCaseId, setSelectedCaseId] = useState<string>("");
  const reportRef = useRef<HTMLDivElement>(null);

  const { data: patients } = useQuery({
    queryKey: ["patients"],
    queryFn: async () => {
      const { data, error } = await supabase.from("patients").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const selectedPatient = patients?.find((p) => p.case_id === selectedCaseId);

  const { data: prediction } = useQuery({
    queryKey: ["prediction", selectedPatient?.id],
    enabled: !!selectedPatient,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("predictions")
        .select("*, metrics(*)")
        .eq("patient_id", selectedPatient!.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: latestUpload } = useQuery({
    queryKey: ["latestUpload", selectedPatient?.id],
    enabled: !!selectedPatient,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mri_uploads")
        .select("*")
        .eq("patient_id", selectedPatient!.id)
        .order("upload_order", { ascending: false })
        .limit(1)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const getStorageUrl = (bucket: string, path: string | null) => {
    if (!path) return null;
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  };

  const metrics = prediction?.metrics?.[0] || null;
  const probabilities = prediction?.probabilities as Record<string, number> | null;

  const downloadPDF = async () => {
    if (!reportRef.current) return;
    try {
      const canvas = await html2canvas(reportRef.current, { backgroundColor: "#0d1117", scale: 2 });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const width = pdf.internal.pageSize.getWidth();
      const height = (canvas.height * width) / canvas.width;
      pdf.addImage(imgData, "PNG", 0, 0, width, height);
      pdf.save(`report_${selectedCaseId}.pdf`);
      toast({ title: "PDF downloaded" });
    } catch (e: any) {
      toast({ title: "Error generating PDF", description: e.message, variant: "destructive" });
    }
  };

  const downloadPNG = async () => {
    if (!reportRef.current) return;
    try {
      const canvas = await html2canvas(reportRef.current, { backgroundColor: "#0d1117", scale: 2 });
      const link = document.createElement("a");
      link.download = `report_${selectedCaseId}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      toast({ title: "PNG downloaded" });
    } catch (e: any) {
      toast({ title: "Error generating PNG", description: e.message, variant: "destructive" });
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-primary" />
            Results
          </h2>
          {prediction && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={downloadPDF}><FileText className="mr-2 h-4 w-4" /> PDF</Button>
              <Button variant="outline" onClick={downloadPNG}><FileImage className="mr-2 h-4 w-4" /> PNG</Button>
            </div>
          )}
        </div>

        <Card>
          <CardContent className="pt-6">
            <Select value={selectedCaseId} onValueChange={setSelectedCaseId}>
              <SelectTrigger className="max-w-xs">
                <SelectValue placeholder="Select patient by Case ID" />
              </SelectTrigger>
              <SelectContent>
                {patients?.map((p) => (
                  <SelectItem key={p.id} value={p.case_id}>{p.case_id} — {p.patient_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {prediction && selectedPatient && (
          <div ref={reportRef} className="space-y-6 p-4">
            {/* Diagnosis Summary */}
            <Card>
              <CardHeader>
                <CardTitle>Diagnosis Summary — {selectedPatient.patient_name}</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Tumor Present</p>
                  <Badge variant={prediction.tumor_present ? "destructive" : "secondary"} className="mt-1">
                    {prediction.tumor_present ? "YES" : "NO"}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Tumor Type</p>
                  <p className="font-bold text-foreground mt-1">{prediction.tumor_type}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Severity</p>
                  <Badge className={
                    prediction.severity_level === "RED" ? "bg-[hsl(var(--severity-red))] text-white" :
                    prediction.severity_level === "YELLOW" ? "bg-[hsl(var(--severity-yellow))] text-black" :
                    "bg-[hsl(var(--severity-green))] text-white"
                  }>
                    {prediction.severity_level}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Queue Rank</p>
                  <p className="font-bold text-primary mt-1">#{prediction.queue_rank ?? "—"}</p>
                </div>
              </CardContent>
            </Card>

            {/* Probability Breakdown */}
            {probabilities && (
              <Card>
                <CardHeader><CardTitle className="text-lg">Probability Breakdown</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {Object.entries(probabilities).map(([key, val]) => (
                    <div key={key}>
                      <div className="flex justify-between text-sm mb-1">
                        <span>{key}</span>
                        <span className="text-primary font-mono">{(val * 100).toFixed(1)}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-secondary overflow-hidden">
                        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${val * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* MRI vs Grad-CAM */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader><CardTitle className="text-lg">Original MRI</CardTitle></CardHeader>
                <CardContent>
                  {latestUpload ? (
                    <img src={getStorageUrl("mri_images", latestUpload.image_path)!} alt="MRI" className="w-full rounded-lg" />
                  ) : <p className="text-muted-foreground">No image</p>}
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-lg">Grad-CAM Heatmap</CardTitle></CardHeader>
                <CardContent>
                  {prediction.gradcam_path ? (
                    <img src={getStorageUrl("gradcam_images", prediction.gradcam_path)!} alt="Grad-CAM" className="w-full rounded-lg" />
                  ) : <p className="text-muted-foreground">No Grad-CAM available</p>}
                </CardContent>
              </Card>
            </div>

            {/* Metrics */}
            {metrics && (
              <Card>
                <CardHeader><CardTitle className="text-lg">Model Metrics</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                      ["Precision", metrics.precision],
                      ["Recall", metrics.recall],
                      ["F1-Score", metrics.f1_score],
                      ["Support", metrics.support],
                      ["Accuracy", metrics.accuracy],
                      ["Sensitivity", metrics.recall_sensitivity],
                      ["Specificity", metrics.specificity],
                      ["ROC AUC", metrics.roc_auc],
                      ["TP", metrics.tp],
                      ["TN", metrics.tn],
                      ["FP", metrics.fp],
                      ["FN", metrics.fn],
                    ].map(([label, value]) => (
                      <div key={label as string} className="p-3 rounded-md bg-secondary/50">
                        <p className="text-xs text-muted-foreground">{label as string}</p>
                        <p className="text-lg font-mono font-bold text-foreground">
                          {value != null ? (typeof value === "number" && value < 10 ? value.toFixed(4) : value) : "—"}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                    {metrics.confusion_matrix_path && (
                      <div>
                        <p className="text-sm text-muted-foreground mb-2">Confusion Matrix</p>
                        <img src={getStorageUrl("charts", metrics.confusion_matrix_path)!} alt="Confusion Matrix" className="w-full rounded-lg" />
                      </div>
                    )}
                    {metrics.roc_curve_path && (
                      <div>
                        <p className="text-sm text-muted-foreground mb-2">ROC Curve</p>
                        <img src={getStorageUrl("charts", metrics.roc_curve_path)!} alt="ROC Curve" className="w-full rounded-lg" />
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {selectedCaseId && !prediction && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No prediction results found for this patient. Upload and scan an MRI first.
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Results;

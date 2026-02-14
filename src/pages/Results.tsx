import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BarChart3, Download, Eye } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import rocData from "@/data/roc_4class.json";

const severityOrder: Record<string, number> = { RED: 0, YELLOW: 1, GREEN: 2 };
const severityMap: Record<string, { label: string; className: string }> = {
  RED: { label: "SEVERE", className: "bg-[hsl(var(--severity-red))] text-white" },
  YELLOW: { label: "MEDIUM", className: "bg-[hsl(var(--severity-yellow))] text-black" },
  GREEN: { label: "MILD", className: "bg-[hsl(var(--severity-green))] text-white" },
};

const rocColors: Record<string, string> = {
  Glioma: "hsl(0, 72%, 51%)",
  Meningioma: "hsl(45, 93%, 47%)",
  Pituitary: "hsl(190, 70%, 50%)",
  NoTumor: "hsl(142, 71%, 45%)",
};

// Build recharts-compatible data from ROC JSON
const buildRocChartData = () => {
  const allFpr = new Set<number>();
  for (const cls of rocData.classes) {
    rocData.curves[cls as keyof typeof rocData.curves].fpr.forEach((v: number) => allFpr.add(v));
  }
  const sortedFpr = Array.from(allFpr).sort((a, b) => a - b);
  return sortedFpr.map((fpr) => {
    const point: Record<string, number> = { fpr };
    for (const cls of rocData.classes) {
      const curve = rocData.curves[cls as keyof typeof rocData.curves];
      // Interpolate tpr at this fpr
      let tpr = 0;
      for (let i = 0; i < curve.fpr.length - 1; i++) {
        if (fpr >= curve.fpr[i] && fpr <= curve.fpr[i + 1]) {
          const t = (fpr - curve.fpr[i]) / (curve.fpr[i + 1] - curve.fpr[i]);
          tpr = curve.tpr[i] + t * (curve.tpr[i + 1] - curve.tpr[i]);
          break;
        }
      }
      if (fpr >= curve.fpr[curve.fpr.length - 1]) tpr = curve.tpr[curve.tpr.length - 1];
      point[cls] = parseFloat(tpr.toFixed(4));
    }
    return point;
  });
};

const rocChartData = buildRocChartData();

const Results = () => {
  const [gradcamModal, setGradcamModal] = useState<any>(null);
  const reportRef = useRef<HTMLDivElement>(null);

  const { data: predictions } = useQuery({
    queryKey: ["all-predictions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("predictions").select("*, patients(*), metrics(*)").order("created_at", { ascending: false });
      if (error) throw error;
      return data?.sort((a, b) => severityOrder[a.severity_level] - severityOrder[b.severity_level]);
    },
  });

  const getStorageUrl = (bucket: string, path: string | null) => {
    if (!path) return null;
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  };

  const downloadReport = async (prediction: any) => {
    try {
      const patient = prediction.patients;
      // Create a temporary div for PDF rendering
      const container = document.createElement("div");
      container.style.cssText = "position:fixed;left:-9999px;top:0;width:800px;padding:32px;background:#0d1117;color:#e6edf3;font-family:system-ui";
      container.innerHTML = `
        <h2 style="margin-bottom:16px;color:#22d3ee">Patient Report</h2>
        <p><b>Case ID:</b> ${patient?.case_id}</p>
        <p><b>Patient:</b> ${patient?.patient_name}</p>
        <p><b>Tumor Present:</b> ${prediction.tumor_present ? "Yes" : "No"}</p>
        <p><b>Tumor Type:</b> ${prediction.tumor_type}</p>
        <p><b>Severity:</b> ${severityMap[prediction.severity_level]?.label}</p>
        <p><b>Date:</b> ${new Date(prediction.created_at).toLocaleDateString()}</p>
      `;
      document.body.appendChild(container);
      const canvas = await html2canvas(container, { backgroundColor: "#0d1117", scale: 2 });
      document.body.removeChild(container);

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const width = pdf.internal.pageSize.getWidth();
      const height = (canvas.height * width) / canvas.width;
      pdf.addImage(imgData, "PNG", 0, 0, width, height);
      pdf.save(`report_${patient?.case_id}.pdf`);
      toast({ title: "Report downloaded" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <BarChart3 className="h-6 w-6 text-primary" />
          Results
        </h2>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Case ID</TableHead>
                  <TableHead>Patient Name</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Download</TableHead>
                  <TableHead>View</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {predictions?.map((pred) => (
                  <TableRow key={pred.id}>
                    <TableCell className="font-mono text-primary">{pred.patients?.case_id}</TableCell>
                    <TableCell className="font-medium">{pred.patients?.patient_name}</TableCell>
                    <TableCell>
                      <Badge className={`font-bold ${severityMap[pred.severity_level]?.className}`}>
                        {severityMap[pred.severity_level]?.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="outline" size="sm" onClick={() => downloadReport(pred)}>
                        <Download className="h-4 w-4 mr-1" /> Download
                      </Button>
                    </TableCell>
                    <TableCell>
                      <Button variant="outline" size="sm" onClick={() => setGradcamModal(pred)}>
                        <Eye className="h-4 w-4 mr-1" /> Grad-CAM
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {(!predictions || predictions.length === 0) && (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No results yet. Upload and scan an MRI first.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Grad-CAM Modal */}
        <Dialog open={!!gradcamModal} onOpenChange={() => setGradcamModal(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Grad-CAM Result — {gradcamModal?.patients?.patient_name} ({gradcamModal?.patients?.case_id})</DialogTitle>
            </DialogHeader>

            <div className="space-y-6">
              {/* Grad-CAM Image */}
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-2">Tumor Localization (Grad-CAM Heatmap)</h4>
                {gradcamModal?.gradcam_path ? (
                  <img
                    src={getStorageUrl("gradcam_images", gradcamModal.gradcam_path)!}
                    alt="Grad-CAM Heatmap"
                    className="w-full max-h-96 object-contain rounded-lg bg-secondary"
                  />
                ) : (
                  <div className="p-8 rounded-lg bg-secondary text-center text-muted-foreground">
                    <p>No Grad-CAM image available for this prediction.</p>
                    <p className="text-xs mt-1">Grad-CAM highlights the tumor region in red on the MRI scan.</p>
                  </div>
                )}
              </div>

              {/* ROC Chart */}
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-2">Model Accuracy Comparison (ROC)</h4>
                <Card>
                  <CardContent className="pt-6">
                    <ResponsiveContainer width="100%" height={350}>
                      <LineChart data={rocChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis
                          dataKey="fpr"
                          label={{ value: "False Positive Rate", position: "insideBottom", offset: -5, fill: "hsl(var(--muted-foreground))" }}
                          tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                          domain={[0, 1]}
                        />
                        <YAxis
                          label={{ value: "True Positive Rate", angle: -90, position: "insideLeft", fill: "hsl(var(--muted-foreground))" }}
                          tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                          domain={[0, 1]}
                        />
                        <Tooltip
                          contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, color: "hsl(var(--foreground))" }}
                        />
                        <Legend />
                        {rocData.classes.map((cls) => (
                          <Line
                            key={cls}
                            type="monotone"
                            dataKey={cls}
                            name={`${cls} (AUC=${rocData.curves[cls as keyof typeof rocData.curves].auc})`}
                            stroke={rocColors[cls]}
                            strokeWidth={2}
                            dot={false}
                          />
                        ))}
                        {/* Diagonal reference line */}
                        <Line type="linear" dataKey="fpr" name="Random" stroke="hsl(var(--muted-foreground))" strokeDasharray="5 5" strokeWidth={1} dot={false} legendType="none" />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default Results;

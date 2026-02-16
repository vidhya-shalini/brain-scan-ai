import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BarChart3, Download, Eye, Loader2, BarChart } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import jsPDF from "jspdf";
import { BarChart as RechartsBar, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from "recharts";

const severityOrder: Record<string, number> = { RED: 0, YELLOW: 1, GREEN: 2 };
const severityMap: Record<string, { label: string; className: string }> = {
  RED: { label: "SEVERE", className: "bg-[hsl(var(--severity-red))] text-white" },
  YELLOW: { label: "MEDIUM", className: "bg-[hsl(var(--severity-yellow))] text-black" },
  GREEN: { label: "MILD", className: "bg-[hsl(var(--severity-green))] text-white" },
};

const classColors: Record<string, string> = {
  Glioma: "#ef4444",
  Meningioma: "#eab308",
  Pituitary: "#06b6d4",
  NoTumor: "#22c55e",
};

const classInterpretations: Record<string, string> = {
  Glioma: "Glioma is a type of tumor that occurs in the brain and spinal cord. Gliomas begin in the gluey supportive cells (glial cells) that surround nerve cells. Further clinical evaluation and biopsy are recommended.",
  Meningioma: "Meningioma is a tumor that arises from the meninges — the membranes that surround the brain and spinal cord. Most meningiomas are noncancerous (benign), though rarely they can be cancerous. Clinical follow-up advised.",
  Pituitary: "Pituitary tumors are abnormal growths that develop in the pituitary gland. Some pituitary tumors result in excess hormones, while others can cause the pituitary gland to produce lower levels. Most are benign. Endocrinological evaluation recommended.",
  NoTumor: "No tumor detected in the MRI brain scan. The brain parenchyma appears normal. No abnormal enhancement or mass effect identified. Normal study.",
};

type PredictionRow = {
  id: string;
  tumor_present: boolean;
  tumor_type: string;
  severity_level: string;
  probabilities: Record<string, number> | null;
  baseline_probabilities: Record<string, number> | null;
  gradcam_path: string | null;
  created_at: string;
  patient_id: string;
  patients: {
    case_id: string;
    patient_name: string;
    age: number;
    gender: string;
    seizure: boolean;
    headache_severity: string;
    created_at: string;
  } | null;
};

const Results = () => {
  const [gradcamModal, setGradcamModal] = useState<PredictionRow | null>(null);
  const [comparisonModal, setComparisonModal] = useState<PredictionRow | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [gradcamLoading, setGradcamLoading] = useState(false);
  const [gradcamError, setGradcamError] = useState<string | null>(null);

  const { data: predictions } = useQuery({
    queryKey: ["all-predictions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("predictions")
        .select("*, patients(*)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as unknown as PredictionRow[])?.sort(
        (a, b) => severityOrder[a.severity_level] - severityOrder[b.severity_level]
      );
    },
  });

  const getStorageUrl = (bucket: string, path: string | null) => {
    if (!path) return null;
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  };

  // Fetch MRI image URL for a patient
  const getMriUrl = async (patientId: string): Promise<string | null> => {
    const { data } = await supabase
      .from("mri_uploads")
      .select("image_path")
      .eq("patient_id", patientId)
      .order("upload_order", { ascending: false })
      .limit(1);
    if (data?.[0]?.image_path) {
      return getStorageUrl("mri_images", data[0].image_path);
    }
    return null;
  };

  const loadImageAsBase64 = async (url: string): Promise<string | null> => {
    try {
      const resp = await fetch(url);
      const blob = await resp.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    } catch {
      return null;
    }
  };

  const downloadReport = async (pred: PredictionRow) => {
    if (!pred.patients) return;
    setDownloadingId(pred.id);

    try {
      const patient = pred.patients;
      const probs = pred.probabilities || {};
      const maxProb = Math.max(...Object.values(probs));
      const confidence = (maxProb * 100).toFixed(1);
      const interpretation = classInterpretations[pred.tumor_type] || "Classification result available.";
      const reportDate = new Date(pred.created_at);
      const dateStr = reportDate.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
      const timeStr = reportDate.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

      // Load images
      const mriUrl = await getMriUrl(pred.patient_id);
      const gradcamUrl = getStorageUrl("gradcam_images", pred.gradcam_path);
      const [mriBase64, gradcamBase64] = await Promise.all([
        mriUrl ? loadImageAsBase64(mriUrl) : Promise.resolve(null),
        gradcamUrl ? loadImageAsBase64(gradcamUrl) : Promise.resolve(null),
      ]);

      const pdf = new jsPDF("p", "mm", "a4");
      const w = pdf.internal.pageSize.getWidth();
      let y = 15;

      // Header
      pdf.setFillColor(0, 136, 204);
      pdf.rect(0, 0, w, 28, "F");
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(18);
      pdf.setFont("helvetica", "bold");
      pdf.text("BRAIN TUMOR DETECTION CENTER", w / 2, 12, { align: "center" });
      pdf.setFontSize(9);
      pdf.setFont("helvetica", "normal");
      pdf.text("MRI Brain Scan Analysis Report", w / 2, 19, { align: "center" });
      pdf.text("AI-Assisted Diagnostic Report", w / 2, 24, { align: "center" });

      y = 35;

      // Patient info box
      pdf.setDrawColor(0, 136, 204);
      pdf.setLineWidth(0.5);
      pdf.rect(10, y, w - 20, 30);
      pdf.setTextColor(0, 0, 0);
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "bold");

      const col1 = 15;
      const col2 = w / 2 + 5;
      pdf.text("Patient Name:", col1, y + 7);
      pdf.text("Age / Sex:", col1, y + 14);
      pdf.text("Case ID:", col1, y + 21);
      pdf.text("Registered on:", col2, y + 7);
      pdf.text("Reported on:", col2, y + 14);
      pdf.text("Seizure History:", col2, y + 21);

      pdf.setFont("helvetica", "normal");
      pdf.text(patient.patient_name, col1 + 35, y + 7);
      pdf.text(`${patient.age} / ${patient.gender}`, col1 + 35, y + 14);
      pdf.text(patient.case_id, col1 + 35, y + 21);
      pdf.text(`${dateStr} ${timeStr}`, col2 + 35, y + 7);
      pdf.text(`${dateStr} ${timeStr}`, col2 + 35, y + 14);
      pdf.text(patient.seizure ? "Yes" : "No", col2 + 35, y + 21);

      y += 38;

      // Title
      pdf.setFillColor(0, 136, 204);
      pdf.rect(10, y, w - 20, 8, "F");
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(12);
      pdf.setFont("helvetica", "bold");
      pdf.text("MRI BRAIN - AI ANALYSIS REPORT", w / 2, y + 6, { align: "center" });
      y += 14;

      // Prediction results
      pdf.setTextColor(0, 0, 0);
      pdf.setFontSize(11);
      pdf.setFont("helvetica", "bold");
      pdf.text("Prediction Results", 15, y);
      y += 7;

      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      pdf.text(`Tumor Present: ${pred.tumor_present ? "Yes" : "No"}`, 15, y); y += 6;
      pdf.text(`Predicted Class: ${pred.tumor_type}`, 15, y); y += 6;
      pdf.text(`Confidence: ${confidence}%`, 15, y); y += 6;
      pdf.text(`Severity: ${severityMap[pred.severity_level]?.label || pred.severity_level}`, 15, y); y += 8;

      // Probabilities
      pdf.setFont("helvetica", "bold");
      pdf.text("Class Probabilities:", 15, y); y += 6;
      pdf.setFont("helvetica", "normal");
      for (const [cls, prob] of Object.entries(probs)) {
        const pct = (prob * 100).toFixed(1);
        pdf.text(`  ${cls}: ${pct}%`, 15, y);
        // Draw bar
        pdf.setFillColor(cls === pred.tumor_type ? 0 : 180, cls === pred.tumor_type ? 136 : 180, cls === pred.tumor_type ? 204 : 180);
        pdf.rect(65, y - 3, prob * 80, 4, "F");
        y += 6;
      }

      y += 4;

      // Findings
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(11);
      pdf.text("Findings", 15, y); y += 6;
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      const findingsLines = pdf.splitTextToSize(interpretation, w - 35);
      pdf.text(findingsLines, 15, y);
      y += findingsLines.length * 5 + 4;

      // Impression
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(11);
      pdf.text("Impression", 15, y); y += 6;
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      pdf.text(`Model suggests ${pred.tumor_type} with ${confidence}% probability.`, 15, y);
      y += 10;

      // Images section
      if (mriBase64 || gradcamBase64) {
        if (y > 200) { pdf.addPage(); y = 15; }
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(11);
        pdf.text("Scan Images", 15, y); y += 6;

        const imgSize = 55;
        if (mriBase64) {
          try {
            pdf.addImage(mriBase64, "JPEG", 15, y, imgSize, imgSize);
            pdf.setFontSize(8);
            pdf.setFont("helvetica", "normal");
            pdf.text("Original MRI", 15 + imgSize / 2, y + imgSize + 5, { align: "center" });
          } catch { /* image add failed */ }
        }
        if (gradcamBase64) {
          try {
            pdf.addImage(gradcamBase64, "PNG", mriBase64 ? 85 : 15, y, imgSize, imgSize);
            pdf.setFontSize(8);
            pdf.setFont("helvetica", "normal");
            pdf.text("Grad-CAM Heatmap", (mriBase64 ? 85 : 15) + imgSize / 2, y + imgSize + 5, { align: "center" });
          } catch { /* image add failed */ }
        }
        y += imgSize + 12;
      }

      // Footer
      if (y > 250) { pdf.addPage(); y = 15; }
      pdf.setDrawColor(0, 136, 204);
      pdf.setLineWidth(0.3);
      pdf.line(10, y, w - 10, y);
      y += 8;
      pdf.setFontSize(9);
      pdf.setTextColor(100, 100, 100);
      pdf.setFont("helvetica", "italic");
      pdf.text("**** End of Report ****", w / 2, y, { align: "center" });
      y += 10;
      pdf.setFont("helvetica", "normal");
      pdf.text("Radiologic Technologist", 20, y);
      pdf.text("Reporting Radiologist", w / 2, y, { align: "center" });
      pdf.text("Consulting Doctor", w - 50, y);
      y += 5;
      pdf.setFontSize(8);
      pdf.text("(MSc, PGDM)", 20, y);
      pdf.text("(MD, Radiologist)", w / 2, y, { align: "center" });
      pdf.text("(MD, Radiologist)", w - 50, y);

      pdf.save(`MRI_Report_${patient.case_id}_${reportDate.toISOString().slice(0, 10)}.pdf`);
      toast({ title: "Report downloaded" });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      toast({ title: "Error generating report", description: msg, variant: "destructive" });
    } finally {
      setDownloadingId(null);
    }
  };

  const openGradcam = (pred: PredictionRow) => {
    setGradcamError(null);
    setGradcamLoading(true);
    setGradcamModal(pred);

    // Validate gradcam availability
    if (!pred.gradcam_path) {
      setGradcamError("No Grad-CAM image was generated for this prediction. This may happen if no tumor was detected.");
      setGradcamLoading(false);
      return;
    }

    const url = getStorageUrl("gradcam_images", pred.gradcam_path);
    if (!url) {
      setGradcamError("Could not generate storage URL for Grad-CAM image.");
      setGradcamLoading(false);
      return;
    }

    // Test that the image loads
    const img = new Image();
    img.onload = () => setGradcamLoading(false);
    img.onerror = () => {
      setGradcamError("Failed to load Grad-CAM image from storage. The file may be missing or corrupted.");
      setGradcamLoading(false);
    };
    img.src = url;
  };

  const buildProbabilityChartData = (probs: Record<string, number> | null) => {
    if (!probs) return [];
    return Object.entries(probs).map(([cls, value]) => ({
      name: cls,
      probability: parseFloat((value * 100).toFixed(1)),
    }));
  };

  const buildComparisonChartData = (pred: PredictionRow) => {
    const improved = pred.probabilities || {};
    const baseline = (pred.baseline_probabilities as Record<string, number> | null) || null;
    const classes = ["Glioma", "Meningioma", "Pituitary", "NoTumor"];
    return classes.map((cls) => ({
      name: cls,
      "My Model": parseFloat(((improved[cls] || 0) * 100).toFixed(1)),
      "Baseline": baseline ? parseFloat(((baseline[cls] || 0) * 100).toFixed(1)) : null,
    }));
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
                  <TableHead>Report</TableHead>
                  <TableHead>View</TableHead>
                  <TableHead>Comparison</TableHead>
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
                      <Button variant="outline" size="sm" onClick={() => downloadReport(pred)} disabled={downloadingId === pred.id}>
                        {downloadingId === pred.id ? (
                          <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Generating…</>
                        ) : (
                          <><Download className="h-4 w-4 mr-1" /> Download</>
                        )}
                      </Button>
                    </TableCell>
                    <TableCell>
                      <Button variant="outline" size="sm" onClick={() => openGradcam(pred)}>
                        <Eye className="h-4 w-4 mr-1" /> Grad-CAM
                      </Button>
                    </TableCell>
                    <TableCell>
                      <Button variant="outline" size="sm" onClick={() => setComparisonModal(pred)}>
                        <BarChart className="h-4 w-4 mr-1" /> View Graph
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {(!predictions || predictions.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      No results yet. Upload and scan an MRI first.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Grad-CAM Modal */}
        <Dialog open={!!gradcamModal} onOpenChange={() => { setGradcamModal(null); setGradcamError(null); }}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                Grad-CAM Result — {gradcamModal?.patients?.patient_name} ({gradcamModal?.patients?.case_id})
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-6">
              {/* Grad-CAM Image */}
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-2">Tumor Localization (Grad-CAM Heatmap)</h4>
                {gradcamLoading ? (
                  <div className="flex items-center justify-center p-8 rounded-lg bg-secondary">
                    <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
                    <span className="text-muted-foreground">Loading Grad-CAM…</span>
                  </div>
                ) : gradcamError ? (
                  <div className="p-6 rounded-lg bg-secondary text-center space-y-2">
                    <p className="text-muted-foreground">{gradcamError}</p>
                    <p className="text-xs text-muted-foreground/60">
                      Grad-CAM images are generated when a tumor is detected during the scan.
                    </p>
                  </div>
                ) : gradcamModal?.gradcam_path ? (
                  <img
                    src={getStorageUrl("gradcam_images", gradcamModal.gradcam_path)!}
                    alt="Grad-CAM Heatmap"
                    className="w-full max-h-96 object-contain rounded-lg bg-secondary"
                  />
                ) : null}
              </div>

              {/* Dynamic Probability Chart per patient */}
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-2">Prediction Probability Distribution</h4>
                <Card>
                  <CardContent className="pt-6">
                    {gradcamModal?.probabilities ? (
                      <ResponsiveContainer width="100%" height={300}>
                        <RechartsBar data={buildProbabilityChartData(gradcamModal.probabilities)} barSize={50}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                          <YAxis
                            label={{ value: "Probability (%)", angle: -90, position: "insideLeft", fill: "hsl(var(--muted-foreground))" }}
                            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                            domain={[0, 100]}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "hsl(var(--card))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: 8,
                              color: "hsl(var(--foreground))",
                            }}
                            formatter={(value: number) => [`${value}%`, "Probability"]}
                          />
                          <Bar dataKey="probability" radius={[4, 4, 0, 0]}>
                            {buildProbabilityChartData(gradcamModal.probabilities).map((entry, idx) => (
                              <Cell key={idx} fill={classColors[entry.name] || "#8884d8"} />
                            ))}
                          </Bar>
                        </RechartsBar>
                      </ResponsiveContainer>
                    ) : (
                      <p className="text-center text-muted-foreground py-4">No probability data available.</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Comparison Graph Modal */}
        <Dialog open={!!comparisonModal} onOpenChange={() => setComparisonModal(null)}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                Comparison Graph — {comparisonModal?.patients?.patient_name} ({comparisonModal?.patients?.case_id})
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <h4 className="text-sm font-medium text-muted-foreground">
                Model Output Comparison (per class probability %)
              </h4>
              <Card>
                <CardContent className="pt-6">
                  {comparisonModal ? (
                    (() => {
                      const data = buildComparisonChartData(comparisonModal);
                      const hasBaseline = data.some((d) => d["Baseline"] !== null);
                      return (
                        <>
                          <ResponsiveContainer width="100%" height={320}>
                            <RechartsBar data={data} barGap={4} barSize={hasBaseline ? 30 : 50}>
                              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                              <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                              <YAxis
                                label={{ value: "Probability (%)", angle: -90, position: "insideLeft", fill: "hsl(var(--muted-foreground))" }}
                                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                                domain={[0, 100]}
                              />
                              <Tooltip
                                contentStyle={{
                                  backgroundColor: "hsl(var(--card))",
                                  border: "1px solid hsl(var(--border))",
                                  borderRadius: 8,
                                  color: "hsl(var(--foreground))",
                                }}
                                formatter={(value: number | null) => [value !== null ? `${value}%` : "N/A", ""]}
                              />
                              <Legend />
                              <Bar dataKey="My Model" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                              {hasBaseline && (
                                <Bar dataKey="Baseline" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} />
                              )}
                            </RechartsBar>
                          </ResponsiveContainer>
                          {!hasBaseline && (
                            <p className="text-xs text-muted-foreground text-center mt-3">
                              Baseline model data not yet available. Only current model output is shown.
                              Comparison will appear once baseline probabilities are recorded.
                            </p>
                          )}
                        </>
                      );
                    })()
                  ) : null}
                </CardContent>
              </Card>

              {/* Summary */}
              {comparisonModal?.probabilities && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {Object.entries(comparisonModal.probabilities).map(([cls, val]) => (
                    <div key={cls} className="rounded-lg border border-border p-3 text-center">
                      <p className="text-xs text-muted-foreground">{cls}</p>
                      <p className="text-lg font-bold" style={{ color: classColors[cls] }}>
                        {(val * 100).toFixed(1)}%
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default Results;

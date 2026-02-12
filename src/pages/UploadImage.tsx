import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Upload, Scan, AlertTriangle, X, ImageIcon } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";

const UploadImage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [caseId, setCaseId] = useState("");
  const [patientName, setPatientName] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [seizure, setSeizure] = useState(false);
  const [headacheSeverity, setHeadacheSeverity] = useState<string>("Mild");
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [invalidFile, setInvalidFile] = useState(false);
  const [isNewPatient, setIsNewPatient] = useState(true);

  const { data: patients, refetch: refetchPatients } = useQuery({
    queryKey: ["patients"],
    queryFn: async () => {
      const { data, error } = await supabase.from("patients").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const handleSelectPatient = (patientCaseId: string) => {
    const patient = patients?.find((p) => p.case_id === patientCaseId);
    if (patient) {
      setSelectedPatientId(patient.id);
      setCaseId(patient.case_id);
      setPatientName(patient.patient_name);
      setAge(String(patient.age));
      setGender(patient.gender);
      setSeizure(patient.seizure);
      setHeadacheSeverity(patient.headache_severity);
      setIsNewPatient(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    const valid = selected.filter((f) => f.type === "image/jpeg" || f.type === "image/png");
    if (valid.length !== selected.length) {
      setInvalidFile(true);
      setTimeout(() => setInvalidFile(false), 4000);
    }
    if (valid.length > 0) setFiles((prev) => [...prev, ...valid]);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const dropped = Array.from(e.dataTransfer.files);
    const valid = dropped.filter((f) => f.type === "image/jpeg" || f.type === "image/png");
    if (valid.length !== dropped.length) {
      setInvalidFile(true);
      setTimeout(() => setInvalidFile(false), 4000);
    }
    if (valid.length > 0) setFiles((prev) => [...prev, ...valid]);
  }, []);

  const removeFile = (index: number) => setFiles((prev) => prev.filter((_, i) => i !== index));

  const handleUploadAndScan = async () => {
    if (!caseId || !patientName || !age || !gender || files.length === 0) {
      toast({ title: "Missing fields", description: "Please fill all patient fields and upload at least one MRI image.", variant: "destructive" });
      return;
    }

    setUploading(true);
    try {
      // Create or get patient
      let patientId = selectedPatientId;
      if (isNewPatient) {
        const { data: newPatient, error } = await supabase.from("patients").insert({
          case_id: caseId,
          patient_name: patientName,
          age: parseInt(age),
          gender,
          seizure,
          headache_severity: headacheSeverity as any,
          created_by: user?.id,
        }).select().single();
        if (error) throw error;
        patientId = newPatient.id;
        setSelectedPatientId(patientId);
        refetchPatients();
      }

      // Get current max upload_order
      const { data: existingUploads } = await supabase
        .from("mri_uploads")
        .select("upload_order")
        .eq("patient_id", patientId!)
        .order("upload_order", { ascending: false })
        .limit(1);

      let nextOrder = (existingUploads?.[0]?.upload_order ?? 0) + 1;

      // Upload files to storage
      const uploadedPaths: string[] = [];
      for (const file of files) {
        const filePath = `${patientId}/${Date.now()}_${file.name}`;
        const { error: uploadError } = await supabase.storage.from("mri_images").upload(filePath, file);
        if (uploadError) throw uploadError;

        await supabase.from("mri_uploads").insert({
          patient_id: patientId!,
          image_path: filePath,
          upload_order: nextOrder++,
        });
        uploadedPaths.push(filePath);
      }

      toast({ title: "Upload complete", description: `${files.length} image(s) uploaded successfully.` });
      setFiles([]);
      setUploading(false);

      // Now scan
      setScanning(true);
      // Create signed URLs for the inference API
      const imageUrls: string[] = [];
      for (const path of uploadedPaths) {
        const { data } = await supabase.storage.from("mri_images").createSignedUrl(path, 3600);
        if (data) imageUrls.push(data.signedUrl);
      }

      const { data: result, error: fnError } = await supabase.functions.invoke("predict", {
        body: { case_id: caseId, patient_id: patientId, image_urls: imageUrls },
      });

      if (fnError) throw fnError;

      if (result?.tumor_present) {
        toast({ title: "Scan Complete", description: `Tumor detected: ${result.tumor_type}` });
        navigate("/dashboard/results");
      } else {
        toast({ title: "TUMOR NOT DETECTED", description: "No tumor was found in the MRI scan." });
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setUploading(false);
      setScanning(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Upload className="h-6 w-6 text-primary" />
          Upload MRI Image
        </h2>

        {/* Patient Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Patient Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <Label>Select Existing Patient</Label>
                <Select onValueChange={handleSelectPatient}>
                  <SelectTrigger><SelectValue placeholder="Choose patient or create new" /></SelectTrigger>
                  <SelectContent>
                    {patients?.map((p) => (
                      <SelectItem key={p.id} value={p.case_id}>{p.case_id} — {p.patient_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button variant="outline" onClick={() => { setIsNewPatient(true); setSelectedPatientId(null); setCaseId(""); setPatientName(""); setAge(""); setGender(""); setSeizure(false); }}>
                New Patient
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Case ID</Label>
                <Input value={caseId} onChange={(e) => setCaseId(e.target.value)} placeholder="CASE-001" disabled={!isNewPatient} />
              </div>
              <div className="space-y-2">
                <Label>Patient Name</Label>
                <Input value={patientName} onChange={(e) => setPatientName(e.target.value)} placeholder="John Doe" disabled={!isNewPatient} />
              </div>
              <div className="space-y-2">
                <Label>Age</Label>
                <Input type="number" value={age} onChange={(e) => setAge(e.target.value)} placeholder="45" disabled={!isNewPatient} />
              </div>
              <div className="space-y-2">
                <Label>Gender</Label>
                <Select value={gender} onValueChange={setGender} disabled={!isNewPatient}>
                  <SelectTrigger><SelectValue placeholder="Select gender" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Male">Male</SelectItem>
                    <SelectItem value="Female">Female</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Headache Severity</Label>
                <Select value={headacheSeverity} onValueChange={setHeadacheSeverity} disabled={!isNewPatient}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Mild">Mild</SelectItem>
                    <SelectItem value="Medium">Medium</SelectItem>
                    <SelectItem value="Severe">Severe</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2 pt-6">
                <Checkbox checked={seizure} onCheckedChange={(v) => setSeizure(v as boolean)} disabled={!isNewPatient} id="seizure" />
                <Label htmlFor="seizure">History of Seizures</Label>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* File Upload */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">MRI Image Upload</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {invalidFile && (
              <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/30 text-destructive text-sm">
                <AlertTriangle className="h-4 w-4" />
                INVALID INPUT — Provide a proper MRI Brain Scan image. (JPG/PNG only)
              </div>
            )}

            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer"
              onClick={() => document.getElementById("mri-input")?.click()}
            >
              <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">Drag & drop MRI images here or click to browse</p>
              <p className="text-xs text-muted-foreground mt-1">JPG/PNG only</p>
              <input id="mri-input" type="file" accept="image/jpeg,image/png" multiple onChange={handleFileChange} className="hidden" />
            </div>

            {files.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {files.map((file, i) => (
                  <div key={i} className="relative group rounded-md overflow-hidden border border-border">
                    <img src={URL.createObjectURL(file)} alt={file.name} className="w-full h-24 object-cover" />
                    <button
                      onClick={() => removeFile(i)}
                      className="absolute top-1 right-1 p-1 rounded-full bg-background/80 text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="h-3 w-3" />
                    </button>
                    <p className="text-xs p-1 truncate text-muted-foreground">{file.name}</p>
                  </div>
                ))}
              </div>
            )}

            <Button
              onClick={handleUploadAndScan}
              disabled={uploading || scanning || files.length === 0}
              className="w-full text-lg py-6 medical-glow"
              size="lg"
            >
              {scanning ? (
                <><div className="h-5 w-5 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent mr-2" /> Analyzing MRI...</>
              ) : uploading ? (
                <><div className="h-5 w-5 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent mr-2" /> Uploading...</>
              ) : (
                <><Scan className="mr-2 h-5 w-5" /> SCAN MRI</>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default UploadImage;

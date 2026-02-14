import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Users, ChevronLeft, ChevronRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

const PatientInfo = () => {
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [imageIndex, setImageIndex] = useState(0);

  const { data: patients } = useQuery({
    queryKey: ["patients"],
    queryFn: async () => {
      const { data, error } = await supabase.from("patients").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: uploads } = useQuery({
    queryKey: ["uploads", selectedPatient?.id],
    enabled: !!selectedPatient,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mri_uploads").select("*").eq("patient_id", selectedPatient.id)
        .order("upload_order", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const getImageUrl = (path: string) => {
    const { data } = supabase.storage.from("mri_images").getPublicUrl(path);
    return data.publicUrl;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Users className="h-6 w-6 text-primary" />
          Patient Information
        </h2>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Case ID</TableHead>
                  <TableHead>Patient Name</TableHead>
                  <TableHead>Age</TableHead>
                  <TableHead>Gender</TableHead>
                  <TableHead>Seizure</TableHead>
                  <TableHead>Headache</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {patients?.map((p) => (
                  <TableRow key={p.id} className="cursor-pointer hover:bg-secondary/50" onClick={() => { setSelectedPatient(p); setImageIndex(0); }}>
                    <TableCell className="font-mono text-primary">{p.case_id}</TableCell>
                    <TableCell className="font-medium text-foreground hover:text-primary transition-colors">{p.patient_name}</TableCell>
                    <TableCell>{p.age}</TableCell>
                    <TableCell>{p.gender}</TableCell>
                    <TableCell>
                      {p.seizure ? (
                        <Badge className="bg-[hsl(var(--severity-red))] hover:bg-[hsl(var(--severity-red))]/80 text-white font-bold">YES</Badge>
                      ) : (
                        <Badge className="bg-[hsl(var(--severity-green))] hover:bg-[hsl(var(--severity-green))]/80 text-white font-bold">NO</Badge>
                      )}
                    </TableCell>
                    <TableCell><Badge variant="outline">{p.headache_severity}</Badge></TableCell>
                  </TableRow>
                ))}
                {(!patients || patients.length === 0) && (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No patients found</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Dialog open={!!selectedPatient} onOpenChange={() => setSelectedPatient(null)}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                Patient: {selectedPatient?.patient_name}
                <Badge variant="outline" className="ml-2">{selectedPatient?.case_id}</Badge>
              </DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4 text-sm mb-4">
              <div><span className="text-muted-foreground">Age:</span> {selectedPatient?.age}</div>
              <div><span className="text-muted-foreground">Gender:</span> {selectedPatient?.gender}</div>
              <div>
                <span className="text-muted-foreground">Seizure:</span>{" "}
                {selectedPatient?.seizure ? (
                  <Badge className="bg-[hsl(var(--severity-red))] text-white font-bold ml-1">YES</Badge>
                ) : (
                  <Badge className="bg-[hsl(var(--severity-green))] text-white font-bold ml-1">NO</Badge>
                )}
              </div>
              <div><span className="text-muted-foreground">Headache:</span> {selectedPatient?.headache_severity}</div>
            </div>

            {uploads && uploads.length > 0 ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">MRI Images ({uploads.length})</p>
                <div className="relative aspect-square max-h-96 mx-auto rounded-lg overflow-hidden bg-secondary">
                  <img src={getImageUrl(uploads[imageIndex].image_path)} alt={`MRI ${imageIndex + 1}`} className="w-full h-full object-contain" />
                  {uploads.length > 1 && (
                    <>
                      <Button size="icon" variant="ghost" className="absolute left-2 top-1/2 -translate-y-1/2 bg-background/60"
                        onClick={() => setImageIndex((i) => (i - 1 + uploads.length) % uploads.length)}>
                        <ChevronLeft className="h-5 w-5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="absolute right-2 top-1/2 -translate-y-1/2 bg-background/60"
                        onClick={() => setImageIndex((i) => (i + 1) % uploads.length)}>
                        <ChevronRight className="h-5 w-5" />
                      </Button>
                    </>
                  )}
                </div>
                <p className="text-center text-xs text-muted-foreground">{imageIndex + 1} of {uploads.length}</p>
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">No MRI images uploaded yet</p>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default PatientInfo;

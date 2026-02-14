import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ListOrdered } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

const severityOrder = { RED: 0, YELLOW: 1, GREEN: 2 };
const severityMap: Record<string, { label: string; className: string }> = {
  RED: { label: "SEVERE", className: "bg-[hsl(var(--severity-red))] hover:bg-[hsl(var(--severity-red))]/80 text-white" },
  YELLOW: { label: "MEDIUM", className: "bg-[hsl(var(--severity-yellow))] hover:bg-[hsl(var(--severity-yellow))]/80 text-black" },
  GREEN: { label: "MILD", className: "bg-[hsl(var(--severity-green))] hover:bg-[hsl(var(--severity-green))]/80 text-white" },
};

const QueueOrder = () => {
  const { data: queueData } = useQuery({
    queryKey: ["queue"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("predictions").select("*, patients(*)").order("created_at", { ascending: false });
      if (error) throw error;
      return data?.sort((a, b) => {
        const sDiff = severityOrder[a.severity_level] - severityOrder[b.severity_level];
        if (sDiff !== 0) return sDiff;
        return (a.queue_rank ?? 999) - (b.queue_rank ?? 999);
      });
    },
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <ListOrdered className="h-6 w-6 text-primary" />
          Priority Queue
        </h2>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rank</TableHead>
                  <TableHead>Case ID</TableHead>
                  <TableHead>Patient Name</TableHead>
                  <TableHead>Age</TableHead>
                  <TableHead>Gender</TableHead>
                  <TableHead>Seizure</TableHead>
                  <TableHead>Headache</TableHead>
                  <TableHead>Tumor Type</TableHead>
                  <TableHead>Severity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {queueData?.map((item, idx) => (
                  <TableRow key={item.id} className={cn(
                    item.severity_level === "RED" && "bg-[hsl(var(--severity-red))]/5",
                    item.severity_level === "YELLOW" && "bg-[hsl(var(--severity-yellow))]/5",
                  )}>
                    <TableCell className="font-mono font-bold text-primary">{idx + 1}</TableCell>
                    <TableCell className="font-mono">{item.patients?.case_id}</TableCell>
                    <TableCell className="font-medium">{item.patients?.patient_name}</TableCell>
                    <TableCell>{item.patients?.age}</TableCell>
                    <TableCell>{item.patients?.gender}</TableCell>
                    <TableCell>{item.patients?.seizure ? "Yes" : "No"}</TableCell>
                    <TableCell>{item.patients?.headache_severity}</TableCell>
                    <TableCell><Badge variant="outline">{item.tumor_type}</Badge></TableCell>
                    <TableCell>
                      <Badge className={cn("font-bold", severityMap[item.severity_level]?.className)}>
                        {severityMap[item.severity_level]?.label ?? item.severity_level}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {(!queueData || queueData.length === 0) && (
                  <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">No predictions in queue</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default QueueOrder;

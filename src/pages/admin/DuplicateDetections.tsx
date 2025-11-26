import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle, CheckCircle, Copy, FileText, XCircle, Search } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export default function DuplicateDetections() {
  useRequireAuth(true);
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isScanning, setIsScanning] = useState(false);

  const { data: duplicates, isLoading } = useQuery({
    queryKey: ["duplicate-detections", statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("duplicate_detections")
        .select(`
          *,
          document:documents!duplicate_detections_document_id_fkey(id, file_name),
          duplicate:documents!duplicate_detections_duplicate_document_id_fkey(id, file_name),
          batch:batches(id, batch_name)
        `)
        .order("created_at", { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("duplicate_detections")
        .update({ 
          status, 
          reviewed_at: new Date().toISOString(),
          reviewed_by: (await supabase.auth.getUser()).data.user?.id 
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["duplicate-detections"] });
      toast.success("Duplicate status updated");
    },
    onError: () => {
      toast.error("Failed to update duplicate status");
    },
  });

  const getSeverityColor = (score: number) => {
    if (score >= 0.9) return "destructive";
    if (score >= 0.7) return "warning";
    return "secondary";
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "confirmed": return <CheckCircle className="h-4 w-4" />;
      case "dismissed": return <XCircle className="h-4 w-4" />;
      default: return <AlertCircle className="h-4 w-4" />;
    }
  };

  const scanForDuplicates = async () => {
    setIsScanning(true);
    try {
      // Get all documents that belong to a batch
      const { data: docs, error: docsError } = await supabase
        .from('documents')
        .select('id, batch_id')
        .not('batch_id', 'is', null);

      if (docsError) throw docsError;
      if (!docs || docs.length === 0) {
        toast.error("No documents found to scan");
        setIsScanning(false);
        return;
      }

      let successCount = 0;
      for (const doc of docs) {
        if (!doc.batch_id) continue;
        try {
          await supabase.functions.invoke('detect-duplicates', {
            body: {
              documentId: doc.id,
              batchId: doc.batch_id,
              checkCrossBatch: false,
              thresholds: { name: 0.85, address: 0.90 }
            }
          });
          successCount++;
        } catch (err) {
          console.error(`Failed to scan document ${doc.id}:`, err);
        }
      }

      queryClient.invalidateQueries({ queryKey: ["duplicate-detections"] });
      toast.success(`Scanned ${successCount} of ${docs.length} documents for duplicates`);
    } catch (error) {
      console.error('Duplicate scan error:', error);
      toast.error("Failed to scan for duplicates");
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <AdminLayout title="Duplicate Detections">
      <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Duplicate Detections</h1>
        <p className="text-muted-foreground">
          AI-powered duplicate detection analyzes documents for potential duplicates using advanced similarity algorithms on names, addresses, and signatures. Review flagged duplicates with similarity scores, compare matching fields, and confirm or dismiss detections to maintain data integrity and prevent duplicate entries.
        </p>
      </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Detected Duplicates</CardTitle>
                <CardDescription>Documents flagged as potential duplicates</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button 
                  onClick={scanForDuplicates}
                  disabled={isScanning}
                  size="sm"
                >
                  <Search className="h-4 w-4 mr-2" />
                  {isScanning ? "Scanning..." : "Scan All for Duplicates"}
                </Button>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="confirmed">Confirmed</SelectItem>
                    <SelectItem value="dismissed">Dismissed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading duplicates...</div>
            ) : !duplicates || duplicates.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No duplicate detections found
              </div>
            ) : (
              <div className="space-y-4">
                {duplicates.map((dup: any) => (
                  <Card key={dup.id} className="border-l-4" style={{
                    borderLeftColor: dup.status === 'confirmed' ? 'hsl(var(--destructive))' :
                                   dup.status === 'dismissed' ? 'hsl(var(--muted))' :
                                   'hsl(var(--warning))'
                  }}>
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-3">
                          <div className="flex items-center gap-3">
                            <Badge variant={getSeverityColor(dup.similarity_score)}>
                              {(dup.similarity_score * 100).toFixed(0)}% Match
                            </Badge>
                            <Badge variant="outline" className="flex items-center gap-1">
                              {getStatusIcon(dup.status)}
                              {dup.status}
                            </Badge>
                            <span className="text-sm text-muted-foreground">
                              {dup.duplicate_type}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 text-sm">
                                <FileText className="h-4 w-4 text-muted-foreground" />
                                <span className="font-medium">Original:</span>
                                <span className="text-muted-foreground">{dup.document?.file_name}</span>
                              </div>
                            </div>
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 text-sm">
                                <Copy className="h-4 w-4 text-muted-foreground" />
                                <span className="font-medium">Duplicate:</span>
                                <span className="text-muted-foreground">{dup.duplicate?.file_name}</span>
                              </div>
                            </div>
                          </div>

                          <div className="text-xs text-muted-foreground">
                            Detected {format(new Date(dup.created_at), "PPp")} • 
                            Batch: {dup.batch?.batch_name}
                          </div>

                          {dup.duplicate_fields && Object.keys(dup.duplicate_fields).length > 0 && (
                            <div className="pt-2 border-t">
                              <p className="text-sm font-medium mb-2">Matching Fields:</p>
                              <div className="flex flex-wrap gap-2">
                                {Object.entries(dup.duplicate_fields).map(([field, value]: [string, any]) => {
                                  const display = typeof value === "object" && value !== null
                                    ? `${value.current ?? ""} ↔ ${value.candidate ?? ""} (${value.similarity !== undefined ? (value.similarity * 100).toFixed(0) + "%" : ""})`
                                    : String(value);
                                  return (
                                    <Badge key={field} variant="secondary" className="text-xs">
                                      {field}: {display}
                                    </Badge>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>

                        {dup.status === 'pending' && (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => updateStatus.mutate({ id: dup.id, status: "confirmed" })}
                              disabled={updateStatus.isPending}
                            >
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Confirm
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateStatus.mutate({ id: dup.id, status: "dismissed" })}
                              disabled={updateStatus.isPending}
                            >
                              <XCircle className="h-4 w-4 mr-1" />
                              Dismiss
                            </Button>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}

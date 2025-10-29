import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Upload, Trash2, FileSignature } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface SignatureReferencesManagerProps {
  projectId: string;
}

export function SignatureReferencesManager({ projectId }: SignatureReferencesManagerProps) {
  const [references, setReferences] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Form state
  const [entityType, setEntityType] = useState("");
  const [entityId, setEntityId] = useState("");
  const [entityName, setEntityName] = useState("");
  const [signatureFile, setSignatureFile] = useState<File | null>(null);

  useEffect(() => {
    fetchReferences();
  }, [projectId]);

  const fetchReferences = async () => {
    try {
      const { data, error } = await supabase
        .from('signature_references')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setReferences(data || []);
    } catch (error) {
      console.error('Error fetching references:', error);
      toast.error("Failed to load signature references");
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async () => {
    if (!signatureFile || !entityType || !entityId) {
      toast.error("Please fill in all required fields");
      return;
    }

    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Upload signature image to storage
      const fileExt = signatureFile.name.split('.').pop();
      const fileName = `${projectId}/${entityType}/${entityId}_${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(fileName, signatureFile);

      if (uploadError) throw uploadError;

      // Create reference record
      const { error: insertError } = await supabase
        .from('signature_references')
        .insert({
          project_id: projectId,
          entity_type: entityType,
          entity_id: entityId,
          entity_name: entityName || null,
          signature_image_url: fileName,
          created_by: user.id,
        });

      if (insertError) throw insertError;

      toast.success("Reference signature uploaded successfully");
      setIsDialogOpen(false);
      resetForm();
      fetchReferences();
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error(error.message || "Failed to upload signature");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string, imageUrl: string) => {
    if (!confirm('Are you sure you want to delete this reference signature?')) return;

    try {
      // Delete from storage
      await supabase.storage.from('documents').remove([imageUrl]);

      // Delete from database
      const { error } = await supabase
        .from('signature_references')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success("Reference deleted successfully");
      fetchReferences();
    } catch (error) {
      console.error('Delete error:', error);
      toast.error("Failed to delete reference");
    }
  };

  const resetForm = () => {
    setEntityType("");
    setEntityId("");
    setEntityName("");
    setSignatureFile(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileSignature className="h-5 w-5" />
          <h2 className="text-xl font-semibold">Reference Signatures</h2>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Upload className="mr-2 h-4 w-4" />
              Upload Reference
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Upload Reference Signature</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="entity-type">Entity Type *</Label>
                <Input
                  id="entity-type"
                  placeholder="e.g., voter, employee, customer"
                  value={entityType}
                  onChange={(e) => setEntityType(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="entity-id">Entity ID *</Label>
                <Input
                  id="entity-id"
                  placeholder="e.g., V12345, EMP001"
                  value={entityId}
                  onChange={(e) => setEntityId(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="entity-name">Entity Name (Optional)</Label>
                <Input
                  id="entity-name"
                  placeholder="e.g., John Doe"
                  value={entityName}
                  onChange={(e) => setEntityName(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="signature-file">Signature Image *</Label>
                <Input
                  id="signature-file"
                  type="file"
                  accept="image/*"
                  onChange={(e) => setSignatureFile(e.target.files?.[0] || null)}
                />
              </div>

              <Button
                onClick={handleUpload}
                disabled={uploading}
                className="w-full"
              >
                {uploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  'Upload'
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {references.length === 0 ? (
        <Card className="p-8 text-center">
          <FileSignature className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">No reference signatures yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Upload reference signatures to enable automatic comparison during validation
          </p>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Entity Type</TableHead>
                <TableHead>Entity ID</TableHead>
                <TableHead>Entity Name</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {references.map((ref) => (
                <TableRow key={ref.id}>
                  <TableCell className="font-medium">{ref.entity_type}</TableCell>
                  <TableCell>{ref.entity_id}</TableCell>
                  <TableCell>{ref.entity_name || '-'}</TableCell>
                  <TableCell>
                    {new Date(ref.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(ref.id, ref.signature_image_url)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}

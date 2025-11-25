import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { History, RotateCcw, FileText, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface DocumentVersionHistoryProps {
  documentId: string;
  onRestore?: () => void;
}

export const DocumentVersionHistory = ({ documentId, onRestore }: DocumentVersionHistoryProps) => {
  const [selectedVersion, setSelectedVersion] = useState<string | null>(null);

  const { data: versions, isLoading } = useQuery({
    queryKey: ['document-versions', documentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('document_versions')
        .select('*')
        .eq('document_id', documentId)
        .order('version_number', { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  const handleRestore = async (versionId: string, versionNumber: number) => {
    try {
      const version = versions?.find(v => v.id === versionId);
      if (!version) return;

      // Restore document to this version's state
      const validStatuses = ['pending', 'validated', 'rejected', 'needs_review'];
      const status = validStatuses.includes(version.validation_status) 
        ? version.validation_status as 'pending' | 'validated' | 'rejected' | 'needs_review'
        : 'pending';

      const { error } = await supabase
        .from('documents')
        .update({
          file_url: version.file_url,
          file_name: version.file_name,
          extracted_metadata: version.extracted_metadata,
          extracted_text: version.extracted_text,
          validation_status: status,
          confidence_score: version.confidence_score,
          field_confidence: version.field_confidence,
          line_items: version.line_items,
          word_bounding_boxes: version.word_bounding_boxes,
          classification_metadata: version.classification_metadata,
        })
        .eq('id', documentId);

      if (error) throw error;

      toast.success(`Document restored to version ${versionNumber}`);
      onRestore?.();
      setSelectedVersion(null);
    } catch (error: any) {
      toast.error('Failed to restore version: ' + error.message);
    }
  };

  const getChangeTypeBadge = (changeType: string) => {
    const types = {
      field_change: { label: 'Field Change', variant: 'default' as const },
      status_change: { label: 'Status Change', variant: 'secondary' as const },
      file_replacement: { label: 'File Replaced', variant: 'destructive' as const },
      metadata_update: { label: 'Metadata Update', variant: 'outline' as const },
    };
    return types[changeType as keyof typeof types] || types.metadata_update;
  };

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading version history...</div>;
  }

  if (!versions || versions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Version History
          </CardTitle>
          <CardDescription>No version history available yet</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Version History
          </CardTitle>
          <CardDescription>
            Track all changes made to this document
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-4">
              {versions.map((version) => {
                const changeInfo = getChangeTypeBadge(version.change_type);
                return (
                  <div
                    key={version.id}
                    className="flex items-start gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <FileText className="h-5 w-5 mt-1 text-muted-foreground" />
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">Version {version.version_number}</span>
                          <Badge variant={changeInfo.variant}>{changeInfo.label}</Badge>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(version.changed_at), { addSuffix: true })}
                        </span>
                      </div>
                      
                      {version.change_summary && (
                        <p className="text-sm text-muted-foreground">{version.change_summary}</p>
                      )}

                      {version.changed_fields && Object.keys(version.changed_fields).length > 0 && (
                        <div className="text-xs bg-muted p-2 rounded">
                          <strong>Changed fields:</strong> {Object.keys(version.changed_fields).join(', ')}
                        </div>
                      )}

                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-2"
                        onClick={() => setSelectedVersion(version.id)}
                      >
                        <RotateCcw className="h-3 w-3" />
                        Restore this version
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <AlertDialog open={!!selectedVersion} onOpenChange={() => setSelectedVersion(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Restore Document Version?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will restore the document to a previous version. The current state will be saved as a new version. This action can be undone by restoring another version.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const version = versions?.find(v => v.id === selectedVersion);
                if (version) {
                  handleRestore(version.id, version.version_number);
                }
              }}
            >
              Restore Version
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

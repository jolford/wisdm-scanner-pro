/**
 * Documents Admin Page
 * 
 * Provides system administrators with bulk document management capabilities.
 * Allows viewing, selecting, and deleting documents across the entire system.
 * 
 * Features:
 * - View all documents in the system with key metadata
 * - Bulk selection via checkboxes (select all / individual selection)
 * - Batch delete selected documents
 * - "Clear All" function to remove all documents (with confirmation)
 * - Real-time document statistics
 * - Automatic data refresh capability
 * - Status badge visualization (validated, pending, etc.)
 * - Linked project and batch information display
 * 
 * Data Displayed:
 * - File name and type
 * - Associated project and batch
 * - Validation status with color-coded badges
 * - Creation timestamp
 * 
 * Safety Features:
 * - Confirmation dialogs for destructive operations
 * - Admin-only access via authentication guard
 * - Row-level security enforcement via RLS policies
 * 
 * @requires useRequireAuth - Ensures admin authentication
 * @requires AdminLayout - Standard admin page layout
 */

import { useRequireAuth } from '@/hooks/use-require-auth';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Trash2, RefreshCw, AlertTriangle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { AdminLayout } from '@/components/admin/AdminLayout';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';

interface Document {
  id: string;
  file_name: string;
  file_type: string;
  validation_status: string;
  created_at: string;
  projects: { name: string } | null;
  batches: { batch_name: string } | null;
}

const DocumentsAdmin = () => {
  const { loading, isAdmin } = useRequireAuth(true);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDocs, setSelectedDocs] = useState<Set<string>>(new Set());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [clearAllDialogOpen, setClearAllDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!loading && isAdmin) {
      loadDocuments();
    }
  }, [loading, isAdmin]);

  const loadDocuments = async () => {
    try {
      const { data, error } = await supabase
        .from('documents')
        .select(`
          id,
          file_name,
          file_type,
          validation_status,
          created_at,
          projects!inner(name),
          batches(batch_name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDocuments(data || []);
    } catch (error: any) {
      toast.error('Failed to load documents: ' + error.message);
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedDocs(new Set(documents.map(d => d.id)));
    } else {
      setSelectedDocs(new Set());
    }
  };

  const handleSelectDoc = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedDocs);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedDocs(newSelected);
  };

  const handleDeleteSelected = async () => {
    if (selectedDocs.size === 0) return;

    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('documents')
        .delete()
        .in('id', Array.from(selectedDocs));

      if (error) throw error;

      toast.success(`Deleted ${selectedDocs.size} document(s)`);
      setSelectedDocs(new Set());
      setDeleteDialogOpen(false);
      loadDocuments();
    } catch (error: any) {
      toast.error('Failed to delete documents: ' + error.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleClearAll = async () => {
    setIsDeleting(true);
    try {
      const { error } = await supabase.from('documents').delete().neq('id', '00000000-0000-0000-0000-000000000000');

      if (error) throw error;

      toast.success('All documents cleared');
      setClearAllDialogOpen(false);
      setSelectedDocs(new Set());
      loadDocuments();
    } catch (error: any) {
      toast.error('Failed to clear documents: ' + error.message);
    } finally {
      setIsDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const allSelected = documents.length > 0 && selectedDocs.size === documents.length;

  return (
    <AdminLayout title="Documents" description="Manage all documents in the system">
      <div className="space-y-6">
        {/* Stats & Actions Bar */}
        <Card className="p-6 bg-[var(--gradient-card)] shadow-[var(--shadow-elegant)] border border-primary/10">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-2xl font-bold mb-1">{documents.length} Documents</h3>
              <p className="text-sm text-muted-foreground">
                {selectedDocs.size > 0 && `${selectedDocs.size} selected`}
              </p>
            </div>
            <div className="flex gap-3">
              {selectedDocs.size > 0 && (
                <Button
                  variant="destructive"
                  onClick={() => setDeleteDialogOpen(true)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Selected ({selectedDocs.size})
                </Button>
              )}
              <Button
                variant="outline"
                onClick={() => setClearAllDialogOpen(true)}
                className="border-destructive/50 text-destructive hover:bg-destructive/10"
              >
                <AlertTriangle className="h-4 w-4 mr-2" />
                Clear All
              </Button>
              <Button variant="outline" onClick={loadDocuments}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>
        </Card>

        {/* Documents Table */}
        <Card className="p-6 bg-[var(--gradient-card)] shadow-[var(--shadow-elegant)] border border-primary/10">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={handleSelectAll}
                  />
                </TableHead>
                <TableHead>File Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Batch</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {documents.map((doc) => (
                <TableRow key={doc.id}>
                  <TableCell>
                    <Checkbox
                      checked={selectedDocs.has(doc.id)}
                      onCheckedChange={(checked) =>
                        handleSelectDoc(doc.id, checked as boolean)
                      }
                    />
                  </TableCell>
                  <TableCell className="font-medium">{doc.file_name}</TableCell>
                  <TableCell className="uppercase text-xs">{doc.file_type}</TableCell>
                  <TableCell>{doc.projects?.name || 'N/A'}</TableCell>
                  <TableCell>{doc.batches?.batch_name || 'N/A'}</TableCell>
                  <TableCell>
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        doc.validation_status === 'validated'
                          ? 'bg-success/10 text-success'
                          : doc.validation_status === 'pending'
                          ? 'bg-warning/10 text-warning'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {doc.validation_status}
                    </span>
                  </TableCell>
                  <TableCell>
                    {new Date(doc.created_at).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {documents.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              No documents found
            </div>
          )}
        </Card>
      </div>

      {/* Delete Selected Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedDocs.size} Documents?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the selected documents. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSelected}
              disabled={isDeleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Clear All Dialog */}
      <AlertDialog open={clearAllDialogOpen} onOpenChange={setClearAllDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">
              ⚠️ Clear ALL {documents.length} Documents?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete ALL documents from the entire system. This is a
              dangerous operation and cannot be undone. Are you absolutely sure?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClearAll}
              disabled={isDeleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isDeleting ? 'Clearing...' : 'Yes, Clear Everything'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
};

export default DocumentsAdmin;

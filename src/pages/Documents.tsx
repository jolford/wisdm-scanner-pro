import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Download, FileText, Search, Trash2 } from 'lucide-react';
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
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import wisdmLogo from '@/assets/wisdm-logo.png';

interface Document {
  id: string;
  file_name: string;
  file_type: string;
  extracted_metadata: any;
  extracted_text: string;
  created_at: string;
  projects: {
    name: string;
  };
}

const Documents = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [docToDelete, setDocToDelete] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        navigate('/auth');
      } else {
        loadDocuments();
      }
    }
  }, [authLoading, user, navigate]);

  const loadDocuments = async () => {
    try {
      const { data, error } = await supabase
        .from('documents')
        .select(`
          *,
          projects(name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDocuments(data || []);
    } catch (error) {
      console.error('Error loading documents:', error);
      toast({
        title: 'Error',
        description: 'Failed to load documents',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = (docs: Document[]) => {
    if (docs.length === 0) {
      toast({
        title: 'No Documents',
        description: 'No documents to export',
        variant: 'destructive',
      });
      return;
    }

    // Get all unique metadata keys
    const metadataKeys = new Set<string>();
    docs.forEach(doc => {
      if (doc.extracted_metadata) {
        Object.keys(doc.extracted_metadata).forEach(key => metadataKeys.add(key));
      }
    });

    const headers = ['File Name', 'Project', 'Date', ...Array.from(metadataKeys)];
    const rows = docs.map(doc => {
      const row: string[] = [
        doc.file_name,
        doc.projects?.name || 'N/A',
        new Date(doc.created_at).toLocaleDateString(),
      ];
      
      metadataKeys.forEach(key => {
        row.push(doc.extracted_metadata?.[key] || '');
      });
      
      return row;
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `documents-export-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: 'Export Successful',
      description: 'Documents exported to CSV',
    });
  };

  const exportToTXT = (docs: Document[]) => {
    if (docs.length === 0) {
      toast({
        title: 'No Documents',
        description: 'No documents to export',
        variant: 'destructive',
      });
      return;
    }

    const textContent = docs.map(doc => {
      let content = `File: ${doc.file_name}\n`;
      content += `Project: ${doc.projects?.name || 'N/A'}\n`;
      content += `Date: ${new Date(doc.created_at).toLocaleDateString()}\n`;
      content += `\nExtracted Metadata:\n`;
      
      if (doc.extracted_metadata) {
        Object.entries(doc.extracted_metadata).forEach(([key, value]) => {
          content += `  ${key}: ${value}\n`;
        });
      }
      
      content += `\nExtracted Text:\n${doc.extracted_text}\n`;
      content += '\n' + '='.repeat(80) + '\n\n';
      
      return content;
    }).join('');

    const blob = new Blob([textContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `documents-export-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: 'Export Successful',
      description: 'Documents exported to TXT',
    });
  };

  const handleDeleteDoc = async (docId: string) => {
    setDocToDelete(docId);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!docToDelete) return;

    try {
      const { error } = await supabase
        .from('documents')
        .delete()
        .eq('id', docToDelete);

      if (error) throw error;

      toast({
        title: 'Document Deleted',
        description: 'Document removed successfully',
      });

      await loadDocuments();
    } catch (error) {
      console.error('Error deleting document:', error);
      toast({
        title: 'Delete Failed',
        description: 'Failed to delete document',
        variant: 'destructive',
      });
    } finally {
      setDeleteDialogOpen(false);
      setDocToDelete(null);
    }
  };

  const filteredDocuments = documents.filter(doc =>
    doc.file_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    doc.projects?.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/5">
      {/* Header */}
      <header className="border-b border-border/50 backdrop-blur-sm sticky top-0 z-10 bg-background/80">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src={wisdmLogo} alt="WISDM Logo" className="h-10 w-auto" />
              <div className="border-l border-border/50 pl-3">
                <h1 className="text-xl font-bold">Documents</h1>
              </div>
            </div>
            <Button variant="outline" onClick={() => navigate('/')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-12">
        <div className="mb-6 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search documents or projects..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <div className="flex gap-2">
            <Button onClick={() => exportToCSV(filteredDocuments)} variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
            <Button onClick={() => exportToTXT(filteredDocuments)} variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Export TXT
            </Button>
          </div>
        </div>

        {filteredDocuments.length === 0 ? (
          <Card className="p-12 text-center bg-gradient-to-br from-card to-card/80">
            <FileText className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-xl font-semibold mb-2">
              {documents.length === 0 ? 'No Documents Yet' : 'No Matching Documents'}
            </h3>
            <p className="text-muted-foreground">
              {documents.length === 0 
                ? 'Upload and scan documents to see them here' 
                : 'Try a different search term'}
            </p>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredDocuments.map((doc) => (
              <Card key={doc.id} className="p-6 bg-gradient-to-br from-card to-card/80 shadow-[var(--shadow-elegant)]">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold">{doc.file_name}</h3>
                    <p className="text-sm text-muted-foreground">
                      Project: {doc.projects?.name || 'N/A'} • {new Date(doc.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                      {doc.file_type}
                    </span>
                    <Button variant="destructive" size="icon" onClick={() => handleDeleteDoc(doc.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {doc.extracted_metadata && Object.keys(doc.extracted_metadata).length > 0 && (
                  <div className="bg-muted/50 rounded-lg p-4 mb-4">
                    <p className="text-sm font-medium mb-2">Extracted Metadata:</p>
                    <div className="grid md:grid-cols-2 gap-2">
                      {Object.entries(doc.extracted_metadata).map(([key, value]) => (
                        <div key={key} className="text-sm">
                          <span className="font-medium">{key}:</span>{' '}
                          <span className="text-muted-foreground">{value as string}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {doc.extracted_text && (
                  <div className="bg-muted/30 rounded-lg p-4">
                    <p className="text-sm font-medium mb-2">Extracted Text Preview:</p>
                    <p className="text-sm text-muted-foreground line-clamp-3">
                      {doc.extracted_text}
                    </p>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </main>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Document?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the document.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Documents;

import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useRequireAuth } from '@/hooks/use-require-auth';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { GitCompare, ArrowLeft, ArrowRight, FileText, Calendar, User } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Document {
  id: string;
  file_name: string;
  document_type: string;
  extracted_metadata: any;
  validation_status: string;
  created_at: string;
  validated_at: string | null;
  validated_by: string | null;
}

interface FieldChange {
  id: string;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  change_type: string;
  created_at: string;
  user_profile?: {
    full_name: string;
    email: string;
  };
}

export default function DocumentComparison() {
  useRequireAuth(true);
  
  const [searchParams] = useSearchParams();
  const docIdFromUrl = searchParams.get('id');
  
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string>(docIdFromUrl || '');
  const [document, setDocument] = useState<Document | null>(null);
  const [fieldChanges, setFieldChanges] = useState<FieldChange[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadDocuments();
  }, []);

  useEffect(() => {
    if (selectedDocId) {
      loadDocumentAndChanges();
    }
  }, [selectedDocId]);

  const loadDocuments = async () => {
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('id, file_name, document_type, validation_status, extracted_metadata, created_at, validated_at, validated_by')
        .not('validated_at', 'is', null)
        .order('validated_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setDocuments(data || []);
    } catch (error) {
      console.error('Error loading documents:', error);
      toast.error('Failed to load documents');
    }
  };

  const loadDocumentAndChanges = async () => {
    setIsLoading(true);
    try {
      // Load document details
      const { data: docData, error: docError } = await supabase
        .from('documents')
        .select('*')
        .eq('id', selectedDocId)
        .single();

      if (docError) throw docError;
      setDocument(docData);

      // Load field changes
      const { data: changesData, error: changesError } = await supabase
        .from('field_changes')
        .select('*')
        .eq('document_id', selectedDocId)
        .order('created_at', { ascending: false });

      if (changesError) throw changesError;

      // Fetch user profiles
      if (changesData) {
        const userIds = [...new Set(changesData.map(c => c.user_id))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', userIds);

        const profileMap = new Map(profiles?.map(p => [p.id, p]));
        
        const changesWithProfiles = changesData.map(change => ({
          ...change,
          user_profile: profileMap.get(change.user_id) || { full_name: 'Unknown', email: '' },
        }));

        setFieldChanges(changesWithProfiles);
      }
    } catch (error) {
      console.error('Error loading document details:', error);
      toast.error('Failed to load document details');
    } finally {
      setIsLoading(false);
    }
  };

  // Reconstruct original metadata before changes
  const getOriginalMetadata = () => {
    if (!document) return {};
    
    const original = { ...(document.extracted_metadata || {}) };
    
    // Apply changes in reverse to get original state
    [...fieldChanges].reverse().forEach(change => {
      if (change.change_type === 'update' && change.old_value !== null) {
        original[change.field_name] = change.old_value;
      }
    });
    
    return original;
  };

  const originalMetadata = getOriginalMetadata();
  const currentMetadata = document?.extracted_metadata || {};
  const allFields = new Set([...Object.keys(originalMetadata), ...Object.keys(currentMetadata)]);

  return (
    <AdminLayout 
      title="Document Comparison"
      description="Side-by-side view of before and after validation"
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <GitCompare className="h-8 w-8" />
              Document Comparison
            </h1>
            <p className="text-muted-foreground mt-1">
              View changes made during validation
            </p>
          </div>
          <Select value={selectedDocId} onValueChange={setSelectedDocId}>
            <SelectTrigger className="w-[300px]">
              <SelectValue placeholder="Select a document..." />
            </SelectTrigger>
            <SelectContent>
              {documents.map((doc) => (
                <SelectItem key={doc.id} value={doc.id}>
                  {doc.file_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : !document ? (
          <Card>
            <CardContent className="py-12">
              <p className="text-center text-muted-foreground">
                Select a document to view comparison
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Document Info */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      {document.file_name}
                    </CardTitle>
                    <CardDescription className="mt-2 space-y-1">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-3 w-3" />
                        Validated {formatDistanceToNow(new Date(document.validated_at!), { addSuffix: true })}
                      </div>
                    </CardDescription>
                  </div>
                  <Badge variant={
                    document.validation_status === 'validated' ? 'default' :
                    document.validation_status === 'rejected' ? 'destructive' :
                    'secondary'
                  }>
                    {document.validation_status}
                  </Badge>
                </div>
              </CardHeader>
            </Card>

            {/* Side-by-Side Comparison */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* Before (Original) */}
              <Card className="border-red-200 bg-red-50/30">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-red-700">
                    <ArrowLeft className="h-5 w-5" />
                    Before Validation
                  </CardTitle>
                  <CardDescription>
                    Original extracted data
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {Array.from(allFields).sort().map((field) => {
                    const value = originalMetadata[field];
                    const hasChanged = fieldChanges.some(c => c.field_name === field);
                    
                    return (
                      <div key={field} className={`p-3 rounded-lg ${
                        hasChanged ? 'bg-red-100 border-2 border-red-300' : 'bg-background'
                      }`}>
                        <div className="text-sm font-medium text-muted-foreground mb-1">
                          {field}
                        </div>
                        <div className="font-mono text-sm">
                          {value || <span className="text-muted-foreground italic">(empty)</span>}
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>

              {/* After (Current) */}
              <Card className="border-green-200 bg-green-50/30">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-green-700">
                    <ArrowRight className="h-5 w-5" />
                    After Validation
                  </CardTitle>
                  <CardDescription>
                    Corrected/validated data
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {Array.from(allFields).sort().map((field) => {
                    const value = currentMetadata[field];
                    const hasChanged = fieldChanges.some(c => c.field_name === field);
                    
                    return (
                      <div key={field} className={`p-3 rounded-lg ${
                        hasChanged ? 'bg-green-100 border-2 border-green-300' : 'bg-background'
                      }`}>
                        <div className="text-sm font-medium text-muted-foreground mb-1">
                          {field}
                        </div>
                        <div className="font-mono text-sm">
                          {value || <span className="text-muted-foreground italic">(empty)</span>}
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </div>

            {/* Change Timeline */}
            {fieldChanges.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Change Timeline</CardTitle>
                  <CardDescription>
                    History of all modifications
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {fieldChanges.map((change) => (
                      <div key={change.id} className="flex gap-4 items-start">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <User className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">
                              {change.user_profile?.full_name || 'Unknown User'}
                            </span>
                            <Badge variant="outline" className="text-xs">
                              {change.change_type}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(change.created_at), { addSuffix: true })}
                            </span>
                          </div>
                          <div className="text-sm">
                            Updated <span className="font-medium text-primary">{change.field_name}</span>
                          </div>
                          {change.change_type === 'update' && (
                            <div className="flex gap-2 text-xs">
                              <span className="text-red-600">
                                {change.old_value || '(empty)'}
                              </span>
                              <span>→</span>
                              <span className="text-green-600">
                                {change.new_value || '(empty)'}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </AdminLayout>
  );
}

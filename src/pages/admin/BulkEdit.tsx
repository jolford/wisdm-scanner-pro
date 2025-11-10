import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useRequireAuth } from '@/hooks/use-require-auth';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Edit3, Save, X, Search, CheckSquare } from 'lucide-react';

interface Document {
  id: string;
  file_name: string;
  document_type: string;
  extracted_metadata: any;
  validation_status: string;
  created_at: string;
}

export default function BulkEdit() {
  useRequireAuth(true);
  
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDocs, setSelectedDocs] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [fieldName, setFieldName] = useState('');
  const [fieldValue, setFieldValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    loadDocuments();
  }, [searchTerm, statusFilter]);

  const loadDocuments = async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('documents')
        .select('id, file_name, document_type, extracted_metadata, validation_status, created_at')
        .order('created_at', { ascending: false })
        .limit(100);

      if (statusFilter !== 'all') {
        query = query.eq('validation_status', statusFilter as any);
      }

      if (searchTerm) {
        query = query.ilike('file_name', `%${searchTerm}%`);
      }

      const { data, error } = await query;

      if (error) throw error;
      setDocuments(data || []);
    } catch (error) {
      console.error('Error loading documents:', error);
      toast.error('Failed to load documents');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleDocSelection = (docId: string) => {
    const newSelected = new Set(selectedDocs);
    if (newSelected.has(docId)) {
      newSelected.delete(docId);
    } else {
      newSelected.add(docId);
    }
    setSelectedDocs(newSelected);
  };

  const selectAll = () => {
    if (selectedDocs.size === documents.length) {
      setSelectedDocs(new Set());
    } else {
      setSelectedDocs(new Set(documents.map(d => d.id)));
    }
  };

  const handleBulkUpdate = async () => {
    if (selectedDocs.size === 0) {
      toast.error('Please select at least one document');
      return;
    }

    if (!fieldName || !fieldValue) {
      toast.error('Please enter both field name and value');
      return;
    }

    setIsSaving(true);
    try {
      const updates = Array.from(selectedDocs).map(async (docId) => {
        const doc = documents.find(d => d.id === docId);
        if (!doc) return;

        const updatedMetadata = {
          ...(doc.extracted_metadata || {}),
          [fieldName]: fieldValue,
        };

        const { error } = await supabase
          .from('documents')
          .update({ extracted_metadata: updatedMetadata })
          .eq('id', docId);

        if (error) throw error;

        // Track field change
        await supabase.rpc('track_field_change', {
          _document_id: docId,
          _field_name: fieldName,
          _old_value: doc.extracted_metadata?.[fieldName] || null,
          _new_value: fieldValue,
          _change_type: 'update',
        });
      });

      await Promise.all(updates);

      toast.success(`Successfully updated ${selectedDocs.size} documents`);
      setSelectedDocs(new Set());
      setFieldName('');
      setFieldValue('');
      loadDocuments();
    } catch (error) {
      console.error('Error updating documents:', error);
      toast.error('Failed to update documents');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AdminLayout 
      title="Bulk Edit Mode"
      description="Edit multiple document fields simultaneously"
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Edit3 className="h-8 w-8" />
              Bulk Edit Mode
            </h1>
            <p className="text-muted-foreground mt-1">
              Select documents and update fields in bulk
            </p>
          </div>
          {selectedDocs.size > 0 && (
            <Badge variant="secondary" className="text-lg px-4 py-2">
              {selectedDocs.size} selected
            </Badge>
          )}
        </div>

        {/* Bulk Edit Form */}
        {selectedDocs.size > 0 && (
          <Card className="border-primary">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Edit3 className="h-5 w-5" />
                Edit Selected Documents
              </CardTitle>
              <CardDescription>
                Apply changes to {selectedDocs.size} selected document(s)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fieldName">Field Name</Label>
                  <Input
                    id="fieldName"
                    placeholder="e.g., invoice_number, vendor_name"
                    value={fieldName}
                    onChange={(e) => setFieldName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fieldValue">New Value</Label>
                  <Input
                    id="fieldValue"
                    placeholder="Enter the new value"
                    value={fieldValue}
                    onChange={(e) => setFieldValue(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button 
                  onClick={handleBulkUpdate}
                  disabled={isSaving || !fieldName || !fieldValue}
                  className="flex-1"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {isSaving ? 'Saving...' : `Update ${selectedDocs.size} Document(s)`}
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => {
                    setSelectedDocs(new Set());
                    setFieldName('');
                    setFieldValue('');
                  }}
                >
                  <X className="h-4 w-4 mr-2" />
                  Clear
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by filename..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="validated">Validated</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={selectAll}>
                <CheckSquare className="h-4 w-4 mr-2" />
                {selectedDocs.size === documents.length ? 'Deselect All' : 'Select All'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Documents List */}
        <Card>
          <CardHeader>
            <CardTitle>Documents</CardTitle>
            <CardDescription>
              Select documents to edit in bulk
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : documents.length === 0 ? (
              <p className="text-center text-muted-foreground py-12">
                No documents found
              </p>
            ) : (
              <div className="space-y-2">
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    className={`p-4 rounded-lg border-2 transition-all cursor-pointer hover:shadow-md ${
                      selectedDocs.has(doc.id)
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                    onClick={() => toggleDocSelection(doc.id)}
                  >
                    <div className="flex items-center gap-4">
                      <Checkbox
                        checked={selectedDocs.has(doc.id)}
                        onCheckedChange={() => toggleDocSelection(doc.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <div className="flex-1">
                        <div className="font-medium">{doc.file_name}</div>
                        <div className="text-sm text-muted-foreground">
                          Type: {doc.document_type || 'Unknown'} • {new Date(doc.created_at).toLocaleDateString()}
                        </div>
                      </div>
                      <Badge variant={
                        doc.validation_status === 'validated' ? 'default' :
                        doc.validation_status === 'rejected' ? 'destructive' :
                        'secondary'
                      }>
                        {doc.validation_status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
